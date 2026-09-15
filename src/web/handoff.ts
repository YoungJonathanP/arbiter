import * as http from 'node:http';
import { randomBytes } from 'node:crypto';
import { assertMutable } from '../cli/data.js';
import { draftCheckpoint, previewHandoff, captureCheckpoint, exportHandoff } from '../core/handoff.js';
import { inputReviewView, captureQuickNote, setHumanTaskStatus, undoHumanTaskStatus, beginStoredInputReview, saveInputReview, linkInput, reconcileInputIntent, previewInputIncorporation, applyInputIncorporation, saveAppointment, createConnectedPerson, connectInputEntity, disconnectInputEntity, inputRelationships, inputSourcePreview } from '../core/input-storage.js';
import type { PersonalAccess } from './personal-access.js';
import { CommitConflict } from '../core/commit.js';
import { previewPersonalContinuation, exportPersonalContinuation, finishPersonalContinuation, type PersonalContinuation } from '../core/personal-continuation.js';

/** Local browser writes require a per-process token and a loopback Host/peer.
 * Origin checks also prevent cross-site requests and DNS rebinding. */
export function handoffApi(dir: string, personal?: PersonalAccess) {
  const token = randomBytes(32).toString('hex');
  const incorporations = new Map<string, { ref: string; actor: string; expires: number; value: ReturnType<typeof previewInputIncorporation> }>();
  const continuations = new Map<string, { ref: string; actor: string; expires: number; exported: boolean; value: PersonalContinuation }>();
  const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const send = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    const host = req.headers.host ?? '';
    if (req.method !== 'POST') return send(405, { error: 'Use POST' });
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
      || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)
      || host.split(':').at(-1) !== String(req.socket.localPort)
      || (req.headers.origin && req.headers.origin !== `http://${host}`)
      || req.headers['x-arbiter-token'] !== token
      || req.headers['content-type'] !== 'application/json') return send(403, { error: 'Local same-origin session required; reload the task page' });
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const part of req) {
        const chunk = Buffer.from(part); size += chunk.length; chunks.push(chunk);
        if (size > 1024 * 1024) return send(413, { error: 'Request exceeds 1 MiB' });
      }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      // Actor is the local operator capability, never a supplied person/account.
      // The loopback token authorizes this local session; it grants no private access.
      const actor = personal ? personal.authenticate(req.headers.authorization) : 'local-operator';
      if (!actor) return send(401, { error: 'Personal authentication required' });
      const access = personal?.policy;
      if (typeof input.action === 'string' && input.action.startsWith('continuation-')) {
        if (!personal || !access) return send(403, { error: 'Personal authentication required' });
        for (const [id, entry] of continuations) if (entry.expires < Date.now()) continuations.delete(id);
        if (input.action === 'continuation-preview') {
          const id = randomBytes(32).toString('hex');
          const value = previewPersonalContinuation(dir, { ...input.request, ref: input.ref }, actor, access, id);
          if (continuations.size >= 32) continuations.delete(continuations.keys().next().value!);
          continuations.set(id, { ref: input.ref, actor, expires: Date.now() + 15 * 60000, exported: false, value });
          return send(200, { id, packet: value.packet, bytes: value.bytes, allowed: value.allowed, warning: value.warning });
        }
        const entry = continuations.get(input.previewId);
        if (!entry || entry.ref !== input.ref || entry.actor !== actor) throw new Error('Continuation expired or unavailable; preview again');
        if (input.action === 'continuation-export') {
          const packet = exportPersonalContinuation(dir, entry.value, actor, access);
          entry.exported = true;
          return send(200, { packet });
        }
        if (input.action === 'continuation-review') {
          assertMutable(dir);
          if (!entry.exported) throw new Error('Export and read the exact personal packet before recording decisions');
          const result = finishPersonalContinuation(dir, entry.value, actor, access, input.decisions);
          continuations.delete(input.previewId);
          return send(200, result);
        }
        throw new Error('Unknown continuation action');
      }
      if (personal && !['input-view', 'input-review', 'input-incorporation-preview', 'input-incorporation-apply', 'input-reconcile', 'input-source-preview', 'input-appointment', 'input-link', 'input-note', 'input-person', 'input-connect', 'input-disconnect', 'input-status', 'input-undo'].includes(input.action))
        return send(403, { error: 'This action is unavailable in the personal app' });
      if (typeof input.action === 'string' && input.action.startsWith('input-')) {
        if (input.action !== 'input-view') assertMutable(dir);
        switch (input.action) {
          case 'input-view': break;
          case 'input-source-preview': return send(200, inputSourcePreview(dir, input.ref, actor, input.source, access));
          case 'input-incorporation-preview': {
            const value = previewInputIncorporation(dir, input.ref, actor, input.input, input.basis, input.incorporation, input.reason, access);
            for (const [id, entry] of incorporations) if (entry.expires < Date.now()) incorporations.delete(id);
            if (incorporations.size >= 32) incorporations.delete(incorporations.keys().next().value!);
            const id = randomBytes(32).toString('hex');
            incorporations.set(id, { ref: input.ref, actor, expires: Date.now() + 15 * 60000, value });
            return send(200, { id, before: value.before, after: value.after });
          }
          case 'input-incorporation-apply': {
            const entry = incorporations.get(input.previewId); incorporations.delete(input.previewId);
            if (!entry || entry.ref !== input.ref || entry.actor !== actor || entry.expires < Date.now()) throw new Error('Preview expired; review again');
            applyInputIncorporation(dir, input.ref, actor, entry.value, access); break;
          }
          case 'input-appointment': saveAppointment(dir, input.ref, actor, input.basis, input.appointment, undefined, access); break;
          case 'input-person': createConnectedPerson(dir, input.ref, actor, input.basis, input.title, input.role, access); break;
          case 'input-connect': connectInputEntity(dir, input.ref, input.entity, input.role, input.basis, actor, undefined, access); break;
          case 'input-disconnect': disconnectInputEntity(dir, input.ref, input.id, input.basis, actor, undefined, access); break;
          case 'input-note': captureQuickNote(dir, input.ref, input.note, input.basis, actor, { eventDate: input.eventDate, personal: !!personal }, access); break;
          case 'input-link': linkInput(dir, input.ref, input.source, input.basis, actor, undefined, access); break;
          case 'input-status': setHumanTaskStatus(dir, input.ref, actor, input.basis, input.status, input.checklist, undefined, access); break;
          case 'input-undo': undoHumanTaskStatus(dir, input.ref, actor, input.basis, undefined, access); break;
          case 'input-reconcile': reconcileInputIntent(dir, input.ref, actor, input.basis, access); break;
          case 'input-review': {
            if (!['presented', 'deferred', 'dismissed'].includes(input.disposition)) throw new Error('Select a review disposition');
            const preview = beginStoredInputReview(dir, input.ref, actor, [input.input], access);
            saveInputReview(dir, input.ref, actor, { ...preview, basis: input.basis },
              [{ input: input.input, disposition: input.disposition, reason: input.reason }], {}, access);
            break;
          }
          default: throw new Error('Unknown input action');
        }
        return send(200, { ...inputReviewView(dir, input.ref, actor, access), relationships: inputRelationships(dir, input.ref, actor, access) });
      }
      switch (input.action) {
        case 'draft': return send(200, { checkpoint: draftCheckpoint(dir, input.ref) });
        case 'preview': return send(200, previewHandoff(dir, input.request));
        case 'capture':
          assertMutable(dir);
          return send(200, captureCheckpoint(dir, input.preview));
        case 'export': return send(200, { packet: exportHandoff(dir, input.preview) });
        default: return send(400, { error: 'Unknown handoff action' });
      }
    } catch (error) {
      return send(error instanceof CommitConflict ? 409 : 400, { error: error instanceof Error ? error.message : 'Handoff operation failed' });
    }
  };
  return { token, handle };
}

export function handoffPanel(ref: string, owner: string, token: string, esc: (text: string) => string): string {
  return `<details id="handoff" data-ref="${esc(ref)}" data-token="${token}"><summary>Task handoff — edit, preview, copy or export</summary>
  <p>Review the current version or edit a draft. Capture saves owner and checkpoint changes. Dependency states and evidence are editable in the draft’s predicates.</p>
  <button type="button" id="handoff-current">Preview current version</button>
  <button type="button" id="handoff-draft">Edit checkpoint</button>
  <div id="handoff-editor" hidden>
    <p><label>Accountable owner <input id="handoff-owner" value="${esc(owner)}"></label></p>
    <p><label>Next actions and stopping condition<br><textarea id="handoff-next" rows="4" style="width:100%"></textarea></label></p>
    <p><label>Checkpoint fields, constraints and dependency predicates<br><textarea id="handoff-text" rows="18" spellcheck="false" style="width:100%"></textarea></label></p>
    <button type="button" id="handoff-preview">Preview draft and changes</button>
  </div>
  <details><summary>Export format, offline context, source expansion and extraction</summary>
    <p>Options JSON: format (markdown/json), offline, expand (selected KB paths), observations, override ({maxBytes, reason}), extraction ({surface: Summary or ^anchor, replacement}). Extraction preserves original bytes in linked detail and carries extracted rules into the checkpoint.</p>
    <textarea id="handoff-options" rows="5" style="width:100%">{"format":"markdown"}</textarea>
  </details>
  <p id="handoff-status" role="status" aria-live="polite"></p>
  <div id="handoff-result" hidden>
    <details><summary>Task and checkpoint changes</summary><pre id="handoff-changes"></pre></details>
    <details><summary>Selected sources and reasons</summary><p>To include full contents, add only the needed KB paths to <code>expand</code> in the options above and preview again. Each reason comes from the checkpoint input’s purpose. Related files and older checkpoints are never selected automatically.</p><pre id="handoff-sources" style="white-space:pre-wrap"></pre></details>
    <p>Exact packet preview — includes revisions, source manifest, readiness, byte count and omitted context.</p>
    <pre id="handoff-packet" style="white-space:pre-wrap"></pre>
    <button type="button" id="handoff-capture" disabled>Capture reviewed draft</button>
    <button type="button" id="handoff-copy" disabled>Copy handoff</button>
    <button type="button" id="handoff-download" disabled>Export file</button>
  </div>
  </details>`;
}

export const HANDOFF_JS = String.raw`
(function () {
  var panel = document.getElementById('handoff');
  if (!panel) return;
  var get = function (id) { return document.getElementById('handoff-' + id); };
  var ref = panel.getAttribute('data-ref'), preview = null, busy = false;
  function buttons() {
    ['text', 'owner', 'next', 'options'].forEach(function (name) { get(name).disabled = busy; });
    get('capture').disabled = busy || !preview || !preview.request.checkpoint;
    get('copy').disabled = get('download').disabled = busy || !preview || !!preview.request.checkpoint || !preview.allowed;
  }
  function invalidate() { preview = null; get('result').hidden = true; buttons(); }
  async function api(body) {
    var response = await fetch('/api/handoff', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-arbiter-token': panel.getAttribute('data-token')
    }, body: JSON.stringify(body) });
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Handoff request failed');
    return result;
  }
  function options() { var value = JSON.parse(get('options').value); delete value.checkpoint; delete value.owner; return Object.assign(value, { ref: ref }); }
  function show(value) {
    preview = value; get('result').hidden = false;
    get('packet').textContent = value.packet;
    get('sources').textContent = value.assessment.inputs.map(function (input) {
      return input.source + '\n  Reason: ' + input.purpose + '\n  ' + (input.source.indexOf('kb:') !== 0 ? 'Revision only; resolve externally' : (input.source === 'kb:' + ref + '.md' || value.request.offline || (value.request.expand || []).indexOf(input.source.slice(3)) >= 0) ? 'Full contents selected' : input.source === 'kb:PROTOCOL.md' ? 'Checkpoint rules excerpt included' : 'Revision only');
    }).join('\n\n');
    get('changes').textContent = 'CURRENT TASK\n' + value.taskBefore + '\nPROPOSED TASK\n' + value.taskAfter + '\nCURRENT CHECKPOINT\n' + (value.checkpointBefore || '(none)') + '\nPROPOSED CHECKPOINT\n' + value.checkpoint;
    get('status').textContent = value.assessment.readiness + ' · ' + value.bytes + ' UTF-8 bytes\n' + value.assessment.reasons.concat(value.diagnostics).join('\n');
    buttons();
  }
  async function run(work) {
    if (busy) return; busy = true; buttons();
    try { await work(); } catch (error) { invalidate(); get('status').textContent = error.message + ' Refresh and review before continuing.'; }
    finally { busy = false; buttons(); }
  }
  get('current').onclick = function () { run(async function () {
    invalidate(); get('editor').hidden = true;
    var request = options(); delete request.extraction;
    show(await api({ action: 'preview', request: request }));
  }); };
  get('draft').onclick = function () { run(async function () {
    invalidate(); var result = await api({ action: 'draft', ref: ref });
    get('text').value = result.checkpoint; get('editor').hidden = false;
    var next = /^## Next actions\n([\s\S]*?)(?=^## |^<!-- arbiter:checkpoint)/m.exec(result.checkpoint);
    get('next').value = next ? next[1].trim() : '';
    get('status').textContent = 'Edit observations, constraints, owner and dependency predicates, then preview.';
  }); };
  get('next').oninput = function () {
    get('text').value = get('text').value.replace(/^## Next actions\n[\s\S]*?(?=^## |^<!-- arbiter:checkpoint)/m,
      '## Next actions\n\n' + get('next').value + '\n\n'); invalidate();
  };
  ['text', 'owner', 'options'].forEach(function (name) { get(name).oninput = invalidate; });
  get('preview').onclick = function () { run(async function () {
    invalidate(); var request = options(); request.checkpoint = get('text').value; request.owner = get('owner').value;
    show(await api({ action: 'preview', request: request }));
  }); };
  get('capture').onclick = function () { run(async function () {
    var reviewed = preview;
    await api({ action: 'capture', preview: reviewed });
    var request = Object.assign({}, reviewed.request); delete request.checkpoint; delete request.owner; delete request.extraction;
    var current = await api({ action: 'preview', request: request });
    show(current); get('editor').hidden = true;
    if (current.packet !== reviewed.packet) { invalidate(); throw new Error('Saved. Packet changed; preview the current version'); }
    get('status').textContent += '\nCaptured. Copy and export use these exact reviewed bytes.';
  }); };
  async function exact() {
    var reviewed = preview;
    var result = await api({ action: 'export', preview: reviewed });
    if (!preview || preview !== reviewed || result.packet !== reviewed.packet) throw new Error('Preview changed');
    return result.packet;
  }
  get('copy').onclick = function () { run(async function () {
    var packet = await exact(); await navigator.clipboard.writeText(packet);
    get('status').textContent = 'Copied the exact reviewed packet.';
  }); };
  get('download').onclick = function () { run(async function () {
    var packet = await exact();
    var format = preview.request.format === 'json' ? 'json' : 'md';
    var blob = new Blob([packet], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = ref.split('/').pop() + '-handoff.' + format;
    link.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    get('status').textContent = 'Exported the exact reviewed packet.';
  }); };
})();
`;

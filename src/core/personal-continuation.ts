// Ephemeral authenticated continuation; never persist private packets as shared
// checkpoints. The host supplies the principal and retains previews, not callers.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { contextBudget } from './checkpoint.js';
import { CommitConflict } from './commit.js';
import { listStaged } from './corpus.js';
import { fmGet } from './fm.js';
import { parseDocFile } from './parse.js';
import { previewHandoff, exportHandoff, type HandoffRequest } from './handoff.js';
import { readInputState, beginStoredInputReview, inputReviewView, saveInputReview, type InputAccessPolicy } from './input-storage.js';
import type { InputRevision } from './input-review.js';

export type ContinuationRequest = Pick<HandoffRequest, 'ref' | 'expand' | 'offline' | 'observations' | 'override'>;
export type ContinuationDecision = { input: InputRevision; disposition: 'presented' | 'deferred' | 'dismissed'; reason: string };

export function previewPersonalContinuation(dir: string, request: ContinuationRequest, actor: string, access: InputAccessPolicy, session: string) {
  // Copy an allowlist: draft/owner/packet/actor/grants are never accepted here.
  const { ref, expand, offline, observations, override } = request;
  const req: ContinuationRequest = JSON.parse(JSON.stringify({ ref, expand, offline, observations, override }));
  const protocol = fs.readFileSync(path.join(dir, 'PROTOCOL.md'), 'utf8');
  if (fmGet(parseDocFile(protocol).fm, 'version') !== '0.4.17')
    throw new Error('Personal continuation requires explicit protocol 0.4.17 adoption');
  const rules = /^## Authenticated agent input continuation\r?\n[\s\S]*?(?=^## |$(?![\s\S]))/m.exec(protocol)?.[0];
  if (!rules) throw new Error('Installed protocol lacks personal continuation rules');
  const state = readInputState(dir, ref, access);
  if (state.replay.pending || listStaged(dir, `${ref}.md`).length)
    throw new CommitConflict('Reconcile incomplete actions and staged proposals before continuation');
  // The canonical checkpoint must be safe for shared export. Restricted tasks or
  // checkpoint dependencies fail closed through the ordinary handoff reader.
  const shared = previewHandoff(dir, { ...req, format: 'json' });
  const view = inputReviewView(dir, ref, actor, access);
  const review = beginStoredInputReview(dir, ref, actor, view.pending, access);
  if (state.basis !== view.basis || review.basis !== view.basis)
    throw new CommitConflict('Input changed during preview; refresh');
  // Do not duplicate shared source bodies; preserve the full shared packet in
  // one envelope, with all other authorized bodies and exact selection metadata.
  const handoff = JSON.parse(shared.packet);
  delete handoff.bytes; // Only the outer envelope measures emitted context.
  // The canonical checkpoint already contains every manifest source, revision
  // and purpose. Reference those fields instead of emitting a second copy. All
  // source bytes/constraints remain intact; inclusion is explicit in sources.
  handoff.manifest = 'Read the included checkpoint inputs for source/revision/purpose. sources holds full selected bytes; PROTOCOL.md#checkpoints is an excerpt; other inputs are revision-only.';
  if (handoff.sources['PROTOCOL.md'] !== protocol)
    handoff.sources['PROTOCOL.md#authenticated-agent-input-continuation'] = rules;
  const inputs = view.pending.map(input => {
    const key = `linked:${input.source}@${input.revision}`;
    const { bytes, ...metadata } = input;
    return { ...metadata, ...(handoff.sources[key] === bytes ? { included: key } : { bytes }) };
  });
  const metadata = {
    version: 1, session, audience: 'authenticated principal only', reviewer: actor,
    reviewRequired: inputs.length > 0, override: req.override ?? null, handoff, inputs,
  };
  const render = (bytes: number) => JSON.stringify({ ...metadata, bytes }) + '\n';
  let packet = render(0);
  for (let i = 0; i < 10; i++) { const next = render(Buffer.byteLength(packet)); if (next === packet) break; packet = next; }
  const budget = contextBudget(packet, req.override);
  // Re-observe after constructing the complete packet. External files are not
  // locked atomically; the host rechecks again on export and receipt submission.
  if (readInputState(dir, ref, access).basis !== review.basis)
    throw new CommitConflict('Input changed during preview; refresh');
  return { request: req, actor, session, shared, review, packet, ...budget };
}

export type PersonalContinuation = ReturnType<typeof previewPersonalContinuation>;

export function exportPersonalContinuation(dir: string, preview: PersonalContinuation, actor: string, access: InputAccessPolicy) {
  if (preview.actor !== actor) throw new Error('Continuation unavailable');
  const current = previewPersonalContinuation(dir, preview.request, actor, access, preview.session);
  if (current.packet !== preview.packet || current.review.basis !== preview.review.basis)
    throw new CommitConflict('Continuation changed; preview and review again');
  exportHandoff(dir, preview.shared);
  if (!current.allowed) throw new Error('Complete personal packet exceeds reviewed byte budget');
  return current.packet;
}

export function finishPersonalContinuation(dir: string, preview: PersonalContinuation, actor: string, access: InputAccessPolicy, decisions: ContinuationDecision[]) {
  exportPersonalContinuation(dir, preview, actor, access);
  if (!Array.isArray(decisions) || decisions.length !== preview.review.review.observed.length
    || decisions.some(d => !['presented', 'deferred', 'dismissed'].includes(d.disposition)))
    throw new Error('Explicit decisions required for every selected revision');
  // Stored writer rechecks task/source/receipt/policy CAS under the commit lock.
  // It refuses duplicate, unobserved or changed revisions and preserves history.
  return saveInputReview(dir, preview.request.ref, actor, preview.review, decisions, {}, access);
}

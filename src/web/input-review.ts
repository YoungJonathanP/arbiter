export function inputPanel(ref: string, token: string, esc: (text: string) => string) {
  return `<section id="input-review" data-ref="${esc(ref)}" data-token="${token}">
  <h2>Task actions and linked notes</h2>
  <p><label>Status <select id="input-status-choice"><option>todo</option><option>in-flight</option><option>blocked</option><option>done</option><option>dropped</option></select></label> <button id="input-set-status">Save status</button></p>
  <p><button id="input-refresh">Review linked notes</button> <button id="input-done">Done</button> <button id="input-undo">Undo last status action</button></p>
  <p><label><input type="checkbox" id="input-complete"> Mark unfinished checklist steps complete when marking Done</label></p>
  <p>Pending proposals must be resolved before changing status.</p>
  <label>Shared quick note<br><textarea id="input-note" rows="3" style="width:100%"></textarea></label>
  <p><label>Event date (optional) <input id="input-date" type="date"></label> <button id="input-capture">Save linked note</button></p>
  <p id="input-status" role="status" aria-live="polite">Open linked notes before making changes.</p>
  <p><label>Existing note or meeting ref <input id="input-source"></label> <button id="input-link">Link to this task</button></p>
  <div id="input-list"></div>
  <details><summary>Appointment</summary>
    <p><label>Title <input id="input-appointment-title"></label> <label>Date <input type="date" id="input-appointment-date"></label></p>
    <p><label>Time and timezone <input id="input-appointment-time" placeholder="10:00 America/Los_Angeles"></label></p>
    <label>Details <textarea id="input-appointment-details"></textarea></label>
    <p><label>Existing linked meeting ref (optional) <input id="input-appointment-source"></label></p>
    <button id="input-appointment-preview">Read existing appointment</button><pre id="input-appointment-before" style="white-space:pre-wrap"></pre>
    <button id="input-appointment">Save appointment</button>
    <p>Schedule corrections preserve earlier text. An appointment does not change task status.</p>
  </details>
  <details><summary>Connected people and entities</summary>
    <div id="input-relationships"></div>
    <p><label>Name for new card <input id="input-person-title"></label> <button id="input-person">Create and connect</button></p>
    <p><label>Existing entity ref <input id="input-entity"></label> <button id="input-connect">Connect existing card</button></p>
    <label>Relationship <select id="input-role"><option>contributor</option><option>reviewer</option><option>stakeholder</option><option>owner</option><option>note-author</option></select></label>
    <p>Connecting a card does not assign responsibility or grant access.</p>
  </details>
  <button id="input-reconcile" hidden>Recheck interrupted action</button>
  </section>`;
}
export const INPUT_REVIEW_JS = String.raw`
(function () {
  var panel = document.getElementById('input-review'); if (!panel) return;
  var get = function (name) { return document.getElementById('input-' + name) || {}; };
  var view = null, appointmentPreview = null, busy = false, ref = panel.getAttribute('data-ref');
  async function api(action, fields) {
    var response = await fetch(panel.getAttribute('data-api') || '/api/handoff', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-arbiter-token': panel.getAttribute('data-token')
    }, body: JSON.stringify(Object.assign({ action: action, ref: ref, basis: view && view.basis }, fields || {})) });
    var result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  }
  function buttons() {
    panel.querySelectorAll('button, input, textarea, select').forEach(function (control) {
      control.disabled = busy || (control.id !== 'input-refresh' && !view);
    });
  }
  function show(next) {
    view = next; appointmentPreview = null; get('appointment-before').textContent = ''; get('list').replaceChildren(); get('reconcile').hidden = !view.reconciliationRequired;
    get('status').textContent = 'Last linked-input review: ' + (view.lastReview || 'none') + '. ' + view.pending.length + ' actionable notes.';
    view.pending.forEach(function (input) {
      var article = document.createElement('article'), heading = document.createElement('h3'), body = document.createElement('pre');
      heading.textContent = input.source + ' · ' + input.disposition; body.textContent = input.bytes; body.style.whiteSpace = 'pre-wrap';
      article.append(heading, body);
      var reason = document.createElement('input'); reason.placeholder = 'Reason for this disposition'; reason.setAttribute('aria-label', 'Review reason'); article.append(reason);
      ['presented', 'deferred', 'dismissed'].forEach(function (disposition) {
        var button = document.createElement('button'); button.textContent = disposition;
        button.onclick = function () { run(async function () { show(await api('input-review', { input: input, disposition: disposition, reason: reason.value })); }); };
        article.append(button);
      });
      if (input.canIncorporate) {
        var text = document.createElement('textarea'), previewButton = document.createElement('button');
        text.setAttribute('aria-label', 'Proposed task addition'); text.placeholder = 'Explain the change to incorporate';
        previewButton.textContent = 'Preview attributed addition'; article.append(text, previewButton);
        previewButton.onclick = function () { run(async function () {
          var preview = await api('input-incorporation-preview', { input: input, incorporation: text.value, reason: reason.value });
          var exact = document.createElement('pre'), apply = document.createElement('button');
          exact.style.whiteSpace = 'pre-wrap'; exact.textContent = 'CURRENT TASK\n' + preview.before + '\nPROPOSED TASK\n' + preview.after;
          apply.textContent = 'Apply this reviewed addition';
          var invalidate = function () { exact.remove(); apply.remove(); };
          text.oninput = reason.oninput = invalidate;
          apply.onclick = function () { run(async function () { show(await api('input-incorporation-apply', { previewId: preview.id })); }); };
          article.append(exact, apply);
        }); };
      }
      get('list').append(article);
    });
    get('relationships').replaceChildren();
    (view.relationships || []).forEach(function (edge) {
      var row = document.createElement('p'), link = document.createElement('a'), remove = document.createElement('button');
      link.href = (panel.getAttribute('data-api') ? '/personal/' : '/item/') + edge.entity; link.textContent = edge.title + ' · ' + edge.role;
      remove.textContent = 'Disconnect'; remove.onclick = function () { run(async function () { show(await api('input-disconnect', { id: edge.id })); }); };
      row.append(link, remove); get('relationships').append(row);
    });
    buttons();
  }
  async function run(work) {
    if (busy) return; busy = true; buttons();
    try { await work(); } catch (error) { view = null; get('list').replaceChildren(); get('status').textContent = error.message + ' Refresh and review before continuing.'; }
    finally { busy = false; buttons(); }
  }
  get('refresh').onclick = function () { run(async function () { show(await api('input-view')); }); };
  get('capture').onclick = function () { run(async function () { show(await api('input-note', { note: get('note').value, eventDate: get('date').value || undefined })); get('note').value = ''; }); };
  get('set-status').onclick = function () { run(async function () { await api('input-status', { status: get('status-choice').value, checklist: get('complete').checked ? 'complete' : 'preserve' }); location.reload(); }); };
  get('done').onclick = function () { run(async function () { await api('input-status', { status: 'done', checklist: get('complete').checked ? 'complete' : 'preserve' }); location.reload(); }); };
  get('undo').onclick = function () { run(async function () { await api('input-undo'); location.reload(); }); };
  get('reconcile').onclick = function () { run(async function () { show(await api('input-reconcile')); }); };
  get('appointment-preview').onclick = function () { run(async function () {
    var next = await api('input-source-preview', { source: get('appointment-source').value.trim() });
    if (next.basis !== view.basis) throw new Error('Input changed; refresh before reviewing');
    appointmentPreview = next; get('appointment-before').textContent = next.bytes;
  }); };
  get('appointment-source').oninput = function () { appointmentPreview = null; get('appointment-before').textContent = ''; };
  get('appointment').onclick = function () { run(async function () {
    var source = get('appointment-source').value.trim(), existing = source && appointmentPreview && appointmentPreview.source === source ? appointmentPreview : null;
    if (source && !existing) throw new Error('Review the linked appointment revision before editing it');
    show(await api('input-appointment', { appointment: { title: get('appointment-title').value, date: get('appointment-date').value,
      time: get('appointment-time').value, details: get('appointment-details').value, source: source || undefined, revision: existing ? existing.revision : undefined } }));
  }); };
  get('link').onclick = function () { run(async function () { show(await api('input-link', { source: get('source').value })); }); };
  get('person').onclick = function () { run(async function () { show(await api('input-person', { title: get('person-title').value, role: get('role').value })); }); };
  get('connect').onclick = function () { run(async function () { show(await api('input-connect', { entity: get('entity').value, role: get('role').value })); }); };
  buttons();
})();
`;

export function personalInputPanel(ref: string, token: string, esc: (text: string) => string) {
  return inputPanel(ref, token, esc).replace('id="input-review"', 'id="input-review" data-api="/personal/api"')
    .replace('Shared quick note<br>', 'Private quick note (only you)<br>')
    .replace('Connected people and entities', 'Your private connections')
    .replace('href="/item/', 'href="/personal/');
}

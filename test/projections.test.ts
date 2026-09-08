import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { regenFull, regenIncremental } from '../src/core/dashboard.js';
import type { ItemFacts } from '../src/core/facts.js';
import { sha256 } from '../src/core/corpus.js';
import { parseItemFile } from '../src/core/parse.js';
import { fmGet } from '../src/core/fm.js';
import { arbitrate } from '../src/core/arbitrate.js';

const opts = { now: '2026-09-07T10:00', protocolRaw: '"0.4.9"' };
function fact(id: string, extra: Partial<ItemFacts> = {}): ItemFacts {
  return { relPath: `tasks/${id}.md`, dir: 'tasks', id, ref: `tasks/${id}`, type: 'task', kind: 'work-item', title: id,
    status: 'todo', updatedRaw: opts.now, updatedDate: '2026-09-07', related: [], stagedCount: 0, raw: false,
    anchors: [], steps: [], docs: [], ...extra };
}
for (const updatedRaw of [opts.now, '2026-08-01T09:00', '"2026-09-07T10:00"']) {
  test(`current status wins over previous dashboard with timestamp ${updatedRaw}`, () => {
    const prev = regenFull([fact('work')], null, opts);
    const facts = [fact('work', { status: 'blocked', updatedRaw })];
    const inc = regenIncremental(facts, prev, opts);
    assert.match(inc, /\[blocked\] work/);
    assert.equal(inc, regenFull(facts, prev, opts));
  });
}
test('delayed pure arbitration refreshes marks despite older event timestamps', () => {
  const text = '---\nid: work-2026q3\ntype: task\ntitle: Work\nstatus: todo\nupdated: 2026-08-01T09:00\n---\n\n# Work\n\n## Checklist\n- [ ] Ship <!-- ^ship -->\n';
  const proposal = `---\nid: proposal\nitem: tasks/work-2026q3\nauthor: agent\nupdated: 2026-08-02T09:00\nbase: sha256:${sha256(text)}\nops: ['mark: ^ship = in-flight', 'set: status = in-flight']\n---\n\n# Proposal\n\nBegin shipping.\n`;
  const result = arbitrate(text, [{ filename: 'proposal.md', text: proposal }]);
  assert.equal(result.outcome, 'clean', result.flags.join('; '));
  assert.match(result.itemText, /\[~\] Ship/);
  const prev = regenFull([fact('work')], null, opts);
  const facts = [fact('work', { status: fmGet(parseItemFile(result.itemText).fm, 'status'), updatedRaw: fmGet(parseItemFile(result.itemText).fm, 'updated') })];
  assert.match(regenIncremental(facts, prev, opts), /\[in-flight\] work/);
  assert.equal(facts[0]!.updatedRaw, '2026-08-02T09:00');
  assert.equal(regenIncremental(facts, prev, opts), regenFull(facts, prev, opts));
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildIndex, dumpIndex } from '../src/core/indexdb.js';
import { activeSet, children, chain, recordPage, needsReviewCandidates, stagedItems } from '../src/core/queries.js';
import { extractFacts } from '../src/core/facts.js';
import { walkCorpus } from '../src/core/corpus.js';
import { SchemaSet } from '../src/core/schema.js';
import { triage } from '../src/core/triage.js';
import { readProjection } from '../src/core/projection.js';
import { copyFixture } from './helpers.js';
import { serializeDashboard } from '../src/core/serialize.js';
import { parseDashboard } from '../src/core/parse.js';

test('private titles, edges, staged counts and carried entries do not enter projections or queries', () => {
  const publicItem = fact('public', { docs: [{ docId: 'private-notes', title: 'Hidden appendix', docKind: 'note', relPath: 'tasks/public/private-notes.md', visibility: 'private' }] });
  const secret = fact('secret', { title: 'Confidential title', stagedCount: 8, parent: publicItem.ref });
  const prev = regenFull([publicItem, secret], null, opts) + '\n';
  const facts = [{ ...publicItem, prev: secret.ref, related: [secret.ref] }, { ...secret, visibility: 'private' }];
  const dash = regenIncremental(facts, prev, opts);
  assert.doesNotMatch(dash, /Confidential|secret|8 staged/);
  assert.match(dash, /## Tasks \(1\)/);
  assert.equal(dash, regenFull(facts, prev, opts));
  const db = buildIndex(facts);
  try {
    assert.doesNotMatch(dumpIndex(db), /Confidential|secret|private-notes|Hidden appendix/);
    assert.deepEqual(children(db, publicItem.ref), []);
    assert.deepEqual(chain(db, secret.ref), []);
    assert.deepEqual(chain(db, publicItem.ref), [publicItem.ref]);
    assert.deepEqual(stagedItems(db), []);
  } finally { db.close(); }
  const orphan = prev.replace('public —', 'Old private title —').replace('tasks/public.md', 'tasks/missing.md');
  assert.doesNotMatch(regenFull([], orphan, opts), /Old private|missing|Confidential/);
});

for (const parent of [
  undefined, fact('parent', { status: 'done', updatedDate: '2026-08-01' }),
  fact('parent', { archived: '2026-09-01' }), fact('parent', { visibility: 'private' }),
]) {
  test(`active child remains reachable with parent ${parent?.visibility ?? parent?.archived ?? parent?.status ?? 'missing'}`, () => {
    const child = fact('child', { parent: 'tasks/parent', stagedCount: 2 });
    const facts = parent ? [parent, child] : [child];
    const dash = regenFull(facts, null, opts);
    assert.match(dash, /\(2 staged\) child/);
    const db = buildIndex(facts);
    try { assert.ok(activeSet(db, 'tasks', '2026-09-07').some(f => f.ref === child.ref)); }
    finally { db.close(); }
  });
}

test('invalid parent cycles still have a visible route', () => {
  const facts = [fact('a', { parent: 'tasks/b' }), fact('b', { parent: 'tasks/a' })];
  assert.match(regenFull(facts, null, opts), /## Tasks \(2\)/);
  const db = buildIndex(facts);
  try { assert.equal(activeSet(db, 'tasks').length, 2); } finally { db.close(); }
});

test('triage preserves blocked execution and its blocker; legacy review stays explicitly unknown', t => {
  const dir = copyFixture();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const rel = 'tasks/staging-db-migration-2026q3.md';
  const abs = path.join(dir, rel);
  const before = fs.readFileSync(abs, 'utf8');
  const blocker = before.split('\n').filter(l => l.includes('blocked-by:'));
  const schemas = SchemaSet.load(dir);
  const actions = triage(dir, walkCorpus(dir), schemas, { now: opts.now });
  assert.ok(actions.some(a => a.relPath === rel && a.action.includes('review: needed')));
  const after = fs.readFileSync(abs, 'utf8');
  assert.match(after, /^status: blocked$/m);
  assert.match(after, /^review: needed$/m);
  assert.deepEqual(after.split('\n').filter(l => l.includes('blocked-by:')), blocker);
  let facts = extractFacts(dir, walkCorpus(dir), schemas);
  let dash = regenFull(facts, null, opts);
  assert.match(dash, /\[blocked\] \(review: needed\) Staging DB/);
  assert.equal(serializeDashboard(parseDashboard(dash)), dash);
  const db = buildIndex(facts);
  try { assert.ok(needsReviewCandidates(db, '2026-09-07').some(f => f.rel_path === rel && f.review === 'needed' && f.status === 'blocked')); }
  finally { db.close(); }
  fs.writeFileSync(abs, before.replace('status: blocked', 'status: needs-review'));
  facts = extractFacts(dir, walkCorpus(dir), schemas);
  dash = regenFull(facts, null, opts);
  assert.match(dash, /\[needs-review\] \(review: legacy-unknown\) Staging DB/);
  triage(dir, walkCorpus(dir), schemas, { now: opts.now });
  assert.match(fs.readFileSync(abs, 'utf8'), /^status: needs-review$/m);
});

test('same-minute file edits change verified inputs; deleting SQLite preserves current visible state', t => {
  const dir = copyFixture();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const first = readProjection(dir);
  const rel = 'tasks/staging-db-migration-2026q3.md';
  const abs = path.join(dir, rel);
  fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace('status: blocked', 'status: in-flight'));
  const second = readProjection(dir);
  assert.notEqual(first.inputs, second.inputs);
  assert.equal(second.facts.find(f => f.relPath === rel)!.status, 'in-flight');
  const cache = path.join(dir, 'index.sqlite');
  const db = buildIndex(second.facts, cache);
  const before = dumpIndex(db);
  const active = activeSet(db, 'tasks', '2026-09-07');
  db.close(); fs.unlinkSync(cache);
  const rebuilt = buildIndex(readProjection(dir).facts, cache);
  try { assert.equal(dumpIndex(rebuilt), before); assert.deepEqual(activeSet(rebuilt, 'tasks', '2026-09-07'), active); }
  finally { rebuilt.close(); }
});

test('record overflow and pages exclude private records; terminal review remains discoverable', () => {
  const records = Array.from({ length: 8 }, (_, i) => fact(`record-${i}`, {
    dir: 'journal', type: 'journal', kind: 'record', status: undefined,
    ref: `journal/record-${i}`, relPath: `journal/record-${i}.md`, date: '2026-09-07',
    visibility: i === 7 ? 'private' : undefined,
  }));
  const dash = regenFull(records, null, opts);
  assert.match(dash, /## Journal \(7\)/);
  assert.match(dash, /\+2 more in journal/);
  const terminal = fact('completed', { status: 'done', review: 'needed' });
  const db = buildIndex([...records, terminal]);
  try {
    assert.equal(recordPage(db, 'journal').length, 7);
    assert.ok(needsReviewCandidates(db, '2026-09-07').some(f => f.ref === terminal.ref));
  } finally { db.close(); }
});

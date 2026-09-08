// Conformance gates 1–5 (grammar.md §13) over the committed fixture corpus.
// The fixture is the test oracle: if code and fixture disagree, suspect the code.

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { walkCorpus } from '../src/core/corpus.js';
import { regenFull, regenIncremental } from '../src/core/dashboard.js';
import {
  jsonEqual,
  projectDashboard,
  projectDoc,
  projectItem,
  projectProposal,
} from '../src/core/equal.js';
import { extractFacts } from '../src/core/facts.js';
import { buildIndex, dumpIndex } from '../src/core/indexdb.js';
import { normalize } from '../src/core/normalize.js';
import { parseDashboard, parseDocFile, parseItemFile, parseProposal } from '../src/core/parse.js';
import { SchemaSet } from '../src/core/schema.js';
import {
  serializeDashboard,
  serializeDoc,
  serializeItem,
  serializeProposal,
} from '../src/core/serialize.js';
import { validateCorpus } from '../src/core/validate.js';
import { copyFixture, fixtureContext, FIXTURE_DIR } from './helpers.js';

const RAW_FILES = new Set(['journal/prod-timeout-idea.md']); // deliberately raw: not canonical

function roundtrip(kind: string, text: string): { out: string; equal: boolean } {
  switch (kind) {
    case 'item': {
      const a = parseItemFile(text);
      const out = serializeItem(a);
      return { out, equal: jsonEqual(projectItem(a), projectItem(parseItemFile(out))) };
    }
    case 'dashboard': {
      const a = parseDashboard(text);
      const out = serializeDashboard(a);
      return { out, equal: jsonEqual(projectDashboard(a), projectDashboard(parseDashboard(out))) };
    }
    case 'proposal': {
      const a = parseProposal(text);
      const out = serializeProposal(a);
      return { out, equal: jsonEqual(projectProposal(a), projectProposal(parseProposal(out))) };
    }
    default: {
      const a = parseDocFile(text);
      const out = serializeDoc(a);
      return { out, equal: jsonEqual(projectDoc(a), projectDoc(parseDocFile(out))) };
    }
  }
}

test('gate 1 — fixpoint: normalize(normalize(f)) = normalize(f)', () => {
  const ctx = fixtureContext(FIXTURE_DIR);
  for (const f of walkCorpus(FIXTURE_DIR)) {
    if (f.kind === 'protocol') continue;
    const once = normalize(f.relPath, f.text, ctx);
    const twice = normalize(f.relPath, once.text, ctx);
    assert.equal(twice.text, once.text, `fixpoint violated: ${f.relPath}`);
  }
});

test('gate 2 — reparse identity: parse(serialize(parse(f))) = parse(f)', () => {
  for (const f of walkCorpus(FIXTURE_DIR)) {
    if (f.kind === 'protocol') continue;
    const { equal } = roundtrip(f.kind, f.text);
    assert.ok(equal, `reparse identity violated: ${f.relPath}`);
  }
});

test('gate 3 — canonical stability: serialize(parse(f)) = f byte-for-byte', () => {
  for (const f of walkCorpus(FIXTURE_DIR)) {
    if (f.kind === 'protocol' || RAW_FILES.has(f.relPath)) continue;
    const { out } = roundtrip(f.kind, f.text);
    assert.equal(out, f.text, `canonical file rewritten: ${f.relPath}`);
  }
});

test('gate 3b — normalize is identity on canonical files', () => {
  const ctx = fixtureContext(FIXTURE_DIR);
  for (const f of walkCorpus(FIXTURE_DIR)) {
    if (f.kind === 'protocol' || RAW_FILES.has(f.relPath)) continue;
    const res = normalize(f.relPath, f.text, ctx);
    assert.equal(res.text, f.text, `normalize changed canonical file: ${f.relPath}`);
  }
});

test('gate 4 — opacity: mutated opaque regions survive normalization exactly', () => {
  const ctx = fixtureContext(FIXTURE_DIR);
  const rel = 'tasks/sso-timeout-fix-2026q3.md';
  const original = fs.readFileSync(path.join(FIXTURE_DIR, rel), 'utf8');

  // mutate Summary prose (opaque to tools) with deliberately odd bytes
  const weird = 'ODD   spacing — *markup* `and` [half-a-link]( and trailing spaces   ';
  const mutated = original.replace(
    '## Summary\n',
    `## Summary\n${weird}\n`,
  );
  const normalized = normalize(rel, mutated, ctx).text;
  assert.ok(normalized.includes(`\n${weird}\n`), 'opaque prose mutation was not preserved exactly');

  // add a whole opaque section; its bytes must survive
  const opaque = '## Scratch pad\n\nraw notes ~~ 42% !! <- not a production\n  indented junk\n';
  const withSection = original.replace(
    '<!-- arbiter:tier-2',
    `${opaque}\n<!-- arbiter:tier-2`,
  );
  const normalized2 = normalize(rel, withSection, ctx).text;
  assert.ok(
    normalized2.includes('## Scratch pad\n\nraw notes ~~ 42% !! <- not a production\n  indented junk\n'),
    'opaque section mutation was not preserved exactly',
  );
});

test('gate 5 — index is a cache: rebuilt twice it is identical; deleting it loses nothing', () => {
  const schemas = SchemaSet.load(FIXTURE_DIR);
  const files = walkCorpus(FIXTURE_DIR);
  const facts = extractFacts(FIXTURE_DIR, files, schemas);
  const a = buildIndex(facts);
  const b = buildIndex(facts);
  assert.equal(dumpIndex(a), dumpIndex(b), 'index rebuild is not deterministic');
  a.close();
  // "deleting the index loses nothing": rebuild from files alone matches
  const c = buildIndex(extractFacts(FIXTURE_DIR, walkCorpus(FIXTURE_DIR), schemas));
  assert.equal(dumpIndex(b), dumpIndex(c));
  b.close();
  c.close();
});

test('gate 5 — incremental dashboard regen is byte-identical to a full rebuild', () => {
  const schemas = SchemaSet.load(FIXTURE_DIR);
  const files = walkCorpus(FIXTURE_DIR);
  const facts = extractFacts(FIXTURE_DIR, files, schemas);
  const prev = fs.readFileSync(path.join(FIXTURE_DIR, 'DASHBOARD.md'), 'utf8');
  const opts = { now: '2026-07-09T09:00', protocolRaw: '"0.4.6"', generator: 'arbiter-cli' };
  const inc = regenIncremental(facts, prev, opts);
  const full = regenFull(facts, prev, opts);
  assert.equal(inc, full, 'incremental ≠ full rebuild');
});

test('gate 5 — regen with the fixture timestamp reproduces the hand-authored dashboard', () => {
  const schemas = SchemaSet.load(FIXTURE_DIR);
  const files = walkCorpus(FIXTURE_DIR);
  const facts = extractFacts(FIXTURE_DIR, files, schemas);
  const prev = fs.readFileSync(path.join(FIXTURE_DIR, 'DASHBOARD.md'), 'utf8');
  const opts = { now: '2026-07-05T17:30', protocolRaw: '"0.4.6"', generator: 'hand-authored-fixture' };
  const out = regenIncremental(facts, prev, opts);
  assert.match(out, /^inputs: sha256:[a-f0-9]{64}$/m);
  assert.equal(out.replace(/^inputs: .*\n/m, ''), prev, 'visible fixture content is unchanged; 0.4.9 adds input provenance');
});

test('gate 5 — re-parenting is an observed transition: entry leaves, then returns, never lost or duplicated', () => {
  const tmp = copyFixture();
  const schemas = SchemaSet.load(tmp);
  const rel = 'tasks/staging-db-migration-2026q3.md';
  const abs = path.join(tmp, rel);
  const original = fs.readFileSync(abs, 'utf8');

  // re-parent under a task (goal → task) with a touch newer than `generated`
  fs.writeFileSync(
    abs,
    original
      .replace('parent: goals/q3-deploy-pipeline-2026q3', 'parent: tasks/railway-predeploy-hook-2026q3')
      .replace(/^updated: .*$/m, 'updated: 2026-07-05T18:00'),
    'utf8',
  );
  const prev = fs.readFileSync(path.join(tmp, 'DASHBOARD.md'), 'utf8');
  const opts = { now: '2026-07-05T18:30', protocolRaw: '"0.4.6"', generator: 'arbiter-cli' };
  const facts1 = extractFacts(tmp, walkCorpus(tmp), schemas);
  const afterHide = regenIncremental(facts1, prev, opts);
  assert.equal(regenFull(facts1, prev, opts), afterHide, 'incremental ≠ full after re-parenting');
  assert.ok(!afterHide.includes(rel), 'sub-item entry must leave the card');
  assert.match(afterHide, /## Tasks \(3\)/, 'card count must exclude the sub-item');

  // re-parent back to the goal: the entry returns exactly once
  fs.writeFileSync(
    abs,
    original.replace(/^updated: .*$/m, 'updated: 2026-07-05T19:00'),
    'utf8',
  );
  const opts2 = { now: '2026-07-05T19:30', protocolRaw: '"0.4.6"', generator: 'arbiter-cli' };
  const facts2 = extractFacts(tmp, walkCorpus(tmp), schemas);
  const afterReturn = regenIncremental(facts2, afterHide, opts2);
  assert.equal(regenFull(facts2, afterHide, opts2), afterReturn, 'incremental ≠ full after return');
  const occurrences = afterReturn.split(rel).length - 1;
  assert.equal(occurrences, 1, 'returning entry must appear exactly once');
  assert.match(afterReturn, /## Tasks \(4\)/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('nesting: sub-item staged counts roll up onto the top-level ancestor entry', () => {
  const schemas = SchemaSet.load(FIXTURE_DIR);
  const facts = extractFacts(FIXTURE_DIR, walkCorpus(FIXTURE_DIR), schemas);
  const prev = fs.readFileSync(path.join(FIXTURE_DIR, 'DASHBOARD.md'), 'utf8');
  const out = regenFull(facts, prev, { now: '2026-07-05T17:30', protocolRaw: '"0.4.6"', generator: 'hand-authored-fixture' });
  assert.match(out, /\(1 staged\) Railway pre-deploy hook/, 'parent entry must carry the sub-task proposal count');
  assert.ok(!out.includes('predeploy-rollback-verify'), 'sub-task itself stays off tier 1');
});

test('queries: active mirrors tier-1 membership; children derives the forward pointer', async () => {
  const { activeSet, children } = await import('../src/core/queries.js');
  const schemas = SchemaSet.load(FIXTURE_DIR);
  const db = buildIndex(extractFacts(FIXTURE_DIR, walkCorpus(FIXTURE_DIR), schemas));
  const active = activeSet(db, 'tasks').map((r) => r.ref);
  assert.ok(!active.includes('tasks/predeploy-rollback-verify-2026q3'), 'sub-task must not be in the active set');
  assert.ok(active.includes('tasks/railway-predeploy-hook-2026q3'));
  const kids = children(db, 'tasks/railway-predeploy-hook-2026q3').map((r) => r.ref);
  assert.deepEqual(kids, ['tasks/predeploy-rollback-verify-2026q3']);
  db.close();
});

test('validator: the fixture corpus is green (raw file warns, never errors)', () => {
  const tmp = copyFixture();
  const files = walkCorpus(tmp);
  const report = validateCorpus(tmp, files, SchemaSet.load(tmp));
  assert.deepEqual(
    report.errors.map((e) => `${e.relPath}: ${e.message}`),
    [],
    'fixture must validate clean',
  );
  assert.ok(
    report.warnings.some((w) => w.relPath === 'journal/prod-timeout-idea.md'),
    'raw human file should warn',
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

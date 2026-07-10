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
  const opts = { now: '2026-07-09T09:00', protocolRaw: '"0.4.4"', generator: 'arbiter-cli' };
  const inc = regenIncremental(facts, prev, opts);
  const full = regenFull(facts, prev, opts);
  assert.equal(inc, full, 'incremental ≠ full rebuild');
});

test('gate 5 — regen with the fixture timestamp reproduces the hand-authored dashboard', () => {
  const schemas = SchemaSet.load(FIXTURE_DIR);
  const files = walkCorpus(FIXTURE_DIR);
  const facts = extractFacts(FIXTURE_DIR, files, schemas);
  const prev = fs.readFileSync(path.join(FIXTURE_DIR, 'DASHBOARD.md'), 'utf8');
  const opts = { now: '2026-07-05T17:30', protocolRaw: '"0.4.4"', generator: 'hand-authored-fixture' };
  assert.equal(regenIncremental(facts, prev, opts), prev, 'regen does not reproduce the fixture dashboard');
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

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkData, initData } from '../src/cli/data.js';
import { readProjection } from '../src/core/projection.js';
import { impactReport, promotionCandidate } from '../src/core/evidence.js';
import { spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { createArbiterServer } from '../src/web/server.js';
import { validateCorpus } from '../src/core/validate.js';
import { walkCorpus } from '../src/core/corpus.js';
import { SchemaSet } from '../src/core/schema.js';

function setup(t: { after(fn: () => void): void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-evidence-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  initData(dir);
  const write = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  const work = (id = 'copper-2026q3', meta = 'status: done\narchived: 2026-09-02') => write(`tasks/${id}.md`, `---
id: ${id}
type: task
title: Copper work
updated: 2026-09-01T10:00
${meta ? `${meta}\n` : ''}---

# Copper work

## Summary

Replace the transport.

## Artifacts

- test: [Archived measurements](tasks/copper-2026q3/measurements.md)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update in place -->
`);
  const record = (id = 'copper-impact-2026q3', meta = '', observation = 'The recorded median fell from 20 ms to 12 ms.') => write(`accomplishments/${id}.md`, `---
id: ${id}
type: accomplishment
title: Copper latency
date: 2026-09-01
updated: 2026-09-03T10:00
source: [tasks/copper-2026q3]
outcome: copper-latency
verification: observed
verified-by: synthetic-reviewer
observed-on: 2026-09-03
${meta ? `${meta}\n` : ''}---

# Copper latency

## Summary

Reduced measured transport latency.

## Evidence

- test: [Archived measurements](tasks/copper-2026q3/measurements.md)

## Observations

${observation}

## Uncertainty

Production tail latency remains unmeasured.

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · retain evidence -->
`);
  work();
  write('tasks/copper-2026q3/measurements.md', '# Measurement log\n\nSynthetic benchmark: median 20 ms before, 12 ms after.\n');
  record();
  return { dir, write, work, record };
}

test('legacy accomplishments survive schema adoption byte-for-byte without acquiring an attestation', t => {
  const { dir } = setup(t);
  const file = path.join(dir, 'accomplishments/copper-impact-2026q3.md');
  const original = fs.readFileSync(file, 'utf8');
  const legacy = original.replace(/^(outcome|verification|verified-by|observed-on):.*\n/gm, '')
    .replace(/## Observations\n[\s\S]*?(?=<!-- arbiter:)/, '')
    .replaceAll('\n', '\r\n');
  fs.writeFileSync(file, legacy);
  const validate = () => { const files = walkCorpus(dir); return validateCorpus(dir, files, SchemaSet.fromFiles(files)); };
  assert.equal(checkData(dir), 'ready');
  assert.deepEqual(validate().errors, []);
  assert.ok(validate().warnings.some(w => /retained as unverified/.test(w.message)));
  const report = impactReport(readProjection(dir), '2026-09-01', '2026-09-30', '2026-09-08');
  assert.match(report, /Counted outcomes: 0/);
  assert.match(report, /Unverified outcome groups: 1/);
  assert.match(report, /Reduced measured transport latency/);
  assert.match(report, /Impact is unverified/);
  assert.deepEqual(fs.readFileSync(file), Buffer.from(legacy));
  // Even otherwise complete attestations cannot count without explicit verification.
  fs.writeFileSync(file, original.replace('verification: observed\n', ''));
  assert.match(impactReport(readProjection(dir), '2026-09-01', '2026-09-30', '2026-09-08'), /Counted outcomes: 0/);
  // The compatibility schema does not relax any observed-record requirement.
  fs.writeFileSync(file, legacy.replace('type: accomplishment', 'verification: observed\r\ntype: accomplishment'));
  const errors = validate().errors.map(e => e.message).join('\n');
  for (const rule of ['verified-by', 'observed-on', 'Observations', 'Uncertainty', 'outcome identity']) assert.ok(errors.includes(rule), rule);
  fs.writeFileSync(file, legacy.replace('type: accomplishment', 'verification: certified\r\ntype: accomplishment'));
  assert.ok(validate().errors.some(e => /field verification not in/.test(e.message)));
  fs.writeFileSync(file, legacy.replace(/- test:.*\r\n/, ''));
  assert.ok(validate().errors.some(e => /no verifiable/.test(e.message)), 'legacy evidence rule retained');
  fs.writeFileSync(file, legacy);
  const schemaPath = path.join(dir, 'types/accomplishment.md');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  fs.writeFileSync(schemaPath, schema.replace('version: "0.4.18"', 'version: "0.4.14"')
    .replace('verification: { type: enum, required: false', 'verification: { type: enum, required: true')
    .replace('Observations: { required: false', 'Observations: { required: true')
    .replace('Uncertainty: { required: false', 'Uncertainty: { required: true'));
  assert.equal(checkData(dir), 'ready', 'previous schema remains supported');
  assert.equal(validate().errors.filter(e => e.relPath === 'accomplishments/copper-impact-2026q3.md').length, 3, '0.4.14 retains strict required fields/sections');
  assert.match(promotionCandidate(readProjection(dir), 'tasks/copper-2026q3', '2026-09-01', '2026-09-08T10:00'), /verification: unverified/);
  assert.deepEqual(fs.readFileSync(file), Buffer.from(legacy));
});

test('new compatibility-schema skeletons still explicitly request verification and observation detail', t => {
  const { dir } = setup(t);
  const made = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', 'new', 'accomplishment', 'New outcome',
    '--date', '2026-09-08', '--now', '2026-09-08T10:00', '--data', dir], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const body = fs.readFileSync(path.join(dir, made.stdout.trim()), 'utf8');
  for (const section of ['verification: unverified', '## Observations', '## Uncertainty']) assert.ok(body.includes(section));
  const files = walkCorpus(dir);
  assert.deepEqual(validateCorpus(dir, files, SchemaSet.fromFiles(files)).errors, []);
});

test('one archived workstream produces one evidenced outcome with uncertainty and archive links', t => {
  const { dir, record } = setup(t);
  record('copper-repeat-2026q3', 'archived: 2026-09-04');
  const report = impactReport(readProjection(dir), '2026-09-01', '2026-09-30', '2026-09-08');
  assert.match(report, /Counted outcomes: 1/);
  assert.match(report, /Unverified outcome groups: 0/);
  assert.equal(readProjection(dir).facts.filter(f => f.type === 'accomplishment' && !f.raw).length, 2);
  assert.match(report, /\(accomplishments\/copper-impact-2026q3.md\)/);
  assert.match(report, /Recorded observations/);
  assert.match(report, /20 ms to 12 ms/);
  assert.match(report, /Production tail latency remains unmeasured/);
  assert.match(report, /\(tasks\/copper-2026q3\/measurements.md\)/);
  assert.match(report, /\(accomplishments\/copper-repeat-2026q3.md\)/);
  assert.match(report, /archived/);
  assert.match(impactReport(readProjection(dir), '2026-08-01', '2026-08-31', '2026-09-08'), /Counted outcomes: 0/);
});

test('promotion preserves source evidence but never asserts impact verification', t => {
  const { dir, work } = setup(t);
  const candidate = promotionCandidate(readProjection(dir), 'tasks/copper-2026q3', '2026-09-01', '2026-09-08T10:00');
  assert.match(candidate, /verification: unverified/);
  assert.match(candidate, /source: \[tasks\/copper-2026q3\]/);
  assert.match(candidate, /Archived measurements/);
  assert.match(candidate, /Confirm the outcome/);
  work('copper-2026q3', 'status: dropped');
  assert.throws(() => promotionCandidate(readProjection(dir), 'tasks/copper-2026q3', '2026-09-01', '2026-09-08T10:00'), /completed/);
});

test('private, dropped, superseded, staged and review-needed sources cannot inflate impact', t => {
  const { dir, work, write, record } = setup(t);
  const report = () => impactReport(readProjection(dir), '2026-09-01', '2026-09-30', '2026-09-08');
  for (const meta of ['status: dropped', 'status: todo', 'status: done\nreview: needed',
    'status: done\nsuperseded-by: tasks/replacement-2026q3', 'status: done\nvisibility: private']) {
    work('copper-2026q3', meta);
    assert.match(report(), /Counted outcomes: 0/);
    assert.doesNotMatch(report(), /Reduced measured|20 ms/);
  }
  work();
  write('tasks/copper-2026q3.staged/proposal.md', '# Pending proposal\n');
  assert.match(report(), /Counted outcomes: 0/);
  fs.rmSync(path.join(dir, 'tasks/copper-2026q3.staged'), { recursive: true });
  record('copper-impact-2026q3', 'superseded-by: accomplishments/replacement-2026q3');
  assert.match(report(), /Counted outcomes: 0/);
  record('copper-impact-2026q3', 'visibility: private');
  assert.doesNotMatch(report(), /copper|latency|20 ms/);
});

test('links, missing observations, malformed metadata and contradictory duplicates remain unverified', t => {
  const { dir, record, write } = setup(t);
  const file = path.join(dir, 'accomplishments/copper-impact-2026q3.md');
  const original = fs.readFileSync(file, 'utf8');
  const report = () => impactReport(readProjection(dir), '2026-09-01', '2026-09-30', '2026-09-08');
  for (const changed of [original.replace('verification: observed', 'verification: unverified'),
    original.replace('verified-by: synthetic-reviewer\n', ''), original.replace('observed-on: 2026-09-03', 'observed-on: 2026-02-30'),
    original.replace('observed-on: 2026-09-03', 'observed-on: 2026-09-09'),
    original.replace('The recorded median fell from 20 ms to 12 ms.', ''),
    original.replace('outcome: copper-latency\n', ''), original.replace('verification: observed', 'verification: observed\nverification: unverified')]) {
    fs.writeFileSync(file, changed);
    assert.match(report(), /Counted outcomes: 0/);
    assert.match(report(), /Unverified outcome groups: 1/, changed);
  }
  fs.writeFileSync(file, original);
  record('copper-repeat-2026q3');
  const repeated = path.join(dir, 'accomplishments/copper-repeat-2026q3.md');
  fs.writeFileSync(repeated, fs.readFileSync(repeated, 'utf8').replace('date: 2026-09-01', 'date: 2026-08-01'));
  assert.match(report(), /Counted outcomes: 0/);
  assert.match(report(), /Conflicting outcome dates/);
  fs.rmSync(repeated);
  write('tasks/copper-2026q3/measurements.md', '---\nvisibility: private\n---\n\n# Sensitive sample\n');
  assert.match(report(), /Counted outcomes: 0/);
  assert.doesNotMatch(report(), /measurements|Sensitive sample|20 ms/);
});

test('CLI captures supported knowledge, queries and renders it, then preserves durable supersession', async t => {
  const { dir } = setup(t);
  const cli = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', ...args, '--data', dir], { encoding: 'utf8' });
  for (const type of ['decision', 'finding']) {
    const made = cli('new', type, `Copper ${type}`, '--date', '2026-09-08', '--now', '2026-09-08T10:00');
    assert.equal(made.status, 0, made.stderr);
    const rel = made.stdout.trim(), file = path.join(dir, rel);
    assert.match(fs.readFileSync(file, 'utf8'), /scope: unassigned/);
    const rows = cli('query', 'page', `${type}s`, '--json');
    assert.equal(rows.status, 0, rows.stderr);
    assert.match(rows.stdout, new RegExp(`Copper ${type}`));
    const search = cli('search', 'Copper', '--dir', `${type}s`, '--json');
    assert.equal(JSON.parse(search.stdout).total, 1);
  }
  const files = walkCorpus(dir);
  const validation = validateCorpus(dir, files, SchemaSet.fromFiles(files));
  assert.deepEqual(validation.errors, []);
  const server = createArbiterServer(dir);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert.match(await (await fetch(base)).text(), /Copper decision/);
  assert.match(await (await fetch(`${base}/dir/findings`)).text(), /Copper finding/);
  assert.match(await (await fetch(`${base}/item/decisions/copper-decision-2026q3`)).text(), /scope unassigned/);
  const rel = 'decisions/copper-decision-2026q3.md', file = path.join(dir, rel);
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, before.replace('scope: unassigned', 'scope: transport service\nsuperseded-by: decisions/copper-decision-2026q3'));
  const updated = walkCorpus(dir);
  assert.ok(validateCorpus(dir, updated, SchemaSet.fromFiles(updated)).errors.some(e => e.message === 'supersession cycle'));
  const html = await (await fetch(`${base}/item/decisions/copper-decision-2026q3`)).text();
  assert.match(html, /superseded-by/);
});

test('CLI promotion is capturable as an honest candidate; date arguments are strict', t => {
  const { dir } = setup(t);
  const cli = (args: string[], input?: string) => spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', ...args, '--data', dir], { encoding: 'utf8', input });
  const candidate = cli(['promote', 'tasks/copper-2026q3', '--date', '2026-09-01', '--now', '2026-09-08T10:00']);
  assert.equal(candidate.status, 0, candidate.stderr);
  fs.rmSync(path.join(dir, 'accomplishments/copper-impact-2026q3.md'));
  const capture = cli(['write', 'accomplishments/copper-impact-2026q3.md', '--if-match', 'new'], candidate.stdout);
  assert.equal(capture.status, 0, capture.stderr);
  assert.equal(cli(['validate']).status, 0);
  const report = cli(['report', '--since', '2026-09-01', '--until', '2026-09-30', '--now', '2026-09-08T10:00']);
  assert.equal(report.status, 0, report.stderr);
  assert.match(report.stdout, /Counted outcomes: 0/);
  assert.match(report.stdout, /Unverified outcome groups: 1/);
  for (const args of [['report'], ['report', '--since', '2026-02-30'], ['report', '--since', '2026-09-01', '--until', '2026-08-01'], ['promote', 'tasks/copper-2026q3']])
    assert.equal(cli(args).status, 2);
});

test('reviewed knowledge needs scope, provenance and actual observation; evidence-less candidates remain valid', t => {
  const { dir, write } = setup(t);
  const validation = () => { const files = walkCorpus(dir); return validateCorpus(dir, files, SchemaSet.fromFiles(files)); };
  const rel = 'findings/copper-scope-2026q3.md';
  const finding = `---
id: copper-scope-2026q3
type: finding
title: Copper scope
date: 2026-09-01
updated: 2026-09-08T10:00
scope: transport benchmark
source: [tasks/copper-2026q3]
review: reviewed
reviewed-by: synthetic-reviewer
reviewed-on: 2026-09-08
---

# Copper scope

## Summary

The improvement applies to the benchmark, with production impact still unknown.

## Evidence

- test: [Measurements](tasks/copper-2026q3/measurements.md)

## Observations

Median 20 ms before and 12 ms after in the archived benchmark.

## Uncertainty

Production traffic has not been observed.

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · retain scope -->
`;
  write(rel, finding);
  assert.deepEqual(validation().errors, []);
  for (const changed of [finding.replace('scope: transport benchmark', 'scope: unassigned'),
    finding.replace('reviewed-by: synthetic-reviewer\n', ''), finding.replace('reviewed-on: 2026-09-08', 'reviewed-on: 2026-02-30'),
    finding.replace('Median 20 ms before and 12 ms after in the archived benchmark.', '')]) {
    write(rel, changed);
    assert.ok(validation().errors.some(e => e.relPath === rel));
  }
  write(rel, finding);
  const work = path.join(dir, 'tasks/copper-2026q3.md');
  fs.writeFileSync(work, fs.readFileSync(work, 'utf8').replace('- test: [Archived measurements](tasks/copper-2026q3/measurements.md)', ''));
  const candidate = promotionCandidate(readProjection(dir), 'tasks/copper-2026q3', '2026-09-01', '2026-09-08T10:00');
  write('accomplishments/copper-impact-2026q3.md', candidate);
  assert.deepEqual(validation().errors, []);
  assert.match(impactReport(readProjection(dir), '2026-09-01', '2026-09-30', '2026-09-08'), /No usable evidence reference/);
});

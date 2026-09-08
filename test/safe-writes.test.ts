import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { arbitrate, type ProposalInput } from '../src/core/arbitrate.js';
import { sha256 } from '../src/core/corpus.js';
import { parseItemFile } from '../src/core/parse.js';
import { copyFixture } from './helpers.js';

const rel = 'tasks/onboarding-doc-refresh-2026q3.md';
function proposal(item: string, op: string, suffix = 'append'): ProposalInput {
  const id = `2026-09-06-agent-test-${suffix}`;
  return { filename: `${id}.md`, text: `---\nid: ${id}\nitem: tasks/onboarding-doc-refresh-2026q3\nbase: sha256:${sha256(item)}\nauthor: agent-test\nupdated: 2026-09-06T10:00\nops: ['${op.replaceAll("'", "''")}']\n---\n\n# Intent\n\nPreserve this contribution.\n\n<!-- arbiter:staged · PROTOCOL.md#arbitration · pending proposal -->\n` };
}

test('Detail docs append has a parsed effect before its proposal can be deleted', () => {
  const dir = copyFixture();
  try {
    const item = fs.readFileSync(path.join(dir, rel), 'utf8').replace('<!-- arbiter:tier-2', '## Detail docs\n\n- [[existing-note]] Existing note (note) -> onboarding-doc-refresh-2026q3/existing-note.md\n\n<!-- arbiter:tier-2');
    fs.writeFileSync(path.join(dir, rel), item);
    assert.equal(parseItemFile(item).sections.find(s => s.heading === 'Detail docs')?.kind, 'docs');
    const p = proposal(item, 'append: Detail docs · [[new-note]] New note (note) -> onboarding-doc-refresh-2026q3/new-note.md');
    const staged = path.join(dir, rel.replace('.md', '.staged'), p.filename);
    fs.writeFileSync(staged, p.text);
    const result = arbitrate(item, [p]);
    const docs = parseItemFile(result.itemText).sections.find(s => s.heading === 'Detail docs');
    const applied = docs?.kind === 'docs' && docs.entries.some(e => e.docId === 'new-note' && e.title === 'New note');
    assert.ok(applied, 'an applied verdict must correspond to an actual parsed docs entry');
    assert.ok(applied || result.remaining.includes(p.filename));
    assert.equal(fs.readFileSync(staged, 'utf8'), p.text, 'pure arbitration never deletes intent');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

import { spawn, spawnSync } from 'node:child_process';
import { commitFile, CommitConflict, readJournals, recoverCommits, stageProposal } from '../src/core/commit.js';
import { arbitrateFile } from '../src/core/arbitrate-file.js';
import { triage } from '../src/core/triage.js';
import { walkCorpus } from '../src/core/corpus.js';
import { SchemaSet } from '../src/core/schema.js';
import { fmGet } from '../src/core/fm.js';
import { REPO_ROOT } from './helpers.js';
const cliPath = path.join(REPO_ROOT, 'src/cli/main.ts');
const plainRel = 'journal/railway-cli-gotcha.md';
function cli(dir: string, args: string[], input?: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliPath, ...args, '--data', dir], { cwd: REPO_ROOT, encoding: 'utf8', input });
}

test('append variants, missing sections, malformed entries and malformed targets are checked structurally', () => {
  const dir = copyFixture();
  try {
    const item = fs.readFileSync(path.join(dir, rel), 'utf8');
    for (const op of [
      'append: Summary · A new fact', 'append: Checklist · A new step',
      'append: Artifacts · pr: [Proof](https://example.com/proof)',
      'append: Evidence · report: [Proof](https://example.com/proof)',
      'append: Detail docs · [[new-note]] New note (note) -> onboarding-doc-refresh-2026q3/new-note.md',
    ]) {
      const p = proposal(item, op);
      const result = arbitrate(item, [p]);
      assert.deepEqual(result.deleted, [p.filename], op);
      assert.equal(result.receipts[0]?.ops[0]?.verdict, 'applied');
      const ast = parseItemFile(result.itemText);
      const heading = op.slice('append: '.length).split(' · ')[0];
      const section = ast.sections.find(s => s.heading === heading)!;
      assert.ok(ast.sections.every(s => s.kind !== 'malformed'));
      if (section.kind === 'prose') assert.ok(section.lines.includes('A new fact'));
      else if (section.kind === 'checklist') assert.ok(section.steps.some(s => s.text === 'A new step' && s.mark === ' '));
      else if (section.kind === 'links') assert.ok(section.entries.some(e => e.label === 'Proof' && e.target === 'https://example.com/proof'));
      else if (section.kind === 'docs') assert.ok(section.entries.some(e => e.docId === 'new-note' && e.title === 'New note'));
      else assert.fail('append did not produce an eligible section');
      assert.doesNotMatch(JSON.stringify(ast.sections.find(s => s.heading === 'Summary')), /arbitrated/);
    }
    for (const op of ['append: Unknown section · text', 'append: Artifacts · not a link', 'append: Detail docs · bad', 'append: Checklist · text <!-- bad -->', 'append: Summary · ## Injected', 'append: Summary · ']) {
      const p = proposal(item, op);
      const result = arbitrate(item, [p]);
      assert.deepEqual(result.remaining, [p.filename], op);
      assert.deepEqual(result.deleted, []);
      assert.equal(result.receipts.length, 0);
    }
    const malformed = item.replace('## Checklist', '## Artifacts\nnot a valid entry\n\n## Checklist');
    const p = proposal(malformed, 'append: Artifacts · pr: [Proof](https://example.com/proof)');
    const result = arbitrate(malformed, [p]);
    assert.deepEqual(result.deleted, [p.filename], 'a valid append can coexist with opaque material');
    assert.match(result.itemText, /not a valid entry/);
    const recovered = parseItemFile(result.itemText).sections.find(s => s.heading === 'Artifacts');
    assert.ok(recovered?.kind === 'links' && recovered.entries.some(e => e.label === 'Proof'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('malformed proposals remain isolated and visible in global CLI diagnostics', () => {
  const dir = copyFixture();
  try {
    fs.writeFileSync(path.join(dir, rel.replace('.md', '.staged'), 'broken.md'), '# No frontmatter\n');
    const out = cli(dir, ['arbitrate', rel]);
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stderr, /proposal missing frontmatter/);
    assert.equal(fs.readFileSync(path.join(dir, rel.replace('.md', '.staged'), 'broken.md'), 'utf8'), '# No frontmatter\n');
    const parsed = parseItemFile(fs.readFileSync(path.join(dir, rel), 'utf8'));
    const steps = parsed.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []);
    assert.equal(steps.find(s => s.anchor === 'quickstart')?.mark, '!');
    assert.equal(steps.find(s => s.text === 'retire the old wiki page')?.mark, 'x');
    assert.equal(readJournals(dir)[0]?.receipts.length, 2);
    assert.notEqual(cli(dir, ['validate']).status, 0, 'global health still reports the malformed proposal');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('same-base CLI writers cannot both overwrite successfully', async () => {
  const dir = copyFixture();
  try {
    const before = fs.readFileSync(path.join(dir, plainRel), 'utf8');
    const run = (text: string) => new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', cliPath, 'write', plainRel, '--if-match', sha256(before), '--data', dir], { cwd: REPO_ROOT, stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', reject); child.on('exit', resolve); child.stdin.end(text);
    });
    const a = before.replace('bit me while testing', 'writer A');
    const b = before.replace('bit me while testing', 'writer B');
    assert.deepEqual((await Promise.all([run(a), run(b)])).sort(), [0, 3]);
    assert.ok([a, b].includes(fs.readFileSync(path.join(dir, plainRel), 'utf8')));
    assert.equal(readJournals(dir).filter(j => j.state === 'complete').length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const phase of ['prepared', 'replaced', 'before-cleanup']) {
  test(`process death at ${phase} preserves intent, recovers history and replays idempotently`, () => {
    const dir = copyFixture();
    try {
      const original = fs.readFileSync(path.join(dir, rel), 'utf8');
      const staged = path.join(dir, rel.replace('.md', '.staged'));
      const originals = fs.readdirSync(staged).map(filename => ({ filename, text: fs.readFileSync(path.join(staged, filename), 'utf8') }));
      const script = `import { arbitrateFile } from './src/core/arbitrate-file.ts'; arbitrateFile(${JSON.stringify(dir)}, ${JSON.stringify(rel)}, { hook: p => { if (p === ${JSON.stringify(phase)}) process.kill(process.pid, 'SIGKILL'); } });`;
      const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(child.signal, 'SIGKILL', child.stderr);
      assert.equal(fs.readdirSync(staged).length, 2, 'no cleanup before durable verification');
      const j = readJournals(dir)[0]!;
      assert.equal(j.before, original);
      assert.deepEqual(j.proposals, originals);
      recoverCommits(dir);
      const after = fs.readFileSync(path.join(dir, rel), 'utf8');
      const ast = parseItemFile(after);
      assert.equal(ast.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []).find(s => s.anchor === 'quickstart')?.mark, '!');
      assert.ok(!fs.existsSync(staged));
      assert.equal(readJournals(dir)[0]?.state, 'complete');
      // Identical IDs, including an overruled mark, cannot be reapplied later.
      for (const p of originals) stageProposal(dir, rel, p);
      arbitrateFile(dir, rel);
      assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), after);
      assert.ok(!fs.existsSync(staged));
      recoverCommits(dir);
      assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), after);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test('external edits are preserved before/after replacement and before cleanup; fresh-base reconciliation works', () => {
  for (const phase of ['before-replace', 'replaced', 'before-cleanup'] as const) {
    const dir = copyFixture();
    try {
      const file = path.join(dir, plainRel);
      const before = fs.readFileSync(file, 'utf8');
      const proposed = before + '\nAgent contribution\n';
      const external = before + '\nExternal contribution\n';
      assert.throws(() => commitFile(dir, plainRel, () => ({ text: proposed }), { expected: sha256(before), hook: p => { if (p === phase) fs.writeFileSync(file, external); } }), CommitConflict);
      assert.equal(fs.readFileSync(file, 'utf8'), external);
      const j = readJournals(dir)[0]!;
      assert.equal(j.state, 'conflict'); assert.equal(j.before, before); assert.equal(j.after, proposed); assert.equal(j.observed, external);
      const merged = external + '\nAgent contribution\n';
      commitFile(dir, plainRel, () => ({ text: merged }), { expected: sha256(external) });
      assert.equal(fs.readFileSync(file, 'utf8'), merged);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('recovery preserves divergent external bytes and retains staged proposals', () => {
  const dir = copyFixture();
  try {
    const file = path.join(dir, rel);
    assert.throws(() => arbitrateFile(dir, rel, { hook: phase => { if (phase === 'prepared') throw new Error('crash'); } }), /crash/);
    const external = fs.readFileSync(file, 'utf8') + '\nExternal edit\n';
    fs.writeFileSync(file, external);
    assert.throws(() => recoverCommits(dir), CommitConflict);
    assert.equal(fs.readFileSync(file, 'utf8'), external);
    assert.equal(fs.readdirSync(path.join(dir, rel.replace('.md', '.staged'))).length, 2);
    assert.equal(readJournals(dir)[0]?.state, 'conflict');
    arbitrateFile(dir, rel);
    assert.match(fs.readFileSync(file, 'utf8'), /External edit/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('propose scaffolds canonical refs; replay ID collisions keep fresh intent staged', () => {
  const dir = copyFixture();
  try {
    const out = cli(dir, ['propose', rel, '--op', 'append: Summary · A durable fact', '--intent', 'Keep evidence for the next session.', '--now', '2026-09-06T10:00']);
    assert.equal(out.status, 0, out.stderr);
    const stagedRel = out.stdout.trim();
    const proposalText = fs.readFileSync(path.join(dir, stagedRel), 'utf8');
    assert.match(proposalText, /item: tasks\/onboarding-doc-refresh-2026q3/);
    arbitrateFile(dir, rel);
    const before = fs.readFileSync(path.join(dir, rel), 'utf8');
    assert.ok(parseItemFile(before).sections.some(s => s.heading === 'Summary' && s.kind === 'prose' && s.lines.includes('A durable fact')));
    const p = { filename: path.basename(stagedRel), text: proposalText.replace('A durable fact', 'Different intent') };
    stageProposal(dir, rel, p);
    const result = arbitrateFile(dir, rel);
    assert.deepEqual(result.remaining, [p.filename]);
    assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), before);
    assert.equal(fs.readFileSync(path.join(dir, stagedRel), 'utf8'), p.text);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('triage and normalize use recoverable commits and refuse stale snapshots/sticky staging', () => {
  const dir = copyFixture();
  try {
    const schemas = SchemaSet.load(dir);
    const files = walkCorpus(dir);
    const staleRel = 'tasks/staging-db-migration-2026q3.md';
    const file = files.find(f => f.relPath === staleRel)!;
    const external = file.text + '\nExternal contribution\n';
    fs.writeFileSync(file.absPath, external);
    assert.throws(() => triage(dir, files.filter(f => f.relPath === staleRel), schemas, { now: '2026-09-06T10:00' }), CommitConflict);
    assert.equal(fs.readFileSync(file.absPath, 'utf8'), external);
    const actions = triage(dir, walkCorpus(dir), schemas, { now: '2026-09-06T10:00' });
    assert.ok(actions.some(a => a.relPath === rel && a.action.includes('swept')));
    assert.equal(fmGet(parseItemFile(fs.readFileSync(path.join(dir, rel), 'utf8')).fm, 'status'), 'blocked');
    assert.ok(readJournals(dir).some(j => j.target === rel && j.receipts.length === 2));
    const normalized = cli(dir, ['normalize', '--now', '2026-09-06T10:00']);
    assert.equal(normalized.status, 0, normalized.stderr);
    assert.ok(readJournals(dir).some(j => j.target === 'journal/prod-timeout-idea.md'));
    assert.ok(parseItemFile(fs.readFileSync(path.join(dir, 'journal/prod-timeout-idea.md'), 'utf8')).fm);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('historical Summary prose and legacy verdicts survive new arbitration and normalization', () => {
  const dir = copyFixture();
  try {
    const historical = 'Original context.\n\n- 2026-07-01 — arbitrated old-proposal: `set: eta = 2026-07-02` ⇒ applied';
    const base = fs.readFileSync(path.join(dir, rel), 'utf8');
    const item = base.replace(/(## Summary\n)[\s\S]*?(\n\n## Checklist)/, `$1${historical}$2`);
    fs.writeFileSync(path.join(dir, rel), item);
    arbitrateFile(dir, rel);
    const after = fs.readFileSync(path.join(dir, rel), 'utf8');
    assert.ok(after.includes(`## Summary\n${historical}\n\n## Checklist`));
    assert.ok(after.includes('## Arbitration history\n- 2026-07-05'));
    const out = cli(dir, ['normalize']);
    assert.equal(out.status, 0, out.stderr);
    assert.ok(fs.readFileSync(path.join(dir, rel), 'utf8').includes(`## Summary\n${historical}\n\n## Checklist`));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('read-only recovery and health diagnostics preserve all journal and proposal bytes', () => {
  const dir = copyFixture();
  try {
    assert.throws(() => arbitrateFile(dir, rel, { hook: phase => { if (phase === 'prepared') throw new Error('crash'); } }), /crash/);
    const before = JSON.stringify(readJournals(dir));
    const item = fs.readFileSync(path.join(dir, rel), 'utf8');
    const inspect = cli(dir, ['recover', '--dry-run']);
    assert.equal(inspect.status, 0, inspect.stderr);
    assert.match(inspect.stdout, /"state": "prepared"/);
    const health = cli(dir, ['doctor']);
    assert.equal(health.status, 0, health.stderr);
    assert.match(health.stdout, /prepared: tasks/);
    assert.equal(JSON.stringify(readJournals(dir)), before);
    assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), item);
    const recover = cli(dir, ['recover']);
    assert.equal(recover.status, 0, recover.stderr);
    assert.equal(readJournals(dir)[0]?.state, 'complete');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('replaying old receipts after a later write preserves the newer effects and points to original history', () => {
  const dir = copyFixture();
  try {
    const staged = path.join(dir, rel.replace('.md', '.staged'));
    const originalProposals = fs.readdirSync(staged).map(filename => ({ filename, text: fs.readFileSync(path.join(staged, filename), 'utf8') }));
    arbitrateFile(dir, rel);
    const first = readJournals(dir)[0]!;
    const before = fs.readFileSync(path.join(dir, rel), 'utf8');
    const newer = before.replace('status: blocked', 'status: done').replace('- [!] rewrite quickstart', '- [x] rewrite quickstart');
    commitFile(dir, rel, () => ({ text: newer }), { expected: sha256(before) });
    for (const p of originalProposals) stageProposal(dir, rel, p);
    arbitrateFile(dir, rel);
    assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), newer);
    const replay = readJournals(dir).find(j => j.receipts.some(r => r.replayed))!;
    assert.ok(replay.receipts.every(r => r.replayed && r.committedIn === first.id));
    assert.ok(!fs.existsSync(staged));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

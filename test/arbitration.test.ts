// Gates 6–7 (no-loss, confluence) plus the spec-readability regression oracle:
// the fixture's 2-proposal staged conflict has a fully determined outcome,
// derived from the spec alone and pinned in test/expected/.

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { arbitrate, type ProposalInput } from '../src/core/arbitrate.js';
import { sha256 } from '../src/core/corpus.js';
import { copyFixture, readExpected, REPO_ROOT } from './helpers.js';

const ITEM_REL = 'tasks/onboarding-doc-refresh-2026q3.md';
const STAGED_REL = 'tasks/onboarding-doc-refresh-2026q3.staged';

function loadConflict(dir: string): { item: string; proposals: ProposalInput[] } {
  const item = fs.readFileSync(path.join(dir, ITEM_REL), 'utf8');
  const stagedDir = path.join(dir, STAGED_REL);
  const proposals = fs
    .readdirSync(stagedDir)
    .filter((f) => f.endsWith('.md'))
    .map((filename) => ({ filename, text: fs.readFileSync(path.join(stagedDir, filename), 'utf8') }));
  return { item, proposals };
}

test('fixture invariant: staged base hashes match the item bytes (every .staged/ dir)', () => {
  const fixtures = path.join(REPO_ROOT, 'fixtures', 'arbiter-data');
  let checked = 0;
  for (const dir of ['tasks', 'goals', 'meetings', 'journal', 'accomplishments']) {
    const dirAbs = path.join(fixtures, dir);
    if (!fs.existsSync(dirAbs)) continue;
    for (const entry of fs.readdirSync(dirAbs)) {
      if (!entry.endsWith('.staged')) continue;
      const item = fs.readFileSync(path.join(dirAbs, `${entry.replace(/\.staged$/, '')}.md`), 'utf8');
      for (const p of fs.readdirSync(path.join(dirAbs, entry)).filter((f) => f.endsWith('.md'))) {
        const text = fs.readFileSync(path.join(dirAbs, entry, p), 'utf8');
        assert.ok(text.includes(`base: sha256:${sha256(item)}`), `${dir}/${entry}/${p}: base hash out of date`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 3, 'expected the onboarding pair plus the nested sub-task proposal');
});

test('regression oracle: arbitration matches the spec-derived expected bytes', () => {
  const { item, proposals } = loadConflict(path.join(REPO_ROOT, 'fixtures', 'arbiter-data'));
  const result = arbitrate(item, proposals);
  assert.equal(result.outcome, 'clean');
  assert.equal(result.itemText, readExpected('onboarding-arbitrated.md'));
  assert.deepEqual(result.deleted, [
    '2026-07-05-agent-heron-2c91-quickstart-blocked.md',
    '2026-07-05-agent-kestrel-7f3a-close-out.md',
  ]);
  assert.deepEqual(result.remaining, []);
});

test('resolution-line evidence links are comma-space separated (grammar §9)', () => {
  const { item, proposals } = loadConflict(path.join(REPO_ROOT, 'fixtures', 'arbiter-data'));
  const { itemText } = arbitrate(item, proposals);
  assert.match(
    itemText,
    /⇒ overruled \(\[[^\]]+\]\([^)]+\), \[[^\]]+\]\([^)]+\)\)/,
    'evidence separator must be ", "',
  );
  assert.ok(!/\)\s*,\S/.test(itemText), 'no missing space after comma in evidence lists');
});

test('gate 7 — confluence: any input order, any repetition, identical bytes', () => {
  const { item, proposals } = loadConflict(path.join(REPO_ROOT, 'fixtures', 'arbiter-data'));
  const forward = arbitrate(item, proposals).itemText;
  const reversed = arbitrate(item, [...proposals].reverse()).itemText;
  assert.equal(forward, reversed, 'arbitration depends on input order');
  // duplicate arbitration by a concurrent arbiter computes the same bytes
  assert.equal(arbitrate(item, proposals).itemText, forward);
  // arbitrating the arbitrated item with nothing staged is a no-op
  const again = arbitrate(forward, []);
  assert.equal(again.outcome, 'noop');
  assert.equal(again.itemText, forward);
});

test('gate 6 — no-loss: every op applied, overruled on the record, or still staged', () => {
  const { item, proposals } = loadConflict(path.join(REPO_ROOT, 'fixtures', 'arbiter-data'));
  // add a third proposal whose op no rule decides (conflicting non-status set)
  const mk = (name: string, ops: string, body: string, updated: string): ProposalInput => ({
    filename: name,
    text: `---
id: ${name.replace(/\.md$/, '')}
item: onboarding-doc-refresh-2026q3
base: sha256:${sha256(item)}
author: agent-test
updated: ${updated}
ops: [${ops}]
---

# test proposal

${body}

<!-- arbiter:staged · PROTOCOL.md#arbitration · pending proposal -->
`,
  });
  const p3 = mk("2026-07-05-agent-owl-1111-eta-a.md", "'set: eta = 2026-07-25'", 'ETA per the sprint plan.', '2026-07-05T18:00');
  const p4 = mk("2026-07-05-agent-owl-2222-eta-b.md", "'set: eta = 2026-08-01'", 'ETA per capacity.', '2026-07-05T18:05');

  const result = arbitrate(item, [...proposals, p3, p4]);
  assert.equal(result.outcome, 'partial');
  // conflicting eta proposals stay staged whole; the decided pair is deleted
  assert.deepEqual(result.remaining.sort(), [p3.filename, p4.filename].sort());
  assert.deepEqual(result.deleted, [
    '2026-07-05-agent-heron-2c91-quickstart-blocked.md',
    '2026-07-05-agent-kestrel-7f3a-close-out.md',
  ]);
  // the item is flagged for a human/arbiter session
  assert.match(result.itemText, /^status: blocked$/m);
  assert.match(result.itemText, /^review: needed$/m);
  // decided ops are all on the record
  assert.match(result.itemText, /arbitrated 2026-07-05-agent-heron-2c91-quickstart-blocked: `mark: \^quickstart = blocked` ⇒ applied/);
  assert.match(result.itemText, /`set: status = done` ⇒ overruled/);
  // no eta landed silently
  assert.ok(!/^eta:/m.test(result.itemText), 'undecided op must not be applied');
});

test('terminal reversal is never auto-resolved', () => {
  const dir = copyFixture();
  const doneItem = fs.readFileSync(path.join(dir, 'tasks/sso-timeout-fix-2026q3.md'), 'utf8');
  const reopen: ProposalInput = {
    filename: '2026-07-06-agent-owl-3333-reopen.md',
    text: `---
id: 2026-07-06-agent-owl-3333-reopen
item: sso-timeout-fix-2026q3
base: sha256:${sha256(doneItem)}
author: agent-owl-3333
updated: 2026-07-06T10:00
ops: ['set: status = in-flight']
---

# Reopen: timeouts back

Seeing 15-minute logouts again on [the dashboard](https://grafana.example.com/d/auth-errors).

<!-- arbiter:staged · PROTOCOL.md#arbitration · pending proposal -->
`,
  };
  const result = arbitrate(doneItem, [reopen]);
  assert.equal(result.outcome, 'partial');
  assert.deepEqual(result.deleted, []);
  assert.deepEqual(result.remaining, [reopen.filename]);
  assert.match(result.itemText, /^status: done$/m);
  const replay = arbitrate(result.itemText, [reopen]);
  assert.deepEqual(replay.remaining, [reopen.filename]);
  assert.match(replay.itemText, /^status: done$/m);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI arbitrate: writes the oracle bytes, deletes proposals, removes the emptied .staged/', () => {
  const dir = copyFixture();
  const cli = path.join(REPO_ROOT, 'src', 'cli', 'main.ts');
  execFileSync(process.execPath, ['--import', 'tsx', cli, 'arbitrate', 'tasks/onboarding-doc-refresh-2026q3', '--data', dir], {
    cwd: REPO_ROOT,
  });
  const after = fs.readFileSync(path.join(dir, ITEM_REL), 'utf8');
  assert.equal(after, readExpected('onboarding-arbitrated.md'));
  assert.ok(!fs.existsSync(path.join(dir, STAGED_REL)), 'emptied .staged/ should be removed');

  // the corpus must still validate green after arbitration
  const out = execFileSync(process.execPath, ['--import', 'tsx', cli, 'validate', '--data', dir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.match(out, / 0 error\(s\)/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI write --if-match: CAS succeeds on match, refuses on mismatch and on sticky staging', () => {
  const dir = copyFixture();
  const cli = path.join(REPO_ROOT, 'src', 'cli', 'main.ts');
  const rel = 'journal/railway-cli-gotcha.md';
  const current = fs.readFileSync(path.join(dir, rel), 'utf8');
  const next = current.replace('bit me while testing', 'bit me twice while testing');

  // mismatched hash refused
  assert.throws(() =>
    execFileSync(process.execPath, ['--import', 'tsx', cli, 'write', rel, '--if-match', '0'.repeat(64), '--data', dir], {
      cwd: REPO_ROOT,
      input: next,
    }),
  );
  // matched hash lands
  execFileSync(
    process.execPath,
    ['--import', 'tsx', cli, 'write', rel, '--if-match', sha256(current), '--data', dir],
    { cwd: REPO_ROOT, input: next },
  );
  assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), next);

  // sticky staging: direct writes to a contended item are refused even with a fresh hash
  const contended = 'tasks/onboarding-doc-refresh-2026q3.md';
  const cur = fs.readFileSync(path.join(dir, contended), 'utf8');
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ['--import', 'tsx', cli, 'write', contended, '--if-match', sha256(cur), '--data', dir],
      { cwd: REPO_ROOT, input: cur },
    ),
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

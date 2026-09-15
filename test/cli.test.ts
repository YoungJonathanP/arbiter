import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, FIXTURE_DIR } from './helpers.js';

function temporary(t: { after(fn: () => void): void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function cli(args: string[], options: { cwd?: string; data?: string; input?: string; entry?: string } = {}) {
  const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), options.entry ?? path.join(REPO_ROOT, 'src/cli/main.ts'), ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ARBITER_DATA: options.data ?? '' },
    input: options.input ?? '', encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  return result;
}

function bootstrap(dir: string): void {
  const result = cli(['init', '--data', dir, '--now', '2026-09-06T12:34']);
  assert.equal(result.status, 0, result.stderr);
}

test('CLI: help exits without KB selection or a listener; invalid arguments fail before selection', (t) => {
  const dir = temporary(t);
  for (const args of [['help'], ['--help'], ['-h'], ['serve', '--help'], ['new', '-h'], ['help', 'write']]) {
    const result = cli(args, { cwd: dir, data: path.join(dir, 'missing') });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /usage: arbiter/);
    assert.doesNotMatch(result.stdout + result.stderr, /http:\/\/|data:|no such/);
  }
  const bad = [
    ['nonesuch'], ['validate', 'tasks/a.md'], ['validate', '--typo'], ['validate', '--data'],
    ['new', 'meeting', 'Title', '--date'], ['new', 'meeting', 'Title', '--date', '--force'],
    ['hash', 'a', 'ignored'], ['write', 'a'], ['serve', '--port', 'NaN'], ['serve', '--port', '65536'],
    ['serve', 'ignored'], ['regen', '--full', 'ignored'], ['regen', '--full=false'],
    ['query', 'children'], ['query', 'chain', 'tasks/a', '--json'], ['query', 'staged', 'ignored'],
    ['query', 'page', 'journal', '-1'], ['query', 'active', 'unknown'], ['normalize', '--now', 'bad'],
    ['validate', '--now', '2026-09-06T12:34'], ['hash', '-x'], ['help', 'unknown'],
    ['validate', '--data', dir, '--data', dir],
  ];
  for (const args of bad) {
    const result = cli(args, { cwd: dir });
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stdout} ${result.stderr}`);
    assert.match(result.stderr, /usage: arbiter/);
    assert.doesNotMatch(result.stderr, /no arbiter-data directory found/);
  }
});

test('CLI: init is explicit, non-destructive, content-free and yields a healthy KB', (t) => {
  const root = temporary(t);
  const dir = path.join(root, 'new-kb');
  assert.equal(cli(['init'], { data: dir }).status, 2);
  bootstrap(dir);
  for (const name of ['tasks', 'goals', 'meetings', 'journal', 'accomplishments', 'decisions', 'findings', 'people']) {
    assert.deepEqual(fs.readdirSync(path.join(dir, name)), []);
  }
  assert.ok(fs.existsSync(path.join(dir, 'DASHBOARD.md')));
  const doctor = cli(['doctor', '--data', dir]);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.match(doctor.stdout, /protocol 0\.4\.17/);
  assert.match(doctor.stdout, /11 files, 0 error\(s\)/);
  const before = fs.readFileSync(path.join(dir, 'DASHBOARD.md'), 'utf8');
  assert.equal(cli(['init', '--data', dir]).status, 2);
  assert.equal(fs.readFileSync(path.join(dir, 'DASHBOARD.md'), 'utf8'), before);
  const occupied = path.join(root, 'occupied');
  fs.mkdirSync(occupied);
  fs.writeFileSync(path.join(occupied, 'notes.txt'), 'keep');
  assert.equal(cli(['init', '--data', occupied]).status, 2);
  assert.deepEqual(fs.readdirSync(occupied), ['notes.txt']);
});

test('CLI: missing, empty and malformed KBs have distinct diagnostics and selection precedence', (t) => {
  const root = temporary(t);
  const missing = path.join(root, 'missing');
  const failure = cli(['validate', '--data', missing], { data: FIXTURE_DIR });
  assert.equal(failure.status, 2);
  assert.match(failure.stderr, /source: --data/);
  assert.match(failure.stderr, /does not exist/);
  assert.equal(fs.existsSync(missing), false);
  for (const cmd of ['validate', 'doctor']) {
    const empty = cli([cmd, '--data', root]);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /empty bootstrap directory.*not initialized/);
  }
  assert.equal(cli(['regen', '--data', root]).status, 2);
  const dir = path.join(root, 'arbiter-data');
  bootstrap(dir);
  const env = cli(['doctor'], { cwd: root, data: dir });
  assert.match(env.stderr, /source: ARBITER_DATA/);
  const walk = cli(['doctor'], { cwd: root });
  assert.equal(walk.status, 0, walk.stderr);
  assert.match(walk.stderr, /source: cwd walk/);
  const nested = path.join(dir, 'meetings');
  assert.equal(cli(['doctor'], { cwd: nested }).status, 0);
  fs.writeFileSync(path.join(dir, 'PROTOCOL.md'), '---\nid: wrong\nversion: "99"\n---\n');
  const malformed = cli(['doctor', '--data', dir]);
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /protocol.*identity|PROTOCOL.*identity/);
  fs.unlinkSync(path.join(dir, 'PROTOCOL.md'));
  assert.equal(cli(['validate', '--data', dir]).status, 2);
});

test('CLI: schema identities and supported versions are checked before use', (t) => {
  const dir = temporary(t);
  bootstrap(dir);
  for (const version of ['0.4.6', '0.4.8', '0.4.9', '0.4.10', '0.4.11', '0.4.12', '0.4.13']) {
    for (const rel of ['PROTOCOL.md', 'types/_base.md']) {
      const target = path.join(dir, rel);
      fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/version: "[^"]+"/, `version: "${version}"`));
    }
    const result = cli(['doctor', '--data', dir]);
    assert.equal(result.status, 0, `${version}: ${result.stderr}`);
    assert.ok(result.stdout.includes(`protocol ${version}`));
  }
  const file = path.join(dir, 'types/meeting.md');
  const original = fs.readFileSync(file, 'utf8');
  for (const text of [original.replace('schema: meeting', 'schema: task'), original.replace('version: "0.4"', 'version: "99"'), original.replace('extends: _base', 'extends: missing')]) {
    fs.writeFileSync(file, text);
    const result = cli(['doctor', '--data', dir]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /types\/meeting.md/);
  }
});

test('CLI: meeting date, record date and quarter use --date while capture time stays separate', (t) => {
  const dir = temporary(t);
  bootstrap(dir);
  const now = '2026-09-06T12:34';
  const cases = [
    ['meeting', 'Future planning', '2028-02-29', 'meetings/future-planning-2028-02-29.md'],
    ['task', 'Quarter plan', '2027-01-01', 'tasks/quarter-plan-2027q1.md'],
    ['goal', 'Quarter goal', '2026-12-31', 'goals/quarter-goal-2026q4.md'],
    ['accomplishment', 'Quarter impact', '2026-04-01', 'accomplishments/quarter-impact-2026q2.md'],
    ['journal', 'Earlier notes', '2024-02-29', 'journal/earlier-notes.md'],
  ];
  for (const [type, title, date, rel] of cases) {
    const result = cli(['new', type!, title!, '--date', date!, '--now', now, '--data', dir]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), rel);
    const content = fs.readFileSync(path.join(dir, rel!), 'utf8');
    assert.match(content, /created: 2026-09-06\nupdated: 2026-09-06T12:34/);
    if (['meeting', 'journal', 'accomplishment'].includes(type!)) assert.ok(content.includes(`date: ${date}\n`));
  }
  for (const date of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '0000-01-01', '2026-1-01', '2026-01-00']) {
    const result = cli(['new', 'meeting', 'Invalid', '--date', date, '--data', dir]);
    assert.equal(result.status, 2, `${date}: ${result.stderr}`);
    assert.match(result.stderr, /--date/);
  }
  for (const now of ['2026-02-29T12:00', '2026-09-06T24:00', '2026-09-06T12:60']) {
    assert.equal(cli(['new', 'meeting', 'Invalid', '--now', now, '--data', dir]).status, 2);
  }
  assert.equal(cli(['new', 'task', 'Quarter plan', '--date', '2027-04-01', '--data', dir]).status, 1);
  assert.equal(cli(['new', 'task', 'Quarter plan', '--date', '2027-04-01', '--force', '--data', dir]).status, 0);
  assert.equal(cli(['new', 'meeting', '!!!', '--data', dir]).status, 2);
});

test('CLI: hash round-trips, bare digests work, format errors differ from contention', (t) => {
  const dir = temporary(t);
  bootstrap(dir);
  const run = (...args: string[]) => cli([...args, '--data', dir], { input: 'replacement\n' });
  assert.equal(run('write', 'journal/cas', '--if-match', 'new').status, 0);
  const hash = run('hash', 'journal/cas').stdout.trim();
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  for (const digest of [hash, hash.slice(7), hash.toUpperCase().replace('SHA256:', 'sha256:')]) {
    assert.equal(run('write', 'journal/cas', '--if-match', digest).status, 0);
  }
  const mismatch = run('write', 'journal/cas', '--if-match', '0'.repeat(64));
  assert.equal(mismatch.status, 3);
  assert.match(mismatch.stderr, /expected: sha256:0{64}/);
  assert.ok(mismatch.stderr.includes(`actual: ${hash}`));
  for (const digest of ['sha256:bad', 'bad', 'sha512:' + '0'.repeat(64)]) {
    const result = run('write', 'journal/cas', '--if-match', digest);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /digest format/);
    assert.doesNotMatch(result.stderr, /CAS mismatch/);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'journal/cas.md'), 'utf8'), 'replacement\n');
});

test('CLI: frozen corpora and symlink aliases reject all mutation commands; read-only checks work', (t) => {
  const root = temporary(t);
  // Relocate the package into a temporary directory. Even a broken guard must
  // never let this regression mutate the actual conformance corpora.
  const pkg = path.join(root, 'package');
  fs.mkdirSync(pkg);
  fs.cpSync(path.join(REPO_ROOT, 'src'), path.join(pkg, 'src'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(pkg, 'package.json'));
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(pkg, 'node_modules'));
  for (const rel of ['arbiter-data', 'fixtures/arbiter-data']) {
    fs.cpSync(FIXTURE_DIR, path.join(pkg, rel), { recursive: true });
  }
  const run = (args: string[]) => cli(args, { entry: path.join(pkg, 'src/cli/main.ts') });
  const alias = path.join(root, 'alias');
  fs.symlinkSync(path.join(pkg, 'fixtures/arbiter-data'), alias);
  for (const dir of [path.join(pkg, 'fixtures/arbiter-data'), path.join(pkg, 'arbiter-data'), alias]) {
    for (const args of [['new', 'journal', 'Probe'], ['regen'], ['triage'], ['normalize'], ['arbitrate', 'tasks/probe'], ['write', 'tasks/probe', '--if-match', 'new'], ['init']]) {
      const result = run([...args, '--data', dir]);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /frozen.*read-only/);
    }
    assert.equal(run(['validate', '--data', dir]).status, 0);
    assert.equal(run(['regen', '--dry-run', '--data', dir]).status, 0);
  }
  const dir = path.join(root, 'live');
  bootstrap(dir);
  assert.equal(cli(['write', '../escape', '--if-match', 'new', '--data', dir]).status, 2);
  fs.symlinkSync(path.join(pkg, 'fixtures/arbiter-data'), path.join(dir, 'tasks/frozen'));
  assert.equal(cli(['write', 'tasks/frozen/tasks/probe', '--if-match', 'new', '--data', dir]).status, 2);
});

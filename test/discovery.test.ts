import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { initData } from '../src/cli/data.js';
import { readProjection } from '../src/core/projection.js';
import { discover, dependencies } from '../src/core/discovery.js';
import { regenFull } from '../src/core/dashboard.js';
import { parseDashboard } from '../src/core/parse.js';
import { createArbiterServer } from '../src/web/server.js';
import { draftCheckpoint, previewHandoff, captureCheckpoint } from '../src/core/handoff.js';

function setup(t: { after(fn: () => void): void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-discovery-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  initData(dir);
  const write = (rel: string, text: string) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const item = (ref: string, meta = '', body = 'Searchable synthetic outcome.') => write(`${ref}.md`, `---\nid: ${ref.split('/')[1]}\ntype: ${ref.startsWith('goals/') ? 'goal' : 'task'}\ntitle: ${ref.split('/')[1]}\nstatus: todo\nupdated: 2026-09-08T10:00\n${meta}---\n\n# ${ref}\n\n## Summary\n\n${body}\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place -->\n`);
  item('goals/navigation-2026q3');
  for (let i = 0; i < 123; i++) item(`tasks/work-${String(i).padStart(3, '0')}-2026q3`, i < 17 ? 'parent: goals/navigation-2026q3\n' : '');
  item('tasks/secret-2026q3', 'visibility: private\nparent: goals/navigation-2026q3\n', 'CONFIDENTIAL fixture');
  item('tasks/archived-2026q3', 'archived: 2026-08-01\nparent: goals/navigation-2026q3\n');
  write('tasks/archived-2026q3/rationale.md', '# Transport decision\n\nUse copper instead of glass for the low latency link.\n');
  write('tasks/secret-2026q3/rationale.md', '# Secret copper decision\n');
  write('tasks/work-000-2026q3/checkpoints/old.md', 'Historical copper context must never appear.');
  return { dir, write, item };
}

test('discovery finds archived evidence by content with explicit tiers and archive ownership', t => {
  const { dir, write } = setup(t), snapshot = readProjection(dir);
  assert.equal(discover(snapshot, { q: 'copper' }).total, 0);
  const result = discover(snapshot, { q: 'copper', archive: 'include', tiers: '3' });
  assert.equal(result.total, 1);
  assert.equal(result.results[0]!.path, 'tasks/archived-2026q3/rationale.md');
  assert.match(result.results[0]!.preview, /copper/);
  assert.equal(result.results[0]!.archived, '2026-08-01');
  assert.equal(discover(snapshot, { q: 'copper', archive: 'only', tiers: '2' }).total, 0);
  assert.doesNotMatch(JSON.stringify(result), /CONFIDENTIAL|secret|Historical/);
  write('tasks/archived-2026q3/long.md', '# Long source\n\n' + 'background '.repeat(100) + 'needlephrase governs compatibility.\n');
  const long = discover(readProjection(dir), { q: 'needlephrase', archive: 'include' }).results[0]!;
  assert.match(long.preview, /needlephrase/);
  assert.ok(long.preview.length <= 240);
  assert.throws(() => discover(snapshot, { pageSize: 51 }), /page-size/);
  assert.throws(() => discover(snapshot, { tiers: '4' }), /tiers/);
  assert.throws(() => discover(snapshot, { page: Number.MAX_SAFE_INTEGER }), /page/);
});

test('all visible active work is reachable through bounded stable pages and bounded cards', t => {
  const { dir, item, write } = setup(t);
  item('tasks/orphan-2026q3', 'parent: tasks/secret-2026q3\n');
  const snapshot = readProjection(dir), found: string[] = [];
  let page = 0;
  for (;;) {
    const result = discover(snapshot, { tiers: '2', dir: 'tasks', page });
    assert.equal(result.total, 124);
    assert.ok(result.results.length <= 10);
    found.push(...result.results.map(r => r.path));
    if (result.nextPage === null) break;
    page = result.nextPage;
  }
  assert.equal(found.length, 124);
  assert.equal(new Set(found).size, 124);
  assert.ok(found.includes('tasks/orphan-2026q3.md'));
  const childResult = discover(snapshot, { tiers: '2', parent: 'goals/navigation-2026q3' });
  assert.equal(childResult.total, 17);
  assert.ok(childResult.results.every(r => r.parent === 'goals/navigation-2026q3'));
  const dash = parseDashboard(regenFull(snapshot.facts, null, { now: '2026-09-08T10:00', protocolRaw: '"0.4.13"' }));
  const tasks = dash.cards.find(c => c.label === 'Tasks')!;
  assert.equal(tasks.count, 124);
  assert.equal(tasks.rows.filter(r => r.kind === 'entry').length, 5);
  assert.deepEqual(tasks.rows.at(-1), { kind: 'overflow', count: 119, dir: 'tasks' });
  write('DASHBOARD.md', '# Stale counterfeit dashboard\n');
  assert.equal(discover(readProjection(dir), { tiers: '1', q: 'counterfeit' }).total, 0);
  assert.equal(discover(readProjection(dir), { tiers: '1', q: 'Tasks' }).total, 1);
  assert.deepEqual(discover({ ...snapshot, files: [...snapshot.files].reverse(), facts: [...snapshot.facts].reverse() }, { dir: 'tasks', tiers: '2' }).results,
    discover(snapshot, { dir: 'tasks', tiers: '2' }).results);
});

test('current checkpoint summaries assess stale observations and separate dependencies without history', t => {
  const { dir, write } = setup(t), ref = 'tasks/work-000-2026q3';
  const draft = draftCheckpoint(dir, ref, '2026-09-08T10:00');
  captureCheckpoint(dir, previewHandoff(dir, { ref, checkpoint: draft }));
  let summary = discover(readProjection(dir), { tiers: '2', q: 'work-000' }).results[0]!.checkpoint!;
  assert.notEqual(summary.readiness, 'ready');
  assert.ok(summary.nextAction.length <= 240);
  assert.ok(summary.reasons.length <= 3);
  assert.doesNotMatch(JSON.stringify(summary), /Historical copper/);
  const before = summary;
  write(`${ref}/checkpoints/old.md`, 'x'.repeat(500000));
  summary = discover(readProjection(dir), { tiers: '2', q: 'work-000' }).results[0]!.checkpoint!;
  assert.deepEqual(summary, before);
  assert.ok(dependencies(readProjection(dir), ref).length > 0, 'checkpoint start predicates are explicit');
});

test('human pages, JSON and CLI select identical pages; goal children and archives stay reachable', async t => {
  const { dir } = setup(t), server = createArbiterServer(dir);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const params = 'tiers=2&dir=tasks&page=2&page-size=7';
  const json = await (await fetch(`${base}/search?${params}&format=json`)).json() as ReturnType<typeof discover>;
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', 'search', '--tiers', '2', '--dir', 'tasks', '--page', '2', '--page-size', '7', '--json', '--data', dir], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), json);
  const html = await (await fetch(`${base}/dir/tasks?${params}`)).text();
  const main = html.split('<main>')[1]!.split('</main>')[0]!;
  assert.match(main, /123 results/);
  assert.match(main, />Previous<\/a>/);
  assert.match(main, />Next<\/a>/);
  assert.equal((main.match(/<article /g) ?? []).length, 7);
  for (const row of json.results) assert.ok(main.includes(`href="/item/${row.ref}"`));
  assert.doesNotMatch(main, /Tier 2 —|secret|CONFIDENTIAL/);
  const goal = await (await fetch(`${base}/item/goals/navigation-2026q3`)).text();
  assert.match(goal, /17 results/);
  assert.match(goal, /href="\/item\/tasks\/work-000-2026q3"/);
  assert.match(goal, /children.json/);
  const archived = await (await fetch(`${base}/search?q=copper&archive=only`)).text();
  assert.match(archived, /href="\/doc\/tasks\/archived-2026q3\/rationale"/);
  const dashboard = await (await fetch(`${base}/`)).text();
  assert.ok((dashboard.match(/class="nav-item/g) ?? []).length <= 25);
  assert.equal((await fetch(`${base}/search?page-size=1000`)).status, 400);
  const bad = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', 'search', '--archive', 'implicit', '--data', dir], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});

test('completed checklist text stays muted while explicit superseded prose retains deletion markup', async t => {
  const { dir, write } = setup(t);
  write('tasks/style-2026q3.md', '---\nid: style-2026q3\ntype: task\ntitle: Style\nstatus: done\nupdated: 2026-09-08T10:00\n---\n\n# Style\n\n## Checklist\n\n- [x] Completed work <!-- ^completed -->\n- [ ] ~~Superseded approach~~ Use current approach <!-- ^changed -->\n');
  const server = createArbiterServer(dir);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => server.close());
  const html = await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/item/tasks/style-2026q3`)).text();
  assert.match(html, /class="check done"[^>]*>[^]*?<span class="label">Completed work<\/span>/);
  assert.match(html, /<del>Superseded approach<\/del> Use current approach/);
  const doneRule = /\.check\.done \.label \{([^}]+)\}/.exec(html)![1]!;
  assert.match(doneRule, /color:var\(--muted\)/);
  assert.doesNotMatch(doneRule, /line-through/);
});

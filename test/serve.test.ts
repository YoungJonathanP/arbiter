// `arbiter serve` scaffold: read-only rendering of a live data directory.
// Assertions run against the fixture corpus (with its staged conflict).

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { parseDashboard } from '../src/core/parse.js';
import { fmGet } from '../src/core/fm.js';
import { regenFull } from '../src/core/dashboard.js';
import { readProjection } from '../src/core/projection.js';
import { createArbiterServer } from '../src/web/server.js';
import { copyFixture } from './helpers.js';

async function withServer(dir: string, fn: (base: string) => Promise<void>): Promise<void> {
  const server = createArbiterServer(dir);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('serve: dashboard, item, doc, dir, protocol and raw routes render', async () => {
  const dir = copyFixture();
  await withServer(dir, async (base) => {
    const dash = await (await fetch(`${base}/`)).text();
    assert.match(dash, /Onboarding doc refresh/);
    assert.match(dash, /2 staged/);
    assert.match(dash, /protocol <b>0\.4\.6<\/b>/);

    const item = await (await fetch(`${base}/item/tasks/staging-db-migration-2026q3`)).text();
    assert.match(item, /Staging DB migration/);
    assert.match(item, /blocked-by/);
    assert.match(item, /href="\/item\/goals\/q3-deploy-pipeline-2026q3#\^railway-predeploy"/);

    const doc = await (await fetch(`${base}/doc/tasks/railway-predeploy-hook-2026q3/rollout-plan`)).text();
    assert.match(doc, /Rollout plan/);

    const listing = await (await fetch(`${base}/dir/goals?archive=include`)).text();
    assert.match(listing, /archived 2026-07-01/); // archives are explicitly requested, flagged

    const raw = await (await fetch(`${base}/raw/DASHBOARD.md`)).text();
    const snapshot = readProjection(dir);
    assert.equal(raw, regenFull(snapshot.facts, fs.readFileSync(`${dir}/DASHBOARD.md`, 'utf8'), {
      now: fmGet(parseDashboard(raw).fm, 'generated')!, protocolRaw: '"0.4.6"', inputs: snapshot.inputs,
    })); // raw/agent dashboard = the verified current projection

    const protocol = await (await fetch(`${base}/protocol`)).text();
    assert.match(protocol, /Arbiter agent protocol/);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: a parent task nests its sub-tasks; the sub-task stays off the dashboard card', async () => {
  const dir = copyFixture();
  await withServer(dir, async (base) => {
    const parent = await (await fetch(`${base}/item/tasks/railway-predeploy-hook-2026q3`)).text();
    assert.match(parent, /Sub-tasks · derived/);
    assert.match(parent, /href="\/item\/tasks\/predeploy-rollback-verify-2026q3"/);
    assert.match(parent, /1 staged/); // child's pending proposal visible from the parent

    const child = await (await fetch(`${base}/item/tasks/predeploy-rollback-verify-2026q3`)).text();
    assert.match(child, /Pre-deploy rollback verification/);
    assert.match(child, /1 staged proposal\(s\) pending/);

    const dash = await (await fetch(`${base}/`)).text();
    // tier-1 card: parent carries the rolled-up flag; the sub-task has no card entry
    assert.match(dash, /class="nav-item sub"/); // sidenav nests it instead
    assert.ok(
      !/class="card-item[^"]*"><a href="\/item\/tasks\/predeploy-rollback-verify-2026q3"/.test(dash),
      'sub-task must not be a dashboard card entry',
    );
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: dashboard color-codes each goal and the tasks that roll up to it', async () => {
  const dir = copyFixture();
  await withServer(dir, async (base) => {
    const dash = await (await fetch(`${base}/`)).text();
    assert.match(dash, /--epic-0:/); // palette defined
    assert.match(dash, /@media \(prefers-color-scheme: dark\)/); // mode-aware variants
    const epicOf = (ref: string): string | undefined =>
      dash.match(new RegExp(`--epic:var\\((--epic-\\d)\\)"><a href="/item/${ref.replace(/\//g, '\\/')}"`))?.[1];
    const goal = epicOf('goals/q3-deploy-pipeline-2026q3');
    const task = epicOf('tasks/railway-predeploy-hook-2026q3');
    assert.ok(goal, 'the active goal is color-coded on the dashboard');
    assert.equal(task, goal, 'a task rolls up to its owning goal color');
    // a task with no owning goal stays neutral (no epic style)
    assert.ok(
      !/--epic:var\(--epic-\d\)"><a href="\/item\/tasks\/onboarding-doc-refresh-2026q3"/.test(dash),
      'a goal-less task must not be color-coded',
    );
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: staged proposals surface on the contended item with their intents', async () => {
  const dir = copyFixture();
  await withServer(dir, async (base) => {
    const item = await (await fetch(`${base}/item/tasks/onboarding-doc-refresh-2026q3`)).text();
    assert.match(item, /2 staged proposal\(s\) pending/);
    assert.match(item, /agent-heron-2c91/);
    assert.match(item, /mark: \^quickstart = done/); // ops visible
    assert.match(item, /arbiter arbitrate tasks\/onboarding-doc-refresh-2026q3/);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: raw human entries render with the pending-normalization banner', async () => {
  const dir = copyFixture();
  await withServer(dir, async (base) => {
    const item = await (await fetch(`${base}/item/journal/prod-timeout-idea`)).text();
    assert.match(item, /raw human entry/);
    assert.match(item, /Prod timeouts spike/);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: tier 2 and tier 3 views offer the data-relative path for copying; tier 1 does not', async () => {
  const dir = copyFixture();
  await withServer(dir, async (base) => {
    const item = await (await fetch(`${base}/item/tasks/staging-db-migration-2026q3`)).text();
    assert.match(item, /class="copy-path" data-copy="tasks\/staging-db-migration-2026q3\.md"/);

    const doc = await (await fetch(`${base}/doc/tasks/railway-predeploy-hook-2026q3/rollout-plan`)).text();
    assert.match(doc, /class="copy-path" data-copy="tasks\/railway-predeploy-hook-2026q3\/rollout-plan\.md"/);

    for (const route of ['/', '/dir/tasks', '/protocol']) {
      const html = await (await fetch(`${base}${route}`)).text();
      assert.ok(!html.includes('class="copy-path"'), `${route} must not carry the copy affordance`);
    }
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: HTML is escaped and path traversal is refused', async () => {
  const dir = copyFixture();
  // plant an item whose prose tries to inject markup
  fs.writeFileSync(
    `${dir}/journal/xss-attempt.md`,
    '# <script>alert(1)</script>\n\nprose with <img src=x onerror=alert(1)> tag\n',
  );
  await withServer(dir, async (base) => {
    const item = await (await fetch(`${base}/item/journal/xss-attempt`)).text();
    assert.ok(!item.includes('<script>alert'), 'script tag must be escaped');
    assert.ok(!item.includes('<img src=x'), 'img tag must be escaped');
    assert.match(item, /&lt;script&gt;/);

    const traversal = await fetch(`${base}/raw/..%2Fpackage.json`);
    assert.equal(traversal.status, 404);
    const abs = await fetch(`${base}/raw/%2Fetc%2Fhosts`);
    assert.equal(abs.status, 404);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: prose renders inline markdown and reflows hard-wrapped source lines', async () => {
  const dir = copyFixture();
  // Files are hard-wrapped for editing, so an emphasis span routinely straddles a
  // source newline and a paragraph's line breaks are soft.
  fs.writeFileSync(
    `${dir}/journal/markdown-prose.md`,
    [
      '# Markdown prose',
      '',
      '## Summary',
      'Define a **uniformity',
      'template** and an *audit skill*; `**not bold**` stays literal and',
      'MORTGAGE_MARKETPLACE_CLIENT keeps its underscores.',
      '',
      '- first **bullet**',
      '- second bullet, wrapped',
      '  onto a continuation line',
      '',
      '1. ordered one',
      '2. ordered two',
      '',
      '### Section H',
      'body under the heading',
      '',
      '> quoted claim, wrapped',
      '> onto a second line',
      '',
    ].join('\n'),
  );
  await withServer(dir, async (base) => {
    const item = await (await fetch(`${base}/item/journal/markdown-prose`)).text();
    assert.match(item, /Define a <strong>uniformity template<\/strong>/); // emphasis survives the wrap
    assert.match(item, /an <em>audit skill<\/em>/);
    assert.match(item, /<code>\*\*not bold\*\*<\/code>/); // code spans are not emphasis
    assert.match(item, /MORTGAGE_MARKETPLACE_CLIENT/);
    assert.ok(!/MORTGAGE<em>/.test(item), 'snake_case must not become emphasis');
    assert.ok(!item.includes('<br>'), 'soft line breaks must reflow, not hard-break');
    assert.match(item, /<ul class="prose-list"><li>first <strong>bullet<\/strong><\/li>/);
    assert.match(item, /<li>second bullet, wrapped onto a continuation line<\/li><\/ul>/);
    assert.match(item, /<ol class="prose-list"><li>ordered one<\/li><li>ordered two<\/li><\/ol>/);
    // an in-prose heading breaks the block instead of absorbing the text after it
    assert.match(item, /<h5 class="prose-h">Section H<\/h5><p class="summary-text">body under the heading<\/p>/);
    assert.match(item, /<blockquote class="prose-quote">quoted claim, wrapped onto a second line<\/blockquote>/);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: wikilinks resolve to the file they name, or degrade to plain text', async () => {
  const dir = copyFixture();
  fs.writeFileSync(
    `${dir}/journal/wikilink-prose.md`,
    ['# Wikilink prose', '', '## Summary', 'Detail in [[railway-predeploy-hook-2026q3]] and [[rollout-plan]]; owner [[Dana]].', ''].join('\n'),
  );
  await withServer(dir, async (base) => {
    const item = await (await fetch(`${base}/item/journal/wikilink-prose`)).text();
    assert.match(item, /<a href="\/item\/tasks\/railway-predeploy-hook-2026q3">railway-predeploy-hook-2026q3<\/a>/);
    assert.match(item, /<a href="\/doc\/tasks\/railway-predeploy-hook-2026q3\/rollout-plan">rollout-plan<\/a>/);
    assert.match(item, /owner Dana\./); // no target: bare text, never brackets
    assert.ok(!/\[\[/.test(item.split('<details class="agent">')[0]!), 'no raw wikilink brackets in the rendered body');
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('serve: current human, agent, preview and raw views exclude private files and relationships', async t => {
  const dir = copyFixture();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const rel = 'tasks/staging-db-migration-2026q3.md';
  const secretRef = 'tasks/secret-2026q3';
  const secret = '---\nid: secret-2026q3\ntype: task\ntitle: Confidential launch\nstatus: todo\nvisibility: private\nupdated: 2026-09-07T09:00\n---\n\n# Confidential launch\n\nHidden body.\n';
  fs.writeFileSync(`${dir}/${secretRef}.md`, secret);
  fs.mkdirSync(`${dir}/${secretRef}`);
  fs.writeFileSync(`${dir}/${secretRef}/notes.md`, '# Secret document\n');
  fs.mkdirSync(`${dir}/${secretRef}.staged`);
  fs.writeFileSync(`${dir}/${secretRef}.staged/proposal.md`, '# Secret proposal\n');
  fs.writeFileSync(`${dir}/${rel}`, fs.readFileSync(`${dir}/${rel}`, 'utf8')
    .replace('status: blocked', `status: in-flight\nrelated: [${secretRef}]`)
    .replace('## Summary', `## Summary\nSee [Confidential launch](${secretRef}.md).`));
  const stored = fs.readFileSync(`${dir}/DASHBOARD.md`, 'utf8');
  fs.writeFileSync(`${dir}/DASHBOARD.md`, stored.replace('## Tasks (4)', `## Tasks (5)\n- [todo] Confidential launch — 2026-09-07 -> ${secretRef}.md`));
  const privateDoc = 'tasks/staging-db-migration-2026q3/private-notes.md';
  fs.mkdirSync(`${dir}/tasks/staging-db-migration-2026q3`, { recursive: true });
  fs.writeFileSync(`${dir}/${privateDoc}`, '---\nvisibility: private\ntitle: Hidden appendix\n---\n\n# Hidden appendix\n');
  fs.appendFileSync(`${dir}/${rel}`, `\n## Detail docs\n- [[private-notes]] Hidden appendix (note) -> ${privateDoc}\n`);
  const sourceBefore = fs.readFileSync(`${dir}/${rel}`, 'utf8');
  await withServer(dir, async base => {
    for (const route of ['/', '/raw/DASHBOARD.md', '/dir/tasks', `/item/${rel.replace(/\.md$/, '')}`, `/raw/${rel}`]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      const text = await response.text();
      assert.doesNotMatch(text, /Confidential|secret-2026q3|Hidden body|Secret proposal|Hidden appendix|private-notes/);
      if (route === '/') {
        assert.match(text, /files verified/);
        assert.match(text, /inputs <b>sha256:/);
        assert.match(text, /\[in-flight\] Staging DB migration/); // current agent bytes, same old updated
      }
    }
    for (const route of [`/item/${secretRef}`, `/doc/${secretRef}/notes`, `/raw/${secretRef}.md`, `/raw/${secretRef}/notes.md`, `/raw/${secretRef}.staged/proposal.md`, '/raw/.arbiter/transactions/secret.json', `/raw/${privateDoc}`, '/doc/tasks/staging-db-migration-2026q3/private-notes']) {
      assert.equal((await fetch(base + route)).status, 404);
    }
  });
  assert.equal(fs.readFileSync(`${dir}/${rel}`, 'utf8'), sourceBefore);
  assert.equal(fs.readFileSync(`${dir}/${secretRef}.md`, 'utf8'), secret);
});

test('serve: the board and the side nav share one display order', async () => {
  const dir = copyFixture();
  const expected = ['tasks', 'journal', 'goals', 'accomplishments', 'meetings', 'people', 'findings', 'decisions'];
  await withServer(dir, async (base) => {
    const dash = await (await fetch(`${base}/`)).text();
    const cards = [...dash.matchAll(/<a class="card-head" href="\/dir\/([a-z]+)"/g)].map((m) => m[1]);
    assert.ok(cards.length > 1, 'the fixture board renders cards');
    // the fixture has no entry for every type, so the board is a subsequence of the display order
    assert.deepEqual(cards, expected.filter((d) => cards.includes(d)), 'cards read row-major across the two-column board');
    const nav = [...dash.matchAll(/<a class="n-label" href="\/dir\/([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(nav, expected, 'the side nav reads in the same order as the board');
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

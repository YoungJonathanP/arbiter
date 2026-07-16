// `arbiter serve` scaffold: read-only rendering of a live data directory.
// Assertions run against the fixture corpus (with its staged conflict).

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
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

    const listing = await (await fetch(`${base}/dir/goals`)).text();
    assert.match(listing, /archived 2026-07-01/); // archived stays visible, flagged

    const raw = await (await fetch(`${base}/raw/DASHBOARD.md`)).text();
    assert.equal(raw, fs.readFileSync(`${dir}/DASHBOARD.md`, 'utf8')); // view-as-agent = exact bytes

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

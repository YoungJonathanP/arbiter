import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { arbitrate, opSatisfied } from '../src/core/arbitrate.js';
import { sha256, walkCorpus } from '../src/core/corpus.js';
import { projectItem } from '../src/core/equal.js';
import { normalize } from '../src/core/normalize.js';
import { parseItemFile, parseOp } from '../src/core/parse.js';
import { readProjection } from '../src/core/projection.js';
import { SchemaSet } from '../src/core/schema.js';
import { serializeItem } from '../src/core/serialize.js';
import { validateCorpus } from '../src/core/validate.js';
import { createArbiterServer } from '../src/web/server.js';
import { copyFixture, fixtureContext, FIXTURE_DIR, REPO_ROOT } from './helpers.js';

const rel = 'tasks/recovery-2026q3.md';
const malformedLink = '- note: [Annotated](https://example.com) — trailing annotation   ';
const malformedDoc = '- [[bad]] Annotated (note) -> tasks/recovery-2026q3/bad.md extra';
const malformedStep = '- [?] Unknown mark <!-- ^unknown -->   ';
const orphan = '      see: [Orphan](tasks/missing-2026q3.md)';
const text = `---
id: recovery-2026q3
type: task
title: Recovery
status: todo
updated: 2026-09-07T10:00
---


# Recovery

## Summary
Synthetic recovery case.

## Checklist

* [X] First <!-- ^first -->

  see: [Public](https://example.com/first)
${malformedStep}
${orphan}

- [ ] Last <!-- ^last -->
      see: [Broken anchor](tasks/recovery-2026q3.md#^missing)

## Artifacts

${Array.from({ length: 8 }, (_, i) => `- note: [Link ${i} (accepted annotation)](https://example.com/${i})`).join('\n')}
${malformedLink}

- note: [Last link](https://example.com/last)
- note: [Broken path](tasks/missing-2026q3.md)

## Detail docs

- [[first]] First doc (accepted annotation) (note) -> tasks/recovery-2026q3/first.md
${malformedDoc}

- [[last]] Last doc (plan) -> tasks/recovery-2026q3/last.md

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place -->
`;
const lineOf = (source: string, line: string) => source.split('\n').indexOf(line) + 1;

function install(dir: string, source = text) {
  fs.writeFileSync(`${dir}/${rel}`, source);
  fs.mkdirSync(`${dir}/tasks/recovery-2026q3`, { recursive: true });
  for (const id of ['first', 'last']) fs.writeFileSync(`${dir}/tasks/recovery-2026q3/${id}.md`, `# ${id}\n`);
}

test('recovery retains ordered neighbors, opaque bytes and blanks across repeated normalization and round trips', () => {
  const ast = parseItemFile(text);
  const links = ast.sections.find(s => s.kind === 'links');
  const docs = ast.sections.find(s => s.kind === 'docs');
  const steps = ast.sections.find(s => s.kind === 'checklist');
  assert.equal(links?.entries.length, 10);
  assert.equal(docs?.entries.length, 2);
  assert.deepEqual(steps?.steps.map(s => [s.text, s.continuations.map(c => c.label)]), [['First', ['Public']], ['Last', ['Broken anchor']]]);
  assert.equal(links?.entries[0]?.rawLine, lineOf(text, '- note: [Link 0 (accepted annotation)](https://example.com/0)'));
  const once = normalize(rel, text, fixtureContext(FIXTURE_DIR));
  assert.ok(once.flags.some(f => f.includes(`${rel}:${lineOf(text, malformedLink)}:`) && f.includes('expected link-entry')));
  for (const raw of [malformedLink, malformedDoc, malformedStep, orphan]) assert.ok(once.text.includes(`\n${raw}\n`));
  assert.ok(once.text.indexOf('Link 7') < once.text.indexOf(malformedLink));
  assert.ok(once.text.indexOf(malformedLink) < once.text.indexOf('Last link'));
  assert.ok(once.text.includes(`\n${malformedLink}\n\n- note: [Last link]`));
  assert.ok(once.text.includes('- [x] First <!-- ^first -->\n\n      see:'));
  assert.deepEqual(projectItem(ast), projectItem(parseItemFile(once.text)));
  let current = once.text;
  for (let i = 0; i < 4; i++) {
    current = normalize(rel, serializeItem(parseItemFile(current)), fixtureContext(FIXTURE_DIR)).text;
    assert.equal(current, once.text);
  }
});

test('diagnostics identify original lines and distinguish malformed syntax from unresolved paths and anchors', () => {
  const dir = copyFixture();
  try {
    install(dir);
    const report = validateCorpus(dir, walkCorpus(dir), SchemaSet.load(dir));
    const malformed = report.warnings.filter(d => d.relPath === rel && d.code === 'malformed-entry');
    assert.deepEqual(malformed.map(d => d.line), [malformedStep, orphan, malformedLink, malformedDoc].map(l => lineOf(text, l)));
    assert.ok(malformed.every(d => d.expected && d.message.includes('preserved verbatim')));
    const broken = report.errors.filter(d => d.relPath === rel && d.code === 'broken-target');
    assert.equal(broken.length, 2, 'opaque apparent targets are never validated as links');
    const cli = spawnSync(process.execPath, ['--import', 'tsx', `${REPO_ROOT}/src/cli/main.ts`, 'validate', '--data', dir], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(cli.status, 1, cli.stderr);
    assert.ok(cli.stdout.includes(`warning ${rel}:${lineOf(text, malformedLink)}: malformed entry`));
    assert.ok(cli.stdout.includes(`ERROR   ${rel}:${lineOf(text, '- note: [Broken path](tasks/missing-2026q3.md)')}: Artifacts entry target does not resolve`));
    assert.equal(fs.readFileSync(`${dir}/${rel}`, 'utf8'), text);
    assert.deepEqual(broken.map(d => d.line), [lineOf(text, '      see: [Broken anchor](tasks/recovery-2026q3.md#^missing)'), lineOf(text, '- note: [Broken path](tasks/missing-2026q3.md)')]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function proposal(source: string, op: string) {
  const id = '2026-09-07-agent-recovery';
  return { filename: `${id}.md`, text: `---\nid: ${id}\nitem: tasks/recovery-2026q3\nbase: sha256:${sha256(source)}\nauthor: agent-recovery\nupdated: 2026-09-07T11:00\nops: ['${op}']\n---\n\n# Intent\n\nSynthetic intent.\n` };
}

test('arbitration verifies recovered appends and marks, deduplicates without coordinates, and keeps malformed ops staged', () => {
  for (const opText of ['append: Artifacts · note: [Added](https://example.com/added)', 'append: Detail docs · [[added]] Added (note) -> tasks/recovery-2026q3/added.md', 'append: Checklist · Added step', 'mark: ^last = done']) {
    const result = arbitrate(text, [proposal(text, opText)]);
    assert.equal(result.deleted.length, 1, opText);
    assert.ok(opSatisfied(parseItemFile(result.itemText), parseOp(opText)!));
    for (const raw of [malformedLink, malformedDoc, malformedStep, orphan]) assert.ok(result.itemText.includes(`\n${raw}\n`));
    assert.equal(serializeItem(parseItemFile(result.itemText)), result.itemText);
  }
  const duplicate = 'append: Artifacts · note: [Last link](https://example.com/last)';
  const result = arbitrate(text, [proposal(text, duplicate)]);
  const deduped = parseItemFile(result.itemText).sections.find(s => s.kind === 'links');
  assert.equal(deduped?.entries.filter(e => e.label === 'Last link').length, 1);
  for (const opText of ['append: Artifacts · note: [Annotated](https://example.com) — trailing annotation', 'append: Detail docs · [[bad]] Annotated (note) -> tasks/recovery-2026q3/bad.md extra', 'mark: ^unknown = done']) {
    const p = proposal(text, opText);
    assert.equal(opSatisfied(parseItemFile(text), parseOp(opText)!), false);
    assert.deepEqual(arbitrate(text, [p]).remaining, [p.filename]);
  }
});

test('renderer keeps navigation and actionable diagnostics in source order without exposing private lines', async () => {
  const dir = copyFixture();
  const privateLine = '- note: [Hidden](tasks/secret-recovery-2026q3.md) trailing';
  const source = text.replace('status: todo', 'status: in-flight\nrelated: [tasks/secret-recovery-2026q3]').replace(malformedLink, `${privateLine}\n${malformedLink}`);
  install(dir, source);
  fs.writeFileSync(`${dir}/tasks/secret-recovery-2026q3.md`, '---\nid: secret-recovery-2026q3\ntype: task\ntitle: Secret Recovery\nvisibility: private\n---\n\n# Secret Recovery\n');
  const server = createArbiterServer(dir);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const html = await (await fetch(`${base}/item/tasks/recovery-2026q3`)).text();
    assert.match(html, /href="https:\/\/example.com\/7"/);
    assert.match(html, /href="\/doc\/tasks\/recovery-2026q3\/last"/);
    assert.ok(html.indexOf('href="https://example.com/7"') < html.indexOf('Annotated](https://example.com)'));
    assert.ok(html.indexOf('Annotated](https://example.com)') < html.indexOf('href="https://example.com/last"'));
    assert.ok(html.includes(`Line ${lineOf(source, malformedLink)}: malformed entry; expected link-entry`));
    assert.match(html, /broken target:.*anchor does not resolve/);
    assert.match(html, /Correct the path or anchor/);
    assert.doesNotMatch(html, /secret-recovery|Secret Recovery/);
    const raw = await (await fetch(`${base}/raw/${rel}`)).text();
    assert.doesNotMatch(raw, /secret-recovery/);
    assert.match(raw, /status: in-flight/);
    assert.doesNotMatch(html, /Raw human file/);
    const projection = readProjection(dir);
    assert.equal(projection.facts.find(f => f.relPath === rel)?.docs.length, 2);
    assert.equal(projection.facts.find(f => f.relPath === rel)?.status, 'in-flight');
    assert.equal(fs.readFileSync(`${dir}/${rel}`, 'utf8'), source);
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

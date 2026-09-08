// Shared default audience: private items and their owned files never enter a
// derived view. Explicit filesystem access is outside this projection API.
import type { ItemFacts } from './facts.js';
import type { CorpusFile } from './corpus.js';
import { fmGet } from './fm.js';
import { parseItemFile } from './parse.js';

export function visibilityPolicy(facts: ItemFacts[], files: CorpusFile[] = []) {
  const hidden = facts.filter(f => f.visibility === 'private');
  const privateDocs = facts.flatMap(f => f.docs.filter(d => d.visibility === 'private'));
  const privateFiles = files.filter(f => f.kind !== 'checkpoint-history' && fmGet(parseItemFile(f.text).fm, 'visibility') === 'private');
  const paths = new Set([...hidden.map(f => f.relPath), ...privateFiles.map(f => f.relPath), ...privateDocs.map(d => d.relPath)]);
  const tokens = [...new Set([...hidden.flatMap(f => [f.ref, f.id, f.title]),
    ...privateDocs.flatMap(d => [d.relPath, d.docId, d.title]),
    ...privateFiles.flatMap(f => [f.relPath, f.relPath.split('/').at(-1)!.replace(/\.md$/, ''), fmGet(parseItemFile(f.text).fm, 'title') ?? ''])])].filter(Boolean);
  const allowsPath = (rel: string): boolean => !/^tasks\/[^/]+\/checkpoints\//.test(rel) && !paths.has(rel) && !hidden.some(f => rel.startsWith(`${f.ref}/`) || rel.startsWith(`${f.ref}.staged/`));
  // Drop complete source lines carrying a known private identifier/title. This
  // also protects raw/agent previews; canonical source files remain untouched.
  const redact = (text: string): string => text.split('\n').filter(line => !tokens.some(token => line.includes(token))).join('\n');
  // Keep a mapping to original lines without inserting off-grammar frontmatter.
  const redactSource = (text: string) => {
    const sourceLines: number[] = [];
    const lines: string[] = [];
    text.split('\n').forEach((line, i) => {
      if (tokens.some(token => line.includes(token))) return;
      lines.push(line);
      sourceLines.push(i + 1);
    });
    return { text: lines.join('\n'), sourceLines };
  };
  return { allowsPath, redact, redactSource };
}

export function visibleFacts(facts: ItemFacts[]): ItemFacts[] {
  const policy = visibilityPolicy(facts);
  const refs = new Set(facts.filter(f => policy.allowsPath(f.relPath)).map(f => f.ref));
  return facts.filter(f => policy.allowsPath(f.relPath)).map(f => ({
    ...f,
    title: policy.redact(f.title) || f.id,
    summaryFirst: f.summaryFirst === undefined ? undefined : policy.redact(f.summaryFirst),
    parent: f.parent && refs.has(f.parent) ? f.parent : undefined,
    prev: f.prev && refs.has(f.prev) ? f.prev : undefined,
    related: f.related.filter(ref => refs.has(ref)),
    steps: f.steps.filter(s => policy.redact(s.text) === s.text),
    docs: f.docs.filter(d => d.visibility !== 'private' && policy.allowsPath(d.relPath) && policy.redact(d.title) === d.title),
  }));
}

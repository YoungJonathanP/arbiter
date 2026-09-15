// Read-only migration analysis. The caller explicitly selects sources and authors
// role/scope decisions. This module neither walks a KB nor writes/adopts a contract.
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { parseItemFile } from './parse.js';
import { fmGet, fmGetList } from './fm.js';

export type MigrationRole = 'assignment' | 'coordination' | 'dependency' | 'history';
export interface MigrationSource { path: string; bytes: Buffer }
export interface MigrationChoice {
  path: string;
  role: MigrationRole;
  rationale: string;
  // Explicit anchor choices override the file's role; never manufacture task IDs.
  anchors?: Record<string, { role: MigrationRole; target: string; rationale: string }>;
}
export interface MigrationLink {
  target: string;
  state: 'resolved' | 'uninspected' | 'invalid' | 'external-unverified';
}
const digest = (bytes: Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const safePath = (p: string) => !!p && !p.startsWith('/') && !/[\\#:\s]/.test(p)
  && p.split('/').every(part => !!part && part !== '.' && part !== '..');

/** Deliberately inspect only the supplied bytes. Unknown link syntax/targets stay
 * unresolved; this is not a general Markdown validator or a publication filter.
 * Keep manifests of private inputs outside shareable repositories. */
export function migrationDryRun(sources: readonly MigrationSource[], choices: readonly MigrationChoice[], questions: readonly string[] = []) {
  const byPath = new Map<string, MigrationSource>();
  for (const source of sources) {
    if (!safePath(source.path) || byPath.has(source.path)) throw new Error(`Invalid or duplicate source path: ${source.path}`);
    byPath.set(source.path, source);
  }
  const selected = new Map<string, MigrationChoice>();
  for (const choice of choices) {
    if (!byPath.has(choice.path) || selected.has(choice.path) || !choice.rationale.trim()) throw new Error(`Invalid or duplicate choice: ${choice.path}`);
    selected.set(choice.path, choice);
  }
  const anchors = (text: string) => [...text.matchAll(/<!-- \^([a-z0-9][a-z0-9-]*) -->/g)].map(m => m[1]!);
  const resolve = (target: string): MigrationLink => {
    if (/^https?:\/\/\S+$/.test(target)) return { target, state: 'external-unverified' };
    const [file, anchor, extra] = target.split('#');
    if (!file || !safePath(file) || extra !== undefined || (anchor !== undefined && !/^\^[a-z0-9][a-z0-9-]*$/.test(anchor))) return { target, state: 'invalid' };
    const found = byPath.get(file) ?? (!posix.extname(file) ? byPath.get(`${file}.md`) : undefined);
    if (!found) return { target, state: 'uninspected' };
    return { target, state: anchor && !anchors(found.bytes.toString('utf8')).includes(anchor.slice(1)) ? 'invalid' : 'resolved' };
  };
  const items = sources.map(source => {
    const text = source.bytes.toString('utf8'), ast = parseItemFile(text), choice = selected.get(source.path);
    const warnings: string[] = [];
    if (!Buffer.from(text).equals(source.bytes)) warnings.push('Non-UTF-8 bytes: text analysis is incomplete; original digest remains byte-exact.');
    const ids = anchors(text);
    if (new Set(ids).size !== ids.length) warnings.push('Duplicate anchors require review.');
    for (const id of Object.keys(choice?.anchors ?? {})) if (!ids.includes(id)) throw new Error(`Unknown anchor: ${source.path}#^${id}`);
    const headings = [...text.matchAll(/^## ([^\r\n]+)\r?$/gm)];
    const sections = headings.map((m, i) => ({ heading: m[1]!, bytes: Buffer.byteLength(text.slice(m.index, headings[i + 1]?.index ?? text.length)) }));
    if (sections.some(s => s.heading === 'Summary' && s.bytes > 1024)) warnings.push('Summary exceeds 1 KiB target.');
    const rows = ast.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []);
    if (rows.some(row => Array.from(row.text).length > 400)) warnings.push('Checklist row exceeds 400 code points.');
    const owner = fmGet(ast.fm, 'owner') ?? 'unassigned';
    if (choice?.role === 'assignment' && owner === 'unassigned') warnings.push('Accountable owner must be confirmed; prose staffing does not assign this task.');
    if (!choice) warnings.push('Role and assignment boundary need a human decision.');
    const targets = new Set([
      ...[...text.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)].map(m => m[1]!),
      // Only detail-document entries declare arrow links. Prose transitions
      // (for example todo -> in-flight or version upgrades) are not KB refs.
      ...[...text.matchAll(/^- \[\[[^\]\r\n]+\]\] [^\r\n]*? -> (\S+)/gm)].map(m => m[1]!),
      ...['parent', 'checkpoint', 'superseded-by', 'source', 'prev'].flatMap(key => fmGet(ast.fm, key) ? [fmGet(ast.fm, key)!] : []),
      ...(fmGetList(ast.fm, 'related') ?? []),
    ]);
    const links = [...targets].map(resolve);
    if (links.some(link => link.state === 'invalid' || link.state === 'uninspected')) warnings.push('Some links need targeted inspection or repair; preservation alone does not prove resolution.');
    const mappings = [undefined, ...ids].map(id => {
      const old = source.path + (id ? `#^${id}` : ''), override = id ? choice?.anchors?.[id] : undefined;
      const target = override?.target ?? old;
      return { old, role: override?.role ?? choice?.role ?? 'unassigned', target,
        rationale: override?.rationale ?? choice?.rationale ?? 'Unresolved',
        compatibility: resolve(old), proposedLink: resolve(target) };
    });
    return { path: source.path, revision: digest(source.bytes), bytes: source.bytes.length,
      id: fmGet(ast.fm, 'id'), parent: fmGet(ast.fm, 'parent'), status: fmGet(ast.fm, 'status'), owner,
      sections, anchors: ids, links, mappings, warnings,
      history: { strategy: 'retain-original-in-place' as const, path: source.path, bytes: source.bytes.length, revision: digest(source.bytes) } };
  });
  return { mode: 'dry-run' as const, sourceState: 'local-files-only' as const, mutationAllowed: false as const,
    reads: sources.map(source => source.path), bytesRead: sources.reduce((n, source) => n + source.bytes.length, 0), items,
    questions: [...questions],
    gates: ['Select a separate working copy and resolve its identity.', 'Review actual contract differences; no version relabeling.',
      'Confirm assignment, accountable owner, scope conflicts and live start predicates.',
      'Verify a complete backup, including .arbiter/transactions; test restore before migration.'],
    rollback: { state: 'not-executed' as const, strategy: 'Restore every pre-migration byte and path from the verified backup; remove only files created by the migration after checking their expected hashes. Preserve concurrent changes for review.',
      expected: items.map(item => ({ path: item.path, revision: item.revision, bytes: item.bytes })),
      limitation: 'Selected-source digests are not a complete backup or a verified rollback.' } };
}

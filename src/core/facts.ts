// ItemFacts: the per-item summary every derived artifact (index, dashboard,
// queries, triage) is computed from. A pure projection of file bytes plus the
// staged-directory listing — no wall clock, no mtimes (dated evidence only).

import type { CorpusFile } from './corpus.js';
import { fmGet, fmGetRaw, fmGetList } from './fm.js';
import { DIR_TO_TYPE, TERMINAL_STATUSES } from './model.js';
import { parseItemFile } from './parse.js';
import type { SchemaSet } from './schema.js';

export interface ItemFacts {
  relPath: string;
  dir: string;
  id: string;
  ref: string; // <dir>/<id>
  type: string;
  kind: 'work-item' | 'record';
  title: string;
  status?: string;
  review?: string;
  /** raw `updated:` scalar; unquote before timestamp comparisons */
  updatedRaw?: string;
  updatedDate?: string; // date part
  date?: string; // record date field
  due?: string;
  created?: string;
  archived?: string;
  visibility?: string;
  parent?: string;
  prev?: string;
  related: string[];
  source?: string[];
  supersededBy?: string;
  scope?: string;
  verification?: string;
  stagedCount: number;
  raw: boolean; // no frontmatter yet
  /** first non-empty line of ## Summary — the one-line summary nested views show */
  summaryFirst?: string;
  anchors: string[];
  steps: { mark: string; text: string; anchor?: string }[];
  docs: { docId: string; title: string; docKind: string; relPath: string; visibility?: string }[];
  hash?: string;
}

export function isTerminal(status: string | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.has(status);
}

export function extractFacts(_dataDir: string, files: CorpusFile[], schemas: SchemaSet): ItemFacts[] {
  const out: ItemFacts[] = [];
  for (const f of files) {
    if (f.kind !== 'item') continue;
    const [dir, file] = f.relPath.split('/') as [string, string];
    const id = file.replace(/\.md$/, '');
    const type = DIR_TO_TYPE[dir]!;
    const schema = schemas.get(type);
    const ast = parseItemFile(f.text);
    const updated = fmGet(ast.fm, 'updated');
    const facts: ItemFacts = {
      relPath: f.relPath,
      dir,
      id,
      ref: `${dir}/${id}`,
      type,
      kind: schema?.kind ?? 'record',
      title: fmGet(ast.fm, 'title') ?? ast.title ?? id,
      review: fmGet(ast.fm, 'review') ?? (fmGet(ast.fm, 'status') === 'needs-review' ? 'legacy-unknown' : undefined),
      status: fmGet(ast.fm, 'status') ?? (schema?.kind === 'work-item' ? 'todo' : undefined),
      updatedRaw: fmGetRaw(ast.fm, 'updated') ?? updated,
      updatedDate: updated?.slice(0, 10),
      date: fmGet(ast.fm, 'date'),
      due: fmGet(ast.fm, 'due'),
      created: fmGet(ast.fm, 'created'),
      archived: fmGet(ast.fm, 'archived'),
      visibility: fmGet(ast.fm, 'visibility'),
      parent: fmGet(ast.fm, 'parent'),
      prev: fmGet(ast.fm, 'prev'),
      source: fmGetList(ast.fm, 'source'),
      supersededBy: fmGet(ast.fm, 'superseded-by'),
      scope: fmGet(ast.fm, 'scope'),
      verification: fmGet(ast.fm, 'verification'),
      related: fmGetList(ast.fm, 'related') ?? [],
      stagedCount: files.filter(p => p.kind === 'proposal' && p.relPath.startsWith(f.relPath.replace(/\.md$/, '.staged/'))).length,
      raw: ast.fm === null,
      anchors: [],
      steps: [],
      docs: [],
    };
    for (const s of ast.sections) {
      if (s.kind === 'prose' && s.heading === 'Summary' && facts.summaryFirst === undefined) {
        facts.summaryFirst = s.lines.find((l) => l !== '');
      }
      if (s.kind === 'checklist') {
        for (const st of s.steps) {
          facts.steps.push({ mark: st.mark, text: st.text, anchor: st.anchor });
          if (st.anchor) facts.anchors.push(st.anchor);
        }
      }
      if (s.kind === 'docs') facts.docs.push(...s.entries.map(entry => ({
        ...entry, visibility: fmGet(parseItemFile(files.find(file => file.relPath === entry.relPath)?.text ?? '').fm, 'visibility'),
      })));
    }
    out.push(facts);
  }
  return out;
}

/** Days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// Nesting (PROTOCOL.md#tier-1/#tier-2, grammar §7 membership): a work item
// whose `parent` resolves to a visible, nonterminal, non-archived item in the SAME
// directory is a sub-item — off tier 1, reached through its parent. The child
// list is derived from the children's parent refs (forward pointers are
// computed, never stored), and staged counts roll up onto the nearest
// top-level ancestor so hidden proposals stay visible on the card.

export interface Nesting {
  /** true = hidden from tier 1; reached through its parent */
  isSub(ref: string): boolean;
  /** direct children (any dir), relevance-ordered: non-terminal by updated desc, terminal last */
  childrenOf(ref: string): ItemFacts[];
  /** own staged count + staged counts of all sub-item descendants */
  rolledStaged(f: ItemFacts): number;
}

export function computeNesting(facts: ItemFacts[]): Nesting {
  const byRef = new Map(facts.map((f) => [f.ref, f]));
  const subs = new Set<string>();
  const children = new Map<string, ItemFacts[]>();
  for (const f of facts) {
    if (f.parent === undefined) continue;
    const p = byRef.get(f.parent);
    if (p !== undefined) {
      const list = children.get(p.ref) ?? [];
      list.push(f);
      children.set(p.ref, list);
    }
    if (f.kind === 'work-item' && p !== undefined && p.kind === 'work-item' && p.dir === f.dir && !p.archived && !isTerminal(p.status)) subs.add(f.ref);
  }
  for (const f of facts) {
    const seen = new Set<string>();
    let cur: ItemFacts | undefined = f;
    while (cur && subs.has(cur.ref)) {
      if (seen.has(cur.ref)) { for (const ref of seen) subs.delete(ref); break; }
      seen.add(cur.ref);
      cur = cur.parent ? byRef.get(cur.parent) : undefined;
    }
  }
  for (const list of children.values()) {
    list.sort((a, b) => {
      const at = isTerminal(a.status) ? 1 : 0;
      const bt = isTerminal(b.status) ? 1 : 0;
      if (at !== bt) return at - bt;
      const au = a.updatedRaw?.replace(/^["']|["']$/g, '') ?? '';
      const bu = b.updatedRaw?.replace(/^["']|["']$/g, '') ?? '';
      if (au !== bu) return au < bu ? 1 : -1;
      return a.ref < b.ref ? -1 : 1;
    });
  }
  // attribute each sub-item's staged count to its nearest top-level ancestor
  // (cycle-guarded: a parent cycle is a validator error; its counts stay put)
  const extra = new Map<string, number>();
  for (const f of facts) {
    if (!subs.has(f.ref) || f.stagedCount === 0) continue;
    const seen = new Set<string>([f.ref]);
    let cur = byRef.get(f.parent!);
    while (cur !== undefined && subs.has(cur.ref) && !seen.has(cur.ref)) {
      seen.add(cur.ref);
      cur = cur.parent !== undefined ? byRef.get(cur.parent) : undefined;
    }
    if (cur !== undefined && !seen.has(cur.ref)) extra.set(cur.ref, (extra.get(cur.ref) ?? 0) + f.stagedCount);
  }
  return {
    isSub: (ref) => subs.has(ref),
    childrenOf: (ref) => children.get(ref) ?? [],
    rolledStaged: (f) => f.stagedCount + (extra.get(f.ref) ?? 0),
  };
}

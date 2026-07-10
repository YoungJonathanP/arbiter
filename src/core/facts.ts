// ItemFacts: the per-item summary every derived artifact (index, dashboard,
// queries, triage) is computed from. A pure projection of file bytes plus the
// staged-directory listing — no wall clock, no mtimes (dated evidence only).

import type { CorpusFile } from './corpus.js';
import { listStaged } from './corpus.js';
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
  /** raw `updated:` value as written (emitted verbatim); ISO order = lexicographic */
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
  stagedCount: number;
  raw: boolean; // no frontmatter yet
  anchors: string[];
  steps: { mark: string; text: string; anchor?: string }[];
  docs: { docId: string; title: string; docKind: string; relPath: string }[];
  hash?: string;
}

export function isTerminal(status: string | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.has(status);
}

export function extractFacts(dataDir: string, files: CorpusFile[], schemas: SchemaSet): ItemFacts[] {
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
      related: fmGetList(ast.fm, 'related') ?? [],
      stagedCount: listStaged(dataDir, f.relPath).length,
      raw: ast.fm === null,
      anchors: [],
      steps: [],
      docs: [],
    };
    for (const s of ast.sections) {
      if (s.kind === 'checklist') {
        for (const st of s.steps) {
          facts.steps.push({ mark: st.mark, text: st.text, anchor: st.anchor });
          if (st.anchor) facts.anchors.push(st.anchor);
        }
      }
      if (s.kind === 'docs') facts.docs.push(...s.entries);
    }
    out.push(facts);
  }
  return out;
}

/** Days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

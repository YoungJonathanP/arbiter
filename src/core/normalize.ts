// Normalizer: liberal input → canonical form (grammar §12, PROTOCOL.md#normalization).
// Idempotent (gate 1); never discards human prose; opaque regions pass through
// untouched (gate 4). Pure: all environmental facts arrive via NormalizeContext.

import { sectionDiagnostics } from './section-rows.js';
import type { Frontmatter, ItemFile, Section } from './model.js';
import { DIR_TO_TYPE, KNOWN_SECTIONS } from './model.js';
import { fmGet, fmGetRaw, fmSet, fmSetRaw } from './fm.js';
import {
  classifyPath,
  parseDashboard,
  parseDocFile,
  parseItemFile,
  parseProposal,
} from './parse.js';
import { serializeDashboard, serializeDoc, serializeItem, serializeProposal } from './serialize.js';
import type { SchemaSet } from './schema.js';

export interface NormalizeContext {
  schemas: SchemaSet;
  /** YYYY-MM-DD; stamps `normalized:` on first touch */
  today: string;
  /** rel path → dashboard entry date (dated evidence beats mtime) */
  dashboardDates: Map<string, string>;
  /** bare id → object refs `<dir>/<id>` bearing it */
  idsByBareId: Map<string, string[]>;
  /** file mtime, used only when no dated evidence exists */
  mtime?: Date;
}

export interface NormalizeResult {
  text: string;
  changed: boolean;
  flags: string[];
}

const DEFAULT_REMINDERS: Record<string, string> = {
  'tier-1': 'open only the -> path you need; a stale index is advisory — item files are truth',
  'tier-2': 'update marks in place; check <id>.staged/ before editing',
  'tier-3': 'read-mostly: append under a dated heading; do not rewrite history',
  types: 'field schema; consult when writing this type — do not edit during item work',
  staged: 'pending proposal: while any pends, every writer stages — do not edit the item directly',
};

const POINTER_SECTION: Record<string, string> = {
  'tier-1': 'tier-1',
  'tier-2': 'tier-2',
  'tier-3': 'tier-3',
  types: 'tier-2',
  staged: 'arbitration',
};

function defaultPointer(scope: string) {
  return {
    scope,
    section: POINTER_SECTION[scope] ?? 'tier-2',
    reminder: DEFAULT_REMINDERS[scope] ?? '',
  };
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isBareRef(v: string): boolean {
  return !v.includes('/') && /^[a-z0-9][a-z0-9-]*$/.test(v);
}

function qualifyRef(v: string, ctx: NormalizeContext, flags: string[], relPath: string): string {
  if (!isBareRef(v)) return v;
  const refs = ctx.idsByBareId.get(v) ?? [];
  if (refs.length === 1) return refs[0]!;
  flags.push(
    refs.length === 0
      ? `${relPath}: bare ref "${v}" matches no object`
      : `${relPath}: bare ref "${v}" is ambiguous (${refs.join(', ')}) — flagged, never guessed`,
  );
  return v;
}

/** Canonical section order: Summary, Plan inputs, Checklist, Artifacts/Evidence, Detail docs, opaque in original order. */
function orderSections(sections: Section[]): Section[] {
  const rank = (s: Section): number => {
    const i = (KNOWN_SECTIONS as readonly string[]).indexOf(s.heading);
    return i >= 0 ? i : KNOWN_SECTIONS.length;
  };
  // stable sort: opaque sections keep original relative order after known ones
  return sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map((x) => x.s);
}

function normalizeItem(relPath: string, text: string, ctx: NormalizeContext): NormalizeResult {
  const flags: string[] = [];
  const ast: ItemFile = parseItemFile(text);
  const [dir, file] = relPath.split('/') as [string, string];
  const id = file.replace(/\.md$/, '');
  const type = DIR_TO_TYPE[dir] ?? dir;
  const schema = ctx.schemas.get(type);

  if (!ast.fm) {
    // First touch of a raw human file: add frontmatter, move original prose
    // under ## Summary unchanged, stamp normalized, append the pointer.
    const fm: Frontmatter = { entries: [] };
    fmSet(fm, 'id', id);
    fmSet(fm, 'type', type);
    fmSet(fm, 'title', ast.title ?? id);
    if (schema?.kind === 'work-item') fmSet(fm, 'status', 'todo');
    const dashDate = ctx.dashboardDates.get(relPath);
    const fallback = dashDate ?? (ctx.mtime ? fmtDate(ctx.mtime) : ctx.today);
    if (schema?.kind === 'record' && schema.fields.has('date')) {
      const idDate = /-(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1];
      fmSet(fm, 'date', idDate ?? fallback);
    }
    fmSet(fm, 'updated', fallback);
    fmSet(fm, 'normalized', ctx.today);
    ast.fm = fm;
    flags.push(`${relPath}: raw human file normalized on first touch`);
  } else if (schema) {
    // fill missing required fields with schema defaults
    const dashDate = ctx.dashboardDates.get(relPath);
    for (const [key, def] of schema.fields) {
      if (!def.required || fmGet(ast.fm, key) !== undefined) continue;
      let v: string | undefined;
      if (key === 'id') v = id;
      else if (key === 'type') v = type;
      else if (key === 'title') v = ast.title ?? id;
      else if (key === 'status') v = def.default ?? 'todo';
      else if (key === 'date')
        v = /-(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1] ?? dashDate ?? (ctx.mtime ? fmtDate(ctx.mtime) : undefined);
      else if (key === 'updated') v = dashDate ?? (ctx.mtime ? fmtDate(ctx.mtime) : undefined);
      else if (def.default && !def.default.includes(' ')) v = def.default;
      if (v !== undefined) fmSet(ast.fm, key, v);
      else flags.push(`${relPath}: required field "${key}" missing and no default derivable`);
    }
  }

  // ref / ref-list fields: qualify bare ids; canonical flow sequence
  if (schema && ast.fm) {
    for (const [key, def] of schema.fields) {
      if (def.type !== 'ref' && def.type !== 'ref-list') continue;
      const entry = ast.fm.entries.find((e) => e.key === key);
      if (!entry) continue;
      if (def.type === 'ref' && entry.value.kind === 'scalar') {
        const v = fmGet(ast.fm, key)!;
        const q = qualifyRef(v, ctx, flags, relPath);
        if (q !== v) fmSet(ast.fm, key, q);
      } else if (def.type === 'ref-list') {
        const items =
          entry.value.kind === 'seq'
            ? entry.value.items
            : fmGet(ast.fm, key)!
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s !== '');
        const qualified = items.map((v) => qualifyRef(v, ctx, flags, relPath));
        const canonical = `[${qualified.join(', ')}]`;
        if (fmGetRaw(ast.fm, key) !== canonical || entry.value.kind !== 'seq') {
          fmSetRaw(ast.fm, key, canonical);
        }
      }
    }
  }

  // fold loose lead prose into ## Summary (never discard human prose)
  const lead = ast.sections.find((s) => s.heading === '' && s.kind === 'prose');
  if (lead && lead.kind === 'prose') {
    ast.sections = ast.sections.filter((s) => s !== lead);
    const summary = ast.sections.find((s) => s.heading === 'Summary');
    if (summary && summary.kind === 'prose') {
      summary.lines = [...lead.lines, ...summary.lines];
    } else {
      ast.sections.unshift({ kind: 'prose', heading: 'Summary', lines: lead.lines });
    }
  }
  if (ast.preamble.length > 0) {
    // prose above the title: fold under Summary as well
    const pre = ast.preamble;
    ast.preamble = [];
    const summary = ast.sections.find((s) => s.heading === 'Summary');
    if (summary && summary.kind === 'prose') summary.lines = [...pre, ...summary.lines];
    else ast.sections.unshift({ kind: 'prose', heading: 'Summary', lines: pre });
  }

  ast.sections = orderSections(ast.sections);

  if (!ast.pointer) ast.pointer = defaultPointer('tier-2');

  for (const s of ast.sections) {
    for (const d of sectionDiagnostics(s)) flags.push(`${relPath}:${d.line}: malformed entry in ## ${s.heading}; expected ${d.expected}; preserved verbatim`);
    if (s.kind === 'malformed') flags.push(`${relPath}: section "## ${s.heading}" is off-grammar; preserved verbatim`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) flags.push(`${relPath}: un-slugged filename; rename only if never referenced`);

  const out = serializeItem(ast);
  return { text: out, changed: out !== text, flags };
}

export function normalize(relPath: string, text: string, ctx: NormalizeContext): NormalizeResult {
  const kind = classifyPath(relPath);
  const lf = text.replace(/\r\n/g, '\n');
  switch (kind) {
    case 'checkpoint':
    case 'checkpoint-history':
      // Checkpoint revisions name exact bytes. Never silently normalize a
      // version or its history; explicit replacement creates a new revision.
      return { text, changed: false, flags: [] };
    case 'protocol':
      return { text: lf.endsWith('\n') ? lf : lf + '\n', changed: text !== lf || !lf.endsWith('\n'), flags: [] };
    case 'item':
      return normalizeItem(relPath, lf, ctx);
    case 'dashboard': {
      const ast = parseDashboard(lf);
      if (!ast.pointer) ast.pointer = defaultPointer('tier-1');
      const out = serializeDashboard(ast);
      return { text: out, changed: out !== text, flags: [] };
    }
    case 'doc': {
      const ast = parseDocFile(lf);
      if (!ast.pointer) ast.pointer = defaultPointer('tier-3');
      const out = serializeDoc(ast);
      return { text: out, changed: out !== text, flags: [] };
    }
    case 'proposal': {
      const ast = parseProposal(lf);
      if (!ast.pointer) ast.pointer = defaultPointer('staged');
      const out = serializeProposal(ast);
      return { text: out, changed: out !== text, flags: [] };
    }
    case 'schema': {
      const ast = parseDocFile(lf);
      if (!ast.pointer) ast.pointer = defaultPointer('types');
      const out = serializeDoc(ast);
      return { text: out, changed: out !== text, flags: [] };
    }
  }
}

/** Build the id → object-refs map for bare-ref qualification. */
export function buildIdMap(itemRelPaths: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const rel of itemRelPaths) {
    const parts = rel.split('/');
    if (parts.length !== 2 || !parts[1]!.endsWith('.md')) continue;
    const id = parts[1]!.slice(0, -3);
    const ref = `${parts[0]}/${id}`;
    const list = map.get(id) ?? [];
    list.push(ref);
    map.set(id, list);
  }
  return map;
}

/** rel path → entry date map from a dashboard, if present. */
export function buildDashboardDates(dashboardText: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!dashboardText) return map;
  const dash = parseDashboard(dashboardText);
  for (const card of dash.cards) {
    for (const row of card.rows) {
      if (row.kind === 'entry') map.set(row.entry.relPath, row.entry.date);
    }
  }
  return map;
}

// Parser for the machine-read subset (grammar.md v0.4.4). Liberal per §12 on
// input; everything off-grammar is captured verbatim so it can be preserved
// byte-for-byte (opacity, gate 4).

import type {
  CardSection,
  DashboardEntry,
  DashboardFile,
  DashRow,
  DocFile,
  FileKind,
  Frontmatter,
  ItemFile,
  LinkEntry,
  Mark,
  Op,
  PointerLine,
  ProposalFile,
  Section,
  Step,
  TypeSchema,
  FieldDef,
  SectionDef,
} from './model.js';
import { KNOWN_SECTIONS } from './model.js';
import { fmGet, fmGetList, parseFrontmatter, parseFlowMap, scalarValue } from './fm.js';

export { parseFrontmatter } from './fm.js';

export const POINTER_RE = /^<!-- arbiter:(\S+) · PROTOCOL\.md#([a-z0-9-]+) · (.*?) -->$/;
export const MD_LINK_RE = /\[([^\]]*)\]\(([^)\s][^)]*)\)/g;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const RESOLUTION_RE = /^- (\d{4}-\d{2}-\d{2}) — arbitrated ([a-z0-9][a-z0-9-]*): (.*)$/;

export function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function classifyPath(relPath: string): FileKind {
  const parts = relPath.split('/');
  if (relPath === 'PROTOCOL.md') return 'protocol';
  if (relPath === 'DASHBOARD.md') return 'dashboard';
  if (parts[0] === 'types') return 'schema';
  if (parts.length === 3 && parts[1]!.endsWith('.staged')) return 'proposal';
  if (parts.length === 3) return 'doc';
  return 'item';
}

export function parsePointer(line: string): PointerLine | null {
  const m = POINTER_RE.exec(line);
  return m ? { scope: m[1]!, section: m[2]!, reminder: m[3]! } : null;
}

/** Strip a trailing pointer line (and surrounding blanks) from the tail. */
function takePointer(lines: string[]): { body: string[]; pointer: PointerLine | null } {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === '') end--;
  if (end > 0) {
    const p = parsePointer(lines[end - 1]!);
    if (p) return { body: lines.slice(0, end - 1), pointer: p };
  }
  return { body: lines, pointer: null };
}

function stripTrailingBlanks(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === '') end--;
  return lines.slice(0, end);
}

// --- checklist ---------------------------------------------------------------

const LIBERAL_MARKS: Record<string, Mark> = {
  ' ': ' ',
  '~': '~',
  '!': '!',
  x: 'x',
  X: 'x',
  DONE: 'x',
  '/': '~',
  WIP: '~',
};

const STEP_RE = /^[-*+] \[([^\]]*)\] (.*)$/;
const ANCHOR_TAIL_RE = /^(.*?) <!-- \^([a-z0-9][a-z0-9-]*) -->$/;
const CONT_RE = /^( {2,8})(blocked-by|see): \[([^\]]*)\]\(([^)]+)\)$/;

export function parseStepLine(line: string): { mark: Mark; text: string; anchor?: string } | null {
  const m = STEP_RE.exec(line);
  if (!m) return null;
  const mark = LIBERAL_MARKS[m[1]!];
  if (mark === undefined) return null;
  let text = m[2]!;
  let anchor: string | undefined;
  const a = ANCHOR_TAIL_RE.exec(text);
  if (a) {
    text = a[1]!;
    anchor = a[2]!;
  }
  if (text.includes('<!--')) return null; // step-text MUST NOT contain "<!--"
  return { mark, text, anchor };
}

function parseChecklist(lines: string[]): Step[] | null {
  const steps: Step[] = [];
  for (const line of stripTrailingBlanks(lines)) {
    if (line === '') continue; // tolerate internal blanks (liberal)
    const cont = CONT_RE.exec(line);
    if (cont) {
      const last = steps[steps.length - 1];
      if (!last) return null;
      last.continuations.push({ kw: cont[2] as 'blocked-by' | 'see', label: cont[3]!, target: cont[4]! });
      continue;
    }
    const s = parseStepLine(line);
    if (!s) return null;
    steps.push({ mark: s.mark, text: s.text, anchor: s.anchor, continuations: [] });
  }
  return steps;
}

// --- link / docs entries -----------------------------------------------------

const LINK_ENTRY_RE = /^[-*+] ([^:]+): \[([^\]]*)\]\(([^)]+)\)$/;
const DOCS_ENTRY_RE = /^[-*+] \[\[([a-z0-9][a-z0-9-]*)\]\] (.*) \((plan|investigation|report|note)\) -> (\S+)$/;

function parseLinkEntries(lines: string[]): LinkEntry[] | null {
  const entries: LinkEntry[] = [];
  for (const line of stripTrailingBlanks(lines)) {
    if (line === '') continue;
    const m = LINK_ENTRY_RE.exec(line);
    if (!m) return null;
    entries.push({ kindLabel: m[1]!, label: m[2]!, target: m[3]! });
  }
  return entries;
}

function parseDocsEntries(lines: string[]) {
  const entries = [];
  for (const line of stripTrailingBlanks(lines)) {
    if (line === '') continue;
    const m = DOCS_ENTRY_RE.exec(line);
    if (!m) return null;
    entries.push({ docId: m[1]!, title: m[2]!, docKind: m[3]!, relPath: m[4]! });
  }
  return entries;
}

// --- item files ----------------------------------------------------------------

function parseSection(heading: string, lines: string[]): Section {
  const body = stripTrailingBlanks(lines);
  if (heading === 'Checklist') {
    const steps = parseChecklist(body);
    return steps ? { kind: 'checklist', heading, steps } : { kind: 'malformed', heading, lines: body };
  }
  if (heading === 'Artifacts' || heading === 'Evidence') {
    const entries = parseLinkEntries(body);
    return entries ? { kind: 'links', heading, entries } : { kind: 'malformed', heading, lines: body };
  }
  if (heading === 'Detail docs') {
    const entries = parseDocsEntries(body);
    return entries ? { kind: 'docs', heading, entries } : { kind: 'malformed', heading, lines: body };
  }
  // Summary and opaque sections are prose
  return { kind: 'prose', heading, lines: body };
}

interface FileShell {
  fm: Frontmatter | null;
  title: string | null;
  preamble: string[];
  sections: { heading: string; lines: string[] }[];
  /** prose between title and the first `## ` heading (raw files) */
  leadProse: string[];
  pointer: PointerLine | null;
}

function parseShell(text: string): FileShell {
  const all = splitLines(text.replace(/\r\n/g, '\n'));
  const fmRes = parseFrontmatter(all);
  const rest = fmRes ? all.slice(fmRes.end) : all;
  const { body, pointer } = takePointer(rest);

  let title: string | null = null;
  const preamble: string[] = [];
  let i = 0;
  while (i < body.length) {
    const line = body[i]!;
    if (line === '') {
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      title = line.slice(2);
      i++;
      break;
    }
    if (line.startsWith('## ')) break; // sectioned file without a title
    preamble.push(line);
    i++;
  }

  // blanks directly after the title are the canonical separator, not prose
  while (i < body.length && body[i] === '') i++;
  const leadProse: string[] = [];
  while (i < body.length && !body[i]!.startsWith('## ')) {
    leadProse.push(body[i]!);
    i++;
  }

  const sections: { heading: string; lines: string[] }[] = [];
  while (i < body.length) {
    const heading = body[i]!.slice(3);
    i++;
    const lines: string[] = [];
    while (i < body.length && !body[i]!.startsWith('## ')) {
      lines.push(body[i]!);
      i++;
    }
    sections.push({ heading, lines });
  }

  return {
    fm: fmRes?.fm ?? null,
    title,
    preamble: stripTrailingBlanks(preamble),
    sections,
    leadProse: stripTrailingBlanks(leadProse),
    pointer,
  };
}

export function parseItemFile(text: string): ItemFile {
  const shell = parseShell(text);
  const sections: Section[] = [];
  if (shell.leadProse.length > 0) sections.push({ kind: 'prose', heading: '', lines: shell.leadProse });
  for (const s of shell.sections) sections.push(parseSection(s.heading, s.lines));
  return { fm: shell.fm, title: shell.title, sections, pointer: shell.pointer, preamble: shell.preamble };
}

// --- dashboard -----------------------------------------------------------------

const CARD_RE = /^## ([^(]*) \((\d+)\)$/;
const OVERFLOW_RE = /^- \+(\d+) more in ([a-z]+)\/$/;

export function parseDashboardEntry(line: string): DashboardEntry | null {
  if (!line.startsWith('- ')) return null;
  let rest = line.slice(2);
  const arrow = rest.lastIndexOf(' -> ');
  if (arrow < 0) return null;
  const relPath = rest.slice(arrow + 4);
  rest = rest.slice(0, arrow);
  // canonical em dash, then liberal en dash / hyphen (§12)
  let dash = rest.lastIndexOf(' — ');
  let sepLen = ' — '.length;
  if (dash < 0 || !DATE_RE.test(rest.slice(dash + sepLen))) {
    for (const sep of [' – ', ' - ']) {
      const i = rest.lastIndexOf(sep);
      if (i >= 0 && DATE_RE.test(rest.slice(i + sep.length))) {
        dash = i;
        sepLen = sep.length;
        break;
      }
    }
  }
  if (dash < 0) return null;
  const date = rest.slice(dash + sepLen);
  if (!DATE_RE.test(date)) return null;
  let titlePart = rest.slice(0, dash);
  let status: string | undefined;
  let stagedCount: number | undefined;
  const st = /^\[([a-z-]+)\] /.exec(titlePart);
  if (st) {
    status = st[1]!;
    titlePart = titlePart.slice(st[0].length);
  }
  const sf = /^\((\d+) staged\) /.exec(titlePart);
  if (sf) {
    stagedCount = Number(sf[1]!);
    titlePart = titlePart.slice(sf[0].length);
  }
  return { status, stagedCount, title: titlePart, date, relPath };
}

export function parseDashboard(text: string): DashboardFile {
  const shell = parseShell(text);
  const cards: CardSection[] = [];
  for (const s of shell.sections) {
    const m = CARD_RE.exec(`## ${s.heading}`);
    const label = m ? m[1]! : s.heading;
    const count = m ? Number(m[2]!) : 0;
    const rows: DashRow[] = [];
    for (const line of stripTrailingBlanks(s.lines)) {
      if (line === '') continue;
      const of = OVERFLOW_RE.exec(line);
      if (of) {
        rows.push({ kind: 'overflow', count: Number(of[1]!), dir: of[2]! });
        continue;
      }
      const e = parseDashboardEntry(line);
      if (e) rows.push({ kind: 'entry', entry: e });
      else rows.push({ kind: 'stray', line });
    }
    cards.push({ label, count, rows });
  }
  return { fm: shell.fm, cards, pointer: shell.pointer };
}

// --- docs ------------------------------------------------------------------------

export function parseDocFile(text: string): DocFile {
  const shell = parseShell(text);
  const body: string[] = [...shell.leadProse];
  for (const s of shell.sections) {
    if (body.length > 0) body.push('');
    body.push(`## ${s.heading}`, ...stripTrailingBlanks(s.lines));
  }
  return { fm: shell.fm, title: shell.title, body: stripTrailingBlanks(body), pointer: shell.pointer };
}

// --- proposals ---------------------------------------------------------------------

const OP_SET_RE = /^set: ([A-Za-z0-9_-]+) = (.*)$/;
const OP_MARK_ANCHOR_RE = /^mark: \^([a-z0-9][a-z0-9-]*) = (todo|in-flight|blocked|done)$/;
const OP_MARK_TEXT_RE = /^mark: "(.*)" = (todo|in-flight|blocked|done)$/;
const OP_APPEND_RE = /^append: ([^·]+) · (.*)$/;

export function parseOp(raw: string): Op | null {
  let m = OP_SET_RE.exec(raw);
  if (m) return { kind: 'set', key: m[1]!, value: m[2]!, raw };
  m = OP_MARK_ANCHOR_RE.exec(raw);
  if (m) return { kind: 'mark', anchor: m[1]!, mark: m[2]!, raw };
  m = OP_MARK_TEXT_RE.exec(raw);
  if (m) return { kind: 'mark', stepText: m[1]!, mark: m[2]!, raw };
  m = OP_APPEND_RE.exec(raw);
  if (m) return { kind: 'append', section: m[1]!.trim(), text: m[2]!, raw };
  return null;
}

export function extractLinks(lines: string[]): { label: string; target: string }[] {
  const seen = new Set<string>();
  const out: { label: string; target: string }[] = [];
  for (const line of lines) {
    for (const m of line.matchAll(MD_LINK_RE)) {
      const key = `[${m[1]!}](${m[2]!})`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ label: m[1]!, target: m[2]! });
      }
    }
  }
  return out;
}

export function parseProposal(text: string): ProposalFile {
  const shell = parseShell(text);
  const body: string[] = [...shell.leadProse];
  for (const s of shell.sections) {
    if (body.length > 0) body.push('');
    body.push(`## ${s.heading}`, ...stripTrailingBlanks(s.lines));
  }
  const opsRaw = fmGetList(shell.fm, 'ops') ?? [];
  const ops: Op[] = [];
  for (const raw of opsRaw) {
    const op = parseOp(raw);
    if (op) ops.push(op);
    else ops.push({ kind: 'set', key: '', value: '', raw }); // invalid; validator flags via key === ''
  }
  const bodyLines = stripTrailingBlanks(body);
  return {
    fm: shell.fm,
    title: shell.title,
    body: bodyLines,
    pointer: shell.pointer,
    ops,
    bodyLinks: extractLinks(bodyLines),
  };
}

// --- type schemas -------------------------------------------------------------------

function flowMapToFieldDef(raw: string): FieldDef {
  const entries = parseFlowMap(raw);
  const get = (k: string) => entries.find((e) => e.key === k);
  const scalar = (k: string) => {
    const e = get(k);
    return e && e.value.kind === 'scalar' ? scalarValue(e.value.raw) : undefined;
  };
  const values = (() => {
    const e = get('values');
    return e && e.value.kind === 'seq' ? e.value.items : undefined;
  })();
  return {
    type: scalar('type') ?? 'text',
    required: scalar('required') === 'true',
    values,
    default: scalar('default'),
    note: scalar('note'),
  };
}

export function parseTypeSchema(text: string): TypeSchema {
  const shell = parseShell(text);
  const fm = shell.fm;
  const fields = new Map<string, FieldDef>();
  const sections = new Map<string, SectionDef>();
  const fieldsEntry = fm?.entries.find((e) => e.key === 'fields');
  if (fieldsEntry?.value.kind === 'map') {
    for (const e of fieldsEntry.value.entries) {
      fields.set(e.key, flowMapToFieldDef(e.value.kind === 'scalar' ? e.value.raw : ''));
    }
  }
  const sectionsEntry = fm?.entries.find((e) => e.key === 'sections');
  if (sectionsEntry?.value.kind === 'map') {
    for (const e of sectionsEntry.value.entries) {
      const def = flowMapToFieldDef(e.value.kind === 'scalar' ? e.value.raw : '');
      sections.set(e.key, { required: def.required, note: def.note });
    }
  }
  const relevance = fmGet(fm, 'relevance');
  const kind = fmGet(fm, 'kind');
  return {
    schema: fmGet(fm, 'schema') ?? '',
    version: fmGet(fm, 'version'),
    extends: fmGet(fm, 'extends'),
    kind: kind === 'work-item' || kind === 'record' ? kind : undefined,
    slugForm: fmGet(fm, 'slug-form'),
    fields,
    sections,
    relevance: relevance === 'active-first' || relevance === 'recent-first' ? relevance : undefined,
  };
}

export function isKnownSection(heading: string): boolean {
  return (KNOWN_SECTIONS as readonly string[]).includes(heading);
}

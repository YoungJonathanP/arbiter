// AST for the machine-read subset (grammar.md v0.4.4).
// Every node keeps enough raw text that serialization of a canonical file
// reproduces it byte-for-byte (gate 3) and opaque regions are never rewritten
// (gate 4). Fields prefixed `raw` are concrete-syntax carriers and are
// excluded from semantic equality (gate 2).

export type FmValue =
  | { kind: 'scalar'; raw: string } // raw as written, including quotes
  | { kind: 'seq'; items: string[]; raw: string } // unquoted item values
  | { kind: 'map'; entries: FmEntry[] }; // nested block mapping (type schemas only)

export interface FmEntry {
  key: string;
  value: FmValue;
  rawLines: string[]; // exact source lines (1+); regenerated on mutation
}

export interface Frontmatter {
  entries: FmEntry[];
}

export type Mark = ' ' | '~' | '!' | 'x';

export interface Continuation {
  rawLine?: number;
  rawLeadingBlanks?: string[];
  kw: 'blocked-by' | 'see';
  label: string;
  target: string;
}

export interface Step {
  rawLine?: number;
  mark: Mark;
  text: string;
  anchor?: string;
  continuations: Continuation[];
}

export interface LinkEntry {
  rawLine?: number;
  kindLabel: string;
  label: string;
  target: string;
}

export interface DocsEntry {
  rawLine?: number;
  docId: string;
  title: string;
  docKind: string;
  relPath: string;
}

/** Entry indices address the structured arrays; opaque and blank rows retain order.
 * Consumers may mutate entries in place or append. Reindex rows when removing or
 * reordering entries. Source positions are 1-based in the parsed input snapshot. */
export type SectionRow =
  | { kind: 'entry'; index: number; line: number }
  | { kind: 'opaque'; raw: string; line: number; expected: string }
  | { kind: 'blank'; raw: string; line: number };

export interface RecoverableSection {
  rawRows?: SectionRow[];
}

export type Section =
  | { kind: 'prose'; heading: string; lines: string[] } // Summary + opaque; lines exclude trailing blanks
  | { kind: 'checklist'; heading: string; steps: Step[] } & RecoverableSection
  | { kind: 'links'; heading: string; entries: LinkEntry[] } & RecoverableSection
  | { kind: 'docs'; heading: string; entries: DocsEntry[] } & RecoverableSection
  | { kind: 'malformed'; heading: string; lines: string[] }; // known heading, body off-grammar: opaque + flagged

export interface PointerLine {
  scope: string;
  section: string;
  reminder: string;
}

export interface ItemFile {
  fm: Frontmatter | null; // null = raw human file
  title: string | null;
  sections: Section[];
  pointer: PointerLine | null;
  /** lines that precede the title or otherwise fall outside productions (raw files) */
  preamble: string[];
}

export interface DashboardEntry {
  status?: string;
  stagedCount?: number;
  review?: string;
  title: string;
  date: string;
  relPath: string;
}

export type DashRow =
  | { kind: 'entry'; entry: DashboardEntry }
  | { kind: 'overflow'; count: number; dir: string }
  | { kind: 'stray'; line: string }; // hand-added off-grammar line — preserved verbatim, never deleted

export interface CardSection {
  label: string;
  count: number;
  rows: DashRow[];
}

export interface DashboardFile {
  fm: Frontmatter | null;
  cards: CardSection[];
  pointer: PointerLine | null;
}

export interface DocFile {
  fm: Frontmatter | null;
  title: string | null;
  body: string[]; // opaque prose incl. dated headings; excludes trailing blanks
  pointer: PointerLine | null;
}

export type Op =
  | { kind: 'set'; key: string; value: string; raw: string }
  | { kind: 'mark'; anchor?: string; stepText?: string; mark: string; raw: string }
  | { kind: 'append'; section: string; text: string; raw: string };

export interface ProposalFile {
  fm: Frontmatter | null;
  title: string | null;
  body: string[];
  pointer: PointerLine | null;
  ops: Op[];
  /** distinct md-links of the body, in body order (evidence for overruled verdicts) */
  bodyLinks: { label: string; target: string }[];
}

export interface FieldDef {
  type: string;
  required: boolean;
  values?: string[];
  default?: string;
  note?: string;
}

export interface SectionDef {
  required: boolean;
  note?: string;
}

export interface TypeSchema {
  schema: string;
  version?: string;
  extends?: string;
  kind?: 'work-item' | 'record';
  slugForm?: string;
  fields: Map<string, FieldDef>;
  sections: Map<string, SectionDef>;
  relevance?: 'active-first' | 'recent-first';
}

// Checkpoints share the lossless document syntax, with metadata defined in §15.
export type CheckpointFile = DocFile;
export type CheckpointReadiness = 'unprepared' | 'ready' | 'waiting' | 'review-required';
export interface CheckpointInput {
  id: string;
  source: string; // kb:<root-relative path>, repo:<relative path>, or https URL
  revision: string; // sha256:<hex>, external immutable revision, or unknown
  observed: string;
  purpose: string;
}
export interface StartPredicate {
  id: string;
  state: 'met' | 'unmet' | 'unknown';
  owner: string;
  condition: string;
  evidence: string;
}

export type FileKind = 'input-review' | 'item' | 'dashboard' | 'doc' | 'checkpoint' | 'checkpoint-history' | 'proposal' | 'schema' | 'protocol';

/** Supported type registration. Field/section definitions remain installed schema data.
 * Arbitrary schema-only plugins are not supported; add a type here and bundle its schema. */
export const ITEM_TYPES = [
  { type: 'task', dir: 'tasks', label: 'Tasks', kind: 'work-item', version: '0.4', introduced: '0.4' },
  { type: 'goal', dir: 'goals', label: 'Goals', kind: 'work-item', version: '0.4', introduced: '0.4' },
  { type: 'meeting', dir: 'meetings', label: 'Meetings', kind: 'record', version: '0.4', introduced: '0.4' },
  { type: 'journal', dir: 'journal', label: 'Journal', kind: 'record', version: '0.4', introduced: '0.4' },
  { type: 'accomplishment', dir: 'accomplishments', label: 'Accomplishments', kind: 'record', version: '0.4.18', introduced: '0.4' },
  { type: 'decision', dir: 'decisions', label: 'Decisions', kind: 'record', version: '0.4.14', introduced: '0.4.14' },
  { type: 'person', dir: 'people', label: 'People', kind: 'record', version: '0.4.16', introduced: '0.4.16' },
  { type: 'finding', dir: 'findings', label: 'Findings', kind: 'record', version: '0.4.14', introduced: '0.4.14' },
] as const;
export const ITEM_DIRS = ITEM_TYPES.map(t => t.dir);
export type ItemDir = (typeof ITEM_DIRS)[number];
export const DIR_TO_TYPE: Record<string, string> = Object.fromEntries(ITEM_TYPES.map(t => [t.dir, t.type]));
export const TYPE_TO_DIR: Record<string, string> = Object.fromEntries(ITEM_TYPES.map(t => [t.type, t.dir]));

export const TERMINAL_STATUSES = new Set(['done', 'dropped']);
export const STATUSES = new Set(['todo', 'in-flight', 'blocked', 'done', 'dropped', 'needs-review']);
export const MARKS: Mark[] = [' ', '~', '!', 'x'];
export const DOC_KINDS = new Set(['plan', 'investigation', 'report', 'note']);
export const POINTER_SCOPES = new Set(['tier-1', 'tier-2', 'tier-3', 'types', 'staged', 'checkpoint', 'input-review']);

export const KNOWN_SECTIONS = ['Summary', 'Plan inputs', 'Checklist', 'Artifacts', 'Evidence', 'Detail docs'] as const;

// Dashboard projections always use current facts; timestamps are event metadata.

import type { DashboardEntry, DashRow, Frontmatter } from './model.js';
import { fmSetRaw } from './fm.js';
import type { ItemFacts, Nesting } from './facts.js';
import { computeNesting, daysBetween, isTerminal } from './facts.js';
import { visibleFacts } from './visibility.js';
import { sha256 } from './corpus.js';
import { parseDashboard } from './parse.js';
import { serializeDashboard } from './serialize.js';

const CARDS: { label: string; dir: string; kind: 'work-item' | 'record' }[] = [
  { label: 'Tasks', dir: 'tasks', kind: 'work-item' },
  { label: 'Goals', dir: 'goals', kind: 'work-item' },
  { label: 'Meetings', dir: 'meetings', kind: 'record' },
  { label: 'Journal', dir: 'journal', kind: 'record' },
  { label: 'Accomplishments', dir: 'accomplishments', kind: 'record' },
];

const RECORD_CARD_LIMIT = 5;
const AGE_OFF_DAYS = 7;

export interface RegenOptions {
  /** wall-clock "now", supplied by the caller: YYYY-MM-DDTHH:MM */
  now: string;
  /** raw scalar of PROTOCOL.md `version:` (quotes preserved) */
  protocolRaw: string;
  generator?: string;
  /** Digest of verified visible source inputs, supplied by a snapshot reader. */
  inputs?: string;
}

interface Candidate {
  entry: DashboardEntry;
  facts: ItemFacts;
}

function entryFor(f: ItemFacts, nest: Nesting, prevDate?: string): DashboardEntry {
  const date =
    f.kind === 'work-item'
      ? (f.updatedDate ?? prevDate ?? f.date ?? '')
      : (f.date ?? prevDate ?? f.updatedDate ?? '');
  const staged = nest.rolledStaged(f); // sub-item proposals surface on their top-level ancestor
  return {
    status: f.kind === 'work-item' ? f.status : undefined,
    stagedCount: staged > 0 ? staged : undefined,
    review: f.review,
    title: f.title,
    date,
    relPath: f.relPath,
  };
}

/** terminal item past its 7-day age-off leaves the card */
function agedOff(status: string | undefined, entryDate: string, today: string): boolean {
  return isTerminal(status) && entryDate !== '' && daysBetween(entryDate, today) > AGE_OFF_DAYS;
}

function buildCards(candidates: Map<string, Candidate[]>, today: string, nest: Nesting): { label: string; count: number; rows: DashRow[] }[] {
  const cards = [];
  for (const def of CARDS) {
    const backed = (candidates.get(def.dir) ?? []).filter(c =>
      !c.facts.archived && !agedOff(c.entry.status, c.entry.date, today) && !nest.isSub(c.facts.ref));

    let rows: DashRow[] = [];
    let count: number;
    if (def.kind === 'work-item') {
      // active-first: non-terminal by updated desc, then terminal by updated desc
      backed.sort((a, b) => {
        const at = isTerminal(a.entry.status) ? 1 : 0;
        const bt = isTerminal(b.entry.status) ? 1 : 0;
        if (at !== bt) return at - bt;
        const au = a.facts?.updatedRaw?.replace(/^["']|["']$/g, '') ?? a.entry.date;
        const bu = b.facts?.updatedRaw?.replace(/^["']|["']$/g, '') ?? b.entry.date;
        if (au !== bu) return au < bu ? 1 : -1;
        return a.entry.relPath < b.entry.relPath ? -1 : 1;
      });
      const entries = backed;
      count = entries.length;
      rows = entries.map((c) => ({ kind: 'entry', entry: c.entry }));
    } else {
      // recent-first: by date desc; top 5 on the card, the rest behind overflow
      backed.sort((a, b) => {
        if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1;
        return a.entry.relPath < b.entry.relPath ? -1 : 1;
      });
      const entries = backed;
      count = entries.length;
      const shown = entries.slice(0, RECORD_CARD_LIMIT);
      rows = shown.map((c) => ({ kind: 'entry', entry: c.entry }));
      if (entries.length > RECORD_CARD_LIMIT) {
        rows.push({ kind: 'overflow', count: entries.length - RECORD_CARD_LIMIT, dir: def.dir });
      }
    }
    cards.push({ label: def.label, count, rows });
  }
  return cards;
}

function buildFrontmatter(maxUpdated: string, opts: RegenOptions): Frontmatter {
  const fm: Frontmatter = { entries: [] };
  fmSetRaw(fm, 'updated', maxUpdated || opts.now);
  fmSetRaw(fm, 'generator', opts.generator ?? 'arbiter-cli');
  fmSetRaw(fm, 'generated', opts.now);
  fmSetRaw(fm, 'protocol', opts.protocolRaw);
  fmSetRaw(fm, 'inputs', opts.inputs!);
  return fm;
}

const POINTER = {
  scope: 'tier-1',
  section: 'tier-1',
  reminder: 'open only the -> path you need; a stale index is advisory — item files are truth',
};

/** Full rebuild: every item, reconciled against the previous dashboard when present. */
export function regenFull(facts: ItemFacts[], prevText: string | null, opts: RegenOptions): string {
  facts = visibleFacts(facts);
  opts = { ...opts, inputs: opts.inputs ?? `sha256:${sha256(JSON.stringify([...facts].sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)))}` };
  const prev = prevText !== null ? parseDashboard(prevText) : null;
  const prevDates = new Map(prev?.cards.flatMap(c => c.rows.flatMap(r => r.kind === 'entry' ? [[r.entry.relPath, r.entry.date] as const] : [])) ?? []);
  const nest = computeNesting(facts);
  const candidates = new Map<string, Candidate[]>();
  let maxUpdated = '';
  for (const f of facts) {
    if (f.updatedRaw !== undefined) {
      const updated = f.updatedRaw.replace(/^[\"']|[\"']$/g, '');
      if (updated > maxUpdated) maxUpdated = updated;
    }
    const prevDate = prevDates.get(f.relPath);
    const list = candidates.get(f.dir) ?? [];
    list.push({ entry: entryFor(f, nest, prevDate), facts: f });
    candidates.set(f.dir, list);
  }
  // Unverifiable carried entries/strays cannot establish visibility.
  return serializeDashboard({
    fm: buildFrontmatter(maxUpdated, opts),
    cards: buildCards(candidates, opts.now.slice(0, 10), nest),
    pointer: POINTER,
  });
}

/** Compatibility entry point: callers already scan every source file. */
export function regenIncremental(facts: ItemFacts[], prevText: string, opts: RegenOptions): string {
  return regenFull(facts, prevText, opts);
}

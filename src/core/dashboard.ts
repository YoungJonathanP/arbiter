// Dashboard (tier 1) regeneration — PROTOCOL.md#tier-1, grammar §7.
// Two paths, one output (gate 5):
//   regenIncremental: previous entries + items whose `updated` > previous
//     `generated`; entries leave only on an observed transition.
//   regenFull: every item, reconciling hand-added entries and undatable raw
//     items against the previous dashboard (dated evidence beats mtimes).
// Both are pure functions of (facts, previous dashboard, now).

import type { DashboardEntry, DashboardFile, DashRow, Frontmatter } from './model.js';
import { fmGetRaw, fmSetRaw } from './fm.js';
import type { ItemFacts } from './facts.js';
import { daysBetween, isTerminal } from './facts.js';
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
}

interface Candidate {
  entry: DashboardEntry;
  facts?: ItemFacts; // undefined = hand-added entry whose file is missing
  prevOrder: number;
}

function entryFor(f: ItemFacts, prevDate?: string): DashboardEntry {
  const date =
    f.kind === 'work-item'
      ? (f.updatedDate ?? prevDate ?? f.date ?? '')
      : (f.date ?? prevDate ?? f.updatedDate ?? '');
  return {
    status: f.kind === 'work-item' ? f.status : undefined,
    stagedCount: f.stagedCount > 0 ? f.stagedCount : undefined,
    title: f.title,
    date,
    relPath: f.relPath,
  };
}

/** terminal item past its 7-day age-off leaves the card */
function agedOff(status: string | undefined, entryDate: string, today: string): boolean {
  return isTerminal(status) && entryDate !== '' && daysBetween(entryDate, today) > AGE_OFF_DAYS;
}

function buildCards(candidates: Map<string, Candidate[]>, today: string): { label: string; count: number; rows: DashRow[] }[] {
  const cards = [];
  for (const def of CARDS) {
    const list = candidates.get(def.dir) ?? [];
    // dedupe by path (an item both in prev and changed keeps its fresher form:
    // facts-backed candidates win over prev-only ones)
    const byPath = new Map<string, Candidate>();
    for (const c of list) {
      const cur = byPath.get(c.entry.relPath);
      if (!cur || (c.facts && !cur.facts)) byPath.set(c.entry.relPath, c);
    }
    let all = [...byPath.values()];
    // observed transitions: archived items and aged-off terminal items leave
    all = all.filter((c) => !(c.facts?.archived) && !agedOff(c.entry.status, c.entry.date, today));

    const backed = all.filter((c) => c.facts);
    const orphans = all.filter((c) => !c.facts).sort((a, b) => a.prevOrder - b.prevOrder);

    let rows: DashRow[] = [];
    let count: number;
    if (def.kind === 'work-item') {
      // active-first: non-terminal by updated desc, then terminal by updated desc
      backed.sort((a, b) => {
        const at = isTerminal(a.entry.status) ? 1 : 0;
        const bt = isTerminal(b.entry.status) ? 1 : 0;
        if (at !== bt) return at - bt;
        const au = a.facts?.updatedRaw ?? a.entry.date;
        const bu = b.facts?.updatedRaw ?? b.entry.date;
        if (au !== bu) return au < bu ? 1 : -1;
        return a.entry.relPath < b.entry.relPath ? -1 : 1;
      });
      const entries = [...backed, ...orphans];
      count = entries.length;
      rows = entries.map((c) => ({ kind: 'entry', entry: c.entry }));
    } else {
      // recent-first: by date desc; top 5 on the card, the rest behind overflow
      backed.sort((a, b) => {
        if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1;
        return a.entry.relPath < b.entry.relPath ? -1 : 1;
      });
      const entries = [...backed, ...orphans];
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

function buildFrontmatter(prevFm: Frontmatter | null, maxUpdated: string, opts: RegenOptions): Frontmatter {
  const fm: Frontmatter = { entries: [] };
  const prevUpdated = fmGetRaw(prevFm, 'updated') ?? '';
  const updated = maxUpdated > prevUpdated ? maxUpdated : prevUpdated;
  fmSetRaw(fm, 'updated', updated !== '' ? updated : opts.now);
  fmSetRaw(fm, 'generator', opts.generator ?? 'arbiter-cli');
  fmSetRaw(fm, 'generated', opts.now);
  fmSetRaw(fm, 'protocol', opts.protocolRaw);
  return fm;
}

const POINTER = {
  scope: 'tier-1',
  section: 'tier-1',
  reminder: 'open only the -> path you need; a stale index is advisory — item files are truth',
};

function assembleDashboard(
  candidates: Map<string, Candidate[]>,
  strays: Map<string, DashRow[]>,
  prev: DashboardFile | null,
  maxUpdated: string,
  opts: RegenOptions,
): string {
  const today = opts.now.slice(0, 10);
  const cards = buildCards(candidates, today);
  // hand-added stray lines are never deleted (PROTOCOL#tier-1)
  for (const card of cards) {
    const s = strays.get(card.label);
    if (s) card.rows.push(...s);
  }
  const dash: DashboardFile = {
    fm: buildFrontmatter(prev?.fm ?? null, maxUpdated, opts),
    cards,
    pointer: prev?.pointer ?? POINTER,
  };
  return serializeDashboard(dash);
}

function collectPrev(prev: DashboardFile | null): {
  entries: Map<string, { entry: DashboardEntry; order: number }>;
  strays: Map<string, DashRow[]>;
} {
  const entries = new Map<string, { entry: DashboardEntry; order: number }>();
  const strays = new Map<string, DashRow[]>();
  if (prev) {
    let order = 0;
    for (const card of prev.cards) {
      for (const row of card.rows) {
        if (row.kind === 'entry') entries.set(row.entry.relPath, { entry: row.entry, order: order++ });
        else if (row.kind === 'stray') {
          const list = strays.get(card.label) ?? [];
          list.push(row);
          strays.set(card.label, list);
        }
      }
    }
  }
  return { entries, strays };
}

/** Full rebuild: every item, reconciled against the previous dashboard when present. */
export function regenFull(facts: ItemFacts[], prevText: string | null, opts: RegenOptions): string {
  const prev = prevText !== null ? parseDashboard(prevText) : null;
  const { entries: prevEntries, strays } = collectPrev(prev);
  const candidates = new Map<string, Candidate[]>();
  let maxUpdated = '';
  for (const f of facts) {
    if (f.updatedRaw !== undefined && f.updatedRaw > maxUpdated) maxUpdated = f.updatedRaw;
    const prevE = prevEntries.get(f.relPath);
    const list = candidates.get(f.dir) ?? [];
    list.push({ entry: entryFor(f, prevE?.entry.date), facts: f, prevOrder: prevE?.order ?? Number.MAX_SAFE_INTEGER });
    candidates.set(f.dir, list);
    prevEntries.delete(f.relPath);
  }
  // hand-added entries whose file does not exist: preserved, never deleted
  for (const [relPath, { entry, order }] of prevEntries) {
    const dir = relPath.split('/')[0]!;
    const list = candidates.get(dir) ?? [];
    list.push({ entry, prevOrder: order });
    candidates.set(dir, list);
  }
  return assembleDashboard(candidates, strays, prev, maxUpdated, opts);
}

/** Incremental: previous entries + items whose `updated` is newer than the previous `generated`. */
export function regenIncremental(facts: ItemFacts[], prevText: string, opts: RegenOptions): string {
  const prev = parseDashboard(prevText);
  const generated = (prev.fm && fmGetRaw(prev.fm, 'generated')) || '';
  const { entries: prevEntries, strays } = collectPrev(prev);
  const factsByPath = new Map(facts.map((f) => [f.relPath, f]));

  const candidates = new Map<string, Candidate[]>();
  let maxUpdated = '';
  const push = (c: Candidate, dir: string) => {
    const list = candidates.get(dir) ?? [];
    list.push(c);
    candidates.set(dir, list);
  };

  // fold in every item whose updated is newer than the previous generated
  const folded = new Set<string>();
  for (const f of facts) {
    if (f.updatedRaw !== undefined && f.updatedRaw > generated) {
      if (f.updatedRaw > maxUpdated) maxUpdated = f.updatedRaw;
      const prevE = prevEntries.get(f.relPath);
      push({ entry: entryFor(f, prevE?.entry.date), facts: f, prevOrder: prevE?.order ?? Number.MAX_SAFE_INTEGER }, f.dir);
      folded.add(f.relPath);
    }
  }
  // previous entries persist unless a transition is observed (buildCards drops
  // archived/aged-off); staged flags are re-checked — proposals are not touches
  for (const [relPath, { entry, order }] of prevEntries) {
    if (folded.has(relPath)) continue;
    const f = factsByPath.get(relPath);
    if (f) {
      const refreshed: DashboardEntry = {
        ...entry,
        stagedCount: f.stagedCount > 0 ? f.stagedCount : undefined,
        title: f.title,
      };
      push({ entry: refreshed, facts: f, prevOrder: order }, f.dir);
    } else {
      push({ entry, prevOrder: order }, relPath.split('/')[0]!);
    }
  }
  // records beyond the top-5 window never left entries, so they are not in
  // prevEntries; fold them from facts so overflow counts stay truthful
  for (const f of facts) {
    if (folded.has(f.relPath) || prevEntries.has(f.relPath)) continue;
    push({ entry: entryFor(f), facts: f, prevOrder: Number.MAX_SAFE_INTEGER }, f.dir);
  }
  return assembleDashboard(candidates, strays, prev, maxUpdated, opts);
}

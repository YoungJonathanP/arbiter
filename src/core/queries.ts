// Queries over the derived index. Anything a query produces that matters
// (needs-review, archived) is written back to markdown by triage — the index
// itself is never truth. All take an explicit `today` (never wall clock).

import type { IndexDb } from './indexdb.js';

export interface ItemRow {
  ref: string;
  dir: string;
  id: string;
  type: string;
  kind: string;
  title: string;
  status: string | null;
  updated: string | null;
  updated_date: string | null;
  date: string | null;
  due: string | null;
  archived: string | null;
  staged_count: number;
  rel_path: string;
  prev: string | null;
}

const NON_ARCHIVED = `archived IS NULL`;
const TERMINAL = `status IN ('done', 'dropped')`;

/** Relevance-ordered active set for a work-item dir (active-first). */
export function activeSet(db: IndexDb, dir: string): ItemRow[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE dir = ? AND ${NON_ARCHIVED}
       ORDER BY (CASE WHEN ${TERMINAL} THEN 1 ELSE 0 END), updated DESC, ref`,
    )
    .all(dir) as ItemRow[];
}

/** Recency page for a record dir (recent-first, 10 per page, archived skipped). */
export function recordPage(db: IndexDb, dir: string, page = 0, pageSize = 10): ItemRow[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE dir = ? AND ${NON_ARCHIVED}
       ORDER BY COALESCE(date, updated_date) DESC, ref LIMIT ? OFFSET ?`,
    )
    .all(dir, pageSize, page * pageSize) as ItemRow[];
}

/** Overdue: due < today while status is non-terminal (task schema note). */
export function overdue(db: IndexDb, today: string): ItemRow[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE due IS NOT NULL AND due < ? AND NOT ${TERMINAL}
       AND ${NON_ARCHIVED} ORDER BY due, ref`,
    )
    .all(today) as ItemRow[];
}

/** Non-terminal work items untouched for 14+ days: triage stamps needs-review. */
export function needsReviewCandidates(db: IndexDb, today: string, days = 14): ItemRow[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE kind = 'work-item' AND NOT ${TERMINAL}
       AND status != 'needs-review' AND ${NON_ARCHIVED}
       AND updated_date IS NOT NULL
       AND julianday(?) - julianday(updated_date) >= ?
       ORDER BY updated_date, ref`,
    )
    .all(today, days) as ItemRow[];
}

/** Terminal work items past the 7-day dashboard age-off (archive candidates). */
export function agedOffTerminal(db: IndexDb, today: string, days = 7): ItemRow[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE kind = 'work-item' AND ${TERMINAL} AND ${NON_ARCHIVED}
       AND updated_date IS NOT NULL
       AND julianday(?) - julianday(updated_date) > ?
       ORDER BY updated_date, ref`,
    )
    .all(today, days) as ItemRow[];
}

/** Records older than a quarter (~90 days): archive candidates. */
export function staleRecords(db: IndexDb, today: string, days = 90): ItemRow[] {
  return db
    .prepare(
      `SELECT * FROM items WHERE kind = 'record' AND ${NON_ARCHIVED}
       AND type != 'accomplishment'
       AND COALESCE(date, updated_date) IS NOT NULL
       AND julianday(?) - julianday(COALESCE(date, updated_date)) > ?
       ORDER BY ref`,
    )
    .all(today, days) as ItemRow[];
}

/** Items with unresolved staged proposals — the most urgent thing on a card. */
export function stagedItems(db: IndexDb): ItemRow[] {
  return db.prepare(`SELECT * FROM items WHERE staged_count > 0 ORDER BY ref`).all() as ItemRow[];
}

/**
 * Iteration chain through `prev:` refs. The forward pointer is derived here,
 * never stored (PROTOCOL.md#slugs). Returns oldest → newest around `ref`.
 */
export function chain(db: IndexDb, ref: string): string[] {
  const prevOf = db.prepare(`SELECT prev FROM items WHERE ref = ?`);
  const nextOf = db.prepare(`SELECT ref FROM items WHERE prev = ? ORDER BY ref`);
  const back: string[] = [];
  let cur: string | undefined = ref;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    back.unshift(cur);
    cur = (prevOf.get(cur) as { prev: string | null } | undefined)?.prev ?? undefined;
  }
  let tip = ref;
  for (;;) {
    const next = nextOf.all(tip) as { ref: string }[];
    if (next.length === 0 || seen.has(next[0]!.ref)) break;
    tip = next[0]!.ref;
    seen.add(tip);
    back.push(tip);
  }
  return back;
}

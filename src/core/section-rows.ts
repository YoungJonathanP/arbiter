import type { RecoverableSection, Section, SectionRow } from './model.js';

/** Reconcile parsed order with in-place changes and appended structured entries. */
export function orderedRows<T>(section: RecoverableSection, entries: T[]):
  ({ kind: 'entry'; entry: T } | Exclude<SectionRow, { kind: 'entry' }>)[] {
  const seen = new Set<number>();
  const rows: ({ kind: 'entry'; entry: T } | Exclude<SectionRow, { kind: 'entry' }>)[] = [];
  for (const row of section.rawRows ?? []) {
    if (row.kind !== 'entry') { rows.push(row); continue; }
    const entry = entries[row.index];
    if (entry !== undefined) { rows.push({ kind: 'entry', entry }); seen.add(row.index); }
  }
  entries.forEach((entry, i) => { if (!seen.has(i)) rows.push({ kind: 'entry', entry }); });
  return rows;
}

export function sectionDiagnostics(section: Section) {
  return 'rawRows' in section ? (section.rawRows ?? []).filter(r => r.kind === 'opaque') : [];
}

/** Source coordinates and layout do not participate in structured op equality. */
export function withoutSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSource);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.startsWith('raw')).map(([key, val]) => [key, withoutSource(val)]));
  return value;
}

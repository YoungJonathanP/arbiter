// Semantic projection of ASTs for gate-2 equality: raw concrete-syntax
// carriers (quote styles, raw lines) are dropped; everything meaningful kept.

import type { DashboardFile, DocFile, Frontmatter, ItemFile, ProposalFile } from './model.js';
import { scalarValue } from './fm.js';

export function projectFm(fm: Frontmatter | null): unknown {
  if (!fm) return null;
  return fm.entries.map((e) => {
    if (e.value.kind === 'scalar') return [e.key, scalarValue(e.value.raw)];
    if (e.value.kind === 'seq') return [e.key, e.value.items];
    return [e.key, e.value.entries.map((n) => [n.key, n.value.kind === 'scalar' ? scalarValue(n.value.raw) : ''])];
  });
}

export function projectItem(f: ItemFile): unknown {
  return {
    fm: projectFm(f.fm),
    title: f.title,
    preamble: f.preamble,
    pointer: f.pointer,
    sections: f.sections.map((s) => {
      switch (s.kind) {
        case 'prose':
        case 'malformed':
          return { kind: s.kind, heading: s.heading, lines: s.lines };
        case 'checklist':
          return {
            kind: s.kind,
            heading: s.heading,
            steps: s.steps.map((st) => ({
              mark: st.mark,
              text: st.text,
              anchor: st.anchor ?? null,
              continuations: st.continuations,
            })),
          };
        case 'links':
        case 'docs':
          return { kind: s.kind, heading: s.heading, entries: s.entries };
      }
    }),
  };
}

export function projectDashboard(f: DashboardFile): unknown {
  return {
    fm: projectFm(f.fm),
    pointer: f.pointer,
    cards: f.cards.map((c) => ({
      label: c.label,
      count: c.count,
      rows: c.rows.map((r) =>
        r.kind === 'entry'
          ? {
              kind: r.kind,
              status: r.entry.status ?? null,
              staged: r.entry.stagedCount ?? null,
              title: r.entry.title,
              date: r.entry.date,
              relPath: r.entry.relPath,
            }
          : r,
      ),
    })),
  };
}

export function projectDoc(f: DocFile): unknown {
  return { fm: projectFm(f.fm), title: f.title, body: f.body, pointer: f.pointer };
}

export function projectProposal(f: ProposalFile): unknown {
  return {
    fm: projectFm(f.fm),
    title: f.title,
    body: f.body,
    pointer: f.pointer,
    ops: f.ops.map((o) => o.raw),
  };
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

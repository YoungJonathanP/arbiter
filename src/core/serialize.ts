// Canonical serializer (grammar §1, §5): emits exactly the productions, with
// exactly one blank line between sections and before the pointer line. For a
// canonical input file, serialize(parse(f)) === f byte-for-byte (gate 3).
// Section *order* is preserved as parsed — reordering to canonical order is
// the normalizer's job, so parse(serialize(parse(f))) = parse(f) (gate 2).

import type {
  DashboardFile,
  DocFile,
  ItemFile,
  PointerLine,
  ProposalFile,
  Section,
  Step,
} from './model.js';
import { orderedRows } from './section-rows.js';
import { serializeFrontmatter } from './fm.js';

export function serializePointer(p: PointerLine): string {
  return `<!-- arbiter:${p.scope} · PROTOCOL.md#${p.section} · ${p.reminder} -->`;
}

export function serializeStep(s: Step): string[] {
  const anchor = s.anchor ? ` <!-- ^${s.anchor} -->` : '';
  const out = [`- [${s.mark}] ${s.text}${anchor}`];
  for (const c of s.continuations) out.push(...(c.rawLeadingBlanks ?? []), `      ${c.kw}: [${c.label}](${c.target})`);
  return out;
}

function serializeSection(s: Section): string[] {
  const head = s.heading === '' ? [] : [`## ${s.heading}`];
  switch (s.kind) {
    case 'prose':
    case 'malformed':
      return [...head, ...s.lines];
    case 'checklist':
      return [...head, ...orderedRows(s, s.steps).flatMap(r => r.kind === 'entry' ? serializeStep(r.entry) : [r.raw])];
    case 'links':
      return [...head, ...orderedRows(s, s.entries).map(r => r.kind === 'entry' ? `- ${r.entry.kindLabel}: [${r.entry.label}](${r.entry.target})` : r.raw)];
    case 'docs':
      return [
        ...head,
        ...orderedRows(s, s.entries).map(r => r.kind === 'entry' ? `- [[${r.entry.docId}]] ${r.entry.title} (${r.entry.docKind}) -> ${r.entry.relPath}` : r.raw),
      ];
  }
}

function assemble(blocks: string[][], pointer: PointerLine | null): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.length === 0) continue;
    if (parts.length > 0) parts.push('');
    parts.push(...b);
  }
  if (pointer) {
    if (parts.length > 0) parts.push('');
    parts.push(serializePointer(pointer));
  }
  return parts.join('\n') + '\n';
}

export function serializeItem(f: ItemFile): string {
  const blocks: string[][] = [];
  if (f.fm) blocks.push(serializeFrontmatter(f.fm));
  if (f.preamble.length > 0) blocks.push(f.preamble);
  if (f.title !== null) blocks.push([`# ${f.title}`]);
  for (const s of f.sections) blocks.push(serializeSection(s));
  return assemble(blocks, f.pointer);
}

export function serializeDashboard(f: DashboardFile): string {
  const blocks: string[][] = [];
  if (f.fm) blocks.push(serializeFrontmatter(f.fm));
  blocks.push(['# Dashboard']);
  for (const c of f.cards) {
    const lines = [`## ${c.label} (${c.count})`];
    for (const r of c.rows) {
      if (r.kind === 'entry') {
        const e = r.entry;
        const status = e.status !== undefined ? `[${e.status}] ` : '';
        const staged = e.stagedCount !== undefined ? `(${e.stagedCount} staged) ` : '';
        lines.push(`- ${status}${staged}${e.review ? `(review: ${e.review}) ` : ''}${e.title} — ${e.date} -> ${e.relPath}`);
      } else if (r.kind === 'overflow') {
        lines.push(`- +${r.count} more in ${r.dir}/`);
      } else {
        lines.push(r.line);
      }
    }
    blocks.push(lines);
  }
  return assemble(blocks, f.pointer);
}

export function serializeDoc(f: DocFile): string {
  const blocks: string[][] = [];
  if (f.fm) blocks.push(serializeFrontmatter(f.fm));
  if (f.title !== null) blocks.push([`# ${f.title}`]);
  if (f.body.length > 0) blocks.push(f.body);
  return assemble(blocks, f.pointer);
}

export function serializeProposal(f: ProposalFile): string {
  const blocks: string[][] = [];
  if (f.fm) blocks.push(serializeFrontmatter(f.fm));
  if (f.title !== null) blocks.push([`# ${f.title}`]);
  if (f.body.length > 0) blocks.push(f.body);
  return assemble(blocks, f.pointer);
}

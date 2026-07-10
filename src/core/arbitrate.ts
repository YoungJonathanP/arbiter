// Arbitration: a pure function of (current item, staged proposal set) —
// PROTOCOL.md#arbitration step 4, grammar §9. No wall clock, no environment:
// concurrent arbiters compute byte-identical results (gate 7), and every op
// ends applied, overruled-on-the-record, or still staged (gate 6).

import type { ItemFile, Op, ProposalFile, Section, Step } from './model.js';
import { TERMINAL_STATUSES, KNOWN_SECTIONS } from './model.js';
import { fmGet, fmGetRaw, fmSet, fmSetRaw } from './fm.js';
import { parseItemFile, parseProposal, RESOLUTION_RE } from './parse.js';
import { serializeItem } from './serialize.js';

export interface ProposalInput {
  filename: string; // basename, e.g. 2026-07-05-agent-heron-2c91-quickstart-blocked.md
  text: string;
}

export interface ArbitrationResult {
  /** 'noop' = nothing staged; 'clean' = all proposals arbitrated; 'partial' = some stay staged */
  outcome: 'noop' | 'clean' | 'partial';
  itemText: string;
  /** proposal filenames to delete (their intent now lives in the item) */
  deleted: string[];
  /** proposal filenames that stay staged (item is flagged needs-review) */
  remaining: string[];
  flags: string[];
}

interface Prop {
  filename: string;
  stem: string;
  ast: ProposalFile;
  updated: string;
  updatedRaw: string;
  decidable: boolean;
  reasons: string[];
  verdicts: ('applied' | 'overruled')[]; // parallel to ast.ops
}

const MARK_ORDER: Record<string, number> = { todo: 0, 'in-flight': 1, done: 2 };
const MARK_TO_CHAR: Record<string, Step['mark']> = { todo: ' ', 'in-flight': '~', blocked: '!', done: 'x' };

function findStep(item: ItemFile, op: Op & { kind: 'mark' }): Step | undefined {
  for (const s of item.sections) {
    if (s.kind !== 'checklist') continue;
    for (const st of s.steps) {
      if (op.anchor !== undefined ? st.anchor === op.anchor : st.text === op.stepText) return st;
    }
  }
  return undefined;
}

function stepKey(op: Op & { kind: 'mark' }): string {
  return op.anchor !== undefined ? `^${op.anchor}` : `"${op.stepText}"`;
}

function evidenceSuffix(p: Prop): string {
  if (p.ast.bodyLinks.length === 0) return '';
  return ` (${p.ast.bodyLinks.map((l) => `[${l.label}](${l.target})`).join(', ')})`;
}

/** Compare ISO datetimes as written; lexicographic order is chronological for ISO-8601. */
function maxDatetime(values: { cmp: string; raw: string }[]): { cmp: string; raw: string } {
  return values.reduce((a, b) => (b.cmp > a.cmp ? b : a));
}

export function arbitrate(itemText: string, proposals: ProposalInput[]): ArbitrationResult {
  if (proposals.length === 0) {
    return { outcome: 'noop', itemText, deleted: [], remaining: [], flags: [] };
  }

  // bytewise filename order — input order must not matter (gate 7)
  const sorted = [...proposals].sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0));
  const item = parseItemFile(itemText);
  const itemStatus = fmGet(item.fm, 'status') ?? 'todo';
  const flags: string[] = [];

  const props: Prop[] = sorted.map((p) => {
    const ast = parseProposal(p.text);
    return {
      filename: p.filename,
      stem: p.filename.replace(/\.md$/, ''),
      ast,
      updated: fmGet(ast.fm, 'updated') ?? '',
      updatedRaw: fmGetRaw(ast.fm, 'updated') ?? fmGet(ast.fm, 'updated') ?? '',
      decidable: true,
      reasons: [],
      verdicts: ast.ops.map(() => 'applied' as const),
    };
  });

  // --- decidability sweep -----------------------------------------------------
  const setValues = new Map<string, Set<string>>(); // non-status key -> distinct values proposed
  for (const p of props) {
    for (const op of p.ast.ops) {
      if (op.kind === 'set' && op.key === '') {
        p.decidable = false;
        p.reasons.push(`unparseable op \`${op.raw}\``);
      } else if (op.kind === 'set' && op.key !== 'status') {
        const s = setValues.get(op.key) ?? new Set<string>();
        s.add(op.value);
        setValues.set(op.key, s);
      } else if (op.kind === 'mark') {
        const step = findStep(item, op);
        if (!step) {
          p.decidable = false;
          p.reasons.push(`mark op addresses missing step ${stepKey(op)}`);
        } else if (op.mark === 'blocked' && p.ast.bodyLinks.length === 0) {
          p.decidable = false;
          p.reasons.push('mark-op sets blocked but the body cites no blocker link');
        }
      } else if (op.kind === 'append') {
        if (!(KNOWN_SECTIONS as readonly string[]).includes(op.section)) {
          p.decidable = false;
          p.reasons.push(`append targets unknown section "${op.section}"`);
        }
      }
      // terminal reversal: never auto-resolved
      if (TERMINAL_STATUSES.has(itemStatus)) {
        const reopens =
          (op.kind === 'set' && op.key === 'status' && !TERMINAL_STATUSES.has(op.value)) ||
          (op.kind === 'mark' && op.mark !== 'done');
        if (reopens) {
          p.decidable = false;
          p.reasons.push('terminal reversal — never auto-resolved');
        }
      }
    }
  }
  // same non-status field set to different values: no rule decides
  for (const [key, values] of setValues) {
    if (values.size > 1) {
      for (const p of props) {
        if (p.ast.ops.some((o) => o.kind === 'set' && o.key === key)) {
          p.decidable = false;
          p.reasons.push(`conflicting \`set: ${key}\` values with no resolution rule`);
        }
      }
    }
  }
  // conflicting explicit statuses: structure can adjudicate blocked/done claims;
  // any other value in a multi-way status conflict has no structural tiebreak
  const statusValues = new Set(
    props.flatMap((p) => p.ast.ops.filter((o) => o.kind === 'set' && o.key === 'status').map((o) => (o as Op & { kind: 'set' }).value)),
  );
  if (statusValues.size > 1) {
    for (const p of props) {
      const soft = p.ast.ops.some(
        (o) => o.kind === 'set' && o.key === 'status' && o.value !== 'blocked' && o.value !== 'done',
      );
      if (soft) {
        p.decidable = false;
        p.reasons.push('conflicting explicit statuses; structure cannot adjudicate this value');
      }
    }
  }

  const decidable = props.filter((p) => p.decidable);
  const remaining = props.filter((p) => !p.decidable);
  for (const p of remaining) {
    flags.push(`${p.filename} stays staged: ${p.reasons.join('; ')}`);
  }

  if (decidable.length === 0) {
    if (item.fm && itemStatus !== 'needs-review') {
      fmSet(item.fm, 'status', 'needs-review');
      return { outcome: 'partial', itemText: serializeItem(item), deleted: [], remaining: remaining.map((p) => p.filename), flags };
    }
    return { outcome: 'partial', itemText, deleted: [], remaining: remaining.map((p) => p.filename), flags };
  }

  // --- merge mark ops per step (lattice; evidenced blocked wins) ---------------
  interface MarkClaim {
    prop: Prop;
    opIndex: number;
    op: Op & { kind: 'mark' };
  }
  const claims = new Map<Step, MarkClaim[]>();
  for (const p of decidable) {
    p.ast.ops.forEach((op, i) => {
      if (op.kind !== 'mark') return;
      const step = findStep(item, op)!;
      const list = claims.get(step) ?? [];
      list.push({ prop: p, opIndex: i, op });
      claims.set(step, list);
    });
  }

  for (const [step, list] of claims) {
    const blocked = list.filter((c) => c.op.mark === 'blocked');
    let winners: MarkClaim[];
    if (blocked.length > 0) {
      winners = blocked; // blocked-with-evidence wins the step
      step.mark = '!';
      // synthesize the blocked-by continuation from the winning proposal's body
      // (first distinct md-link, in body order); dedupe by target
      for (const w of blocked) {
        const link = w.prop.ast.bodyLinks[0]!;
        if (!step.continuations.some((c) => c.kw === 'blocked-by' && c.target === link.target)) {
          step.continuations.unshift({ kw: 'blocked-by', label: link.label, target: link.target });
        }
      }
    } else {
      const best = Math.max(...list.map((c) => MARK_ORDER[c.op.mark] ?? 0));
      winners = list.filter((c) => (MARK_ORDER[c.op.mark] ?? 0) === best);
      step.mark = MARK_TO_CHAR[winners[0]!.op.mark]!;
      if (step.mark !== '!') {
        // a step leaving blocked drops its blocked-by line only when un-blocking is the intent
        if (step.continuations.some((c) => c.kw === 'blocked-by') && step.mark === 'x') {
          step.continuations = step.continuations.filter((c) => c.kw !== 'blocked-by');
        }
      }
    }
    for (const c of list) {
      if (!winners.includes(c)) c.prop.verdicts[c.opIndex] = 'overruled';
    }
  }

  // --- non-status set ops -------------------------------------------------------
  for (const p of decidable) {
    p.ast.ops.forEach((op) => {
      if (op.kind === 'set' && op.key !== 'status' && item.fm) fmSet(item.fm, op.key, op.value);
    });
  }

  // --- append ops (always merge; dedupe byte-identical entries) ------------------
  for (const p of decidable) {
    p.ast.ops.forEach((op) => {
      if (op.kind !== 'append') return;
      let section = item.sections.find((s) => s.heading === op.section);
      if (!section) {
        section =
          op.section === 'Checklist'
            ? { kind: 'checklist', heading: 'Checklist', steps: [] }
            : op.section === 'Artifacts' || op.section === 'Evidence'
              ? { kind: 'links', heading: op.section, entries: [] }
              : { kind: 'prose', heading: op.section, lines: [] };
        item.sections.push(section);
      }
      if (section.kind === 'checklist') {
        if (!section.steps.some((s) => s.text === op.text)) {
          section.steps.push({ mark: ' ', text: op.text, continuations: [] });
        }
      } else if (section.kind === 'links') {
        const m = /^([^:]+): \[([^\]]*)\]\(([^)]+)\)$/.exec(op.text);
        if (m) {
          if (!section.entries.some((e) => e.kindLabel === m[1]! && e.label === m[2]! && e.target === m[3]!)) {
            section.entries.push({ kindLabel: m[1]!, label: m[2]!, target: m[3]! });
          }
        } else {
          flags.push(`${p.filename}: append to ${op.section} is not a link entry; appended as written`);
          section.entries.push({ kindLabel: 'note', label: op.text, target: '' });
        }
      } else if (section.kind === 'prose') {
        if (!section.lines.includes(op.text)) section.lines.push(op.text);
      }
    });
  }

  // --- status: structure decides --------------------------------------------------
  const steps = item.sections.flatMap((s) => (s.kind === 'checklist' ? s.steps : []));
  const anyBlocked = steps.some((s) => s.mark === '!');
  const allDone = steps.length > 0 && steps.every((s) => s.mark === 'x');
  let status = itemStatus;

  const statusOps: { prop: Prop; opIndex: number; value: string }[] = [];
  for (const p of decidable) {
    p.ast.ops.forEach((op, i) => {
      if (op.kind === 'set' && op.key === 'status') statusOps.push({ prop: p, opIndex: i, value: op.value });
    });
  }
  for (const so of statusOps) {
    // "An explicit status that contradicts the merged structure loses."
    const consistent =
      so.value === 'dropped' // dropping is a judgment; structure never contradicts it
        ? true
        : so.value === 'blocked'
          ? anyBlocked
          : so.value === 'done'
            ? allDone
            : !anyBlocked && !allDone;
    if (!consistent) so.prop.verdicts[so.opIndex] = 'overruled';
  }
  const appliedStatuses = [...new Set(statusOps.filter((s) => s.prop.verdicts[s.opIndex] === 'applied').map((s) => s.value))];
  if (appliedStatuses.includes('dropped')) status = 'dropped';
  else if (anyBlocked) status = 'blocked';
  else if (allDone && appliedStatuses.includes('done')) status = 'done';
  else if (appliedStatuses.length === 1) status = appliedStatuses[0]!;
  else if (status === 'blocked' && !anyBlocked) status = 'in-flight';

  if (remaining.length > 0) status = 'needs-review';
  if (item.fm && fmGet(item.fm, 'status') !== undefined) fmSet(item.fm, 'status', status);

  // --- updated: max across item and arbitrated proposals (never wall clock) -------
  const candidates = [{ cmp: fmGet(item.fm, 'updated') ?? '', raw: fmGetRaw(item.fm, 'updated') ?? '' }];
  for (const p of decidable) candidates.push({ cmp: p.updated, raw: p.updatedRaw });
  const newUpdated = maxDatetime(candidates);
  if (item.fm && newUpdated.raw !== '') fmSetRaw(item.fm, 'updated', newUpdated.raw);
  const resolutionDate = (fmGet(item.fm, 'updated') ?? '').slice(0, 10);

  // --- resolution lines at the end of ## Summary -----------------------------------
  let summary = item.sections.find((s): s is Section & { kind: 'prose' } => s.heading === 'Summary' && s.kind === 'prose');
  if (!summary) {
    summary = { kind: 'prose', heading: 'Summary', lines: [] };
    item.sections.unshift(summary);
  }
  const lines: string[] = [];
  for (const p of decidable) {
    const verdicts = p.ast.ops
      .map((op, i) =>
        p.verdicts[i] === 'applied' ? `\`${op.raw}\` ⇒ applied` : `\`${op.raw}\` ⇒ overruled${evidenceSuffix(p)}`,
      )
      .join('; ');
    lines.push(`- ${resolutionDate} — arbitrated ${p.stem}: ${verdicts}`);
  }
  const last = summary.lines[summary.lines.length - 1];
  if (summary.lines.length > 0 && last !== undefined && last !== '' && !RESOLUTION_RE.test(last)) {
    summary.lines.push('');
  }
  summary.lines.push(...lines);

  return {
    outcome: remaining.length === 0 ? 'clean' : 'partial',
    itemText: serializeItem(item),
    deleted: decidable.map((p) => p.filename),
    remaining: remaining.map((p) => p.filename),
    flags,
  };
}

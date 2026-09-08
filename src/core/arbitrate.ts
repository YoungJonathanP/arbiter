// Arbitration: a pure function of (current item, staged proposal set) —
// PROTOCOL.md#arbitration step 4, grammar §9. No wall clock, no environment:
// concurrent arbiters compute byte-identical results (gate 7), and every op
// ends applied, overruled-on-the-record, or still staged (gate 6).

import { sectionDiagnostics, withoutSource } from './section-rows.js';
import type { ItemFile, Op, ProposalFile, Section, Step } from './model.js';
import { TERMINAL_STATUSES, KNOWN_SECTIONS, STATUSES, TYPE_TO_DIR } from './model.js';
import { fmGet, fmGetRaw, fmSet, fmSetRaw } from './fm.js';
import { parseItemFile, parseProposal, RESOLUTION_RE } from './parse.js';
import type { ResolvedSchema } from './schema.js';
import { sha256 } from './corpus.js';
import { serializeItem } from './serialize.js';

export interface ProposalInput {
  filename: string; // basename, e.g. 2026-07-05-agent-heron-2c91-quickstart-blocked.md
  text: string;
}

export interface ArbitrationResult {
  /** 'noop' = nothing staged; 'clean' = all proposals arbitrated; 'partial' = some stay staged */
  outcome: 'noop' | 'clean' | 'partial';
  itemText: string;
  /** Eligible for cleanup only after commit verification and durable receipts. */
  deleted: string[];
  /** proposal filenames that stay staged for review (terminal status is preserved) */
  remaining: string[];
  flags: string[];
  receipts: ProposalReceipt[];
}

export interface ProposalReceipt {
  id: string;
  digest: string;
  filename: string;
  /** Original durable commit; replay receipts refer back to this snapshot. */
  committedIn?: string;
  replayed?: boolean;
  ops: { raw: string; verdict: 'applied' | 'overruled'; reason: string }[];
}

interface Prop {
  filename: string;
  stem: string;
  ast: ProposalFile;
  updated: string;
  updatedRaw: string;
  decidable: boolean;
  reasons: string[];
  verdicts: ('pending' | 'applied' | 'overruled')[]; // parallel to ast.ops
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

/** Parse an append through the same grammar used to read the eventual file. */
function appendSection(op: Op & { kind: 'append' }): Section | undefined {
  if (!op.text.trim() || /[\r\n]/.test(op.text)) return;
  const line = op.section === 'Summary' ? op.text : op.section === 'Checklist' ? `- [ ] ${op.text}` : `- ${op.text}`;
  const sections = parseItemFile(`# Append\n\n## ${op.section}\n${line}\n`).sections;
  const section = sections[0];
  if (sections.length !== 1 || !section || section.kind === 'malformed' || sectionDiagnostics(section).length > 0) return;
  if (section.kind === 'checklist' && (section.steps.length !== 1 || section.steps[0]!.text !== op.text)) return;
  if (section.kind === 'prose' && (section.lines.length !== 1 || section.lines[0] !== op.text)) return;
  return section;
}

export function opSatisfied(item: ItemFile, op: Op): boolean {
  if (op.kind === 'set') return fmGet(item.fm, op.key) === op.value;
  if (op.kind === 'mark') return findStep(item, op)?.mark === MARK_TO_CHAR[op.mark];
  const expected = appendSection(op);
  const actual = item.sections.find(s => s.heading === op.section);
  if (!expected || !actual || expected.kind !== actual.kind) return false;
  if (expected.kind === 'prose' && actual.kind === 'prose') return actual.lines.includes(op.text);
  if (expected.kind === 'checklist' && actual.kind === 'checklist') return actual.steps.some(s => s.text === op.text);
  if (expected.kind === 'links' && actual.kind === 'links') return expected.entries.every(e => actual.entries.some(a => JSON.stringify(withoutSource(a)) === JSON.stringify(withoutSource(e))));
  if (expected.kind === 'docs' && actual.kind === 'docs') return expected.entries.every(e => actual.entries.some(a => JSON.stringify(withoutSource(a)) === JSON.stringify(withoutSource(e))));
  return false;
}

export function proposalProblems(ast: ProposalFile, filename: string, item: ItemFile): string[] {
  const errors: string[] = [];
  const id = fmGet(item.fm, 'id');
  const ref = `${TYPE_TO_DIR[fmGet(item.fm, 'type') ?? '']}/${id}`;
  if (!ast.fm || !item.fm) errors.push('missing frontmatter');
  if (fmGet(ast.fm, 'id') !== filename.replace(/\.md$/, '') || !/^[a-z0-9][a-z0-9-]*\.md$/.test(filename)) errors.push('proposal ID must match filename');
  if (![id, ref].includes(fmGet(ast.fm, 'item'))) errors.push('proposal targets a different item');
  if (!/^sha256:[a-f0-9]{64}$/.test(fmGet(ast.fm, 'base') ?? '')) errors.push('invalid base digest');
  if (!fmGet(ast.fm, 'author') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(fmGet(ast.fm, 'updated') ?? '') || !Number.isFinite(Date.parse(fmGet(ast.fm, 'updated') ?? ''))) errors.push('missing author or invalid updated');
  if (!ast.body.some(line => line.trim()) || ast.ops.length === 0) errors.push('intent body and ops required');
  if (ast.ops.some(op => op.kind === 'set' && op.key === '')) errors.push('unparseable op');
  if (ast.pointer && ast.pointer.scope !== 'staged') errors.push('invalid pointer scope');
  if (ast.ops.some(op => /[`\r\n]/.test(op.raw))) errors.push('op contains a backtick or newline');
  return errors;
}

export function arbitrate(itemText: string, proposals: ProposalInput[], schema?: ResolvedSchema): ArbitrationResult {
  if (proposals.length === 0) {
    return { outcome: 'noop', itemText, deleted: [], remaining: [], flags: [], receipts: [] };
  }

  // bytewise filename order — input order must not matter (gate 7)
  const sorted = [...proposals].sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0));
  const item = parseItemFile(itemText);
  const itemStatus = fmGet(item.fm, 'status') ?? 'todo';
  const flags: string[] = [];

  const props: Prop[] = sorted.map((p) => {
    const ast = parseProposal(p.text);
    const reasons = proposalProblems(ast, p.filename, item);
    return {
      filename: p.filename,
      stem: p.filename.replace(/\.md$/, ''),
      ast,
      updated: fmGet(ast.fm, 'updated') ?? '',
      updatedRaw: fmGetRaw(ast.fm, 'updated') ?? fmGet(ast.fm, 'updated') ?? '',
      decidable: reasons.length === 0,
      reasons,
      verdicts: ast.ops.map(() => 'pending' as const),
    };
  });

  // --- decidability sweep -----------------------------------------------------
  const setValues = new Map<string, Set<string>>(); // non-status key -> distinct values proposed
  for (const p of props) {
    for (const op of p.ast.ops) {
      if (op.kind === 'set' && (['id', 'type', 'created', 'updated'].includes(op.key) || (op.key === 'status' && !STATUSES.has(op.value)) || (schema && !schema.fields.has(op.key)))) {
        p.decidable = false; p.reasons.push('unsupported or protected set field/value');
      }
      if (op.kind === 'set' && op.key === '') {
        p.decidable = false;
        p.reasons.push(`unparseable op \`${op.raw}\``);
      } else if (op.kind === 'set' && op.key !== 'status') {
        const s = setValues.get(op.key) ?? new Set<string>();
        s.add(op.value);
        setValues.set(op.key, s);
      } else if (op.kind === 'mark') {
        const step = findStep(item, op);
        const matches = item.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []).filter(s => op.anchor !== undefined ? s.anchor === op.anchor : s.text === op.stepText);
        if (!step || matches.length !== 1) {
          p.decidable = false;
          p.reasons.push(`mark op addresses missing step ${stepKey(op)}`);
        } else if (op.mark === 'blocked' && p.ast.bodyLinks.length === 0) {
          p.decidable = false;
          p.reasons.push('mark-op sets blocked but the body cites no blocker link');
        }
      } else if (op.kind === 'append') {
        if (!(KNOWN_SECTIONS as readonly string[]).includes(op.section) || (schema && !schema.sections.has(op.section)) || !appendSection(op) || item.sections.filter(s => s.heading === op.section).length > 1 || item.sections.some(s => s.heading === op.section && s.kind === 'malformed')) {
          p.decidable = false;
          p.reasons.push(`append targets unsupported/malformed section or entry "${op.section}"`);
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
    if (item.fm && fmGet(item.fm, 'review') === undefined) {
      fmSet(item.fm, 'review', itemStatus === 'needs-review' ? 'legacy-unknown' : 'needed');
      return { outcome: 'partial', itemText: serializeItem(item), deleted: [], remaining: remaining.map((p) => p.filename), flags, receipts: [] };
    }
    return { outcome: 'partial', itemText, deleted: [], remaining: remaining.map((p) => p.filename), flags, receipts: [] };
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
      const addition = appendSection(op)!;
      let section = item.sections.find(s => s.heading === op.section);
      if (!section) { item.sections.push(addition); return; }
      if (opSatisfied(item, op)) return;
      if (section.kind === 'checklist' && addition.kind === 'checklist') section.steps.push(...addition.steps);
      else if (section.kind === 'links' && addition.kind === 'links') section.entries.push(...addition.entries);
      else if (section.kind === 'docs' && addition.kind === 'docs') section.entries.push(...addition.entries);
      else if (section.kind === 'prose' && addition.kind === 'prose') section.lines.push(...addition.lines);

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
  const appliedStatuses = [...new Set(statusOps.filter((s) => s.prop.verdicts[s.opIndex] !== 'overruled').map((s) => s.value))];
  if (appliedStatuses.includes('dropped')) status = 'dropped';
  else if (anyBlocked) status = 'blocked';
  else if (allDone && appliedStatuses.includes('done')) status = 'done';
  else if (appliedStatuses.length === 1) status = appliedStatuses[0]!;
  else if (status === 'blocked' && !anyBlocked) status = 'in-flight';

  if (remaining.length > 0 && item.fm && fmGet(item.fm, 'review') === undefined) fmSet(item.fm, 'review', itemStatus === 'needs-review' ? 'legacy-unknown' : 'needed');
  if (item.fm && fmGet(item.fm, 'status') !== undefined) fmSet(item.fm, 'status', status);

  // --- updated: max across item and arbitrated proposals (never wall clock) -------
  const candidates = [{ cmp: fmGet(item.fm, 'updated') ?? '', raw: fmGetRaw(item.fm, 'updated') ?? '' }];
  for (const p of decidable) candidates.push({ cmp: p.updated, raw: p.updatedRaw });
  const newUpdated = maxDatetime(candidates);
  if (item.fm && newUpdated.raw !== '') fmSetRaw(item.fm, 'updated', newUpdated.raw);
  const resolutionDate = (fmGet(item.fm, 'updated') ?? '').slice(0, 10);

  // Verify the serialized target structure before assigning any applied verdict.
  const parsed = parseItemFile(serializeItem(item));
  const failed: Prop[] = [];
  for (const p of decidable) {
    p.ast.ops.forEach((op, i) => {
      if (p.verdicts[i] === 'overruled') return;
      if (opSatisfied(parsed, op)) p.verdicts[i] = 'applied';
      else if (op.kind === 'set' && op.key === 'status') p.verdicts[i] = 'overruled';
      else if (!failed.includes(p)) failed.push(p);
    });
  }
  if (failed.length) {
    // Conservatively retain the batch; no partial effects from a failed plan.
    return { outcome: 'partial', itemText, deleted: [], receipts: [],
      remaining: sorted.map(p => p.filename),
      flags: [...flags, ...failed.map(p => `${p.filename} stays staged: parsed postcondition failed; batch retained`)],
    };
  }

  // History is separate from the current continuation Summary (contract 0.4.8).
  // Preserve legacy Summary receipts and historical prose in place.
  let summary = item.sections.find((s): s is Section & { kind: 'prose' } => s.heading === 'Arbitration history' && s.kind === 'prose');
  if (!summary) {
    summary = { kind: 'prose', heading: 'Arbitration history', lines: [] };
    item.sections.push(summary);
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
    receipts: decidable.map(p => ({ id: p.stem, filename: p.filename, digest: sha256(sorted.find(s => s.filename === p.filename)!.text), ops: p.ast.ops.map((op, i) => ({ raw: op.raw, verdict: p.verdicts[i] as 'applied' | 'overruled', reason: p.verdicts[i] === 'applied' ? 'verified in parsed target' : op.kind === 'mark' ? `merged step mark is ${findStep(parsed, op)?.mark}` : `merged item status is ${fmGet(parsed.fm, 'status')}` })) })),
  };
}

// Reports consume only the current visibility-filtered projection, including
// archives. Evidence links are references, never a claim of network verification.
import { emitScalar, fmGet, fmGetList } from './fm.js';
import { parseItemFile } from './parse.js';
import type { ItemFacts } from './facts.js';
import type { ItemFile } from './model.js';
import type { readProjection } from './projection.js';
import { sectionDiagnostics } from './section-rows.js';
import { validDate } from './date.js';

type Snapshot = ReturnType<typeof readProjection>;
type SourceRecord = { facts: ItemFacts; ast: ItemFile; redacted?: boolean };
const prose = (ast: ItemFile, heading: string) => ast.sections.flatMap(s =>
  s.kind === 'prose' && s.heading === heading ? s.lines : []).join('\n').trim();
const links = (ast: ItemFile) => ast.sections.flatMap(s => s.kind === 'links' &&
  ['Artifacts', 'Evidence'].includes(s.heading) ? s.entries : []);
const text = (value: string) => value.replace(/[\\`*_{}\[\]<>#|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const link = (label: string, target: string) => `[${text(label)}](${target.replace(/[\s()<>]/g, c => encodeURIComponent(c).replace(/\(/g, '%28').replace(/\)/g, '%29'))})`;

function records(snapshot: Snapshot): Map<string, SourceRecord> {
  const files = new Map(snapshot.files.map(f => [f.relPath, f]));
  return new Map(snapshot.facts.map(facts => {
    const file = files.get(facts.relPath);
    return [facts.ref, { facts, ast: parseItemFile(file?.text ?? ''), redacted: file?.redacted }];
  }));
}

function eligibleWork(record: SourceRecord | undefined): record is SourceRecord {
  return !!record && !record.redacted && record.facts.kind === 'work-item' && record.facts.status === 'done' &&
    !record.facts.raw && !record.facts.stagedCount && !record.facts.review && !fmGet(record.ast.fm, 'superseded-by');
}

function visibleEvidence(snapshot: Snapshot, ast: ItemFile) {
  return links(ast).filter(e => {
    if (/^https?:\/\//.test(e.target)) return true;
    const [path, anchor] = e.target.split('#^');
    const file = snapshot.files.find(f => f.relPath === path && ['item', 'doc'].includes(f.kind));
    if (!file || file.redacted) return false;
    const owner = snapshot.facts.find(f => f.relPath === path || path!.startsWith(`${f.ref}/`));
    const ownerFile = owner && snapshot.files.find(f => f.relPath === owner.relPath);
    if (owner && (owner.status === 'dropped' || (ownerFile && fmGet(parseItemFile(ownerFile.text).fm, 'superseded-by')))) return false;
    return !anchor || parseItemFile(file.text).sections.some(s => s.kind === 'checklist' && s.steps.some(step => step.anchor === anchor));
  });
}

export function promotionCandidate(snapshot: Snapshot, ref: string, date: string, now: string): string {
  if (!validDate(date) || !validDate(now.slice(0, 10))) throw new Error('promotion requires real dates');
  if (!snapshot.files.some(f => f.relPath === 'types/accomplishment.md' && ['0.4.14', '0.4.18'].includes(fmGet(parseItemFile(f.text).fm, 'version') ?? '')))
    throw new Error('promotion requires explicit adoption of accomplishment schema 0.4.14 or 0.4.18');
  const work = records(snapshot).get(ref);
  if (!eligibleWork(work)) throw new Error('promotion requires visible completed work without review, staging or supersession');
  const id = `${work.facts.id.replace(/-\d{4}q[1-4]$/, '')}-impact-${date.slice(0, 4)}q${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
  // Keep titles quoted under the supported flat frontmatter syntax.
  const title = `Candidate: ${work.facts.title}`;
  const evidence = visibleEvidence(snapshot, work.ast).map(e => `- ${e.kindLabel}: ${link(e.label, e.target)}`);
  return `---\nid: ${id}\ntype: accomplishment\ntitle: ${emitScalar(title)}\ndate: ${date}\nsource: [${ref}]\noutcome: ${ref}\nverification: unverified\ncreated: ${now.slice(0, 10)}\nupdated: ${now}\n---\n\n# ${text(title)}\n\n## Summary\n\nCandidate from completed work: ${text(work.facts.summaryFirst ?? work.facts.title)}\n\n## Evidence\n\n${evidence.join('\n')}\n\n## Observations\n\n## Uncertainty\n\nConfirm the outcome, its date and stable outcome identity against existing accomplishments. Record what was observed, by whom and when before setting verification: observed. Source links alone do not verify impact.\n\n<!-- arbiter:tier-2 · PROTOCOL.md#accomplishments · candidate; verify before counting impact -->\n`;
}

export function impactReport(snapshot: Snapshot, since: string, until: string, generated: string): string {
  if (![since, until, generated].every(validDate) || since > until) throw new Error('report requires real dates with since <= until');
  const all = records(snapshot);
  type Record = { ref: string; ast: ItemFile; date: string; sources: string[]; reasons: string[] };
  const groups = new Map<string, Record[]>();
  for (const [ref, { facts, ast, redacted }] of all) {
    if (redacted || facts.type !== 'accomplishment' || facts.raw || fmGet(ast.fm, 'superseded-by') || facts.status === 'dropped') continue;
    const date = facts.date;
    if (!date || !validDate(date)) continue;
    const sources = fmGetList(ast.fm, 'source') ?? [];
    // Redacted/missing provenance cannot qualify or introduce report text.
    if (!sources.length || sources.some(source => !eligibleWork(all.get(source)))) continue;
    const reasons: string[] = [];
    if (ast.sections.some(s => sectionDiagnostics(s).length || s.kind === 'malformed')) reasons.push('Malformed structured content requires review.');
    if (new Set(ast.fm?.entries.map(e => e.key)).size !== ast.fm?.entries.length) reasons.push('Duplicate metadata requires review.');
    if (!fmGet(ast.fm, 'outcome')?.trim()) reasons.push('No stable outcome identity recorded.');
    if (fmGet(ast.fm, 'verification') !== 'observed') reasons.push('Impact is unverified.');
    const observed = fmGet(ast.fm, 'observed-on');
    if (!observed || !validDate(observed) || observed > generated || observed < date) reasons.push('Missing or inconsistent observation date.');
    if (!fmGet(ast.fm, 'verified-by')?.trim()) reasons.push('No observer recorded.');
    if (!prose(ast, 'Summary')) reasons.push('No impact claim recorded.');
    if (!prose(ast, 'Observations')) reasons.push('No observation recorded.');
    if (!prose(ast, 'Uncertainty')) reasons.push('Verification limits have not been stated.');
    if (!visibleEvidence(snapshot, ast).length) reasons.push('No usable evidence reference.');
    if (facts.review || facts.stagedCount) reasons.push('Review or staged changes remain unresolved.');
    const key = fmGet(ast.fm, 'outcome')?.trim() || `unidentified:${ref}`;
    const group = groups.get(key) ?? [];
    group.push({ ref, ast, date, sources, reasons });
    groups.set(key, group);
  }
  const counted: string[] = [], candidates: string[] = [];
  for (const [outcome, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    group.sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
    if (!group.some(r => r.date >= since && r.date <= until)) continue;
    // Compare all current records, even outside the requested range; a conflicting
    // duplicate must not count twice in separate periods.
    const reasons = [...new Set(group.flatMap(r => r.reasons))];
    if (new Set(group.map(r => r.date)).size > 1 || new Set(group.map(r => prose(r.ast, 'Summary'))).size > 1)
      reasons.push('Conflicting outcome dates or claims; reconcile duplicate records.');
    const row = group[0]!;
    const body = [`### ${text(outcome)}`, '', `Impact claim: ${text(prose(row.ast, 'Summary')) || '(not recorded)'}`, '',
      `Outcome date: ${row.date}`, '', 'Recorded observations:', '',
      ...[...new Set(group.map(r => prose(r.ast, 'Observations')).filter(Boolean))].map(o => `- ${text(o)}`),
      ...[...new Set(group.map(r => fmGet(r.ast.fm, 'verified-by') ? `- Observer: ${text(fmGet(r.ast.fm, 'verified-by')!)}; observed on ${text(fmGet(r.ast.fm, 'observed-on') ?? 'unknown')}.` : ''))].filter(Boolean),
      '', 'Evidence references (not independently checked by this report):', '',
      ...[...new Set(group.flatMap(r => visibleEvidence(snapshot, r.ast).map(e => `- ${link(e.label, e.target)}`)))],
      '', 'Uncertainty:', '', ...reasons.map(reason => `- ${reason}`),
      ...[...new Set(group.map(r => prose(r.ast, 'Uncertainty')).filter(Boolean))].map(u => `- ${text(u)}`),
      '', 'Source records (archives retained):', '',
      ...[...new Set(group.flatMap(r => [r.ref, ...r.sources]))].sort().map(ref => `- ${link(all.get(ref)!.facts.title, `${ref}.md`)}${all.get(ref)!.facts.archived ? ' (archived)' : ''}`), ''].join('\n');
    (reasons.length ? candidates : counted).push(body);
  }
  return [`# Impact report: ${since} through ${until}`, '', `Generated: ${generated}. Inclusive outcome dates; archives included.`, '',
    'Counts reflect recorded attestations, not independent verification. Shared outcome identities count once. Related tasks and journal activity add no impact counts.', '',
    `Counted outcomes: ${counted.length}`, `Unverified outcome groups: ${candidates.length}`, '',
    '## Observed outcomes', '', ...counted, '## Candidates requiring verification', '', ...candidates, ''].join('\n');
}

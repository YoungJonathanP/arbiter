import { checkInputProtocol, parseInputLedger, replayInputEvents } from './input-storage-format.js';
import { validDate } from './date.js';
// Validator: judges a data directory against grammar.md + the type schemas
// (which are data, never hardcoded). Raw human files are VALID (protocol
// #normalization) — they produce warnings, never errors.

import { sectionDiagnostics } from './section-rows.js';
import { assessCheckpoint, SIZE_TARGETS } from './checkpoint.js';
import { serializeStep } from './serialize.js';
import type { CorpusFile } from './corpus.js';
import { sha256 } from './corpus.js';
import { DIR_TO_TYPE, ITEM_DIRS, DOC_KINDS, STATUSES, POINTER_SCOPES } from './model.js';
import { fmGet, fmGetList } from './fm.js';
import {
  parseDashboard,
  parseDocFile,
  parseItemFile,
  parseProposal,
  parseTypeSchema,
  parseOp,
} from './parse.js';
import type { SchemaSet } from './schema.js';

export interface Finding {
  severity: 'error' | 'warning';
  relPath: string;
  message: string;
  line?: number;
  code?: 'malformed-entry' | 'broken-target';
  expected?: string;
}

export interface ValidationReport {
  errors: Finding[];
  warnings: Finding[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:?\d{2}|Z)?)?$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WORK_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*-\d{4}q[1-4]$/;
const MEETING_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}$/;
const WIKILINK_RE = /\[\[([^[\]|]+)\]\]/g;
const OBJECT_REF_RE = new RegExp(`^(${ITEM_DIRS.join('|')})/[a-z0-9][a-z0-9-]*$`);

export function validateCorpus(dataDir: string, files: CorpusFile[], schemas: SchemaSet, options: { verifyHistory?: boolean } = {}): ValidationReport {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const err = (relPath: string, message: string, line?: number, code?: Finding['code']) => errors.push({ severity: 'error', relPath, message, ...(line ? { line } : {}), ...(code ? { code } : {}) });
  const warn = (relPath: string, message: string) => warnings.push({ severity: 'warning', relPath, message });

  const byPath = new Map(files.map((f) => [f.relPath, f]));
  const boundedContract = ['0.4.11', '0.4.12', '0.4.13', '0.4.14', '0.4.15', '0.4.16', '0.4.17'].includes(fmGet(parseDocFile(byPath.get('PROTOCOL.md')?.text ?? '').fm, 'version') ?? '');
  const anchorsByPath = new Map<string, Set<string>>();
  const itemMeta = new Map<string, { parent?: string; archived: boolean }>();

  // pass 1: collect anchors (for cross-file anchor refs) and parent/archived
  // facts (for the nesting checks after the main loop)
  for (const f of files) {
    if (f.kind !== 'item') continue;
    const ast = parseItemFile(f.text, f.sourceLines);
    itemMeta.set(f.relPath, {
      parent: fmGet(ast.fm, 'parent'),
      archived: fmGet(ast.fm, 'archived') !== undefined,
    });
    const anchors = new Set<string>();
    for (const s of ast.sections) {
      if (s.kind !== 'checklist') continue;
      for (const st of s.steps) {
        if (!st.anchor) continue;
        if (anchors.has(st.anchor)) err(f.relPath, `duplicate anchor ^${st.anchor} (anchors are unique per file)`);
        anchors.add(st.anchor);
      }
    }
    anchorsByPath.set(f.relPath, anchors);
  }

  // `[[bare-id]]` is the old graph's idiom; PROTOCOL has exactly one link form
  // (a data-root-relative markdown link), so prose carrying one gets nudged- the
  // rewrite is spelled out whenever the id resolves to a single file.
  const pathByBareId = new Map<string, string>();
  const ambiguousIds = new Set<string>();
  for (const f of files) {
    if (f.kind !== 'item' && f.kind !== 'doc') continue;
    const bare = f.relPath.slice(f.relPath.lastIndexOf('/') + 1).replace(/\.md$/, '');
    if (pathByBareId.has(bare)) ambiguousIds.add(bare);
    else pathByBareId.set(bare, f.relPath);
  }
  const checkWikilinks = (relPath: string, lines: string[], where: string) => {
    for (const line of lines) {
      // quoting the syntax in a code span is how it gets discussed, not a use of it
      for (const m of line.replace(/`[^`]*`/g, '').matchAll(WIKILINK_RE)) {
        const id = m[1]!.trim();
        const target = ambiguousIds.has(id) ? undefined : pathByBareId.get(id);
        warn(
          relPath,
          `wikilink in ${where}: [[${id}]] carries no target- PROTOCOL has one link form` +
            (target !== undefined ? `; write [${id}](${target})` : ' (unresolved id; link it or drop the brackets)'),
        );
      }
    }
  };

  const checkTarget = (relPath: string, target: string, what: string, line?: number) => {
    if (/^https?:\/\//.test(target)) return;
    const [p, anchor] = target.split('#^');
    if (!byPath.has(p!)) {
      err(relPath, `${what} target does not resolve: ${target}`, line, 'broken-target');
      return;
    }
    if (anchor !== undefined && !anchorsByPath.get(p!)?.has(anchor)) {
      err(relPath, `${what} anchor does not resolve: ${target}`, line, 'broken-target');
    }
  };

  for (const f of files) {
    switch (f.kind) {
      case 'input-review': {
        try {
          const task = f.relPath.split('/').slice(0, 2).join('/');
          const events = parseInputLedger(task, f.text);
          checkInputProtocol(events, fmGet(parseDocFile(byPath.get('PROTOCOL.md')?.text ?? '').fm, 'version') ?? '');
          const state = replayInputEvents(events);
          if (!byPath.has(`${task}.md`)) err(f.relPath, 'Input-review task does not resolve');
          if (!['0.4.15', '0.4.16', '0.4.17'].includes(fmGet(parseDocFile(byPath.get('PROTOCOL.md')?.text ?? '').fm, 'version') ?? '')) err(f.relPath, 'Input-review role requires protocol 0.4.15');
          for (const link of state.links) if (!byPath.has(`${link.source}.md`)) err(f.relPath, 'Linked source does not resolve');
          for (const edge of state.relationships) if (!byPath.has(`${edge.entity}.md`)) err(f.relPath, 'Connected entity does not resolve');
          if (state.pending) warn(f.relPath, 'Incomplete input action requires explicit reconciliation');
        } catch (error) { err(f.relPath, error instanceof Error ? error.message : 'Invalid input-review ledger'); }
        break;
      }
      case 'checkpoint':
      case 'checkpoint-history': {
        const assessment = assessCheckpoint(f.relPath, f.text, files, new Map(), options.verifyHistory !== false);
        for (const message of assessment.errors) err(f.relPath, message);
        for (const message of assessment.warnings) warn(f.relPath, message);
        if (f.kind === 'checkpoint' && assessment.readiness !== 'ready')
          warn(f.relPath, `checkpoint readiness: ${assessment.readiness}${assessment.reasons.length ? '; ' + assessment.reasons.join('; ') : ''}`);
        break;
      }
      case 'protocol':
        break;
      case 'schema': {
        const s = parseTypeSchema(f.text);
        if (!s.schema) err(f.relPath, 'schema frontmatter missing `schema:` key');
        if (s.extends && !files.some((x) => x.relPath === `types/${s.extends}.md`))
          err(f.relPath, `extends unresolved schema "${s.extends}"`);
        const doc = parseDocFile(f.text);
        if (!doc.pointer) warn(f.relPath, 'missing pointer line');
        else if (doc.pointer.scope !== 'types') err(f.relPath, `pointer scope should be types, is ${doc.pointer.scope}`);
        break;
      }
      case 'dashboard': {
        if (boundedContract && Buffer.byteLength(f.text, 'utf8') > SIZE_TARGETS.overview)
          warn(f.relPath, 'project overview exceeds 4 KiB target; use bounded groups and paging');
        const d = parseDashboard(f.text);
        if (!d.fm) warn(f.relPath, 'dashboard missing frontmatter');
        for (const key of ['updated', 'generator', 'generated', 'protocol']) {
          if (d.fm && fmGet(d.fm, key) === undefined) warn(f.relPath, `dashboard frontmatter missing ${key}`);
        }
        if (!d.pointer) warn(f.relPath, 'missing pointer line');
        else if (d.pointer.scope !== 'tier-1') err(f.relPath, `pointer scope should be tier-1, is ${d.pointer.scope}`);
        for (const c of d.cards) {
          let entries = 0;
          let overflow = 0;
          for (const r of c.rows) {
            if (r.kind === 'entry') {
              entries++;
              if (!byPath.has(r.entry.relPath))
                warn(f.relPath, `entry path does not resolve (hand-added stub?): ${r.entry.relPath}`);
              if (r.entry.status !== undefined && !STATUSES.has(r.entry.status))
                err(f.relPath, `unknown status [${r.entry.status}] in card "${c.label}"`);
            } else if (r.kind === 'overflow') overflow = r.count;
            else warn(f.relPath, `hand-added line preserved in card "${c.label}": ${r.line}`);
          }
          if (c.count !== entries + overflow)
            warn(f.relPath, `card "${c.label}" header count ${c.count} ≠ ${entries} entries + ${overflow} overflow (stale index is advisory)`);
        }
        break;
      }
      case 'item': {
        const [dir, file] = f.relPath.split('/') as [string, string];
        const id = file.replace(/\.md$/, '');
        const type = DIR_TO_TYPE[dir]!;
        const schema = schemas.get(type);
        const ast = parseItemFile(f.text, f.sourceLines);

        for (const s of ast.sections) for (const d of sectionDiagnostics(s)) warnings.push({
          severity: 'warning', relPath: f.relPath, line: d.line, code: 'malformed-entry', expected: d.expected,
          message: `malformed entry in ## ${s.heading}; expected ${d.expected}; preserved verbatim`,
        });
        if (!ast.fm) {
          warn(f.relPath, 'raw human file (valid; normalization repairs it on first touch)');
          if (!SLUG_RE.test(id)) warn(f.relPath, 'un-slugged filename; rename only if never referenced');
          break;
        }
        if (!ast.title) err(f.relPath, 'missing `# <title>` line');
        if (!ast.pointer) err(f.relPath, 'missing pointer line (required once normalized)');
        else if (ast.pointer.scope !== 'tier-2') err(f.relPath, `pointer scope should be tier-2, is ${ast.pointer.scope}`);
        if (fmGet(ast.fm, 'id') !== id) err(f.relPath, `frontmatter id "${fmGet(ast.fm, 'id')}" ≠ filename stem "${id}"`);
        if (fmGet(ast.fm, 'type') !== type) err(f.relPath, `frontmatter type "${fmGet(ast.fm, 'type')}" ≠ directory type "${type}"`);

        if (schema) {
          // slug form
          const sf = schema.slugForm ?? '';
          if (sf.includes('YYYYqN') && !WORK_ID_RE.test(id)) err(f.relPath, `id does not match slug form ${sf}`);
          else if (sf.includes('YYYY-MM-DD') && !MEETING_ID_RE.test(id)) err(f.relPath, `id does not match slug form ${sf}`);
          else if (!SLUG_RE.test(id)) warn(f.relPath, 'un-slugged filename; rename only if never referenced');

          for (const [key, def] of schema.fields) {
            const v = fmGet(ast.fm, key);
            if (v === undefined) {
              if (def.required) err(f.relPath, `required field missing: ${key}`);
              continue;
            }
            if (def.type === 'date' && !DATE_RE.test(v)) err(f.relPath, `field ${key} is not a date: ${v}`);
            if (def.type === 'datetime' && !DATETIME_RE.test(v)) err(f.relPath, `field ${key} is not a datetime: ${v}`);
            if (def.type === 'enum' && def.values && !def.values.includes(v))
              err(f.relPath, `field ${key} not in [${def.values.join(', ')}]: ${v}`);
            if (def.type === 'ref' || def.type === 'ref-list') {
              for (const ref of fmGetList(ast.fm, key) ?? []) {
                if (!OBJECT_REF_RE.test(ref)) {
                  warn(f.relPath, `bare ref in ${key}: "${ref}" (liberal; normalization qualifies it)`);
                } else if (!byPath.has(`${ref}.md`)) {
                  err(f.relPath, `${key} object ref does not resolve: ${ref}`);
                }
              }
            }
          }
          for (const e of ast.fm.entries) {
            if (!schema.fields.has(e.key)) warn(f.relPath, `unknown frontmatter key preserved: ${e.key}`);
          }
          for (const [name, def] of schema.sections) {
            if (def.required && !ast.sections.some((s) => s.heading === name))
              err(f.relPath, `required section missing: ## ${name}`);
          }
        }

        const superseded = fmGet(ast.fm, 'superseded-by');
        if (superseded !== undefined) {
          if (!OBJECT_REF_RE.test(superseded) || !byPath.has(`${superseded}.md`)) err(f.relPath, 'superseded-by must resolve to an object ref');
          const seen = new Set([`${dir}/${id}`]);
          let next: string | undefined = superseded;
          while (next) {
            if (seen.has(next)) { err(f.relPath, 'supersession cycle'); break; }
            seen.add(next);
            next = fmGet(parseItemFile(byPath.get(`${next}.md`)?.text ?? '').fm, 'superseded-by');
          }
        }
        if (type === 'accomplishment' && schema?.version === '0.4.18' && fmGet(ast.fm, 'verification') === undefined)
          warn(f.relPath, 'Accomplishment has no verification metadata; retained as unverified, not counted impact');
        const observed = type === 'accomplishment' && fmGet(ast.fm, 'verification') === 'observed';
        const reviewed = ['decision', 'finding'].includes(type) && fmGet(ast.fm, 'review') === 'reviewed';
        if (observed || reviewed) {
          const who = observed ? 'verified-by' : 'reviewed-by', when = observed ? 'observed-on' : 'reviewed-on';
          if (!fmGet(ast.fm, who)?.trim()) err(f.relPath, `${who} required for recorded observation/review`);
          const date = fmGet(ast.fm, when);
          if (!date || !validDate(date) || date < (fmGet(ast.fm, 'date') ?? '')) err(f.relPath, `${when} must be a real date on or after the record date`);
          for (const heading of ['Summary', 'Observations', 'Uncertainty']) {
            if (!ast.sections.some(s => s.kind === 'prose' && s.heading === heading && s.lines.join('').trim())) err(f.relPath, `nonempty ${heading} required for recorded observation/review`);
          }
          if (!ast.sections.some(s => s.kind === 'links' && s.heading === 'Evidence' && s.entries.length)) err(f.relPath, 'Evidence required for recorded observation/review');
          if (reviewed && (!fmGet(ast.fm, 'scope')?.trim() || fmGet(ast.fm, 'scope') === 'unassigned')) err(f.relPath, 'reviewed knowledge requires explicit scope');
          if (observed) {
            if (!fmGet(ast.fm, 'outcome')?.trim()) err(f.relPath, 'observed accomplishment requires stable outcome identity');
            const sources = fmGetList(ast.fm, 'source') ?? [];
            if (!sources.length) err(f.relPath, 'observed accomplishment requires source work');
            for (const source of sources) {
              const sourceAst = parseItemFile(byPath.get(`${source}.md`)?.text ?? '');
              if (schemas.get(fmGet(sourceAst.fm, 'type') ?? '')?.kind !== 'work-item' || fmGet(sourceAst.fm, 'status') !== 'done' || fmGet(sourceAst.fm, 'superseded-by'))
                err(f.relPath, 'observed accomplishment source must be completed, non-superseded work');
            }
          }
        }
        const status = fmGet(ast.fm, 'status');
        const checkpoint = fmGet(ast.fm, 'checkpoint');
        if (checkpoint !== undefined && (type !== 'task' || checkpoint !== `${dir}/${id}/checkpoint.md` || byPath.get(checkpoint)?.kind !== 'checkpoint'))
          err(f.relPath, 'checkpoint must resolve to the owning task current checkpoint');
        let hasBang = false;
        let summaryBlockedBy = false;
        for (const s of ast.sections) {
          if (boundedContract && s.kind === 'prose' && s.heading === 'Summary' && Buffer.byteLength(s.lines.join('\n'), 'utf8') > SIZE_TARGETS.summary)
            warn(f.relPath, 'Summary exceeds 1 KiB target; preview extraction into linked detail, preserving constraints');
          if (s.kind === 'malformed') warn(f.relPath, `section "## ${s.heading}" is off-grammar; treated as opaque`);
          if (s.kind === 'checklist') {
            for (const st of s.steps) {
              if (boundedContract && [...serializeStep(st).join('\n')].length > SIZE_TARGETS.rowCharacters)
                warnings.push({ severity: 'warning', relPath: f.relPath, line: st.rawLine, message: `Checklist row${st.anchor ? ` ^${st.anchor}` : ''} exceeds 400 characters; preserve identifiers and essential rules when extracting detail` });
              if (st.mark === '!') {
                hasBang = true;
                if (!st.continuations.some((c) => c.kw === 'blocked-by'))
                  err(f.relPath, `[!] step "${st.text}" has no blocked-by: continuation`);
              }
              for (const c of st.continuations) checkTarget(f.relPath, c.target, `${c.kw}:`, c.rawLine);
            }
          }
          if (s.kind === 'prose' && s.heading === 'Summary') {
            if (s.lines.some((l) => l.startsWith('- blocked-by: ') || /^- blocked-by:/.test(l))) summaryBlockedBy = true;
          }
          if (s.kind === 'prose' && s.heading !== 'Detail docs') checkWikilinks(f.relPath, s.lines, `## ${s.heading}`);
          if (s.kind === 'checklist') checkWikilinks(f.relPath, s.steps.map((st) => st.text), 'a checklist step');
          if (s.kind === 'links') {
            if (s.heading === 'Evidence' && !['accomplishment', 'decision', 'finding'].includes(type))
              warn(f.relPath, '## Evidence outside an accomplishment (grammar §5 expects Artifacts here)');
            for (const e of s.entries) checkTarget(f.relPath, e.target, `${s.heading} entry`, e.rawLine);
          }
          if (s.kind === 'docs') {
            for (const e of s.entries) {
              checkTarget(f.relPath, e.relPath, 'Detail docs entry', e.rawLine);
              if (!e.relPath.startsWith(`${dir}/${id}/`))
                warn(f.relPath, `detail doc lives outside this item's directory: ${e.relPath}`);
            }
          }
        }
        if (status === 'blocked' && !hasBang && !summaryBlockedBy)
          err(f.relPath, 'status: blocked requires a [!] step (or a blocked-by: line under ## Summary)');
        if (type === 'accomplishment' && fmGet(ast.fm, 'verification') !== 'unverified') {
          const evidence = ast.sections.find((s) => s.heading === 'Evidence');
          if (!evidence || evidence.kind !== 'links' || evidence.entries.length === 0)
            err(f.relPath, 'accomplishment has no verifiable ## Evidence link');
        }
        break;
      }
      case 'doc': {
        const ast = parseDocFile(f.text);
        const parts = f.relPath.split('/');
        const itemRel = `${parts[0]}/${parts[1]}.md`;
        const stem = parts[2]!.replace(/\.md$/, '');
        if (!ast.fm) {
          warn(f.relPath, 'raw detail doc (valid; normalization repairs it on first touch)');
          break;
        }
        checkWikilinks(f.relPath, parseItemFile(f.text, f.sourceLines).sections.flatMap((s) => (s.kind === 'prose' ? s.lines : [])), 'doc prose');
        if (fmGet(ast.fm, 'id') !== stem) err(f.relPath, `doc id ≠ filename stem "${stem}"`);
        const kind = fmGet(ast.fm, 'kind');
        if (kind === undefined || !DOC_KINDS.has(kind)) err(f.relPath, `doc kind invalid: ${kind}`);
        if (!byPath.has(itemRel)) err(f.relPath, `owning item missing: ${itemRel}`);
        const itemKey = fmGet(ast.fm, 'item');
        if (itemKey !== parts[1]) warn(f.relPath, `doc frontmatter item "${itemKey}" ≠ owning item id "${parts[1]}"`);
        if (!ast.pointer) err(f.relPath, 'missing pointer line');
        else if (ast.pointer.scope !== 'tier-3') err(f.relPath, `pointer scope should be tier-3, is ${ast.pointer.scope}`);
        break;
      }
      case 'proposal': {
        const ast = parseProposal(f.text);
        const parts = f.relPath.split('/');
        const stem = parts[2]!.replace(/\.md$/, '');
        const itemId = parts[1]!.replace(/\.staged$/, '');
        const itemRel = `${parts[0]}/${itemId}.md`;
        if (!ast.fm) {
          err(f.relPath, 'proposal missing frontmatter');
          break;
        }
        if (fmGet(ast.fm, 'id') !== stem) err(f.relPath, `proposal id ≠ filename stem "${stem}"`);
        if (![itemId, `${parts[0]}/${itemId}`].includes(fmGet(ast.fm, 'item') ?? '')) err(f.relPath, `proposal item "${fmGet(ast.fm, 'item')}" ≠ staged item "${itemId}"`);
        const itemFile = byPath.get(itemRel);
        if (!itemFile) err(f.relPath, `staged against missing item: ${itemRel}`);
        const base = fmGet(ast.fm, 'base') ?? '';
        if (!/^sha256:[0-9a-f]{64}$/.test(base)) err(f.relPath, `base is not sha256:<hex>: ${base}`);
        else if (itemFile && base !== `sha256:${sha256(itemFile.text)}`)
          warn(f.relPath, 'base hash is stale (item moved on; arbitration merges against current bytes)');
        if (fmGet(ast.fm, 'author') === undefined) err(f.relPath, 'proposal missing author');
        const upd = fmGet(ast.fm, 'updated');
        if (upd === undefined || !DATETIME_RE.test(upd)) err(f.relPath, `proposal updated invalid: ${upd}`);
        const opsRaw = fmGetList(ast.fm, 'ops') ?? [];
        if (opsRaw.length === 0) err(f.relPath, 'proposal has no ops');
        for (const raw of opsRaw) {
          if (raw.includes('`')) err(f.relPath, `op contains a backtick: ${raw}`);
          const op = parseOp(raw);
          if (!op || (op.kind === 'set' && op.key === '')) err(f.relPath, `op does not parse: ${raw}`);
          else if (op.kind === 'mark' && op.mark === 'blocked' && ast.bodyLinks.length === 0)
            err(f.relPath, 'mark-op sets blocked but the body cites no blocker link');
        }
        if (ast.body.length === 0) err(f.relPath, 'proposal body (the intent) is required');
        if (!ast.pointer) warn(f.relPath, 'missing pointer line');
        else if (ast.pointer.scope !== 'staged') err(f.relPath, `pointer scope should be staged, is ${ast.pointer.scope}`);
        break;
      }
    }
  }

  // nesting structure (grammar §7 membership): one supported level, no cycles
  const sameDirParent = (rel: string): string | undefined => {
    const p = itemMeta.get(rel)?.parent;
    if (p === undefined || !p.startsWith(`${rel.split('/')[0]}/`)) return undefined;
    const pRel = `${p}.md`;
    return itemMeta.has(pRel) ? pRel : undefined;
  };
  const isSub = (rel: string): boolean => {
    const pRel = sameDirParent(rel);
    return pRel !== undefined && !itemMeta.get(pRel)!.archived;
  };
  const inCycle = new Set<string>();
  for (const start of itemMeta.keys()) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let cur: string | undefined = start;
    while (cur !== undefined && !inCycle.has(cur)) {
      if (onPath.has(cur)) {
        for (const m of path.slice(path.indexOf(cur))) {
          inCycle.add(m);
          err(m, 'parent cycle among same-directory items — every member would be unreachable from tier 1');
        }
        break;
      }
      onPath.add(cur);
      path.push(cur);
      cur = sameDirParent(cur);
    }
  }
  for (const rel of itemMeta.keys()) {
    if (inCycle.has(rel)) continue;
    const pRel = sameDirParent(rel);
    if (pRel !== undefined && isSub(rel) && isSub(pRel))
      warn(rel, 'sub-item nested deeper than one level (one level is the supported presentation depth)');
  }

  return { errors, warnings };
}

export function isValidPointerScope(scope: string): boolean {
  return POINTER_SCOPES.has(scope);
}

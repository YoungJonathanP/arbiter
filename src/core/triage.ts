// Triage — PROTOCOL.md#statuses, #archive, #arbitration (sweep):
//   1. stamp `review: needed` on non-terminal work items untouched 14+ days
//   2. stamp `archived:` on terminal work items past their dashboard age-off,
//      and on records older than a quarter (accomplishments are archived too,
//      but never deleted — reports still read them)
//   3. sweep staging: arbitrate any proposal set older than 24 hours
// Every consequence is written back to markdown; the index is never truth.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { arbitrateFile } from './arbitrate-file.js';
import { commitFile } from './commit.js';
import { sha256 } from './corpus.js';
import type { CorpusFile } from './corpus.js';
import { listStaged, stagedDirFor } from './corpus.js';
import { extractFacts, daysBetween } from './facts.js';
import { fmGet, fmSet } from './fm.js';
import { parseItemFile, parseProposal } from './parse.js';
import type { SchemaSet } from './schema.js';
import { serializeItem } from './serialize.js';
import { TERMINAL_STATUSES } from './model.js';

export interface TriageAction {
  relPath: string;
  action: string;
}

export interface TriageOptions {
  /** YYYY-MM-DDTHH:MM */
  now: string;
  needsReviewDays?: number;
  ageOffDays?: number;
  recordArchiveDays?: number;
  sweepHours?: number;
  dryRun?: boolean;
}

export function triage(dataDir: string, files: CorpusFile[], schemas: SchemaSet, opts: TriageOptions): TriageAction[] {
  const actions: TriageAction[] = [];
  const today = opts.now.slice(0, 10);
  const nrDays = opts.needsReviewDays ?? 14;
  const ageOff = opts.ageOffDays ?? 7;
  const recDays = opts.recordArchiveDays ?? 90;
  const sweepMs = (opts.sweepHours ?? 24) * 3600000;

  const facts = extractFacts(dataDir, files, schemas);
  const write = (absPath: string, text: string) => {
    if (!opts.dryRun) {
      const file = files.find(f => f.absPath === absPath)!;
      commitFile(dataDir, file.relPath, () => ({ text, verify: observed => serializeItem(parseItemFile(observed)) === serializeItem(parseItemFile(text)) }), { expected: sha256(file.text) });
    }
  };

  for (const f of facts) {
    if (f.visibility === 'private') continue;
    const file = files.find((x) => x.relPath === f.relPath)!;

    // 3. staged sweep first: arbitration may change status honestly
    if (f.stagedCount > 0) {
      const stagedNames = listStaged(dataDir, f.relPath);
      const stagedDirAbs = path.join(dataDir, ...stagedDirFor(f.relPath).split('/'));
      const proposals = stagedNames.map((name) => ({
        filename: name,
        text: fs.readFileSync(path.join(stagedDirAbs, name), 'utf8'),
      }));
      const oldest = Math.min(
        ...proposals.map((p) => {
          const upd = fmGet(parseProposal(p.text).fm, 'updated');
          const parsed = upd ? Date.parse(upd) : NaN;
          return Number.isFinite(parsed) ? parsed : 0;
        }),
      );
      if (Date.parse(opts.now) - oldest >= sweepMs) {
        const result = arbitrateFile(dataDir, f.relPath, { dryRun: opts.dryRun });
        for (const flag of result.flags) actions.push({ relPath: f.relPath, action: flag });
        if (result.outcome !== 'noop') {
          file.text = result.itemText;
          actions.push({
            relPath: f.relPath,
            action:
              result.outcome === 'clean'
                ? `swept ${result.deleted.length} staged proposal(s); arbitrated`
                : `swept staging: ${result.deleted.length} arbitrated, ${result.remaining.length} remain staged for review`,
          });
        }
        continue; // arbitration already recomputed status/updated
      }
    }

    if (f.raw) continue; // raw human files are normalized, not triaged

    // 1. review metadata: non-terminal work item untouched 14+ days
    if (
      f.kind === 'work-item' &&
      f.status !== undefined &&
      !TERMINAL_STATUSES.has(f.status) &&
      !f.review &&
      !f.archived &&
      f.updatedDate !== undefined &&
      daysBetween(f.updatedDate, today) >= nrDays
    ) {
      const ast = parseItemFile(file.text);
      if (ast.fm) {
        fmSet(ast.fm, 'review', 'needed');
        fmSet(ast.fm, 'updated', opts.now);
        write(file.absPath, serializeItem(ast));
        actions.push({ relPath: f.relPath, action: `stamped review: needed (untouched since ${f.updatedDate})` });
      }
      continue;
    }

    // 2. archive flags — a flag, never a move
    const archiveWorkItem =
      f.kind === 'work-item' &&
      f.status !== undefined &&
      TERMINAL_STATUSES.has(f.status) &&
      !f.archived &&
      f.updatedDate !== undefined &&
      daysBetween(f.updatedDate, today) > ageOff;
    const recordDate = f.date ?? f.updatedDate;
    const archiveRecord =
      f.kind === 'record' && !f.archived && recordDate !== undefined && daysBetween(recordDate, today) > recDays;
    if (archiveWorkItem || archiveRecord) {
      const ast = parseItemFile(file.text);
      if (ast.fm) {
        fmSet(ast.fm, 'archived', today);
        fmSet(ast.fm, 'updated', opts.now);
        write(file.absPath, serializeItem(ast));
        actions.push({ relPath: f.relPath, action: `stamped archived: ${today} (file stays in place)` });
      }
    }
  }
  return actions;
}

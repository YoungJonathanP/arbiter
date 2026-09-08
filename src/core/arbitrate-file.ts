import * as fs from 'node:fs';
import * as path from 'node:path';
import { arbitrate, opSatisfied, type ProposalReceipt } from './arbitrate.js';
import { commitFile, readJournals, type CommitOptions } from './commit.js';
import { listStaged, sha256, stagedDirFor } from './corpus.js';
import { fmGet } from './fm.js';
import { parseItemFile, parseOp } from './parse.js';
import { SchemaSet } from './schema.js';

export function arbitrateFile(dir: string, rel: string, opts: CommitOptions & { dryRun?: boolean } = {}) {
  const plan = (before: string | null, completed: ProposalReceipt[]) => {
    if (before === null) throw new Error(`missing item: ${rel}`);
    const proposals = listStaged(dir, rel).map(filename => ({ filename, text: fs.readFileSync(path.join(dir, stagedDirFor(rel), filename), 'utf8') }));
    const replay: ProposalReceipt[] = [];
    const collisions: string[] = [];
    const fresh = proposals.filter(p => {
      const old = completed.find(r => r.id === p.filename.replace(/\.md$/, ''));
      if (!old) return true;
      if (old.digest === sha256(p.text)) replay.push({ ...old, replayed: true });
      else collisions.push(p.filename);
      return false;
    });
    const schema = SchemaSet.load(dir).get(fmGet(parseItemFile(before).fm, 'type') ?? '');
    const result = arbitrate(before, fresh, schema);
    const activeReceipts = result.receipts;
    result.deleted.push(...replay.map(p => p.filename));
    result.remaining.push(...collisions);
    result.flags.push(...collisions.map(name => `${name} stays staged: durable proposal ID reused with different bytes; assign a new ID`));
    if (collisions.length) result.outcome = 'partial';
    else if (replay.length && result.outcome === 'noop') result.outcome = 'clean';
    return { ...result, text: result.itemText, proposals, receipts: [...activeReceipts, ...replay], allowStaged: true,
      verify: (text: string) => {
        const item = parseItemFile(text);
        return activeReceipts.every(r => r.ops.every(o => o.verdict === 'overruled' || opSatisfied(item, parseOp(o.raw)!)));
      },
    };
  };
  if (opts.dryRun) {
    const journals = readJournals(dir).filter(j => j.target === rel);
    const result = plan(fs.readFileSync(path.join(dir, rel), 'utf8'), journals.filter(j => j.state === 'complete').flatMap(j => j.receipts));
    if (journals.some(j => j.state === 'prepared')) result.flags.push('pending recovery: run recover before relying on this preview');
    return result;
  }
  return commitFile(dir, rel, plan, opts);
}

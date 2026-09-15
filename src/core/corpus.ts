// Corpus walker: enumerates an arbiter-data directory into classified files,
// deterministically ordered (sorted paths) so every derived artifact is a pure
// function of the file bytes.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileKind } from './model.js';
import { ITEM_DIRS } from './model.js';
import { classifyPath } from './parse.js';

export interface CorpusFile {
  /** path from the data-directory root, `/`-separated */
  relPath: string;
  absPath: string;
  kind: FileKind;
  text: string;
  mtime: Date;
  /** Visible line index → original 1-based source line; present on filtered projections. */
  redacted?: boolean; // projection removed source lines; never use as complete attestation
  sourceLines?: readonly number[];
}

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function walkCorpus(dataDir: string, options: { includeHistory?: boolean } = {}): CorpusFile[] {
  const out: CorpusFile[] = [];
  const roots = ['PROTOCOL.md', 'DASHBOARD.md', 'types', ...ITEM_DIRS];
  const visit = (rel: string) => {
    if (options.includeHistory === false && /^tasks\/[^/]+\/checkpoints(?:\/|$)/.test(rel)) return;
    const abs = path.join(dataDir, ...rel.split('/'));
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) {
        if (name.startsWith('.') && !name.endsWith('.staged')) continue;
        visit(rel === '' ? name : `${rel}/${name}`);
      }
    } else if (rel.endsWith('.md')) {
      out.push({
        relPath: rel,
        absPath: abs,
        kind: classifyPath(rel),
        text: fs.readFileSync(abs, 'utf8'),
        mtime: st.mtime,
      });
    }
  };
  for (const r of roots) visit(r);
  out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return out;
}

/** `<dir>/<id>` for an item file's rel path; null for non-items. */
export function objectRef(relPath: string): string | null {
  const parts = relPath.split('/');
  if (parts.length === 2 && parts[1]!.endsWith('.md')) {
    return `${parts[0]}/${parts[1]!.slice(0, -3)}`;
  }
  return null;
}

export function stagedDirFor(relPath: string): string {
  return relPath.replace(/\.md$/, '.staged');
}

/** Sorted staged proposal filenames for an item rel path (bytewise order). */
export function listStaged(dataDir: string, itemRelPath: string): string[] {
  const dir = path.join(dataDir, ...stagedDirFor(itemRelPath).split('/'));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
}

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkCorpus } from '../src/core/corpus.js';
import { buildDashboardDates, buildIdMap, type NormalizeContext } from '../src/core/normalize.js';
import { SchemaSet } from '../src/core/schema.js';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE_DIR = path.join(REPO_ROOT, 'fixtures', 'arbiter-data');

export function copyFixture(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-test-'));
  fs.cpSync(FIXTURE_DIR, tmp, { recursive: true });
  return tmp;
}

export function fixtureContext(dataDir: string): NormalizeContext {
  const files = walkCorpus(dataDir);
  const dashPath = path.join(dataDir, 'DASHBOARD.md');
  return {
    schemas: SchemaSet.load(dataDir),
    today: '2026-07-09',
    dashboardDates: buildDashboardDates(fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf8') : null),
    idsByBareId: buildIdMap(files.filter((f) => f.kind === 'item').map((f) => f.relPath)),
  };
}

export function readExpected(name: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, 'test', 'expected', name), 'utf8');
}

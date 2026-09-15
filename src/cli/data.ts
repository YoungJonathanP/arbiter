import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fmGet } from '../core/fm.js';
import { parseFrontmatter, parseTypeSchema, splitLines } from '../core/parse.js';
import { ITEM_DIRS, ITEM_TYPES, TYPE_TO_DIR } from '../core/model.js';
import type { Args } from './args.js';

// Locate assets from both src/cli and dist/src/cli, independently of cwd.
function packageRoot(): string {
  let cur = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkg = path.join(cur, 'package.json');
    if (fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, 'utf8')).name === 'arbiter') return cur;
    const parent = path.dirname(cur);
    if (parent === cur) throw new Error('cannot locate Arbiter package assets');
    cur = parent;
  }
}

export const BUNDLED_CONTRACT = path.join(packageRoot(), 'assets/contract');
const FROZEN_DIRS = [BUNDLED_CONTRACT, path.join(packageRoot(), 'arbiter-data'), path.join(packageRoot(), 'fixtures/arbiter-data')];
const SCHEMA_VERSIONS: Record<string, string> = { _base: '0.4.17', ...Object.fromEntries(ITEM_TYPES.map(t => [t.type, t.version])) };

function within(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`));
}

/** Resolve existing ancestors too, so missing destinations under aliases are checked. */
function physicalPath(target: string): string {
  if (fs.existsSync(target)) return fs.realpathSync(target);
  const parent = path.dirname(target);
  if (parent === target) return target;
  return path.join(physicalPath(parent), path.basename(target));
}

export function isFrozen(dir: string): boolean {
  const physical = physicalPath(dir);
  return FROZEN_DIRS.some((root) => within(physicalPath(root), physical));
}

export function selectData(args: Args): string {
  let selected: string | undefined;
  let source: string;
  if (typeof args.flags.get('data') === 'string') {
    selected = String(args.flags.get('data'));
    source = '--data';
  } else if (process.env['ARBITER_DATA']) {
    selected = process.env['ARBITER_DATA'];
    source = 'ARBITER_DATA';
  } else {
    source = 'cwd walk';
    let cur = process.cwd();
    for (;;) {
      const candidate = path.basename(cur) === 'arbiter-data' ? cur : path.join(cur, 'arbiter-data');
      // Select even an empty/malformed nearest directory so a parent KB cannot
      // silently mask its state. Explicit missing selections never fall back.
      if (fs.existsSync(candidate)) { selected = candidate; break; }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }
  if (!selected) throw new Error('no arbiter-data directory found — pass --data <dir>, set ARBITER_DATA, or run inside a tree containing arbiter-data/');
  const dir = path.resolve(selected);
  const physical = physicalPath(dir);
  console.error(`data: ${dir} (source: ${source})${physical !== dir ? `; real path: ${physical}` : ''}`);
  return dir;
}

/** Empty bootstrap state is valid to inspect, but is not an initialized KB. */
export function checkData(dir: string): 'empty' | 'ready' {
  if (!fs.existsSync(dir)) throw new Error(`data directory does not exist: ${dir}; use init --data <dir> to create it explicitly`);
  if (!fs.statSync(dir).isDirectory()) throw new Error(`data path is not a directory: ${dir}`);
  if (fs.readdirSync(dir).length === 0) return 'empty';
  const errors: string[] = [];
  let protocolVersion: string | undefined;
  const protocolPath = path.join(dir, 'PROTOCOL.md');
  if (!fs.existsSync(protocolPath) || !fs.statSync(protocolPath).isFile()) {
    errors.push('missing PROTOCOL.md');
  } else {
    const parsed = parseFrontmatter(splitLines(fs.readFileSync(protocolPath, 'utf8')));
    protocolVersion = parsed ? fmGet(parsed.fm, 'version') : undefined;
    if (!parsed || fmGet(parsed.fm, 'id') !== 'protocol') errors.push('PROTOCOL.md: invalid protocol identity (expected id: protocol)');
    if (!parsed || !['0.4.6', '0.4.8', '0.4.9', '0.4.10', '0.4.11', '0.4.12', '0.4.13', '0.4.14', '0.4.15', '0.4.16', '0.4.17'].includes(fmGet(parsed.fm, 'version') ?? '')) errors.push('PROTOCOL.md: unsupported protocol version (supported: 0.4.6, 0.4.8, 0.4.9, 0.4.10, 0.4.11, 0.4.12, 0.4.13, 0.4.14, 0.4.15, 0.4.16, 0.4.17)');
  }
  for (const [name, version] of Object.entries(SCHEMA_VERSIONS)) {
    const rel = `types/${name}.md`;
    const file = path.join(dir, rel);
    if (name === 'person' && !['0.4.16', '0.4.17'].includes(protocolVersion ?? '') && !fs.existsSync(file)) continue;
    if (!['0.4.14', '0.4.15', '0.4.16', '0.4.17'].includes(protocolVersion ?? '') && ITEM_TYPES.find(t => t.type === name)?.introduced === '0.4.14' && !fs.existsSync(file)) continue;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { errors.push(`missing ${rel}`); continue; }
    const schema = parseTypeSchema(fs.readFileSync(file, 'utf8'));
    if (schema.schema !== name) errors.push(`${rel}: schema identity must be ${name}`);
    if (!(name === '_base' ? ['0.4.6', '0.4.8', '0.4.9', '0.4.10', '0.4.11', '0.4.12', '0.4.13', '0.4.14', '0.4.15', '0.4.16', version] : name === 'accomplishment' ? ['0.4', '0.4.14', version] : [version]).includes(schema.version ?? '')) errors.push(`${rel}: unsupported schema version (supported: ${version})`);
    if (name === '_base') {
      if (schema.extends) errors.push(`${rel}: base schema cannot extend another schema`);
      for (const field of ['id', 'type', 'title', 'updated']) {
        if (!schema.fields.get(field)?.required) errors.push(`${rel}: missing required field definition ${field}`);
      }
    } else {
      if (schema.extends !== '_base') errors.push(`${rel}: expected extends: _base`);
      const kind = ITEM_TYPES.find(t => t.type === name)!.kind;
      if (schema.kind !== kind || !schema.slugForm) errors.push(`${rel}: missing or invalid kind/slug-form`);
    }
  }
  const typesDir = path.join(dir, 'types');
  if (fs.existsSync(typesDir) && fs.statSync(typesDir).isDirectory()) {
    for (const name of fs.readdirSync(typesDir)) {
      if (name.endsWith('.md') && !Object.hasOwn(SCHEMA_VERSIONS, name.slice(0, -3))) errors.push(`types/${name}: unsupported schema identity`);
    }
  }
  if (errors.length) throw new Error(`malformed or unsupported KB:\n${errors.map((e) => `  ${e}`).join('\n')}`);
  return 'ready';
}

export function assertMutable(dir: string): void {
  if (isFrozen(dir)) throw new Error('selected frozen conformance corpus is read-only; pass --data with a live or temporary KB');
  // The CLI mutates only managed paths. Reject symlinks there before traversal:
  // otherwise a live root could conceal a frozen corpus or an external target.
  const visit = (file: string): void => {
    let stat: fs.Stats;
    try { stat = fs.lstatSync(file); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`writes through managed symlinks are not supported: ${file}`);
    if (stat.isDirectory()) for (const name of fs.readdirSync(file)) visit(path.join(file, name));
  };
  for (const name of ['PROTOCOL.md', 'DASHBOARD.md', '.arbiter', 'types', ...ITEM_DIRS]) visit(path.join(dir, name));
}

export function itemPath(dir: string, arg: string): { abs: string; rel: string } {
  const name = arg.endsWith('.md') ? arg : `${arg}.md`;
  const abs = path.resolve(dir, name);
  if (!within(physicalPath(dir), physicalPath(abs)) || !within(path.resolve(dir), abs)) throw new Error(`item path must stay inside selected KB: ${arg}`);
  const rel = path.relative(dir, abs).split(path.sep).join('/');
  return { abs, rel };
}

export function initData(dir: string): void {
  assertMutable(dir);
  if (fs.existsSync(dir) && (!fs.statSync(dir).isDirectory() || fs.readdirSync(dir).length !== 0)) throw new Error('init requires a missing or empty directory; existing content will not be overwritten');
  checkData(BUNDLED_CONTRACT);
  fs.mkdirSync(path.join(dir, 'types'), { recursive: true });
  const protocol = fs.readFileSync(path.join(BUNDLED_CONTRACT, 'PROTOCOL.md'), 'utf8')
    .replace('id: protocol\n', `id: protocol\nkb-id: urn:uuid:${randomUUID()}\n`);
  fs.writeFileSync(path.join(dir, 'PROTOCOL.md'), protocol, { flag: 'wx' });
  for (const name of Object.keys(SCHEMA_VERSIONS)) fs.copyFileSync(path.join(BUNDLED_CONTRACT, `types/${name}.md`), path.join(dir, `types/${name}.md`), fs.constants.COPYFILE_EXCL);
  for (const name of Object.values(TYPE_TO_DIR)) fs.mkdirSync(path.join(dir, name));
}

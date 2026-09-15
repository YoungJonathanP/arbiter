import { validDate } from '../core/date.js';
export { validDate } from '../core/date.js';
import { ITEM_DIRS } from '../core/model.js';
import { discoveryOptions } from '../core/discovery.js';
export interface Args {
  cmd: string;
  positional: string[];
  flags: Map<string, string | boolean>;
}

interface Command {
  usage: string;
  values?: string[];
  switches?: string[];
  min: number;
  max: number;
}

export const COMMANDS: Record<string, Command> = {
  report: { usage: 'report --since <YYYY-MM-DD> [--until <YYYY-MM-DD>] [--now <timestamp>] (Markdown; inclusive outcome dates, archives included)', values: ['since', 'until', 'now'], min: 0, max: 0 },
  promote: { usage: 'promote <work-ref> --date <YYYY-MM-DD> [--now <timestamp>] (editable unverified accomplishment Markdown; capture with write)', values: ['date', 'now'], min: 1, max: 1 },
  search: { usage: 'search [text] [--tiers 1,2,3] [--archive exclude|include|only] [--dir <dir>] [--status <status>] [--parent <ref>] [--page <n>] [--page-size <1..50>] [--json]', values: ['tiers', 'archive', 'dir', 'status', 'parent', 'page', 'page-size'], switches: ['json'], min: 0, max: 1 },
  checkpoint: { usage: 'checkpoint <task-ref> [--file <draft-request.json> | --capture <preview.json>] (otherwise emits editable draft Markdown)', values: ['file', 'capture'], min: 1, max: 1 },
  handoff: { usage: 'handoff <task-ref> [--file <request.json> | --export <preview.json>] [--format markdown|json] (otherwise emits current preview JSON; export emits exact packet)', values: ['file', 'export', 'format'], min: 1, max: 1 },
  validate: { usage: 'validate (whole KB only; scoped paths are not supported)', min: 0, max: 0 },
  doctor: { usage: 'doctor (check KB identity and corpus health)', min: 0, max: 0 },
  init: { usage: 'init --data <dir> [--now <timestamp>] (missing or empty directory only)', values: ['now'], min: 0, max: 0 },
  regen: { usage: 'regen [--full] [--dry-run] [--now <timestamp>]', values: ['now'], switches: ['full', 'dry-run'], min: 0, max: 0 },
  triage: { usage: 'triage [--dry-run] [--now <timestamp>]', values: ['now'], switches: ['dry-run'], min: 0, max: 0 },
  query: { usage: 'query [staged|overdue|needs-review|active [dir]|children <ref>|page [dir] [n]|chain <ref>] [--json] [--now <timestamp>]', values: ['now'], switches: ['json'], min: 0, max: 3 },
  new: { usage: 'new <type> <title...> [--date <YYYY-MM-DD>] [--force] [--now <timestamp>]', values: ['date', 'now'], switches: ['force'], min: 2, max: Infinity },
  arbitrate: { usage: 'arbitrate <dir>/<id> [--dry-run]', switches: ['dry-run'], min: 1, max: 1 },
  propose: { usage: 'propose <dir>/<id> --op <op> --intent <why> [--author <slug>] [--now <timestamp>]', values: ['op', 'intent', 'author', 'now'], min: 1, max: 1 },
  recover: { usage: 'recover [--dry-run] (inspect or recover durable commit journals)', switches: ['dry-run'], min: 0, max: 0 },
  write: { usage: 'write <path> --if-match <sha256:<hex>|<hex>|new> [--file <src>] (otherwise stdin)', values: ['if-match', 'file'], min: 1, max: 1 },
  normalize: { usage: 'normalize [--dry-run] [--now <timestamp>]', values: ['now'], switches: ['dry-run'], min: 0, max: 0 },
  serve: { usage: 'serve [--port <0..65535>] [--host <address>] [--personal-policy <outside-kb.json>] (default command; port 4870, host 127.0.0.1)', values: ['port', 'host', 'personal-policy'], min: 0, max: 0 },
  hash: { usage: 'hash <path> (prints sha256:<hex> for --if-match)', min: 1, max: 1 },
  help: { usage: 'help [command]', min: 0, max: 1 },
};

function fail(message: string, cmd?: string): never {
  throw new Error(`${message}\nusage: arbiter ${cmd && COMMANDS[cmd] ? COMMANDS[cmd].usage : '<command> [args] [--data <dir>] (see --help)'}`);
}


export function normalizeDigest(value: string): string {
  if (value === 'new') return value;
  if (!/^(sha256:)?[a-fA-F0-9]{64}$/.test(value)) fail('invalid digest format: use new, 64 hex digits, or sha256:<64 hex digits>', 'write');
  return value.replace(/^sha256:/, '').toLowerCase();
}

export function parseArgs(argv: string[]): Args {
  const values = new Set(['data', ...Object.values(COMMANDS).flatMap((c) => c.values ?? [])]);
  const switches = new Set(['help', ...Object.values(COMMANDS).flatMap((c) => c.switches ?? [])]);
  const flags = new Map<string, string | boolean>();
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--') { words.push(...argv.slice(i + 1)); break; }
    if (!token.startsWith('-')) { words.push(token); continue; }
    const key = token === '-h' ? 'help' : token.startsWith('--') ? token.slice(2) : token;
    if (!values.has(key) && !switches.has(key)) fail(`unknown option: ${token}`, words[0]);
    if (flags.has(key)) fail(`duplicate option: ${token}`, words[0]);
    if (switches.has(key)) { flags.set(key, true); continue; }
    const value = argv[++i];
    if (value === undefined || value.startsWith('-') || !value.trim()) fail(`missing value for ${token}`, words[0]);
    flags.set(key, value);
  }
  const cmd = words.shift() ?? 'serve';
  if (!Object.hasOwn(COMMANDS, cmd)) fail(`unknown command: ${cmd}`);
  const spec = COMMANDS[cmd]!;
  for (const key of flags.keys()) {
    if (!['data', 'help', ...(spec.values ?? []), ...(spec.switches ?? [])].includes(key)) fail(`unknown option for ${cmd}: --${key}`, cmd);
  }
  if (cmd === 'help' && (words.length > 1 || (words[0] && !Object.hasOwn(COMMANDS, words[0])))) fail('help expects one known command', cmd);
  if (cmd === 'help' || flags.has('help')) return { cmd: 'help', positional: [], flags };
  if (words.length < spec.min || words.length > spec.max) fail(cmd === 'validate' && words.length ? 'scoped validation is not supported; omit paths to explicitly validate the whole KB' : `unexpected or missing arguments for ${cmd}`, cmd);
  if (['checkpoint', 'handoff'].includes(cmd)) {
    if ([...['file', 'capture', 'export']].filter(k => flags.has(k)).length > 1) fail('choose one of --file, --capture or --export', cmd);
    if (flags.has('format') && !['markdown', 'json'].includes(String(flags.get('format')))) fail('format must be markdown or json', cmd);
    if (flags.has('export') && flags.has('format')) fail('format is fixed by the preview; omit --format on export', cmd);
  }
  if (cmd === 'search') discoveryOptions({ q: words[0] ?? '', ...Object.fromEntries([...flags].filter(([k]) => !['data', 'json', 'page-size', 'page'].includes(k))), page: Number(flags.get('page') ?? 0), pageSize: Number(flags.get('page-size') ?? 10) });
  if (cmd === 'report' && !flags.has('since')) fail('report requires --since', cmd);
  if (cmd === 'promote' && !flags.has('date')) fail('promote requires explicit outcome --date', cmd);
  for (const key of ['since', 'until']) if (flags.has(key) && !validDate(String(flags.get(key)))) fail(`--${key} must be a real calendar date`, cmd);
  if (flags.has('until') && String(flags.get('until')) < String(flags.get('since'))) fail('--until must be on or after --since', cmd);
  if (cmd === 'init' && !flags.has('data')) fail('init requires explicit --data <dir>', cmd);
  if (cmd === 'propose' && (!flags.has('op') || !flags.has('intent'))) fail('propose requires --op and --intent', cmd);
  if (cmd === 'write') {
    if (!flags.has('if-match')) fail('write requires --if-match', cmd);
    flags.set('if-match', normalizeDigest(String(flags.get('if-match'))));
  }
  if (flags.has('date') && !validDate(String(flags.get('date')))) fail('--date must be a real calendar date (YYYY-MM-DD, year 0001..9999)', cmd);
  if (flags.has('now')) {
    const now = String(flags.get('now'));
    // Keep the existing documented local minute timestamp; event time is --date.
    if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(now) || !validDate(now.slice(0, 10))) fail('--now must be a real local timestamp (YYYY-MM-DDTHH:MM)', cmd);
  }
  if (flags.has('port')) {
    const port = String(flags.get('port'));
    if (!/^\d+$/.test(port) || Number(port) > 65535) fail('--port must be an integer from 0 to 65535', cmd);
  }
  if (cmd === 'query') {
    const sub = words[0] ?? 'staged';
    const arity: Record<string, [number, number]> = { staged: [0, 0], overdue: [0, 0], 'needs-review': [0, 0], active: [0, 1], children: [1, 1], page: [0, 2], chain: [1, 1] };
    const bounds = arity[sub];
    const count = Math.max(0, words.length - 1);
    if (!Object.hasOwn(arity, sub) || !bounds || count < bounds[0] || count > bounds[1]) fail(`unknown query or invalid arguments: ${sub}`, cmd);
    if (sub === 'chain' && flags.has('json')) fail('query chain does not support --json', cmd);
    if (flags.has('now') && !['overdue', 'needs-review', 'active'].includes(sub)) fail(`query ${sub} does not use --now`, cmd);
    if (['active', 'page'].includes(sub) && words[1] && !(ITEM_DIRS as readonly string[]).includes(words[1])) fail(`unknown item directory: ${words[1]}`, cmd);
    if (sub === 'page' && words[2] && (!/^\d+$/.test(words[2]) || !Number.isSafeInteger(Number(words[2])))) fail('page number must be a nonnegative integer', cmd);
  }
  return { cmd, positional: words, flags };
}

export function help(): void {
  console.log(`arbiter — headless core for the Arbiter knowledge base

usage: arbiter <command> [args] [--data <dir>]

data dir: --data > $ARBITER_DATA > nearest arbiter-data/ walking up from cwd
Resolved path and selection source are reported on stderr; frozen corpora are read-only.
help, --help and -h exit without selecting a KB or starting a server.

${Object.values(COMMANDS).map((c) => `  ${c.usage}`).join('\n')}

--date selects the meeting/record date and dated or quarter ID suffix (future dates allowed).
For tasks/goals it selects the quarter and reopen window, not a due date.
created/updated use capture time; --now overrides that clock for deterministic runs.
init copies only the bundled protocol and schemas, creates empty item directories and a dashboard.
doctor is read-only. An empty bootstrap directory is reported as not initialized.
Use -- to end option parsing for titles or paths beginning with a dash.`);
}

// Restricted-YAML frontmatter per grammar §4: a flat mapping of scalars and
// flat sequences, plus (in type-schema files only, §10) one level of nested
// block mapping whose values are inline flow mappings. Hand-rolled so that the
// concrete syntax of untouched entries survives byte-for-byte.

import type { FmEntry, FmValue, Frontmatter } from './model.js';

/** Strip matching quotes from a YAML scalar as written. */
export function scalarValue(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

/** Quote a scalar for emission only when the plain form would be misread. */
export function emitScalar(v: string): string {
  if (v === '' || /^[\s'"]|\s$/.test(v) || /: |^[-?#&*!|>%@`[\]{},]/.test(v) || v.includes(' #')) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return v;
}

/** Split a flow-sequence body (`a, b, "c, d"`) at top-level `, `. */
function splitFlow(body: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quote) {
      cur += ch;
      if (ch === quote && (quote !== "'" || body[i + 1] !== "'")) quote = null;
      else if (quote === "'" && ch === "'" && body[i + 1] === "'") {
        cur += "'";
        i++;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '[' || ch === '{') {
      depth++;
      cur += ch;
    } else if (ch === ']' || ch === '}') {
      depth--;
      cur += ch;
    } else if (depth === 0 && ch === sep[0] && body.slice(i, i + sep.length) === sep) {
      out.push(cur);
      cur = '';
      i += sep.length - 1;
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '' || out.length > 0) out.push(cur);
  return out.map((s) => s.trim());
}

export function parseFmValue(raw: string): FmValue {
  const t = raw.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    const body = t.slice(1, -1).trim();
    const items = body === '' ? [] : splitFlow(body, ',').map(scalarValue);
    return { kind: 'seq', items, raw };
  }
  return { kind: 'scalar', raw };
}

/** Parse an inline flow mapping `{ type: enum, values: [a, b], note: "x" }`. */
export function parseFlowMap(raw: string): FmEntry[] {
  const t = raw.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return [];
  const body = t.slice(1, -1).trim();
  if (body === '') return [];
  return splitFlow(body, ',').map((part) => {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/s.exec(part);
    if (!m) return { key: part, value: { kind: 'scalar', raw: '' } as FmValue, rawLines: [] };
    return { key: m[1]!, value: parseFmValue(m[2]!), rawLines: [] };
  });
}

const FENCE = '---';

export interface FmParseResult {
  fm: Frontmatter;
  /** index of the first line after the closing fence */
  end: number;
}

/**
 * Parse a frontmatter block starting at lines[0] === '---'. Returns null when
 * there is no well-formed block (raw human file).
 */
export function parseFrontmatter(lines: string[]): FmParseResult | null {
  if (lines[0] !== FENCE) return null;
  const entries: FmEntry[] = [];
  let i = 1;
  while (i < lines.length && lines[i] !== FENCE) {
    const line = lines[i]!;
    const m = /^([A-Za-z0-9_-]+):(?:\s(.*))?$/.exec(line);
    if (!m) return null; // off-grammar frontmatter: treat file as raw
    const key = m[1]!;
    const rest = (m[2] ?? '').trim();
    if (rest === '') {
      // nested block mapping (schemas) or block sequence (liberal ops)
      const rawLines = [line];
      const nested: FmEntry[] = [];
      const seqItems: string[] = [];
      let isSeq = false;
      i++;
      while (i < lines.length && lines[i] !== FENCE && /^\s+\S/.test(lines[i]!)) {
        const sub = lines[i]!;
        rawLines.push(sub);
        const seqM = /^\s+-\s+(.*)$/.exec(sub);
        // nested keys may contain internal spaces (e.g. `Detail docs:` in schemas)
        const mapM = /^\s+([A-Za-z0-9_][A-Za-z0-9_ -]*[A-Za-z0-9_]|[A-Za-z0-9_]): (.*)$/.exec(sub);
        if (seqM) {
          isSeq = true;
          seqItems.push(scalarValue(seqM[1]!));
        } else if (mapM) {
          nested.push({ key: mapM[1]!, value: parseFmValue(mapM[2]!), rawLines: [sub] });
        } else {
          return null;
        }
        i++;
      }
      entries.push({
        key,
        value: isSeq
          ? { kind: 'seq', items: seqItems, raw: '' }
          : { kind: 'map', entries: nested },
        rawLines,
      });
      continue;
    }
    entries.push({ key, value: parseFmValue(rest), rawLines: [line] });
    i++;
  }
  if (lines[i] !== FENCE) return null;
  return { fm: { entries }, end: i + 1 };
}

export function serializeFrontmatter(fm: Frontmatter): string[] {
  const out: string[] = [FENCE];
  for (const e of fm.entries) out.push(...e.rawLines);
  out.push(FENCE);
  return out;
}

// --- semantic accessors -----------------------------------------------------

export function fmGet(fm: Frontmatter | null, key: string): string | undefined {
  const e = fm?.entries.find((x) => x.key === key);
  if (!e) return undefined;
  if (e.value.kind === 'scalar') return scalarValue(e.value.raw);
  if (e.value.kind === 'seq') return e.value.items.join(', ');
  return undefined;
}

export function fmGetRaw(fm: Frontmatter | null, key: string): string | undefined {
  const e = fm?.entries.find((x) => x.key === key);
  return e && e.value.kind === 'scalar' ? e.value.raw.trim() : undefined;
}

export function fmGetList(fm: Frontmatter | null, key: string): string[] | undefined {
  const e = fm?.entries.find((x) => x.key === key);
  if (!e) return undefined;
  if (e.value.kind === 'seq') return e.value.items;
  if (e.value.kind === 'scalar') {
    const v = scalarValue(e.value.raw);
    return v === '' ? [] : v.split(',').map((s) => s.trim());
  }
  return undefined;
}

/** Set (or add, at the end) a scalar key, regenerating that entry's line. */
export function fmSet(fm: Frontmatter, key: string, value: string): void {
  const line = `${key}: ${emitScalar(value)}`;
  const e = fm.entries.find((x) => x.key === key);
  if (e) {
    e.value = { kind: 'scalar', raw: emitScalar(value) };
    e.rawLines = [line];
  } else {
    fm.entries.push({ key, value: { kind: 'scalar', raw: emitScalar(value) }, rawLines: [line] });
  }
}

export function fmSetRaw(fm: Frontmatter, key: string, rawValue: string): void {
  const line = `${key}: ${rawValue}`;
  const e = fm.entries.find((x) => x.key === key);
  if (e) {
    e.value = parseFmValue(rawValue);
    e.rawLines = [line];
  } else {
    fm.entries.push({ key, value: parseFmValue(rawValue), rawLines: [line] });
  }
}

export function fmDelete(fm: Frontmatter, key: string): void {
  const i = fm.entries.findIndex((x) => x.key === key);
  if (i >= 0) fm.entries.splice(i, 1);
}

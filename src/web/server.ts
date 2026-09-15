import { discover, discoveryOptions, compareItems, checkpointSummary, dependencies, compact, type DiscoveryResult } from '../core/discovery.js';
// `arbiter serve` — the v0.6 renderer's read-only scaffold, pulled forward for
// the dogfood trial: visual inspection of a live arbiter-data directory.
//
// Visual design carried from prototype/dashboard.html (tokens, topbar with
// hamburger + status legend, card board, sidenav, item blocks, agent view).
//
// Deliberately local-only: binds 127.0.0.1, serves nothing to a public
// audience; checkpoint capture is the explicit local mutation surface. Every request re-reads the files (no cache, no
// watcher) — refresh the browser and you see the current truth. One
// normalization path: rendering goes through the same core parser the CLI
// and validator use.

import { audienceAllows } from '../core/input-review.js';
import { inputRelationships, inputReviewView, readInputState } from '../core/input-storage.js';
import type { PersonalAccess } from './personal-access.js';
import { inputPanel, personalInputPanel, INPUT_REVIEW_JS } from './input-review.js';
import { handoffApi, handoffPanel, HANDOFF_JS } from './handoff.js';
import { validateCorpus } from '../core/validate.js';
import { SchemaSet } from '../core/schema.js';
import { orderedRows } from '../core/section-rows.js';
import type { SectionRow } from '../core/model.js';
import * as http from 'node:http';
import { stagedDirFor, walkCorpus } from '../core/corpus.js';
import { computeNesting, isTerminal, type ItemFacts } from '../core/facts.js';
import { fmGet } from '../core/fm.js';
import { ITEM_DIRS, ITEM_TYPES } from '../core/model.js';
import { parseDashboard, parseItemFile, parseProposal } from '../core/parse.js';
import { readProjection } from '../core/projection.js';
import { regenFull } from '../core/dashboard.js';
import type { Section } from '../core/model.js';

const MARK_TO_STATUS: Record<string, string> = { ' ': 'todo', '~': 'in-flight', '!': 'blocked', x: 'done' };
const CHECK_GLYPH: Record<string, string> = { done: '✓', 'in-flight': '◐', blocked: '!', todo: '○' };
const CARD_LABELS: Record<string, string> = Object.fromEntries(ITEM_TYPES.map(t => [t.dir, t.label]));
// Reading order for the board (row-major over two columns) and the side nav; DASHBOARD.md keeps ITEM_TYPES order.
const DISPLAY_ORDER = ['tasks', 'journal', 'goals', 'accomplishments', 'meetings', 'people', 'findings', 'decisions'];
const displayRank = (label: string): number => {
  const i = DISPLAY_ORDER.indexOf(label.toLowerCase());
  return i === -1 ? DISPLAY_ORDER.length : i; // an unlisted type sorts last rather than disappearing
};
const NAV_DIRS = [...ITEM_DIRS].sort((a, b) => displayRank(a) - displayRank(b));

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Map a data-root-relative link target to a route (or external URL). */
function targetHref(target: string): string {
  if (/^https?:\/\//.test(target)) return esc(target);
  const [p, anchor] = target.split('#^');
  const frag = anchor !== undefined ? `#^${anchor}` : '';
  const parts = (p ?? '').replace(/\.md$/, '').split('/');
  if (parts.length === 2) return `/item/${esc(parts[0]!)}/${esc(parts[1]!)}${esc(frag)}`;
  if (parts.length === 3) return `/doc/${esc(parts[0]!)}/${esc(parts[1]!)}/${esc(parts[2]!)}`;
  return `/raw/${esc(p ?? '')}`;
}

/** Bare file id → data-relative path, for resolving `[[wikilink]]` prose refs. */
export type WikiIndex = Map<string, string>;

/**
 * Index every item and doc by its bare id. An id claimed by two files is dropped
 * rather than guessed at- an ambiguous ref renders as text, which is honest.
 */
function buildWikiIndex(files: { kind: string; relPath: string }[]): WikiIndex {
  const idx: WikiIndex = new Map();
  const ambiguous = new Set<string>();
  for (const f of files) {
    if (f.kind !== 'item' && f.kind !== 'doc') continue;
    const id = f.relPath.slice(f.relPath.lastIndexOf('/') + 1).replace(/\.md$/, '');
    if (idx.has(id)) ambiguous.add(id);
    else idx.set(id, f.relPath);
  }
  for (const id of ambiguous) idx.delete(id);
  return idx;
}

// Code spans are parked under a sentinel while the rest of the inline pass runs;
// U+0000 cannot appear in a markdown source file, so nothing can forge a slot.
const SENTINEL = '\u0000';
const CODE_SLOT_RE = /\u0000(\d+)\u0000/g;

/**
 * Inline markdown for one logical line of prose: escape, lift code spans out of
 * the way, then links and emphasis. Code spans are extracted first and restored
 * last so `**not bold**` inside backticks stays literal, the way an author
 * quoting markdown syntax expects.
 */
function prose(line: string, wiki?: WikiIndex): string {
  const codes: string[] = [];
  let s = esc(line).replace(/`([^`]+)`/g, (_m, body: string) => {
    codes.push(body);
    return `${SENTINEL}${codes.length - 1}${SENTINEL}`;
  });
  s = s.replace(/\[([^\]]*)\]\(([^)\s][^)]*)\)/g, (_m, label: string, target: string) => {
    const ext = /^https?:\/\//.test(target);
    return `<a href="${targetHref(target)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  // `[[bare-id]]` is the old graph's idiom, still written by agents out of habit:
  // link it when the id resolves to exactly one file, else show the bare label.
  s = s.replace(/\[\[([^[\]|]+)\]\]/g, (_m, id: string) => {
    const target = wiki?.get(id.trim());
    return target !== undefined ? `<a href="${targetHref(target)}">${id}</a>` : id;
  });
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w_])_(?=\S)([^_]*?\S)_(?![\w_])/g, '$1<em>$2</em>');
  return s.replace(CODE_SLOT_RE, (_m, i: string) => `<code>${codes[Number(i)]}</code>`);
}

/**
 * Markdown stripped to plain text, for the one-line previews that already sit
 * inside a link or a clipped row- markup there would nest an anchor in an
 * anchor, so the syntax is dropped rather than rendered.
 */
function plainInline(line: string): string {
  return esc(
    line
      .replace(/\[([^\]]*)\]\(([^)\s][^)]*)\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(\*\*|~~|\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2'),
  );
}

const BULLET_RE = /^[-*+] +(.*)$/;
const ORDERED_RE = /^\d+[.)] +(.*)$/;
const HEADING_RE = /^(#{1,6}) +(.*)$/;
const QUOTE_RE = /^> ?(.*)$/;
const TABLE_ROW_RE = /^\|(.*)\|\s*$/;
const TABLE_RULE_RE = /^\|[\s:|-]+\|\s*$/;

/** Split a `| a | b |` row into its cells. */
function tableCells(line: string): string[] {
  return TABLE_ROW_RE.exec(line)![1]!.split('|').map((c) => c.trim());
}

/**
 * Block-level prose: headings, paragraphs, bullet/ordered lists, blockquotes and
 * fenced code. Within a paragraph, list item or quote, source newlines are SOFT-
 * the files are hard-wrapped for editing, so joining with a space is what reflows
 * the text and what lets an emphasis span survive a wrap
 * (`**uniformity\ntemplate**`). Blank lines and block starts are the real breaks.
 */
function proseBlocks(lines: string[], cls: string, wiki?: WikiIndex): string {
  const out: string[] = [];
  let para: string[] = [];
  let items: string[][] = [];
  let listTag: 'ul' | 'ol' | null = null;
  let quote: string[] = [];
  let rows: string[] = [];
  let fence: string[] | null = null;

  const flushPara = () => {
    if (para.length) out.push(`<p class="${cls}">${prose(para.join(' '), wiki)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (items.length) {
      out.push(`<${listTag} class="prose-list">${items.map((it) => `<li>${prose(it.join(' '), wiki)}</li>`).join('')}</${listTag}>`);
    }
    items = [];
    listTag = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote class="prose-quote">${prose(quote.join(' '), wiki)}</blockquote>`);
    quote = [];
  };
  // A leading delimiter row (`|---|---|`) makes the row above it a header; without
  // one every row is a body row, which is how a half-written table still reads.
  const flushTable = () => {
    if (rows.length) {
      const head = rows.length > 1 && TABLE_RULE_RE.test(rows[1]!) ? rows[0]! : null;
      const body = rows.filter((r, i) => !TABLE_RULE_RE.test(r) && (head === null || i > 0));
      const tr = (r: string, tag: 'th' | 'td') =>
        `<tr>${tableCells(r).map((c) => `<${tag}>${prose(c, wiki)}</${tag}>`).join('')}</tr>`;
      out.push(
        `<div class="prose-table-wrap"><table class="prose-table">` +
          (head !== null ? `<thead>${tr(head, 'th')}</thead>` : '') +
          `<tbody>${body.map((r) => tr(r, 'td')).join('')}</tbody></table></div>`,
      );
    }
    rows = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
    flushTable();
  };

  for (const line of lines) {
    if (fence !== null) {
      if (/^```/.test(line)) {
        out.push(`<pre>${esc(fence.join('\n'))}</pre>`);
        fence = null;
      } else fence.push(line);
      continue;
    }
    if (/^```/.test(line)) {
      flushAll();
      fence = [];
      continue;
    }
    if (line.trim() === '') {
      flushAll();
      continue;
    }
    if (TABLE_ROW_RE.test(line)) {
      flushPara();
      flushList();
      flushQuote();
      rows.push(line);
      continue;
    }
    flushTable(); // any other non-blank line ends a table
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1]!.length + 2, 6); // the item's own h1/h2 own the page
      out.push(`<h${level} class="prose-h">${prose(heading[2]!, wiki)}</h${level}>`);
      continue;
    }
    const quoted = QUOTE_RE.exec(line);
    if (quoted) {
      flushPara();
      flushList();
      quote.push(quoted[1]!);
      continue;
    }
    const bullet = BULLET_RE.exec(line.trimStart());
    const ordered = ORDERED_RE.exec(line.trimStart());
    if (bullet || ordered) {
      const tag = bullet ? 'ul' : 'ol';
      flushPara();
      flushQuote();
      if (listTag !== tag) flushList();
      listTag = tag;
      items.push([(bullet ?? ordered)![1]!]);
      continue;
    }
    if (quote.length) quote.push(line.trim()); // lazy-continued quote line
    else if (items.length) items[items.length - 1]!.push(line.trim()); // wrapped list item
    else para.push(line);
  }
  if (fence !== null) out.push(`<pre>${esc(fence.join('\n'))}</pre>`); // unterminated fence
  flushAll();
  return out.join('');
}

function statusPill(status: string | undefined): string {
  if (!status) return '';
  const cls = esc(status);
  return `<span class="pill ${cls}"><i class="dot ${cls}"></i>${cls}</span>`;
}

function dot(status: string | undefined): string {
  return `<i class="dot ${status ? esc(status) : 'logged'}"></i>`;
}

// epic color coding: each active goal → a stable palette slot; every task that
// rolls up to it (directly, or through an umbrella task) shares that hue. Refs
// with no owning goal (or an archived one) get no class — they render neutral.
const EPIC_COUNT = 10;
function epicColors(facts: ItemFacts[]): { cls: (ref: string) => string; style: (ref: string) => string } {
  const byRef = new Map(facts.map((f) => [f.ref, f]));
  const idx = new Map<string, number>();
  facts
    .filter((f) => f.dir === 'goals' && !f.archived)
    .map((f) => f.ref)
    .sort()
    .forEach((ref, i) => idx.set(ref, i % EPIC_COUNT));
  const owner = (ref: string): number | undefined => {
    let cur = byRef.get(ref);
    const seen = new Set<string>();
    while (cur !== undefined && !seen.has(cur.ref)) {
      if (cur.dir === 'goals') return idx.get(cur.ref);
      seen.add(cur.ref);
      cur = cur.parent !== undefined ? byRef.get(cur.parent) : undefined;
    }
    return undefined;
  };
  return {
    cls: (ref) => (owner(ref) !== undefined ? ' epic' : ''),
    style: (ref) => {
      const n = owner(ref);
      return n !== undefined ? ` style="--epic:var(--epic-${n})"` : '';
    },
  };
}

const CSS = `
  :root {
    --bg:#faf9f6; --panel:#ffffff; --panel-hover:#f5f3ee; --ink:#26241f;
    --muted:#6e6a61; --faint:#8a8578; --neutral:#8a8578;
    --line:#e7e3da; --line-strong:#d8d3c6;
    --accent:#8a6d26; --accent-soft:#f3ecdb;
    --done:#2e7d4f; --flight:#2563eb; --blocked:#c0392b; --dropped:#c65a11; --needs-review:#7c3aed;
    --todo:#ffffff; --todo-ring:#cfcabd; --todo-mark:#b3ada0; --code-bg:#f4f2ec;
    --epic-0:#0b6ba8; --epic-1:#b26a00; --epic-2:#067a54; --epic-3:#a83279; --epic-4:#b1400a;
    --epic-5:#2b6f8c; --epic-6:#6b4bc4; --epic-7:#7a6a00; --epic-8:#b12f52; --epic-9:#4a5b6b;
    --shadow: 0 1px 2px rgba(38,36,31,.05), 0 4px 14px rgba(38,36,31,.05);
    --nav-w:224px; --nav-gap:30px; --toggle-w:32px; --topbar-gap:14px;
    --nav-col:calc(var(--nav-w) + var(--nav-gap));
    --card-min:300px; --board-gap:20px;
    --main-min:calc(var(--card-min) * 2 + var(--board-gap));
    --serif:"Iowan Old Style","Palatino",Georgia,ui-serif,serif;
    --sans:ui-sans-serif,-apple-system,"Segoe UI","Helvetica Neue",sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#15171c; --panel:#1c1f26; --panel-hover:#232732; --ink:#e8e6e1;
      --muted:#9a968c; --faint:#767268; --neutral:#7e7a70;
      --line:#2a2e37; --line-strong:#363b47;
      --accent:#c9a45c; --accent-soft:#2a2618;
      --done:#4caf7d; --flight:#6a9bff; --blocked:#e5675f; --dropped:#ef8e4d; --needs-review:#a78bfa;
      --todo:#ffffff; --todo-ring:rgba(255,255,255,.28); --todo-mark:#f0eee8; --code-bg:#191c22;
      --epic-0:#74b3e0; --epic-1:#e6a94d; --epic-2:#4fb98c; --epic-3:#d98cc0; --epic-4:#ef8a5c;
      --epic-5:#6fb3cc; --epic-6:#a892e8; --epic-7:#cbb84f; --epic-8:#e07996; --epic-9:#94a6b8;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 4px 14px rgba(0,0,0,.25);
    }
  }
  * { box-sizing:border-box; } html,body { margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:15px;
         line-height:1.55; -webkit-font-smoothing:antialiased; }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:2px; }
  h1,h2,h3 { font-family:var(--serif); font-weight:600; text-wrap:balance; margin:0; }
  .wrap { width:100%; padding:0 36px 80px; }

  .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
            padding:22px 0 16px; border-bottom:1px solid var(--line); margin-bottom:24px; }
  .topbar-left { display:flex; align-items:center; gap:var(--topbar-gap); }
  .nav-toggle { display:inline-flex; align-items:center; justify-content:center; flex:none;
                width:var(--toggle-w); height:var(--toggle-w);
                border-radius:6px; cursor:pointer; border:1px solid var(--line-strong);
                background:var(--panel); color:var(--muted); font-size:14px; line-height:1; font-family:var(--sans); }
  .nav-toggle:hover { background:var(--panel-hover); color:var(--accent); }
  .wordmark { display:flex; align-items:center; gap:11px; color:var(--ink);
              margin-left:calc(var(--nav-col) - var(--toggle-w) - var(--topbar-gap)); }
  .wordmark:hover { text-decoration:none; }
  .seal { flex:none; display:block; color:var(--accent); }
  .wordmark-text { display:flex; flex-direction:column; }
  .wordmark-name { font-family:var(--serif); font-size:21px; font-weight:600;
                   letter-spacing:.24em; text-transform:uppercase; line-height:1.15; }
  .wordmark-tag { font-size:12px; color:var(--muted); letter-spacing:.02em; }
  .topbar-meta { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  .capture-stamp { font-family:var(--mono); font-size:12px; color:var(--muted); }
  .capture-stamp b { color:var(--ink); font-weight:600; }
  .legend { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .legend span { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:var(--muted); letter-spacing:.03em; }

  .dot { width:8px; height:8px; border-radius:50%; flex:none; display:inline-block; }
  .dot.done { background:var(--done); } .dot.in-flight { background:var(--flight); }
  .dot.blocked { background:var(--blocked); } .dot.dropped { background:var(--dropped); }
  .dot.needs-review { background:var(--needs-review); }
  .dot.todo { background:var(--todo); box-shadow:0 0 0 1px var(--todo-ring); }
  .dot.logged { background:var(--line-strong); }

  .pill { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600;
          letter-spacing:.04em; padding:2px 9px 2px 7px; border-radius:999px; white-space:nowrap; }
  .pill .dot { width:7px; height:7px; }
  .pill.done { color:var(--done); background:color-mix(in srgb, var(--done) 11%, transparent); }
  .pill.in-flight { color:var(--flight); background:color-mix(in srgb, var(--flight) 11%, transparent); }
  .pill.blocked { color:var(--blocked); background:color-mix(in srgb, var(--blocked) 11%, transparent); }
  .pill.dropped { color:var(--dropped); background:color-mix(in srgb, var(--dropped) 11%, transparent); }
  .pill.needs-review { color:var(--needs-review); background:color-mix(in srgb, var(--needs-review) 11%, transparent); }
  .pill.todo { color:#57534a; background:var(--todo); box-shadow:inset 0 0 0 1px var(--todo-ring); }

  .layout { display:flex; gap:var(--nav-gap); align-items:flex-start; }
  .sidenav { width:var(--nav-w); flex:none; position:sticky; top:16px; max-height:calc(100vh - 32px);
             overflow-y:auto; padding:2px 0 24px; font-size:13px; }
  .nav-collapsed .sidenav { display:none; }
  .nav-collapsed main { margin-left:var(--nav-col); }
  .nav-link { display:block; padding:5px 10px; border-radius:6px; color:var(--muted); font-weight:600; }
  .nav-link:hover { background:var(--panel-hover); text-decoration:none; }
  .nav-link.active { color:var(--accent); background:var(--accent-soft); }
  .nav-group { margin-top:2px; }
  .nav-group > summary { cursor:pointer; list-style:none; display:flex; align-items:center;
                         justify-content:space-between; gap:8px; padding:5px 10px; border-radius:6px;
                         color:var(--muted); font-weight:600; }
  .nav-group > summary::-webkit-details-marker { display:none; }
  .nav-group > summary:hover { background:var(--panel-hover); }
  .nav-group > summary .n-count { font-family:var(--mono); font-size:11px; color:var(--faint); }
  .nav-group.active > summary { color:var(--accent); }
  .nav-items { display:flex; flex-direction:column; padding:1px 0 4px; }
  .nav-item { display:flex; align-items:center; gap:7px; padding:3.5px 10px 3.5px 18px; border-radius:6px;
              color:var(--muted); font-weight:400; font-size:12.5px; white-space:nowrap; }
  .nav-item .dot { width:6px; height:6px; }
  .nav-item .n-title { overflow:hidden; text-overflow:ellipsis; }
  .nav-item:hover { background:var(--panel-hover); text-decoration:none; }
  .nav-item.active { color:var(--accent); background:var(--accent-soft); }
  .nav-item.sub { padding-left:32px; }
  .nav-sep { border:none; border-top:1px solid var(--line); margin:10px 10px; }
  main { flex:1; min-width:0;
         margin-right:clamp(0px, calc(100% - var(--nav-col) - var(--main-min)), var(--nav-col)); }

  .board-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
  .board-head h1 { font-size:26px; }
  .board-head .sub { color:var(--muted); font-size:13.5px; }
  .board-meta { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:18px;
                font-family:var(--mono); font-size:12px; color:var(--muted); }
  .board-meta b { color:var(--ink); font-weight:600; }
  .board { display:grid; gap:var(--board-gap);
           grid-template-columns:repeat(auto-fill, minmax(max(var(--card-min), (100% - var(--board-gap)) / 2), 1fr)); }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; box-shadow:var(--shadow);
          display:flex; flex-direction:column; overflow:hidden; }
  .card-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px;
               padding:13px 16px 11px; border-bottom:1px solid var(--line); color:var(--ink); }
  a.card-head:hover { background:var(--panel-hover); text-decoration:none; }
  .card-title { font-family:var(--serif); font-size:16.5px; font-weight:600; }
  .card-count { font-family:var(--mono); font-size:12px; color:var(--muted);
                background:color-mix(in srgb, var(--neutral) 12%, transparent); padding:1px 8px; border-radius:999px; }
  .card-items { list-style:none; margin:0; padding:6px 0; flex:1; }
  .card-item a { display:flex; align-items:center; gap:10px; padding:7px 16px; color:var(--ink); }
  .card-item a:hover { background:var(--panel-hover); text-decoration:none; }
  .card-item .title { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:14px; }
  .card-item.is-done .title { color:var(--muted); }
  .card-item .when { font-family:var(--mono); font-size:11px; color:var(--faint); flex:none; font-variant-numeric:tabular-nums; }
  .card-more { display:block; padding:9px 16px 11px; border-top:1px solid var(--line); font-size:12.5px; color:var(--muted); }
  .card-more:hover { background:var(--panel-hover); color:var(--accent); text-decoration:none; }
  .empty { padding:28px 16px; color:var(--faint); text-align:center; font-size:13.5px; }

  /* epic color coding: a goal and every task that rolls up to it share a hue */
  .card-item.epic > a { box-shadow: inset 3px 0 0 var(--epic); }
  .card-item.epic .title { color: var(--epic); }
  .row.epic { box-shadow: inset 3px 0 0 var(--epic); }
  .row.epic .r-title { color: var(--epic); }
  .subitem.epic > a { box-shadow: inset 3px 0 0 var(--epic); }
  .subitem.epic .s-title { color: var(--epic); }

  .crumbs { font-size:12.5px; color:var(--faint); margin:2px 0 14px; }
  .crumbs a { color:var(--muted); }
  .crumbs .sep { margin:0 6px; color:var(--line-strong); }

  /* tier 2 / tier 3 only: hand the file path to an agent in one click */
  .crumb-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:2px 0 14px; }
  .crumb-row .crumbs { margin:0; }
  .copy-path { display:inline-flex; align-items:center; gap:5px; cursor:pointer;
               font-family:var(--mono); font-size:11px; line-height:1; color:var(--muted);
               background:var(--panel); border:1px solid var(--line); border-radius:5px; padding:3.5px 6px; }
  .copy-path:hover { color:var(--accent); border-color:var(--line-strong); background:var(--panel-hover); }
  .copy-path:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .copy-path .i-ok { display:none; }
  .copy-path.ok { color:var(--done); border-color:color-mix(in srgb, var(--done) 45%, var(--line)); }
  .copy-path.ok .i-ok { display:inline; }
  .copy-path.ok .i-copy { display:none; }
  .copy-path.fail { color:var(--blocked); border-color:color-mix(in srgb, var(--blocked) 45%, var(--line)); }
  .copy-path .copy-label:empty { display:none; }
  .view-head { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
  .view-head h1 { font-size:24px; }
  .view-sub { color:var(--muted); font-size:13.5px; margin-bottom:18px; }
  .rows { display:flex; flex-direction:column; border:1px solid var(--line); border-radius:8px;
          background:var(--panel); box-shadow:var(--shadow); overflow:hidden; }
  .row { display:grid; grid-template-columns:110px 1fr auto; gap:14px; align-items:center;
         padding:12px 16px; color:var(--ink); border-bottom:1px solid var(--line); }
  .row:last-child { border-bottom:none; }
  .row:hover { background:var(--panel-hover); text-decoration:none; }
  .row.no-status { grid-template-columns:1fr auto; }
  .row .r-main { min-width:0; }
  .row .r-title { font-weight:600; font-size:14.5px; }
  .row .r-when { font-family:var(--mono); font-size:11.5px; color:var(--faint); font-variant-numeric:tabular-nums; text-align:right; }
  .rows-note { font-size:12px; color:var(--faint); margin:10px 0; }

  .item-meta { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:8px 0 22px; }
  .item-meta .when { font-family:var(--mono); font-size:12px; color:var(--muted); }
  .item-meta .kind { font-family:var(--mono); font-size:11px; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; }
  .human-flag { font-family:var(--mono); font-size:11px; color:var(--accent);
                background:var(--accent-soft); padding:2px 8px; border-radius:4px; }
  .staged-chip { font-family:var(--mono); font-size:11px; color:var(--blocked);
                 background:color-mix(in srgb, var(--blocked) 11%, transparent); padding:2px 8px; border-radius:4px; font-weight:700; }
  section.block { margin-bottom:26px; }
  .block-label { font-size:11.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
                 color:var(--faint); margin-bottom:9px; font-family:var(--sans); }
  .summary-text { font-size:15px; color:var(--ink); margin:0 0 10px; }
  .human-note { font-size:12.5px; color:var(--faint); margin:8px 0 0; }
  .prose-list { margin:0 0 10px; padding-left:22px; font-size:15px; color:var(--ink); }
  .prose-list li { margin:0 0 4px; }
  .prose-list li::marker { color:var(--faint); }
  .prose-h { font-size:14px; font-weight:700; color:var(--ink); margin:18px 0 8px; }
  .prose-quote { margin:0 0 10px; padding:2px 0 2px 14px; font-size:15px;
                 color:var(--muted); border-left:3px solid var(--line-strong); }
  .prose-table-wrap { max-width:100%; overflow-x:auto; margin:0 0 14px; }
  .prose-table { border-collapse:collapse; font-size:13.5px; color:var(--ink); }
  .prose-table th, .prose-table td { border:1px solid var(--line); padding:6px 10px; text-align:left;
                                     vertical-align:top; }
  .prose-table th { background:var(--panel-hover); font-weight:700; }
  strong { font-weight:700; } /* colour inherits, so a done row's muted label stays muted */
  em { font-style:italic; }
  del { color:var(--muted); text-decoration-color:var(--line-strong); }
  .proposal-body .summary-text, .proposal-body .prose-list { font-size:13.5px; }
  .banner { border:1px solid var(--blocked); background:color-mix(in srgb, var(--blocked) 8%, transparent);
            color:var(--blocked); border-radius:8px; padding:10px 14px; margin:0 0 16px; font-size:13.5px; }
  .banner code { color:inherit; }

  .checklist { list-style:none; margin:0; padding:0; border:1px solid var(--line); border-radius:8px;
               background:var(--panel); overflow:hidden; }
  .check { display:flex; gap:11px; padding:10px 14px; border-bottom:1px solid var(--line); align-items:baseline; }
  .check:last-child { border-bottom:none; }
  .check .mark { font-family:var(--mono); font-size:13px; font-weight:700; flex:none; width:18px; text-align:center; }
  .check.done .mark { color:var(--done); }
  .check.in-flight .mark { color:var(--flight); }
  .check.blocked .mark { color:var(--blocked); }
  .check.todo .mark { color:var(--todo-mark); }
  .check.done .label { color:var(--muted); }
  .block.is-done > a { color:var(--muted); }
  .check .c-main { min-width:0; }
  .check .blocker { display:block; font-size:12.5px; color:var(--blocked); margin-top:2px; }
  .check .blocker a { color:var(--blocked); font-weight:600; text-decoration:underline;
                      text-decoration-color:color-mix(in srgb, var(--blocked) 40%, transparent); }
  .check .c-links { display:block; font-size:12.5px; margin-top:2px; }

  .subitems { list-style:none; margin:0; padding:0; border:1px solid var(--line); border-radius:8px;
              background:var(--panel); overflow:hidden; }
  .subitem a { display:flex; align-items:baseline; gap:10px; padding:10px 14px; color:var(--ink);
               border-bottom:1px solid var(--line); }
  .subitem:last-child a { border-bottom:none; }
  .subitem a:hover { background:var(--panel-hover); text-decoration:none; }
  .subitem .dot { align-self:center; }
  .subitem .s-title { font-weight:600; font-size:14px; flex:none; }
  .subitem.is-done .s-title { color:var(--muted); }
  .subitem .s-sum { color:var(--muted); font-size:13px; flex:1; min-width:0;
                    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .subitem .s-go { color:var(--faint); flex:none; }
  .sub-hint { font-size:12px; color:var(--faint); margin-left:8px; }

  .link-rows { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .link-row { display:flex; align-items:baseline; gap:10px; }
  .tag { font-family:var(--mono); font-size:10.5px; text-transform:uppercase; letter-spacing:.06em;
         color:var(--muted); background:color-mix(in srgb, var(--neutral) 12%, transparent);
         padding:1.5px 7px; border-radius:4px; flex:none; min-width:44px; text-align:center; }
  .archived-flag { font-family:var(--mono); font-size:10.5px; color:var(--faint);
                   border:1px solid var(--line-strong); padding:1px 7px; border-radius:4px; }

  .doc-body p { margin:0 0 12px; }
  .doc-body code { font-family:var(--mono); font-size:.86em; background:var(--code-bg);
                   border:1px solid var(--line); border-radius:4px; padding:.5px 5px; }
  code { font-family:var(--mono); font-size:.86em; background:var(--code-bg);
         border:1px solid var(--line); border-radius:4px; padding:.5px 5px; }
  pre { background:var(--code-bg); border:1px solid var(--line); border-radius:8px;
        padding:14px 16px; overflow-x:auto; font-family:var(--mono); font-size:12px; line-height:1.6; }

  details.agent { margin-top:34px; border-top:1px solid var(--line); padding-top:14px; }
  details.agent > summary { cursor:pointer; list-style:none; display:inline-flex; align-items:center; gap:8px;
                            font-family:var(--mono); font-size:12px; color:var(--muted); }
  details.agent > summary::-webkit-details-marker { display:none; }
  details.agent > summary::before { content:"▸"; color:var(--faint); font-size:11px; }
  details.agent[open] > summary::before { content:"▾"; }
  details.agent > summary:hover { color:var(--accent); }
  details.agent > summary .path { color:var(--accent); }
  .agent-file { margin-top:10px; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:var(--code-bg); }
  .agent-file .file-tab { font-family:var(--mono); font-size:11px; color:var(--muted); padding:7px 14px;
                          border-bottom:1px solid var(--line); background:var(--panel);
                          display:flex; justify-content:space-between; gap:10px; }
  .agent-file pre { margin:0; border:none; border-radius:0; }

  @media (prefers-reduced-motion: no-preference) {
    .card-item a, .row, .card-head, .nav-link, .nav-item, .nav-group > summary { transition: background-color 120ms ease; }
  }
  @media (max-width: 720px) {
    .wrap { padding:0 16px 60px; }
    .layout { flex-direction:column; gap:12px; }
    .sidenav { position:static; width:100%; max-height:none; border-bottom:1px solid var(--line); padding-bottom:12px; }
    .row { grid-template-columns:1fr auto; }
    .row .pill { display:none; }
    .wordmark { margin-left:0; }
    .nav-collapsed main { margin-left:0; }
    main { margin-right:0; }
  }
`;

const NAV_JS = `
  (function () {
    var t = document.getElementById('nav-toggle');
    var l = document.getElementById('shell');
    if (!t || !l) return;
    var k = 'arbiter-nav-collapsed';
    try { if (localStorage.getItem(k) === '1') l.classList.add('nav-collapsed'); } catch (e) {}
    t.setAttribute('aria-pressed', String(l.classList.contains('nav-collapsed')));
    t.addEventListener('click', function () {
      var c = l.classList.toggle('nav-collapsed');
      try { localStorage.setItem(k, c ? '1' : '0'); } catch (e) {}
      t.setAttribute('aria-pressed', String(c));
    });
  })();
`;

const COPY_JS = `
  (function () {
    function fallback(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    document.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.copy-path') : null;
      if (!btn) return;
      var text = btn.getAttribute('data-copy') || '';
      var label = btn.querySelector('.copy-label');
      var settle = function (ok) {
        btn.classList.remove('ok', 'fail');
        btn.classList.add(ok ? 'ok' : 'fail');
        if (label) label.textContent = ok ? 'copied' : 'copy failed';
        btn.setAttribute('aria-label', (ok ? 'Copied path ' : 'Failed to copy path ') + text);
        window.clearTimeout(btn._t);
        btn._t = window.setTimeout(function () {
          btn.classList.remove('ok', 'fail');
          if (label) label.textContent = '';
          btn.setAttribute('aria-label', 'Copy path ' + text);
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { settle(true); }, function () { settle(fallback(text)); });
      } else {
        settle(fallback(text));
      }
    });
  })();
`;

const SEAL = `<svg class="seal" width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
  <path d="M15 2.5 L26 8.75 L26 21.25 L15 27.5 L4 21.25 L4 8.75 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="15" cy="15" r="3.2" fill="currentColor"/></svg>`;

const LEGEND = `<span class="legend" aria-label="Status legend">
  <span><i class="dot done"></i>done</span>
  <span><i class="dot in-flight"></i>in&#8209;flight</span>
  <span><i class="dot blocked"></i>blocked</span>
  <span><i class="dot todo"></i>todo</span>
  <span><i class="dot dropped"></i>dropped</span>
  <span><i class="dot needs-review"></i>needs&nbsp;review</span>
</span>`;

function sidenav(facts: ItemFacts[], activePath: string): string {
  const nest = computeNesting(facts);
  const navRow = (f: ItemFacts, sub: boolean) =>
    `<a class="nav-item${sub ? ' sub' : ''}${activePath === `/item/${f.dir}/${f.id}` ? ' active' : ''}" href="/item/${esc(f.dir)}/${esc(f.id)}">
             ${dot(f.status)}<span class="n-title">${esc(f.title)}</span></a>`;
  const groups = NAV_DIRS.map((d) => {
    const items = facts.filter((f) => f.dir === d && !f.archived);
    const rows = items.sort(compareItems).slice(0, 5).map(f => navRow(f, nest.isSub(f.ref))).join('')
      + (items.length > 5 ? `<a class="nav-link" href="/dir/${d}">View all ${items.length} →</a>` : '');
    const active = activePath.startsWith(`/item/${d}/`) || activePath === `/dir/${d}`;
    return `<details class="nav-group${active ? ' active' : ''}"${active || items.length > 0 ? ' open' : ''}>
      <summary><a class="n-label" href="/dir/${d}">${CARD_LABELS[d]}</a><span class="n-count">${items.length}</span></summary>
      <div class="nav-items">${rows || `<span class="nav-item">—</span>`}</div></details>`;
  }).join('');
  return `<a class="nav-link${activePath === '/' ? ' active' : ''}" href="/">Dashboard</a>
    <a class="nav-link" href="/search">Search</a>
    ${groups}
    <hr class="nav-sep">
    <a class="nav-link" href="/active">All active work</a>
    <a class="nav-link${activePath === '/protocol' ? ' active' : ''}" href="/protocol">PROTOCOL.md</a>`;
}

function agentView(relPath: string, bytes: string): string {
  return `<details class="agent"><summary>View as agent — <span class="path">${esc(relPath)}</span></summary>
    <div class="agent-file"><div class="file-tab"><span>${esc(relPath)}</span><a href="/raw/${esc(relPath)}">raw</a></div>
    <pre>${esc(bytes)}</pre></div></details>`;
}

function page(title: string, activePath: string, facts: ItemFacts[], body: string, stamp: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Arbiter</title>
<style>${CSS}</style></head><body>
<div class="wrap" id="shell">
  <header class="topbar">
    <div class="topbar-left">
      <button class="nav-toggle" id="nav-toggle" aria-label="Toggle navigation" aria-pressed="false" title="Toggle navigation">☰</button>
      <a class="wordmark" href="/" aria-label="Arbiter dashboard">
        ${SEAL}
        <span class="wordmark-text">
          <span class="wordmark-name">Arbiter</span>
          <span class="wordmark-tag">Work, recorded. Impact, attested.</span>
        </span>
      </a>
    </div>
    <div class="topbar-meta">
      <span class="capture-stamp">${stamp}</span>
      ${LEGEND}
    </div>
  </header>
  <div class="layout" id="layout">
    <nav class="sidenav" id="sidenav" aria-label="Fast navigation">${sidenav(facts, activePath)}</nav>
    <main>${body}</main>
  </div>
</div>
<script>${NAV_JS}${COPY_JS}${HANDOFF_JS}
${INPUT_REVIEW_JS}</script></body></html>`;
}

function crumbs(parts: { label: string; href?: string }[]): string {
  return `<nav class="crumbs">${parts
    .map((p) => (p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : esc(p.label)))
    .join('<span class="sep">/</span>')}</nav>`;
}

const COPY_ICON = `<svg class="i-copy" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
  stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 11.5H3A1.5 1.5 0 0 1 1.5 10V3A1.5 1.5 0 0 1 3 1.5h7A1.5 1.5 0 0 1 11.5 3v1"/>
  <rect x="4.5" y="4.5" width="10" height="10" rx="1.5"/></svg>
<svg class="i-ok" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 8.5 6.2 12 13 4.5"/></svg>`;

/** Data-relative path (e.g. `tasks/foo.md`) — what an agent is handed to pick the item up. */
function copyPathButton(relPath: string): string {
  return `<button type="button" class="copy-path" data-copy="${esc(relPath)}"
    title="Copy ${esc(relPath)}" aria-label="Copy path ${esc(relPath)}">${COPY_ICON}<span class="copy-label" aria-hidden="true"></span></button>`;
}

/** Crumbs plus the copy affordance — tier 2 (item) and tier 3 (doc) views only. */
function crumbRow(parts: { label: string; href?: string }[], relPath: string): string {
  return `<div class="crumb-row">${crumbs(parts)}${copyPathButton(relPath)}</div>`;
}

function renderSection(s: Section, wiki?: WikiIndex): string {
  const label = s.heading === '' ? '' : `<div class="block-label">${esc(s.heading)}</div>`;
  const unresolved = (row: Exclude<SectionRow, { kind: 'entry' }>) => row.kind === 'blank' ? ''
    : `<li class="unresolved"><div class="banner">Line ${row.line}: malformed entry; expected ${esc(row.expected)}. Edit this source line; preserved verbatim.</div><pre>${esc(row.raw)}</pre></li>`;
  let body: string;
  switch (s.kind) {
    case 'prose':
    case 'malformed': {
      if (s.kind === 'malformed') {
        body = `<div class="banner">off-grammar section, preserved verbatim</div><pre>${esc(s.lines.join('\n'))}</pre>`;
        break;
      }
      body = proseBlocks(s.lines, 'summary-text', wiki);
      break;
    }
    case 'checklist':
      body =
        `<ul class="checklist">` +
        orderedRows(s, s.steps)
          .map((row) => {
            if (row.kind !== 'entry') return unresolved(row);
            const st = row.entry;
            const status = MARK_TO_STATUS[st.mark] ?? 'todo';
            const anchor = st.anchor ? ` id="^${esc(st.anchor)}"` : '';
            const blockers = st.continuations
              .filter((c) => c.kw === 'blocked-by')
              .map((c) => `<span class="blocker">blocked-by: <a href="${targetHref(c.target)}">${esc(c.label)}</a></span>`)
              .join('');
            const sees = st.continuations
              .filter((c) => c.kw === 'see')
              .map((c) => `<a href="${targetHref(c.target)}">${esc(c.label)}</a>`)
              .join(' · ');
            return `<li class="check ${status}"${anchor}><span class="mark" aria-hidden="true">${CHECK_GLYPH[status]}</span>
              <span class="c-main"><span class="label">${prose(st.text, wiki)}</span>${blockers}${sees ? `<span class="c-links">see: ${sees}</span>` : ''}</span></li>`;
          })
          .join('') +
        `</ul>`;
      break;
    case 'links':
      body =
        `<ul class="link-rows">` +
        orderedRows(s, s.entries)
          .map((row) => {
            if (row.kind !== 'entry') return unresolved(row);
            const e = row.entry;
            const ext = /^https?:\/\//.test(e.target);
            return `<li class="link-row"><span class="tag">${esc(e.kindLabel)}</span><a href="${targetHref(e.target)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(e.label)}</a></li>`;
          })
          .join('') +
        `</ul>`;
      break;
    case 'docs':
      body =
        `<ul class="link-rows">` +
        orderedRows(s, s.entries)
          .map(row => row.kind !== 'entry' ? unresolved(row) :
              `<li class="link-row"><span class="tag">${esc(row.entry.docKind)}</span><a href="${targetHref(row.entry.relPath)}">${esc(row.entry.title)}</a></li>`)

          .join('') +
        `</ul>`;
      break;
  }
  return `<section class="block">${label}${body}</section>`;
}

function checkpointHtml(summary: ReturnType<typeof checkpointSummary>): string {
  if (!summary) return '';
  return `<p class="rows-note">Checkpoint: ${esc(summary.readiness)}${summary.path ? ` · <a href="${targetHref(summary.path)}">current</a>` : ''}
    ${summary.nextAction ? `<br>Next: ${esc(summary.nextAction)}` : ''}
    ${summary.reasons.length ? `<br>${summary.reasons.map(esc).join('; ')}${summary.reasonCount > summary.reasons.length ? ' (more in current checkpoint)' : ''}` : ''}</p>`;
}
function discoveryRows(rows: DiscoveryResult[]): string {
  return rows.map(r => `<article class="block${r.status === 'done' ? ' is-done' : ''}">
    <a href="${targetHref(r.path)}">${esc(r.title)}</a> ${statusPill(r.status)}
    ${r.stagedCount ? `<span class="staged-chip">${r.stagedCount} staged</span>` : ''}
    ${r.supersededBy ? `<span class="pill">superseded by ${esc(r.supersededBy)}</span>` : ''}
    ${r.verification ? `<span class="pill">verification: ${esc(r.verification)}</span>` : ''}
    ${r.review ? `<span class="pill needs-review">review: ${esc(r.review)}</span>` : ''}
    ${r.archived ? `<span class="archived-flag">archived ${esc(r.archived)}</span>` : ''}
    <div class="rows-note">Tier ${r.tier} · ${esc(r.path)}${r.parent ? ` · parent: <a href="${targetHref(r.parent)}">${esc(r.parent)}</a>` : ''}</div>
    <p class="summary-text"${r.status === 'done' ? ' style="color:var(--muted)"' : ''}>${esc(r.preview)}</p>${checkpointHtml(r.checkpoint)}</article>`).join('') || '<p class="empty">No results</p>';
}

export function createArbiterServer(dataDir: string, options: { personalAccess?: PersonalAccess } = {}): http.Server {
  const handoffs = handoffApi(dataDir);
  const personal = options.personalAccess ? handoffApi(dataDir, options.personalAccess) : null;
  return http.createServer((req, res) => {
    if (req.url === '/personal/api' && personal) { void personal.handle(req, res); return; }
    if (req.url === '/api/handoff') { void handoffs.handle(req, res); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const send = (code: number, body: string, type = 'text/html; charset=utf-8') => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/personal/')) {
        const host = req.headers.host ?? '';
        if (!personal || !options.personalAccess) return send(404, 'Unavailable');
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
          || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)
          || host.split(':').at(-1) !== String(req.socket.localPort)) return send(403, 'Local session required');
        const actor = options.personalAccess.authenticate(req.headers.authorization);
        if (!actor) { res.setHeader('WWW-Authenticate', 'Basic realm="Arbiter personal review", charset="UTF-8"'); return send(401, 'Personal authentication required'); }
        const ref = url.pathname.slice('/personal/'.length);
        // Credential transport only: agents can obtain the process capability
        // without loading an unbudgeted task page or unrelated personal inputs.
        if (ref === 'session' && req.method === 'GET')
          return send(200, JSON.stringify({ token: personal.token }), 'application/json; charset=utf-8');
        try {
          if (ref === 'active') {
            const policy = options.personalAccess.policy, revision = policy.revision;
            const pageNumber = Number(url.searchParams.get('page') ?? 0), pageSize = 20;
            if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) return send(400, 'Invalid page');
            const rows = walkCorpus(dataDir, { includeHistory: false }).filter(f => f.kind === 'item' && /^(tasks|goals)\//.test(f.relPath))
              .filter(f => audienceAllows(policy.resolve(f.relPath, f.text), actor)).map(f => ({ file: f, fm: parseItemFile(f.text).fm }))
              .filter(r => !fmGet(r.fm, 'archived') && !isTerminal(fmGet(r.fm, 'status')));
            const body = rows.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize).map(r => {
              const task = r.file.relPath.replace(/\.md$/, '');
              return `<p><a href="/personal/${esc(task)}">${esc(fmGet(r.fm, 'title') ?? task)}</a> · ${esc(fmGet(r.fm, 'status') ?? 'unprepared')}</p>`;
            }).join('');
            if (policy.revision !== revision) return send(409, 'Access changed; refresh');
            return send(200, `<h1>Your active work</h1><p>${rows.length} accessible active goals and tasks, including nested work.</p>${body}
              ${pageNumber > 0 ? `<a href="?page=${pageNumber - 1}">Previous</a>` : ''}
              ${(pageNumber + 1) * pageSize < rows.length ? `<a href="?page=${pageNumber + 1}">Next</a>` : ''}`);
          }
          if (/^goals\/[a-z0-9][a-z0-9-]*$/.test(ref)) {
            const policy = options.personalAccess.policy, revision = policy.revision;
            const item = walkCorpus(dataDir, { includeHistory: false }).find(f => f.kind === 'item' && f.relPath === `${ref}.md`);
            if (!item || !audienceAllows(policy.resolve(item.relPath, item.text), actor) || policy.revision !== revision) return send(404, 'Goal unavailable');
            return send(200, `<h1>Goal</h1><pre style="white-space:pre-wrap">${esc(item.text)}</pre><a href="/personal/active">Your active work</a>`);
          }
          if (/^people\/[a-z0-9][a-z0-9-]*$/.test(ref)) {
            const policy = options.personalAccess.policy, revision = policy.revision, files = walkCorpus(dataDir, { includeHistory: false });
            const person = files.find(f => f.kind === 'item' && f.relPath === `${ref}.md`);
            if (!person || !audienceAllows(policy.resolve(person.relPath, person.text), actor)) return send(404, 'Entity unavailable');
            const rows = files.filter(f => f.kind === 'item' && f.relPath.startsWith('tasks/')).flatMap(f => {
              const task = f.relPath.replace(/\.md$/, '');
              return inputRelationships(dataDir, task, actor, policy).filter(e => e.entity === ref).map(e =>
                `<p><a href="/personal/${esc(task)}">${esc(fmGet(parseItemFile(f.text).fm, 'title') ?? task)}</a> · ${esc(e.role)}</p>`);
            });
            if (policy.revision !== revision) return send(409, 'Access changed; refresh');
            return send(200, `<h1>Person or entity</h1><pre>${esc(person.text)}</pre><h2>Connected work</h2>${rows.join('') || '<p>No accessible connections.</p>'}`);
          }
          const state = readInputState(dataDir, ref, options.personalAccess.policy);
          if (!audienceAllows(state.task.audience, actor)) return send(404, 'Task unavailable');
          return send(200, `<!doctype html><html><head><meta charset="utf-8"><title>Personal input review</title></head><body>
            <h1>Personal input review</h1><a href="/personal/active">Your active work</a><pre style="white-space:pre-wrap">${esc(state.taskBytes)}</pre>
            ${personalInputPanel(ref, personal.token, esc)}<script>${INPUT_REVIEW_JS}</script></body></html>`);
        } catch { return send(404, 'Task unavailable'); }
      }
      const snapshot = readProjection(dataDir);
      const facts = snapshot.facts;
      const byPath = new Map(snapshot.files.map(f => [f.relPath, f.text]));
      const sourceLines = new Map(snapshot.files.map(f => [f.relPath, f.sourceLines]));
      const safeRead = (rel: string): string | null => byPath.get(rel) ?? null;
      const protocol = fmGet(parseItemFile(safeRead('PROTOCOL.md') ?? '').fm, 'version') ?? '?';
      const now = new Date().toISOString().slice(0, 16);
      const stored = safeRead('DASHBOARD.md');
      const dashboard = regenFull(facts, stored, { now, protocolRaw: `"${protocol}"`, inputs: snapshot.inputs });
      // Raw and agent views use the very same visible projection as the human card.
      byPath.set('DASHBOARD.md', dashboard);
      const wikiNow = (): WikiIndex => buildWikiIndex(snapshot.files);
      const targetDiagnostics = (rel: string): string => validateCorpus(dataDir, snapshot.files, SchemaSet.fromFiles(snapshot.files), { verifyHistory: false }).errors
        .filter(d => d.relPath === rel && d.code === 'broken-target')
        .map(d => `<div class="banner">${d.line ? `Line ${d.line}: ` : ''}broken target: ${esc(d.message)}. Correct the path or anchor in the source file.</div>`).join('');
      const dashStamp = (): string => `files verified <b>${esc(now)}</b> · protocol <b>${esc(protocol)}</b>`;

      const optionsFromUrl = () => {
        const permitted = new Set(['q', 'tiers', 'archive', 'dir', 'status', 'parent', 'page', 'page-size', 'format']);
        for (const key of url.searchParams.keys()) {
          if (!permitted.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Invalid discovery option');
        }
        if (url.searchParams.has('format') && url.searchParams.get('format') !== 'json') throw new Error('format must be json');
        return { ...Object.fromEntries([...url.searchParams].filter(([k]) => !['format', 'page', 'page-size'].includes(k))),
          page: Number(url.searchParams.get('page') ?? 0), pageSize: Number(url.searchParams.get('page-size') ?? 10) };
      };
      const paging = (result: ReturnType<typeof discover>, route: string) => {
        const href = (n: number) => { const params = new URLSearchParams(url.searchParams); params.delete('format'); params.set('page', String(n)); return `${route}?${esc(params.toString())}`; };
        return `<p>${result.total} results · page ${result.page + 1}${result.page > 0 ? ` · <a href="${href(result.page - 1)}">Previous</a>` : ''}${result.nextPage !== null ? ` · <a href="${href(result.nextPage)}">Next</a>` : ''}</p>`;
      };
      const renderDiscovery = (dir?: string) => {
        const result = discover(snapshot, { ...optionsFromUrl(), ...(dir ? { dir, tiers: '2' } : {}) }, now);
        if (url.searchParams.get('format') === 'json') return send(200, JSON.stringify(result), 'application/json; charset=utf-8');
        const o = result.options;
        const body = `<h1>${dir ? esc(CARD_LABELS[dir] ?? dir) + ' list' : 'Search'}</h1>
          <p class="view-sub">Bounded source previews · archives ${esc(o.archive)} · open only the source you need</p>
          <form method="get"><label>Search <input name="q" value="${esc(o.q)}" maxlength="200"></label>
          ${dir ? '' : `<label>Tiers <input name="tiers" value="${esc(o.tiers)}" size="6"></label><label>Directory <input name="dir" value="${esc(o.dir ?? '')}" size="12"></label>`}
          <label>Archives <select name="archive">${['exclude', 'include', 'only'].map(a => `<option${a === o.archive ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
          <label>Status <input name="status" value="${esc(o.status ?? '')}" size="12"></label>
          <label>Parent <input name="parent" value="${esc(o.parent ?? '')}"></label>
          <label>Page size <input type="number" name="page-size" min="1" max="50" value="${o.pageSize}"></label><button>Find</button></form>
          ${paging(result, url.pathname)}${discoveryRows(result.results)}${paging(result, url.pathname)}
          ${agentView('discovery.json', JSON.stringify(result, null, 2))}`;
        return send(200, page(dir ?? 'Search', url.pathname, facts, body, dashStamp()));
      };

      const renderDashboard = (facts: ItemFacts[]): string => {
        const text = safeRead('DASHBOARD.md');
        if (text === null) {
          return page('Dashboard', '/', facts, `<h1>Dashboard</h1><div class="banner">No DASHBOARD.md — run <code>arbiter regen</code>.</div>`, dashStamp());
        }
        const dash = parseDashboard(text);
        const epic = epicColors(facts);
        const meta = dash.fm
          ? `<div class="board-meta">
               <span>inputs <b>${esc(snapshot.inputs)}</b></span>
               <span>updated <b>${esc(fmGet(dash.fm, 'updated') ?? '?')}</b></span>
               <span>generated <b>${esc(fmGet(dash.fm, 'generated') ?? '?')}</b></span>
               <span>protocol <b>${esc(fmGet(dash.fm, 'protocol') ?? '?')}</b></span>
             </div>`
          : '';
        const cards = dash.cards
          .slice()
          .sort((a, b) => displayRank(a.label) - displayRank(b.label))
          .map((c) => {
            const dir = c.label.toLowerCase();
            let overflowHtml = `<a class="card-more" href="/dir/${esc(dir)}">Open ${esc(dir)} →</a>`;
            const rows = c.rows
              .map((r) => {
                if (r.kind === 'overflow') {
                  overflowHtml = `<a class="card-more" href="/dir/${esc(r.dir)}">+${r.count} more…</a>`;
                  return '';
                }
                if (r.kind === 'stray') return `<li class="card-item"><a href="#"><span class="tag">hand-added</span><span class="title">${prose(r.line)}</span></a></li>`;
                const e = r.entry;
                const staged = e.stagedCount ? `<span class="staged-chip">${e.stagedCount} staged</span>` : '';
                const done = isTerminal(e.status) ? ' is-done' : '';
                const eref = e.relPath.replace(/\.md$/, '');
                return `<li class="card-item${done}${epic.cls(eref)}"${epic.style(eref)}><a href="${targetHref(e.relPath)}">${dot(e.status)}
                  <span class="title">${esc(e.title)}</span>${staged}${e.review ? `<span class="pill needs-review">review: ${esc(e.review)}</span>` : ''}<span class="when">${esc(e.date)}</span></a>${checkpointHtml(checkpointSummary(snapshot, eref))}</li>`;
              })
              .join('');
            return `<article class="card">
              <a class="card-head" href="/dir/${esc(dir)}"><span class="card-title">${esc(c.label)}</span><span class="card-count">${c.count}</span></a>
              <ul class="card-items">${rows || `<li class="empty">empty</li>`}</ul>${overflowHtml}</article>`;
          })
          .join('');
        const body = `
          <div class="board-head"><h1>Dashboard</h1>
            <span class="sub">Dashboard · local only · files are truth</span></div>
          ${meta}
          <div class="board">${cards}</div>
          ${agentView('DASHBOARD.md', text)}`;
        return page('Dashboard', '/', facts, body, dashStamp());
      };

      const renderItem = (facts: ItemFacts[], wiki: WikiIndex, dir: string, id: string): string | null => {
        const rel = `${dir}/${id}.md`;
        const text = safeRead(rel);
        if (text === null) return null;
        const ast = parseItemFile(text, sourceLines.get(rel));
        const title = fmGet(ast.fm, 'title') ?? ast.title ?? id;

        const meta: string[] = [`<span class="kind">${esc(fmGet(ast.fm, 'type') ?? dir)}</span>`];
        for (const key of ['started', 'eta', 'due', 'date', 'created', 'updated', 'archived', 'review', 'owner', 'scope', 'verification', 'verified-by', 'observed-on', 'reviewed-by', 'reviewed-on', 'outcome'] as const) {
          const v = fmGet(ast.fm, key);
          if (v !== undefined) meta.push(`<span class="when">${key} ${esc(v)}</span>`);
        }
        for (const key of ['parent', 'prev', 'source', 'related', 'superseded-by'] as const) {
          const v = fmGet(ast.fm, key);
          if (v !== undefined)
            meta.push(
              `<span class="when">${key} ${v
                .split(',')
                .map((r) => `<a href="${targetHref(r.trim())}">${esc(r.trim())}</a>`)
                .join(', ')}</span>`,
            );
        }
        if (fmGet(ast.fm, 'visibility') === 'private') meta.push(`<span class="human-flag">private</span>`);
        if (ast.fm === null) meta.push(`<span class="human-flag">raw human entry</span>`);

        const rawNote =
          ast.fm === null
            ? `<p class="human-note">raw human entry — valid; normalization structures it on first touch (PROTOCOL.md#normalization)</p>`
            : '';

        // staged proposals are the most urgent thing on the page
        let stagedHtml = '';
        const staged = snapshot.files.filter(f => f.kind === 'proposal' && f.relPath.startsWith(`${stagedDirFor(rel)}/`)).map(f => f.relPath.split('/').at(-1)!);
        if (staged.length > 0) {
          const rendered = staged
            .map((name) => {
              const ptext = safeRead(`${stagedDirFor(rel)}/${name}`);
              if (ptext === null) return '';
              const p = parseProposal(ptext);
              const ops = p.ops.map((o) => `<li class="check todo"><span class="mark">·</span><span class="c-main"><code>${esc(o.raw)}</code></span></li>`).join('');
              const body = proseBlocks(p.body, 'summary-text', wiki);
              return `<section class="block"><div class="block-label">proposal · ${esc(name)}</div>
                <div class="rows" style="padding:12px 16px">
                  <div class="rows-note" style="margin-top:0">by <b>${esc(fmGet(p.fm, 'author') ?? '?')}</b> · ${esc(fmGet(p.fm, 'updated') ?? '')}</div>
                  <ul class="checklist" style="border:none">${ops}</ul>
                  <div class="proposal-body">${body}</div>
                </div></section>`;
            })
            .join('');
          stagedHtml = `<div class="banner"><b>${staged.length} staged proposal(s) pending</b> — arbitrate before other work (<code>arbiter arbitrate ${esc(dir)}/${esc(id)}</code>)</div>${rendered}`;
        }

        const childResults = discover(snapshot, { ...optionsFromUrl(), tiers: '2', parent: `${dir}/${id}` }, now);
        const subLabel = dir === 'tasks' ? 'Sub-tasks' : 'Children';
        const subHtml = `<section class="block"><div class="block-label">${subLabel} · derived</div>
          <p><a href="/search?tiers=2&amp;parent=${encodeURIComponent(`${dir}/${id}`)}">Filter children or include archives</a></p>
          ${paging(childResults, url.pathname)}${discoveryRows(childResults.results)}
          ${agentView('children.json', JSON.stringify(childResults, null, 2))}</section>`;
        const deps = dependencies(snapshot, `${dir}/${id}`);
        const depPage = Number(url.searchParams.get('page') ?? 0), depSize = Number(url.searchParams.get('page-size') ?? 10);
        const depRows = deps.slice(depPage * depSize, (depPage + 1) * depSize);
        const depResult = { ...childResults, total: deps.length, results: [], nextPage: (depPage + 1) * depSize < deps.length ? depPage + 1 : null };
        const dependencyHtml = deps.length ? `<section class="block"><div class="block-label">Dependencies and start predicates</div>
          ${paging(depResult, url.pathname)}<ul>${depRows.map(d => `<li>${d.source ? `<a href="${targetHref(d.source)}">${esc(d.source)}</a> · ` : ''}${esc(compact(d.reason))}</li>`).join('')}</ul>
          ${agentView('dependencies.json', JSON.stringify({ total: deps.length, page: depPage, pageSize: depSize, nextPage: depResult.nextPage, results: depRows }, null, 2))}</section>` : '';

        const body = `
          ${crumbRow([{ label: 'Dashboard', href: '/' }, { label: dir, href: `/dir/${esc(dir)}` }, { label: id }], rel)}
          <div class="view-head">${statusPill(fmGet(ast.fm, 'status'))}${facts.find(f => f.relPath === rel)?.review ? `<span class="pill needs-review">review: ${esc(facts.find(f => f.relPath === rel)!.review!)}</span>` : ''}<h1>${esc(title)}</h1></div>
          <div class="item-meta">${meta.join('')}</div>
          ${rawNote}${stagedHtml}${targetDiagnostics(rel)}${checkpointHtml(checkpointSummary(snapshot, `${dir}/${id}`))}${dependencyHtml}
          ${dir === 'tasks' && ['0.4.15', '0.4.16', '0.4.17'].includes(protocol) ? inputPanel(`${dir}/${id}`, handoffs.token, esc) : ''}
          ${dir === 'tasks' && ['0.4.11', '0.4.12', '0.4.13', '0.4.14', '0.4.15', '0.4.16', '0.4.17'].includes(protocol) ? handoffPanel(`${dir}/${id}`, fmGet(ast.fm, 'owner') ?? 'unassigned', handoffs.token, esc) : ''}
          ${dir === 'people' ? `<section class="block"><h2>Connected work</h2>${facts.filter(f => f.dir === 'tasks').flatMap(f => inputRelationships(dataDir, f.ref).filter(e => e.entity === `${dir}/${id}`).map(e => `<p><a href="${targetHref(f.relPath)}">${esc(f.title)}</a> · ${esc(e.role)}</p>`)).join('') || '<p>No accessible connections.</p>'}</section>` : ''}
          ${ast.sections.map((sec) => renderSection(sec, wiki)).join('')}
          ${subHtml}
          ${agentView(rel, text)}`;
        return page(title, `/item/${dir}/${id}`, facts, body, dashStamp());
      };

      const renderDoc = (facts: ItemFacts[], wiki: WikiIndex, dir: string, id: string, docId: string): string | null => {
        const rel = `${dir}/${id}/${docId}.md`;
        const text = safeRead(rel);
        if (text === null) return null;
        const ast = parseItemFile(text, sourceLines.get(rel)); // doc bodies render fine through the section renderer
        const title = ast.title ?? docId;
        const body = `
          ${crumbRow(
            [{ label: 'Dashboard', href: '/' }, { label: dir, href: `/dir/${esc(dir)}` }, { label: id, href: `/item/${esc(dir)}/${esc(id)}` }, { label: docId }],
            rel,
          )}
          <div class="view-head"><span class="tag">${esc(fmGet(ast.fm, 'kind') ?? 'doc')}</span><h1>${esc(title)}</h1></div>
          <div class="view-sub">Tier 3 — read-mostly; appends go under a dated heading</div>
          <div class="doc-body">${ast.sections.map((sec) => renderSection(sec, wiki)).join('')}</div>
          ${agentView(rel, text)}`;
        return page(title, `/doc/${dir}/${id}/${docId}`, facts, body, dashStamp());
      };

      const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (seg[0] === 'active' && seg.length === 1) {
        const pageNumber = Number(url.searchParams.get('page') ?? 0), pageSize = 20;
        if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) return send(400, 'Invalid page');
        const active = facts.filter(f => f.kind === 'work-item' && !f.archived && !isTerminal(f.status)).sort(compareItems);
        const pendingCount = (task: string) => { try { return inputReviewView(dataDir, task).pending.length; } catch { return null; } };
        const rows = active.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize).map(f => ({
          ref: f.ref, title: f.title, status: f.status, parent: f.parent, checkpoint: checkpointSummary(snapshot, f.ref),
          pending: f.dir === 'tasks' && ['0.4.15', '0.4.16', '0.4.17'].includes(protocol) ? pendingCount(f.ref) : 0,
        }));
        const result = { total: active.length, page: pageNumber, pageSize, nextPage: (pageNumber + 1) * pageSize < active.length ? pageNumber + 1 : null, results: rows };
        if (url.searchParams.get('format') === 'json') return send(200, JSON.stringify(result), 'application/json; charset=utf-8');
        return send(200, page('All active work', '/active', facts, `<h1>All active work</h1><p>${result.total} active goals and tasks, including nested work.</p>
          ${pageNumber ? `<a href="/active?page=${pageNumber - 1}">Previous</a>` : ''}
          ${rows.map(r => `<article class="block"><a href="/item/${esc(r.ref)}">${esc(r.title)}</a> ${statusPill(r.status)}${r.parent ? `<p>Parent: <a href="/item/${esc(r.parent)}">${esc(r.parent)}</a></p>` : ''}<p>${r.pending === null ? 'Input review requires reconciliation' : `${r.pending} actionable inputs`}</p>${checkpointHtml(r.checkpoint)}</article>`).join('')}
          ${result.nextPage !== null ? `<a href="/active?page=${result.nextPage}">Next</a>` : ''}`, dashStamp()));
      }
      if (seg[0] === 'search' && seg.length === 1) {
        try { return renderDiscovery(); } catch { return send(400, 'Invalid discovery options.', 'text/plain'); }
      }
      if (seg.length === 0) return send(200, renderDashboard(facts));
      if (seg[0] === 'protocol') {
        const t = safeRead('PROTOCOL.md');
        if (t === null) return send(404, page('404', '/protocol', facts, '<h1>No PROTOCOL.md</h1>', dashStamp()));
        return send(
          200,
          page('Protocol', '/protocol', facts, `<div class="view-head"><h1>PROTOCOL.md</h1></div>
            <div class="view-sub">The agent contract — read once per session; every file's pointer line names its section here</div>
            <pre>${esc(t)}</pre>`, dashStamp()),
        );
      }
      if (seg[0] === 'raw') {
        const t = safeRead(seg.slice(1).join('/'));
        return t === null ? send(404, 'not found', 'text/plain') : send(200, t, 'text/plain; charset=utf-8');
      }
      if (seg[0] === 'dir' && seg.length === 2 && (ITEM_DIRS as readonly string[]).includes(seg[1]!)) {
        try { return renderDiscovery(seg[1]!); } catch { return send(400, 'Invalid discovery options.', 'text/plain'); }
      }
      if (seg[0] === 'item' && seg.length === 3) {
        try { discoveryOptions(optionsFromUrl()); }
        catch { return send(400, 'Invalid discovery options.', 'text/plain'); }
        const html = renderItem(facts, wikiNow(), seg[1]!, seg[2]!);
        return html === null ? send(404, page('404', url.pathname, facts, '<h1>No such item</h1>', dashStamp())) : send(200, html);
      }
      if (seg[0] === 'doc' && seg.length === 4) {
        const html = renderDoc(facts, wikiNow(), seg[1]!, seg[2]!, seg[3]!);
        return html === null ? send(404, page('404', url.pathname, facts, '<h1>No such document</h1>', dashStamp())) : send(200, html);
      }
      return send(404, page('404', url.pathname, facts, '<h1>404</h1><p><a href="/">back to the dashboard</a></p>', dashStamp()));
    } catch (err) {
      return send(500, 'Unable to read the current projection.', 'text/plain');
    }
  });
}

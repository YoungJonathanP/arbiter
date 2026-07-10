// `arbiter serve` — the v0.6 renderer's read-only scaffold, pulled forward for
// the dogfood trial: visual inspection of a live arbiter-data directory.
//
// Visual design carried from prototype/dashboard.html (tokens, topbar with
// hamburger + status legend, card board, sidenav, item blocks, agent view).
//
// Deliberately local-only: binds 127.0.0.1, serves nothing to a public
// audience, writes nothing. Every request re-reads the files (no cache, no
// watcher) — refresh the browser and you see the current truth. One
// normalization path: rendering goes through the same core parser the CLI
// and validator use.

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { listStaged, stagedDirFor, walkCorpus } from '../core/corpus.js';
import { extractFacts, isTerminal, type ItemFacts } from '../core/facts.js';
import { fmGet } from '../core/fm.js';
import { ITEM_DIRS } from '../core/model.js';
import { parseDashboard, parseItemFile, parseProposal } from '../core/parse.js';
import { SchemaSet } from '../core/schema.js';
import type { Section } from '../core/model.js';

const MARK_TO_STATUS: Record<string, string> = { ' ': 'todo', '~': 'in-flight', '!': 'blocked', x: 'done' };
const CHECK_GLYPH: Record<string, string> = { done: '✓', 'in-flight': '◐', blocked: '!', todo: '○' };
const CARD_LABELS: Record<string, string> = {
  tasks: 'Tasks',
  goals: 'Goals',
  meetings: 'Meetings',
  journal: 'Journal',
  accomplishments: 'Accomplishments',
};

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

/** Escape, then turn md-links into anchors and backtick spans into <code>. */
function prose(line: string): string {
  let s = esc(line);
  s = s.replace(/\[([^\]]*)\]\(([^)\s][^)]*)\)/g, (_m, label: string, target: string) => {
    const ext = /^https?:\/\//.test(target);
    return `<a href="${targetHref(target)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function statusPill(status: string | undefined): string {
  if (!status) return '';
  const cls = esc(status);
  return `<span class="pill ${cls}"><i class="dot ${cls}"></i>${cls}</span>`;
}

function dot(status: string | undefined): string {
  return `<i class="dot ${status ? esc(status) : 'logged'}"></i>`;
}

const CSS = `
  :root {
    --bg:#faf9f6; --panel:#ffffff; --panel-hover:#f5f3ee; --ink:#26241f;
    --muted:#6e6a61; --faint:#8a8578; --neutral:#8a8578;
    --line:#e7e3da; --line-strong:#d8d3c6;
    --accent:#8a6d26; --accent-soft:#f3ecdb;
    --done:#2e7d4f; --flight:#2563eb; --blocked:#c0392b; --dropped:#c65a11; --needs-review:#7c3aed;
    --todo:#ffffff; --todo-ring:#cfcabd; --todo-mark:#b3ada0; --code-bg:#f4f2ec;
    --shadow: 0 1px 2px rgba(38,36,31,.05), 0 4px 14px rgba(38,36,31,.05);
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
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 4px 14px rgba(0,0,0,.25);
    }
  }
  * { box-sizing:border-box; } html,body { margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:15px;
         line-height:1.55; -webkit-font-smoothing:antialiased; }
  a { color:var(--accent); text-decoration:none; } a:hover { text-decoration:underline; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:2px; }
  h1,h2,h3 { font-family:var(--serif); font-weight:600; text-wrap:balance; margin:0; }
  .wrap { max-width:1240px; margin:0 auto; padding:0 28px 80px; }

  .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
            padding:22px 0 16px; border-bottom:1px solid var(--line); margin-bottom:24px; }
  .topbar-left { display:flex; align-items:center; gap:14px; }
  .nav-toggle { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px;
                border-radius:6px; cursor:pointer; border:1px solid var(--line-strong);
                background:var(--panel); color:var(--muted); font-size:14px; line-height:1; font-family:var(--sans); }
  .nav-toggle:hover { background:var(--panel-hover); color:var(--accent); }
  .wordmark { display:flex; align-items:center; gap:11px; color:var(--ink); }
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

  .layout { display:flex; gap:30px; align-items:flex-start; }
  .sidenav { width:224px; flex:none; position:sticky; top:16px; max-height:calc(100vh - 32px);
             overflow-y:auto; padding:2px 0 24px; font-size:13px; }
  .layout.nav-collapsed .sidenav { display:none; }
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
  .nav-sep { border:none; border-top:1px solid var(--line); margin:10px 10px; }
  main { flex:1; min-width:0; }

  .board-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
  .board-head h1 { font-size:26px; }
  .board-head .sub { color:var(--muted); font-size:13.5px; }
  .board-meta { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:18px;
                font-family:var(--mono); font-size:12px; color:var(--muted); }
  .board-meta b { color:var(--ink); font-weight:600; }
  .board { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px; }
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

  .crumbs { font-size:12.5px; color:var(--faint); margin:2px 0 14px; }
  .crumbs a { color:var(--muted); }
  .crumbs .sep { margin:0 6px; color:var(--line-strong); }
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
  .summary-text { max-width:68ch; font-size:15px; color:var(--ink); margin:0 0 10px; }
  .human-note { max-width:68ch; font-size:12.5px; color:var(--faint); margin:8px 0 0; }
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
  .check.done .label { color:var(--muted); text-decoration:line-through; text-decoration-color:var(--line-strong); }
  .check .c-main { min-width:0; }
  .check .blocker { display:block; font-size:12.5px; color:var(--blocked); margin-top:2px; }
  .check .blocker a { color:var(--blocked); font-weight:600; text-decoration:underline;
                      text-decoration-color:color-mix(in srgb, var(--blocked) 40%, transparent); }
  .check .c-links { display:block; font-size:12.5px; margin-top:2px; }

  .link-rows { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .link-row { display:flex; align-items:baseline; gap:10px; }
  .tag { font-family:var(--mono); font-size:10.5px; text-transform:uppercase; letter-spacing:.06em;
         color:var(--muted); background:color-mix(in srgb, var(--neutral) 12%, transparent);
         padding:1.5px 7px; border-radius:4px; flex:none; min-width:44px; text-align:center; }
  .archived-flag { font-family:var(--mono); font-size:10.5px; color:var(--faint);
                   border:1px solid var(--line-strong); padding:1px 7px; border-radius:4px; }

  .doc-body { max-width:70ch; }
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
  }
`;

const NAV_JS = `
  (function () {
    var t = document.getElementById('nav-toggle');
    var l = document.getElementById('layout');
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
  const groups = ITEM_DIRS.map((d) => {
    const items = facts.filter((f) => f.dir === d && !f.archived);
    const rows = items
      .map(
        (f) =>
          `<a class="nav-item${activePath === `/item/${f.dir}/${f.id}` ? ' active' : ''}" href="/item/${esc(f.dir)}/${esc(f.id)}">
             ${dot(f.status)}<span class="n-title">${esc(f.title)}</span></a>`,
      )
      .join('');
    const active = activePath.startsWith(`/item/${d}/`) || activePath === `/dir/${d}`;
    return `<details class="nav-group${active ? ' active' : ''}"${active || items.length > 0 ? ' open' : ''}>
      <summary><a class="n-label" href="/dir/${d}">${CARD_LABELS[d]}</a><span class="n-count">${items.length}</span></summary>
      <div class="nav-items">${rows || `<span class="nav-item">—</span>`}</div></details>`;
  }).join('');
  return `<a class="nav-link${activePath === '/' ? ' active' : ''}" href="/">Dashboard</a>
    ${groups}
    <hr class="nav-sep">
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
<div class="wrap">
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
<script>${NAV_JS}</script></body></html>`;
}

function crumbs(parts: { label: string; href?: string }[]): string {
  return `<nav class="crumbs">${parts
    .map((p) => (p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : esc(p.label)))
    .join('<span class="sep">/</span>')}</nav>`;
}

function renderSection(s: Section): string {
  const label = s.heading === '' ? '' : `<div class="block-label">${esc(s.heading)}</div>`;
  let body: string;
  switch (s.kind) {
    case 'prose':
    case 'malformed': {
      if (s.kind === 'malformed') {
        body = `<div class="banner">off-grammar section, preserved verbatim</div><pre>${esc(s.lines.join('\n'))}</pre>`;
        break;
      }
      const paras: string[][] = [[]];
      for (const l of s.lines) {
        if (l === '') paras.push([]);
        else paras[paras.length - 1]!.push(l);
      }
      body = paras
        .filter((p) => p.length)
        .map((p) => `<p class="summary-text">${p.map(prose).join('<br>')}</p>`)
        .join('');
      break;
    }
    case 'checklist':
      body =
        `<ul class="checklist">` +
        s.steps
          .map((st) => {
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
              <span class="c-main"><span class="label">${prose(st.text)}</span>${blockers}${sees ? `<span class="c-links">see: ${sees}</span>` : ''}</span></li>`;
          })
          .join('') +
        `</ul>`;
      break;
    case 'links':
      body =
        `<ul class="link-rows">` +
        s.entries
          .map((e) => {
            const ext = /^https?:\/\//.test(e.target);
            return `<li class="link-row"><span class="tag">${esc(e.kindLabel)}</span><a href="${targetHref(e.target)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(e.label)}</a></li>`;
          })
          .join('') +
        `</ul>`;
      break;
    case 'docs':
      body =
        `<ul class="link-rows">` +
        s.entries
          .map(
            (e) =>
              `<li class="link-row"><span class="tag">${esc(e.docKind)}</span><a href="${targetHref(e.relPath)}">${esc(e.title)}</a></li>`,
          )
          .join('') +
        `</ul>`;
      break;
  }
  return `<section class="block">${label}${body}</section>`;
}

export function createArbiterServer(dataDir: string): http.Server {
  const safeRead = (rel: string): string | null => {
    const abs = path.resolve(dataDir, ...rel.split('/'));
    if (!abs.startsWith(path.resolve(dataDir) + path.sep)) return null; // no traversal
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    return fs.readFileSync(abs, 'utf8');
  };

  const factsNow = (): ItemFacts[] => extractFacts(dataDir, walkCorpus(dataDir), SchemaSet.load(dataDir));

  const dashStamp = (): string => {
    const text = safeRead('DASHBOARD.md');
    if (text === null) return `<span>read-only scaffold · local only · files are truth</span>`;
    const fm = parseDashboard(text).fm;
    return `updated <b>${esc(fmGet(fm, 'updated') ?? '?')}</b> · protocol <b>${esc(fmGet(fm, 'protocol') ?? '?')}</b>`;
  };

  const renderDashboard = (facts: ItemFacts[]): string => {
    const text = safeRead('DASHBOARD.md');
    if (text === null) {
      return page('Dashboard', '/', facts, `<h1>Dashboard</h1><div class="banner">No DASHBOARD.md — run <code>arbiter regen</code>.</div>`, dashStamp());
    }
    const dash = parseDashboard(text);
    const meta = dash.fm
      ? `<div class="board-meta">
           <span>updated <b>${esc(fmGet(dash.fm, 'updated') ?? '?')}</b></span>
           <span>generated <b>${esc(fmGet(dash.fm, 'generated') ?? '?')}</b></span>
           <span>protocol <b>${esc(fmGet(dash.fm, 'protocol') ?? '?')}</b></span>
         </div>`
      : '';
    const cards = dash.cards
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
            return `<li class="card-item${done}"><a href="${targetHref(e.relPath)}">${dot(e.status)}
              <span class="title">${esc(e.title)}</span>${staged}<span class="when">${esc(e.date)}</span></a></li>`;
          })
          .join('');
        return `<article class="card">
          <a class="card-head" href="/dir/${esc(dir)}"><span class="card-title">${esc(c.label)}</span><span class="card-count">${c.count}</span></a>
          <ul class="card-items">${rows || `<li class="empty">empty</li>`}</ul>${overflowHtml}</article>`;
      })
      .join('');
    const body = `
      <div class="board-head"><h1>Dashboard</h1>
        <span class="sub">Tier 1 — read-only scaffold · local only · files are truth</span></div>
      ${meta}
      <div class="board">${cards}</div>
      ${agentView('DASHBOARD.md', text)}`;
    return page('Dashboard', '/', facts, body, dashStamp());
  };

  const renderItem = (facts: ItemFacts[], dir: string, id: string): string | null => {
    const rel = `${dir}/${id}.md`;
    const text = safeRead(rel);
    if (text === null) return null;
    const ast = parseItemFile(text);
    const title = fmGet(ast.fm, 'title') ?? ast.title ?? id;

    const meta: string[] = [`<span class="kind">${esc(fmGet(ast.fm, 'type') ?? dir)}</span>`];
    for (const key of ['started', 'eta', 'due', 'date', 'created', 'updated', 'archived'] as const) {
      const v = fmGet(ast.fm, key);
      if (v !== undefined) meta.push(`<span class="when">${key} ${esc(v)}</span>`);
    }
    for (const key of ['parent', 'prev', 'source', 'related'] as const) {
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
    const staged = listStaged(dataDir, rel);
    if (staged.length > 0) {
      const rendered = staged
        .map((name) => {
          const ptext = safeRead(`${stagedDirFor(rel)}/${name}`);
          if (ptext === null) return '';
          const p = parseProposal(ptext);
          const ops = p.ops.map((o) => `<li class="check todo"><span class="mark">·</span><span class="c-main"><code>${esc(o.raw)}</code></span></li>`).join('');
          const body = p.body.filter((l) => l !== '').map(prose).join('<br>');
          return `<section class="block"><div class="block-label">proposal · ${esc(name)}</div>
            <div class="rows" style="padding:12px 16px">
              <div class="rows-note" style="margin-top:0">by <b>${esc(fmGet(p.fm, 'author') ?? '?')}</b> · ${esc(fmGet(p.fm, 'updated') ?? '')}</div>
              <ul class="checklist" style="border:none">${ops}</ul>
              <p class="summary-text" style="font-size:13.5px">${body}</p>
            </div></section>`;
        })
        .join('');
      stagedHtml = `<div class="banner"><b>${staged.length} staged proposal(s) pending</b> — arbitrate before other work (<code>arbiter arbitrate ${esc(dir)}/${esc(id)}</code>)</div>${rendered}`;
    }

    const body = `
      ${crumbs([{ label: 'Dashboard', href: '/' }, { label: dir, href: `/dir/${esc(dir)}` }, { label: id }])}
      <div class="view-head">${statusPill(fmGet(ast.fm, 'status'))}<h1>${esc(title)}</h1></div>
      <div class="item-meta">${meta.join('')}</div>
      ${rawNote}${stagedHtml}
      ${ast.sections.map(renderSection).join('')}
      ${agentView(rel, text)}`;
    return page(title, `/item/${dir}/${id}`, facts, body, dashStamp());
  };

  const renderDoc = (facts: ItemFacts[], dir: string, id: string, docId: string): string | null => {
    const rel = `${dir}/${id}/${docId}.md`;
    const text = safeRead(rel);
    if (text === null) return null;
    const ast = parseItemFile(text); // doc bodies render fine through the section renderer
    const title = ast.title ?? docId;
    const body = `
      ${crumbs([{ label: 'Dashboard', href: '/' }, { label: dir, href: `/dir/${esc(dir)}` }, { label: id, href: `/item/${esc(dir)}/${esc(id)}` }, { label: docId }])}
      <div class="view-head"><span class="tag">${esc(fmGet(ast.fm, 'kind') ?? 'doc')}</span><h1>${esc(title)}</h1></div>
      <div class="view-sub">Tier 3 — read-mostly; appends go under a dated heading</div>
      <div class="doc-body">${ast.sections.map(renderSection).join('')}</div>
      ${agentView(rel, text)}`;
    return page(title, `/doc/${dir}/${id}/${docId}`, facts, body, dashStamp());
  };

  const renderDir = (facts: ItemFacts[], dir: string): string => {
    const all = facts
      .filter((f) => f.dir === dir)
      .sort((a, b) => ((a.date ?? a.updatedDate ?? '') < (b.date ?? b.updatedDate ?? '') ? 1 : -1));
    const active = all.filter((f) => !f.archived);
    const archived = all.filter((f) => f.archived);
    const row = (f: ItemFacts) => `
      <a class="row${f.status ? '' : ' no-status'}" href="/item/${esc(f.dir)}/${esc(f.id)}">
        ${f.status ? statusPill(f.status) : ''}
        <span class="r-main"><span class="r-title">${esc(f.title)}</span>
          ${f.stagedCount ? `<span class="staged-chip">${f.stagedCount} staged</span>` : ''}
          ${f.archived ? `<span class="archived-flag">archived ${esc(f.archived)}</span>` : ''}</span>
        <span class="r-when">${esc(f.date ?? f.updatedDate ?? '')}</span></a>`;
    const body = `
      ${crumbs([{ label: 'Dashboard', href: '/' }, { label: dir }])}
      <div class="view-head"><h1>${esc(CARD_LABELS[dir] ?? dir)}</h1><span class="card-count">${active.length}</span></div>
      <div class="view-sub">Tier 2 — recency view; archived objects are flagged below, reports still read them</div>
      <div class="rows">${active.map(row).join('') || `<div class="empty">empty</div>`}</div>
      ${
        archived.length
          ? `<div class="rows-note">archived (a flag, never a move)</div><div class="rows">${archived.map(row).join('')}</div>`
          : ''
      }`;
    return page(dir, `/dir/${dir}`, facts, body, dashStamp());
  };

  return http.createServer((req, res) => {
    const send = (code: number, body: string, type = 'text/html; charset=utf-8') => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const facts = factsNow();
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
        return send(200, renderDir(facts, seg[1]!));
      }
      if (seg[0] === 'item' && seg.length === 3) {
        const html = renderItem(facts, seg[1]!, seg[2]!);
        return html === null ? send(404, page('404', url.pathname, facts, '<h1>No such item</h1>', dashStamp())) : send(200, html);
      }
      if (seg[0] === 'doc' && seg.length === 4) {
        const html = renderDoc(facts, seg[1]!, seg[2]!, seg[3]!);
        return html === null ? send(404, page('404', url.pathname, facts, '<h1>No such document</h1>', dashStamp())) : send(200, html);
      }
      return send(404, page('404', url.pathname, facts, '<h1>404</h1><p><a href="/">back to the dashboard</a></p>', dashStamp()));
    } catch (err) {
      return send(500, `<pre>${esc(String(err))}</pre>`);
    }
  });
}

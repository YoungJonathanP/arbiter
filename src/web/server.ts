// `arbiter serve` — the v0.6 renderer's read-only scaffold, pulled forward for
// the dogfood trial: visual inspection of a live arbiter-data directory.
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

const STATUS_COLORS: Record<string, string> = {
  todo: '#8a8578',
  'in-flight': '#3b6ea5',
  blocked: '#e5675f',
  done: '#5a8a4a',
  dropped: '#c65a11',
  'needs-review': '#8a5aa5',
};

const MARK_GLYPHS: Record<string, [string, string]> = {
  ' ': ['○', '#8a8578'],
  '~': ['◐', '#3b6ea5'],
  '!': ['⚠', '#e5675f'],
  x: ['●', '#5a8a4a'],
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
  const c = STATUS_COLORS[status] ?? '#8a8578';
  return `<span class="pill" style="border-color:${c};color:${c}">${esc(status)}</span>`;
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Arbiter</title>
<style>
  :root { --bg:#faf9f6; --panel:#ffffff; --line:#e8e6e1; --ink:#3d3a33; --dim:#8a8578; --gold:#c9a45c; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  header { display:flex; gap:1rem; align-items:baseline; padding:.7rem 1.2rem;
           border-bottom:1px solid var(--line); background:var(--panel); flex-wrap:wrap; }
  header a { color:var(--ink); text-decoration:none; font-weight:600; }
  header a.brand { color:var(--gold); letter-spacing:.04em; }
  header .note { color:var(--dim); font-size:.8rem; margin-left:auto; }
  main { max-width: 60rem; margin: 1.2rem auto; padding: 0 1.2rem; }
  h1 { font-size:1.35rem; margin:.2rem 0 .6rem; }
  h2 { font-size:1rem; margin:1.4rem 0 .5rem; color:var(--dim);
       text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:8px;
          padding:.8rem 1rem; margin:.7rem 0; }
  .pill { display:inline-block; border:1px solid; border-radius:99px; padding:0 .55em;
          font-size:.72rem; font-weight:600; vertical-align:1px; }
  .badge { display:inline-block; background:#f3ecdb; color:#7a5a1a; border-radius:4px;
           padding:0 .45em; font-size:.72rem; font-weight:600; }
  .staged-flag { background:#fbe9e7; color:#c0392b; }
  ul.entries, ul.steps { list-style:none; margin:.3rem 0; padding:0; }
  ul.entries li { display:flex; gap:.6rem; align-items:baseline; padding:.28rem 0;
                  border-bottom:1px dashed var(--line); flex-wrap:wrap; }
  ul.entries li:last-child { border-bottom:0; }
  .date { color:var(--dim); font-size:.8rem; margin-left:auto; white-space:nowrap; }
  ul.steps li { padding:.22rem 0; }
  .cont { color:var(--dim); font-size:.86rem; padding-left:1.7em; }
  .meta { display:flex; gap:.5rem .9rem; flex-wrap:wrap; color:var(--dim); font-size:.82rem; margin:.4rem 0 .9rem; }
  .meta b { color:var(--ink); font-weight:600; }
  a { color:#3b6ea5; }
  code { background:#f0eee8; border-radius:3px; padding:0 .3em; font-size:.88em; }
  pre { background:#f5f3ee; border:1px solid var(--line); border-radius:6px;
        padding:.8rem; overflow-x:auto; font-size:.82rem; }
  .raw-link { font-size:.78rem; color:var(--dim); }
  .banner { border:1px solid #e5675f; background:#fbe9e7; color:#8a2620;
            border-radius:8px; padding:.6rem .9rem; margin:.7rem 0; }
  p { margin:.45rem 0; }
</style></head><body>
<header>
  <a class="brand" href="/">ARBITER</a>
  ${ITEM_DIRS.map((d) => `<a href="/dir/${d}">${d}</a>`).join('\n  ')}
  <a href="/protocol">protocol</a>
  <span class="note">read-only scaffold · local only · files are truth</span>
</header>
<main>${body}</main></body></html>`;
}

function renderSection(s: Section): string {
  const head = s.heading === '' ? '' : `<h2>${esc(s.heading)}</h2>`;
  switch (s.kind) {
    case 'prose': {
      const paras: string[][] = [[]];
      for (const l of s.lines) {
        if (l === '') paras.push([]);
        else paras[paras.length - 1]!.push(l);
      }
      return head + paras.filter((p) => p.length).map((p) => `<p>${p.map(prose).join('<br>')}</p>`).join('');
    }
    case 'checklist':
      return (
        head +
        `<ul class="steps">` +
        s.steps
          .map((st) => {
            const [glyph, color] = MARK_GLYPHS[st.mark] ?? ['?', '#000'];
            const anchor = st.anchor ? ` id="^${esc(st.anchor)}"` : '';
            const conts = st.continuations
              .map((c) => `<div class="cont">${esc(c.kw)}: <a href="${targetHref(c.target)}">${esc(c.label)}</a></div>`)
              .join('');
            return `<li${anchor}><span style="color:${color}">${glyph}</span> ${prose(st.text)}${conts}</li>`;
          })
          .join('') +
        `</ul>`
      );
    case 'links':
      return (
        head +
        `<ul class="steps">` +
        s.entries
          .map((e) => {
            const ext = /^https?:\/\//.test(e.target);
            return `<li>${esc(e.kindLabel)}: <a href="${targetHref(e.target)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(e.label)}</a></li>`;
          })
          .join('') +
        `</ul>`
      );
    case 'docs':
      return (
        head +
        `<ul class="steps">` +
        s.entries
          .map((e) => `<li><a href="${targetHref(e.relPath)}">${esc(e.title)}</a> <span class="badge">${esc(e.docKind)}</span></li>`)
          .join('') +
        `</ul>`
      );
    case 'malformed':
      return head + `<div class="banner">off-grammar section, preserved verbatim</div><pre>${esc(s.lines.join('\n'))}</pre>`;
  }
}

export function createArbiterServer(dataDir: string): http.Server {
  const safeRead = (rel: string): string | null => {
    const abs = path.resolve(dataDir, ...rel.split('/'));
    if (!abs.startsWith(path.resolve(dataDir) + path.sep)) return null; // no traversal
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    return fs.readFileSync(abs, 'utf8');
  };

  const factsNow = (): ItemFacts[] =>
    extractFacts(dataDir, walkCorpus(dataDir), SchemaSet.load(dataDir));

  const renderDashboard = (): string => {
    const text = safeRead('DASHBOARD.md');
    if (text === null) return page('Dashboard', `<h1>Dashboard</h1><div class="banner">No DASHBOARD.md — run <code>arbiter regen</code>.</div>`);
    const dash = parseDashboard(text);
    const meta = dash.fm
      ? `<div class="meta">
           <span>updated <b>${esc(fmGet(dash.fm, 'updated') ?? '?')}</b></span>
           <span>generated <b>${esc(fmGet(dash.fm, 'generated') ?? '?')}</b></span>
           <span>protocol <b>${esc(fmGet(dash.fm, 'protocol') ?? '?')}</b></span>
           <span class="raw-link"><a href="/raw/DASHBOARD.md">view as agent</a></span>
         </div>`
      : '';
    const cards = dash.cards
      .map((c) => {
        const rows = c.rows
          .map((r) => {
            if (r.kind === 'overflow') return `<li><a href="/dir/${esc(r.dir)}">+${r.count} more in ${esc(r.dir)}/</a></li>`;
            if (r.kind === 'stray') return `<li><span class="badge">hand-added</span> ${prose(r.line)}</li>`;
            const e = r.entry;
            const staged = e.stagedCount ? `<span class="badge staged-flag">${e.stagedCount} staged</span>` : '';
            return `<li>${statusPill(e.status)}${staged}<a href="${targetHref(e.relPath)}">${esc(e.title)}</a><span class="date">${esc(e.date)}</span></li>`;
          })
          .join('');
        return `<div class="card"><h2>${esc(c.label)} (${c.count})</h2><ul class="entries">${rows}</ul></div>`;
      })
      .join('');
    return page('Dashboard', `<h1>Dashboard</h1>${meta}${cards}`);
  };

  const renderItem = (dir: string, id: string): string | null => {
    const rel = `${dir}/${id}.md`;
    const text = safeRead(rel);
    if (text === null) return null;
    const ast = parseItemFile(text);
    const title = fmGet(ast.fm, 'title') ?? ast.title ?? id;
    const chips: string[] = [];
    for (const key of ['type', 'started', 'eta', 'due', 'date', 'created', 'updated', 'archived'] as const) {
      const v = fmGet(ast.fm, key);
      if (v !== undefined) chips.push(`<span>${key} <b>${esc(v)}</b></span>`);
    }
    for (const key of ['parent', 'prev', 'source', 'related'] as const) {
      const v = fmGet(ast.fm, key);
      if (v !== undefined)
        chips.push(
          `<span>${key} ${v
            .split(',')
            .map((r) => `<a href="${targetHref(r.trim())}">${esc(r.trim())}</a>`)
            .join(', ')}</span>`,
        );
    }
    const priv = fmGet(ast.fm, 'visibility') === 'private' ? `<span class="badge">private</span>` : '';
    const rawNote = ast.fm === null ? `<div class="banner">raw human entry — valid; normalization structures it on first touch</div>` : '';

    // staged proposals are the most urgent thing on the page
    let stagedHtml = '';
    const staged = listStaged(dataDir, rel);
    if (staged.length > 0) {
      const rendered = staged
        .map((name) => {
          const ptext = safeRead(`${stagedDirFor(rel)}/${name}`);
          if (ptext === null) return '';
          const p = parseProposal(ptext);
          const ops = p.ops.map((o) => `<li><code>${esc(o.raw)}</code></li>`).join('');
          const body = p.body.filter((l) => l !== '').map(prose).join('<br>');
          return `<div class="card"><b>${esc(name)}</b> · by ${esc(fmGet(p.fm, 'author') ?? '?')} · ${esc(fmGet(p.fm, 'updated') ?? '')}
                  <ul class="steps">${ops}</ul><p>${body}</p></div>`;
        })
        .join('');
      stagedHtml = `<div class="banner"><b>${staged.length} staged proposal(s) pending</b> — arbitrate before other work (<code>arbiter arbitrate ${esc(dir)}/${esc(id)}</code>)</div>${rendered}`;
    }

    const sections = ast.sections.map(renderSection).join('');
    return page(
      title,
      `<h1>${statusPill(fmGet(ast.fm, 'status'))} ${esc(title)} ${priv}</h1>
       <div class="meta">${chips.join('')}<span class="raw-link"><a href="/raw/${esc(rel)}">view as agent</a></span></div>
       ${rawNote}${stagedHtml}${sections}`,
    );
  };

  const renderDoc = (dir: string, id: string, docId: string): string | null => {
    const rel = `${dir}/${id}/${docId}.md`;
    const text = safeRead(rel);
    if (text === null) return null;
    const ast = parseItemFile(text); // doc bodies render fine through the item section renderer
    const title = ast.title ?? docId;
    return page(
      title,
      `<h1>${esc(title)}</h1>
       <div class="meta"><span>tier 3 · owned by <a href="/item/${esc(dir)}/${esc(id)}">${esc(id)}</a></span>
       <span class="raw-link"><a href="/raw/${esc(rel)}">view as agent</a></span></div>
       ${ast.sections.map(renderSection).join('')}`,
    );
  };

  const renderDir = (dir: string): string => {
    const facts = factsNow()
      .filter((f) => f.dir === dir)
      .sort((a, b) => ((a.date ?? a.updatedDate ?? '') < (b.date ?? b.updatedDate ?? '') ? 1 : -1));
    const active = facts.filter((f) => !f.archived);
    const archived = facts.filter((f) => f.archived);
    const row = (f: ItemFacts) =>
      `<li>${statusPill(f.status)}${f.stagedCount ? `<span class="badge staged-flag">${f.stagedCount} staged</span>` : ''}
       <a href="/item/${esc(f.dir)}/${esc(f.id)}">${esc(f.title)}</a>
       ${f.archived ? `<span class="badge">archived ${esc(f.archived)}</span>` : ''}
       <span class="date">${esc(f.date ?? f.updatedDate ?? '')}</span></li>`;
    return page(
      dir,
      `<h1>${esc(dir)}/ (${active.length})</h1>
       <div class="card"><ul class="entries">${active.map(row).join('') || '<li>empty</li>'}</ul></div>
       ${archived.length ? `<h2>archived (reports still see these)</h2><div class="card"><ul class="entries">${archived.map(row).join('')}</ul></div>` : ''}`,
    );
  };

  return http.createServer((req, res) => {
    const send = (code: number, body: string, type = 'text/html; charset=utf-8') => {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (seg.length === 0) return send(200, renderDashboard());
      if (seg[0] === 'protocol') {
        const t = safeRead('PROTOCOL.md');
        return t === null ? send(404, page('404', '<h1>No PROTOCOL.md</h1>')) : send(200, page('Protocol', `<h1>PROTOCOL.md</h1><pre>${esc(t)}</pre>`));
      }
      if (seg[0] === 'raw') {
        const t = safeRead(seg.slice(1).join('/'));
        return t === null ? send(404, 'not found', 'text/plain') : send(200, t, 'text/plain; charset=utf-8');
      }
      if (seg[0] === 'dir' && seg.length === 2 && (ITEM_DIRS as readonly string[]).includes(seg[1]!)) {
        return send(200, renderDir(seg[1]!));
      }
      if (seg[0] === 'item' && seg.length === 3) {
        const html = renderItem(seg[1]!, seg[2]!);
        return html === null ? send(404, page('404', '<h1>No such item</h1>')) : send(200, html);
      }
      if (seg[0] === 'doc' && seg.length === 4) {
        const html = renderDoc(seg[1]!, seg[2]!, seg[3]!);
        return html === null ? send(404, page('404', '<h1>No such document</h1>')) : send(200, html);
      }
      return send(404, page('404', '<h1>404</h1><p><a href="/">back to the dashboard</a></p>'));
    } catch (err) {
      return send(500, page('error', `<h1>render error</h1><pre>${esc(String(err))}</pre>`));
    }
  });
}

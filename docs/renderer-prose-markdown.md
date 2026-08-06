# Renderer prose: markdown in, HTML out

*Decision record, 2026-08-06. Renderer-only (`src/web/server.ts`) plus one advisory
validator warning. No grammar or PROTOCOL change: prose is opaque to machines
(grammar.md §1), so how a read-only view paints it is not a spec question.*

## What was wrong

The scaffold rendered prose with two transforms- markdown links and backtick code
spans- and painted every other source line verbatim, one `<br>` per line. Two
visible consequences on a real tier-2 page:

- `**bold**`, `*italic*`, headings, lists, blockquotes and tables showed their raw
  syntax. Agents write all of them, so the summary of a live task read as markup.
- Files are hard-wrapped at ~80 columns for editing, and `<br>`-per-line froze
  that wrap into the layout. Text did not reflow to the column, and an emphasis
  span that straddled a wrap (`**uniformity\ntemplate**`) could never match.

## What it does now

`prose()` is the inline pass and `proseBlocks()` the block pass.

- **Soft newlines.** Inside a paragraph, list item or blockquote, a source newline
  is a space. Blank lines and block starts are the real breaks. This is plain
  markdown semantics and it is what makes hard-wrapped files reflow.
- **Blocks**: ATX headings (demoted two levels- the page owns its own h1/h2),
  bullet and ordered lists, blockquotes, fenced code, and GFM tables (a `|---|`
  delimiter row promotes the row above it to a header; without one every row is a
  body row, so a half-written table still reads).
- **Inline**: links, code spans, `**strong**`, `*em*`/`_em_`, `~~del~~`. Code spans
  are lifted out under a sentinel first and restored last, so `` `**not bold**` ``
  stays literal- an author quoting markdown syntax gets what they typed. Emphasis
  underscores require a non-word character on both flanks, so `SNAKE_CASE_IDENT`
  survives.
- **`plainInline()`** strips markup for the one-line previews that already sit
  inside an anchor (the sub-item rows), where a rendered link would nest anchors.

## Wikilinks

Prose across the corpus carries Logseq-style `[[bare-id]]` refs- 71 of them at the
time of writing, a habit that outlived the migration. PROTOCOL.md has exactly one
link form (a data-root-relative markdown link), so these are off-grammar.

Both halves, deliberately:

- The renderer **resolves** `[[id]]` against an index of every item and doc id, and
  links it. An id claimed by two files is dropped from the index rather than
  guessed at, and an id that resolves to nothing (`[[Disha]]`, a person page from
  the old graph) renders as bare text. A reader is never shown brackets.
- The validator **warns**, quoting the exact markdown link to write when the id
  resolves. Advisory only- warnings never fail `arbiter validate`- so the corpus
  converges as files are touched instead of demanding a bulk rewrite.

Resolving without warning would make wikilinks a de facto second link form;
warning without resolving would leave 71 dead refs on screen. Together they render
correctly today and shrink the debt over time.

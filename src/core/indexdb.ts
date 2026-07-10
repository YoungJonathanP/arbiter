// Derived SQLite index — a disposable cache over the files (gate 5: rebuilt
// twice from the same corpus it is identical; deleting it loses nothing).
// Nothing may require it to navigate; it exists to make queries cheap.

import Database from 'better-sqlite3';
import type { ItemFacts } from './facts.js';

export type IndexDb = InstanceType<typeof Database>;

const SCHEMA = `
CREATE TABLE items (
  ref TEXT PRIMARY KEY, dir TEXT NOT NULL, id TEXT NOT NULL, type TEXT NOT NULL,
  kind TEXT NOT NULL, title TEXT NOT NULL, status TEXT, updated TEXT, updated_date TEXT,
  date TEXT, due TEXT, created TEXT, archived TEXT, visibility TEXT,
  parent TEXT, prev TEXT, staged_count INTEGER NOT NULL, raw INTEGER NOT NULL, rel_path TEXT NOT NULL
);
CREATE TABLE refs (src TEXT NOT NULL, field TEXT NOT NULL, target TEXT NOT NULL);
CREATE TABLE steps (item_ref TEXT NOT NULL, idx INTEGER NOT NULL, mark TEXT NOT NULL, text TEXT NOT NULL, anchor TEXT);
CREATE TABLE docs (item_ref TEXT NOT NULL, doc_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, rel_path TEXT NOT NULL);
`;

export function buildIndex(facts: ItemFacts[], dbPath = ':memory:'): IndexDb {
  const db = new Database(dbPath);
  db.pragma('journal_mode = MEMORY');
  for (const t of ['items', 'refs', 'steps', 'docs']) db.exec(`DROP TABLE IF EXISTS ${t};`);
  db.exec(SCHEMA);
  const insertItem = db.prepare(
    `INSERT INTO items VALUES (@ref,@dir,@id,@type,@kind,@title,@status,@updated,@updated_date,@date,@due,@created,@archived,@visibility,@parent,@prev,@staged_count,@raw,@rel_path)`,
  );
  const insertRef = db.prepare(`INSERT INTO refs VALUES (?,?,?)`);
  const insertStep = db.prepare(`INSERT INTO steps VALUES (?,?,?,?,?)`);
  const insertDoc = db.prepare(`INSERT INTO docs VALUES (?,?,?,?,?)`);
  const all = db.transaction(() => {
    for (const f of [...facts].sort((a, b) => (a.ref < b.ref ? -1 : 1))) {
      insertItem.run({
        ref: f.ref,
        dir: f.dir,
        id: f.id,
        type: f.type,
        kind: f.kind,
        title: f.title,
        status: f.status ?? null,
        updated: f.updatedRaw ?? null,
        updated_date: f.updatedDate ?? null,
        date: f.date ?? null,
        due: f.due ?? null,
        created: f.created ?? null,
        archived: f.archived ?? null,
        visibility: f.visibility ?? null,
        parent: f.parent ?? null,
        prev: f.prev ?? null,
        staged_count: f.stagedCount,
        raw: f.raw ? 1 : 0,
        rel_path: f.relPath,
      });
      if (f.parent) insertRef.run(f.ref, 'parent', f.parent);
      if (f.prev) insertRef.run(f.ref, 'prev', f.prev);
      for (const r of f.related) insertRef.run(f.ref, 'related', r);
      f.steps.forEach((s, i) => insertStep.run(f.ref, i, s.mark, s.text, s.anchor ?? null));
      for (const d of f.docs) insertDoc.run(f.ref, d.docId, d.docKind, d.title, d.relPath);
    }
  });
  all();
  return db;
}

/** Canonical dump for gate-5 identity comparison. */
export function dumpIndex(db: IndexDb): string {
  const items = db.prepare(`SELECT * FROM items ORDER BY ref`).all();
  const refs = db.prepare(`SELECT * FROM refs ORDER BY src, field, target`).all();
  const steps = db.prepare(`SELECT * FROM steps ORDER BY item_ref, idx`).all();
  const docs = db.prepare(`SELECT * FROM docs ORDER BY item_ref, doc_id`).all();
  return JSON.stringify({ items, refs, steps, docs });
}

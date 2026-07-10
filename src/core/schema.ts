// Type schemas are data (types/*.md): parse them, never hardcode field sets.
// `extends` is single-inheritance to _base; effective fields = base ∪ own,
// own winning on collision (grammar §10).

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FieldDef, SectionDef, TypeSchema } from './model.js';
import { parseTypeSchema } from './parse.js';

export interface ResolvedSchema {
  name: string;
  kind: 'work-item' | 'record';
  slugForm?: string;
  fields: Map<string, FieldDef>;
  sections: Map<string, SectionDef>;
  relevance: 'active-first' | 'recent-first';
}

export class SchemaSet {
  private raw = new Map<string, TypeSchema>();
  private resolved = new Map<string, ResolvedSchema>();

  static load(dataDir: string): SchemaSet {
    const set = new SchemaSet();
    const typesDir = path.join(dataDir, 'types');
    if (!fs.existsSync(typesDir)) return set;
    for (const f of fs.readdirSync(typesDir).sort()) {
      if (!f.endsWith('.md')) continue;
      const schema = parseTypeSchema(fs.readFileSync(path.join(typesDir, f), 'utf8'));
      if (schema.schema) set.raw.set(schema.schema, schema);
    }
    return set;
  }

  names(): string[] {
    return [...this.raw.keys()].filter((n) => !n.startsWith('_'));
  }

  get(name: string): ResolvedSchema | undefined {
    if (this.resolved.has(name)) return this.resolved.get(name);
    const own = this.raw.get(name);
    if (!own || name.startsWith('_')) return undefined;
    const fields = new Map<string, FieldDef>();
    const sections = new Map<string, SectionDef>();
    const base = own.extends ? this.raw.get(own.extends) : undefined;
    if (base) for (const [k, v] of base.fields) fields.set(k, v);
    for (const [k, v] of own.fields) fields.set(k, v); // own wins on collision
    if (base) for (const [k, v] of base.sections) sections.set(k, v);
    for (const [k, v] of own.sections) sections.set(k, v);
    const r: ResolvedSchema = {
      name,
      kind: own.kind ?? 'record',
      slugForm: own.slugForm,
      fields,
      sections,
      relevance: own.relevance ?? (own.kind === 'work-item' ? 'active-first' : 'recent-first'),
    };
    this.resolved.set(name, r);
    return r;
  }
}

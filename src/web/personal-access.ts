// Host-owned, opt-in local principal policy. Never load grants from request data
// or a KB record. Keep this file outside the corpus and its exports.
import * as fs from 'node:fs';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { fmGet } from '../core/fm.js';
import { parseItemFile } from '../core/parse.js';
import type { InputAccessPolicy } from '../core/input-storage.js';
import type { Audience } from '../core/input-review.js';

export interface PersonalAccess {
  authenticate(authorization: string | undefined): string | null;
  policy: InputAccessPolicy;
}
interface Configuration {
  version: 1;
  principals: Record<string, { tokenSha256: string }>;
  readers: Record<string, string[]>;
  inherit: Record<string, string>;
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const resource = (value: string) => /^[a-z]+\/[a-z0-9][a-z0-9-]*(?:\.md|\/[a-z0-9-]+\.md(?:#[a-f0-9-]+)?)$/.test(value);

/** The local administrator changes this 0600 JSON file using ordinary filesystem
 * review/CAS. Every authentication and policy read reloads it; malformed files
 * fail closed. Credentials are SHA-256 digests of >=32-character random tokens,
 * not human passwords. Revocation invalidates pending input previews. */
export function personalAccessFile(file: string): PersonalAccess {
  function load() {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid()))
      throw new Error('Personal policy must be an owner-only regular file');
    const text = fs.readFileSync(file, 'utf8');
    const config = JSON.parse(text) as Configuration;
    if (config.version !== 1 || !config.principals || !config.readers || !config.inherit
      || [config.principals, config.readers, config.inherit].some(v => typeof v !== 'object' || Array.isArray(v))) throw new Error('Invalid personal policy');
    for (const [id, principal] of Object.entries(config.principals)) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !/^[a-f0-9]{64}$/.test(principal?.tokenSha256)) throw new Error('Invalid principal');
    }
    for (const [rel, readers] of Object.entries(config.readers)) {
      if (!resource(rel) || !Array.isArray(readers) || new Set(readers).size !== readers.length
        || readers.some(id => !Object.hasOwn(config.principals, id))) throw new Error('Invalid readers');
    }
    for (const [rel, parent] of Object.entries(config.inherit)) {
      if (!resource(rel) || !resource(parent) || Object.hasOwn(config.readers, rel)) throw new Error('Invalid inheritance');
      const seen = new Set([rel]); let next: string | undefined = parent;
      while (next) { if (seen.has(next)) throw new Error('Cyclic inheritance'); seen.add(next); next = config.inherit[next]; }
    }
    return { config, revision: hash(text) };
  }
  load();
  const policy: InputAccessPolicy = {
    get revision() { return load().revision; },
    provision(actor, resources, expectedRevision) {
      // Lock/CAS is for cooperating local administrators. Retain the exact old
      // policy outside the KB before replacement; never roll back over edits.
      const lock = `${file}.lock`; fs.mkdirSync(lock, { mode: 0o700 });
      let temporary: string | undefined;
      try {
        const before = fs.readFileSync(file, 'utf8'), { config, revision } = load();
        if (revision !== expectedRevision || hash(before) !== revision) throw new Error('Personal policy changed; refresh');
        if (!Object.hasOwn(config.principals, actor) || !resources.length || new Set(resources).size !== resources.length)
          throw new Error('Invalid personal provisioning');
        for (const rel of resources) {
          if (!resource(rel) || Object.hasOwn(config.readers, rel) || Object.hasOwn(config.inherit, rel)) throw new Error('Resource already has a policy');
          config.readers[rel] = [actor];
        }
        const history = `${file}.history-${revision}`;
        if (fs.existsSync(history)) { if (fs.readFileSync(history, 'utf8') !== before) throw new Error('Policy history differs'); }
        else fs.writeFileSync(history, before, { flag: 'wx', mode: 0o600 });
        temporary = `${file}.${randomUUID()}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        if (hash(fs.readFileSync(file, 'utf8')) !== revision) throw new Error('Personal policy changed; refresh');
        fs.renameSync(temporary, file); temporary = undefined;
        const result = load();
        if (resources.some(rel => JSON.stringify(result.config.readers[rel]) !== JSON.stringify([actor]))) throw new Error('Policy provisioning changed; reconcile');
      } finally {
        if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
        fs.rmdirSync(lock);
      }
    },
    resolve(rel, bytes): Audience {
      const { config } = load();
      // A personal grant cannot pretend a canonically shared destination is
      // private: default exports would still expose incorporated task prose.
      if (!rel.includes('#') && fmGet(parseItemFile(bytes).fm, 'visibility') !== 'private') return { kind: 'shared' };
      let target = rel;
      while (config.inherit[target]) target = config.inherit[target]!;
      const readers = config.readers[target];
      if (readers) return { kind: 'restricted', readers: [...readers] };
      // Missing inheritance target never broadens access. Audit edges have their
      // own rules; endpoint grants do not expose an association by default.
      if (target !== rel || rel.includes('#') || fmGet(parseItemFile(bytes).fm, 'visibility') === 'private')
        return { kind: 'restricted', readers: [] };
      return { kind: 'shared' };
    },
  };
  return {
    policy,
    authenticate(authorization) {
      const { config } = load();
      if (!authorization?.startsWith('Basic ')) return null;
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
      const split = decoded.indexOf(':'), id = decoded.slice(0, split), token = decoded.slice(split + 1);
      if (split < 1 || token.length < 32 || !Object.hasOwn(config.principals, id)) return null;
      return timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(config.principals[id]!.tokenSha256, 'hex')) ? id : null;
    },
  };
}

// A request/command uses one read of each corpus file. No timestamp watermark or
// persistent index can decide whether an observed fact is current.
import { walkCorpus, sha256 } from './corpus.js';
import { extractFacts } from './facts.js';
import { SchemaSet } from './schema.js';
import { visibilityPolicy, visibleFacts } from './visibility.js';

export function readProjection(dataDir: string) {
  const source = walkCorpus(dataDir, { includeHistory: false });
  const allFacts = extractFacts(dataDir, source, SchemaSet.fromFiles(source));
  const policy = visibilityPolicy(allFacts, source);
  const files = source.filter(f => policy.allowsPath(f.relPath)).map(f => ({ ...f, ...policy.redactSource(f.text) }));
  const facts = visibleFacts(extractFacts(dataDir, files, SchemaSet.fromFiles(files))).map(f => ({ ...f,
    docs: f.docs.filter(d => policy.allowsPath(d.relPath) && policy.redact(d.title) === d.title),
  }));
  const inputs = `sha256:${sha256(JSON.stringify(files.filter(f => f.relPath !== 'DASHBOARD.md').map(f => [f.relPath, f.text])))}`;
  return { facts, files, inputs };
}

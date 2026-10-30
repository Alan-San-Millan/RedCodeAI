#!/usr/bin/env node
/**
 * Ingesta fuera de línea: fragmenta knowledge/, filtra inyección, genera embeddings
 * y guarda el índice JSON.
 *
 *   npm run ingest
 *   npm run ingest -- --corpus <dir> --out <archivo>     (corpus alterno, p. ej. prueba M2)
 *   npm run ingest -- ... --keep-flagged                 (SOLO PRUEBAS: conserva los fragmentos
 *                                                         marcados, con flagged=true; el servidor
 *                                                         nunca los usa salvo RAG_TEST_MODE)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, EMBEDDING_DIMENSIONS } from '../src/config.js';
import { chunkDocument } from '../src/rag/chunking.js';
import { detectInjection } from '../src/rag/injection-filter.js';
import { embedTexts } from '../src/rag/embeddings.js';
import { loadIndex, saveIndex } from '../src/rag/index-store.js';

function parseArgs(argv) {
  const args = { corpus: 'knowledge', out: config.rag.indexPath, keepFlagged: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--corpus') args.corpus = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--keep-flagged') args.keepFlagged = true;
    else throw new Error(`Opción desconocida: ${argv[i]}`);
  }
  return args;
}

function listMarkdown(dir) {
  const files = [];
  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md') && path.relative(dir, full) !== 'README.md') files.push(full);
    }
  })(dir);
  return files.sort();
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const args = parseArgs(process.argv.slice(2));
const files = listMarkdown(args.corpus);
if (!files.length) throw new Error(`No hay archivos .md en ${args.corpus}`);

const corpusHash = sha256(files.map((f) => `${path.relative(args.corpus, f).replace(/\\/g, '/')}\n${fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')}`).join('\n\u0000\n'));
const chunks = files.flatMap((f) => chunkDocument(path.relative(args.corpus, f), fs.readFileSync(f, 'utf8')));

const duplicated = chunks.map((c) => c.id).filter((id, i, all) => all.indexOf(id) !== i);
if (duplicated.length) throw new Error(`IDs duplicados: ${[...new Set(duplicated)].join(', ')}`);

// Filtro de inyección.
const flagged = [];
for (const chunk of chunks) {
  const hits = detectInjection(chunk.text);
  if (hits.length) {
    chunk.flagged = true;
    chunk.flaggedBy = hits;
    flagged.push(chunk);
  }
}
console.log(`\nCorpus: ${args.corpus} (${files.length} archivos, ${chunks.length} fragmentos)`);
console.log(`Filtro de inyección: ${flagged.length} fragmento(s) marcado(s).`);
for (const chunk of flagged) {
  console.log(`  - ${chunk.id} [${chunk.flaggedBy.join(', ')}] (${chunk.meta.file})`);
  const line = chunk.text.split('\n').find((l) => detectInjection(l).length);
  if (line) console.log(`      «${line.trim().slice(0, 140)}»`);
}
const toIndex = args.keepFlagged ? chunks : chunks.filter((c) => !c.flagged);
if (args.keepFlagged && flagged.length) console.log('  --keep-flagged: se conservan con flagged=true (solo para pruebas).');

// Reutiliza embeddings de un índice previo si el texto del fragmento no cambió.
const previous = loadIndex(args.out);
const reusable = new Map();
if (previous && previous.model === config.rag.embeddingModel && previous.dimensions === EMBEDDING_DIMENSIONS) {
  for (const c of previous.chunks) reusable.set(`${c.id}\n${c.textHash}`, c.vector);
}

const records = toIndex.map((c) => ({
  id: c.id,
  text: c.text,
  textHash: sha256(c.text),
  tokens: c.tokens,
  meta: c.meta,
  ...(c.flagged ? { flagged: true, flaggedBy: c.flaggedBy } : {})
}));
const missing = records.filter((r) => !reusable.has(`${r.id}\n${r.textHash}`));
console.log(`Embeddings: ${records.length - missing.length} reutilizados, ${missing.length} por generar con ${config.rag.embeddingModel}.`);

const vectors = missing.length
  ? await embedTexts(missing.map((r) => r.text), 'RETRIEVAL_DOCUMENT', { onProgress: (m) => console.log(`  ${m}`) })
  : [];
missing.forEach((r, i) => reusable.set(`${r.id}\n${r.textHash}`, vectors[i]));
for (const r of records) r.vector = reusable.get(`${r.id}\n${r.textHash}`);

saveIndex(args.out, {
  model: config.rag.embeddingModel,
  dimensions: EMBEDDING_DIMENSIONS,
  normalized: true,
  taskType: 'RETRIEVAL_DOCUMENT',
  createdAt: new Date().toISOString(),
  corpus: args.corpus.replace(/\\/g, '/'),
  corpusHash,
  excluded: flagged.map((c) => ({ id: c.id, flaggedBy: c.flaggedBy, file: c.meta.file })),
  chunks: records
});
const size = (fs.statSync(args.out).size / 1024 / 1024).toFixed(2);
console.log(`Índice guardado en ${args.out} (${records.length} fragmentos, ${size} MB).\n`);

#!/usr/bin/env node
/**
 * Calibración del umbral RAG_MIN_SCORE: solo recuperación (no genera código).
 * Para cada consulta de la matriz imprime los fragmentos más cercanos por coseno y por
 * palabras clave, y guarda la salida completa en tests/rag-eval/calibration/.
 *
 *   npm run calibrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { findLanguage } from '../src/config.js';
import { loadIndex } from '../src/rag/index-store.js';
import { embedTexts } from '../src/rag/embeddings.js';
import { buildQueryText, appliesTo, createRetriever } from '../src/rag/retriever.js';
import { expandQuery } from '../src/rag/glossary.js';
import { buildBm25 } from '../src/rag/bm25.js';
import { dot } from '../src/rag/vector.js';

const index = loadIndex(config.rag.indexPath);
if (!index) throw new Error(`No existe ${config.rag.indexPath}. Corre npm run ingest.`);
const { cases } = JSON.parse(fs.readFileSync('tests/rag-eval/cases.json', 'utf8'));
const bm25 = buildBm25(index.chunks);

const queries = cases.map((c) => buildQueryText(c.query, findLanguage(c.language)));
const vectors = await embedTexts(queries, 'RETRIEVAL_QUERY', { batchSize: 10 });

const report = {
  createdAt: new Date().toISOString(),
  embeddingModel: index.model,
  indexCreatedAt: index.createdAt,
  settings: { minScore: config.rag.minScore, topK: config.rag.topK, candidates: config.rag.candidates },
  cases: []
};
for (const [i, c] of cases.entries()) {
  const language = findLanguage(c.language);
  const eligible = index.chunks.filter((ch) => appliesTo(ch, c.language) && !ch.flagged);
  const byCosine = eligible.map((ch) => ({ id: ch.id, cosine: Number(dot(vectors[i], ch.vector).toFixed(4)) }))
    .sort((a, b) => b.cosine - a.cosine);
  const keywordQuery = expandQuery(c.query);
  const keyword = bm25(keywordQuery, { limit: 8, filter: (id) => eligible.some((e) => e.id === id) });
  const cosineOf = new Map(byCosine.map((x) => [x.id, x.cosine]));
  // Selección final del recuperador real, reutilizando el vector ya calculado.
  const retrieve = createRetriever(index, { embed: async () => vectors[i], test: { mode: false, forceIds: [] } });
  const result = await retrieve({ requirement: c.query, language });
  report.cases.push({
    id: c.id,
    type: c.type,
    query: c.query,
    keywordQuery,
    topCosine: byCosine.slice(0, 10),
    topKeyword: keyword.map((k) => ({ id: k.id, bm25: Number(k.score.toFixed(3)), cosine: cosineOf.get(k.id) })),
    selected: result.fragments.map((f) => ({ id: f.id, cosine: f.cosine, rrf: f.rrf })),
    grounded: result.grounded
  });
}

const dir = 'tests/rag-eval/calibration';
fs.mkdirSync(dir, { recursive: true });
const stamp = report.createdAt.replace(/[:.]/g, '-');
fs.writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify(report, null, 2));

for (const c of report.cases) {
  console.log(`\n${c.id} (${c.type}) — ${c.query.split('\n')[0].slice(0, 80)}`);
  console.log('  coseno:  ' + c.topCosine.slice(0, 6).map((x) => `${x.cosine.toFixed(3)} ${x.id}`).join('\n           '));
  console.log(`  SELECCIÓN (umbral ${report.settings.minScore}, top ${report.settings.topK}): ${c.grounded ? c.selected.map((s) => `${s.id} (${s.cosine})`).join(', ') : 'NINGUNO → sin respaldo documental'}`);
  console.log('  BM25:    ' + (c.topKeyword.slice(0, 4).map((x) => `${x.bm25.toFixed(2)} (cos ${x.cosine.toFixed(3)}) ${x.id}`).join('\n           ') || '—'));
}
console.log(`\nSalida completa: ${path.join(dir, `${stamp}.json`)}`);

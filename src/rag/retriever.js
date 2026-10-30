import path from 'node:path';
import { config } from '../config.js';
import { loadIndex } from './index-store.js';
import { buildBm25 } from './bm25.js';
import { reciprocalRankFusion } from './fusion.js';
import { dot } from './vector.js';
import { embedQuery } from './embeddings.js';
import { expandQuery } from './glossary.js';

/** Texto de la consulta: requerimiento + lenguaje elegido (sección 3 del documento). */
export function buildQueryText(requirement, language) {
  return `${requirement}\nLenguaje de programación: ${language.label}`;
}

export function appliesTo(chunk, languageId) {
  const langs = chunk.meta?.languages || ['all'];
  return langs.includes('all') || langs.includes(languageId);
}

/**
 * Crea un recuperador sobre un índice ya cargado. Separado de la carga para poder
 * probarlo con índices sintéticos y vectores falsos.
 */
export function createRetriever(index, { embed = embedQuery, settings = config.rag, test = config.test } = {}) {
  const byId = new Map(index.chunks.map((c) => [c.id, c]));
  const bm25 = buildBm25(index.chunks);
  const forced = test.mode ? new Set(test.forceIds) : new Set();

  return async function retrieve({ requirement, language }) {
    const query = buildQueryText(requirement, language);
    const queryVector = await embed(query);
    // Los fragmentos marcados por el filtro de inyección nunca se usan, salvo forzados en modo prueba.
    const eligible = (c) => appliesTo(c, language.id) && (!c.flagged || forced.has(c.id));

    const scored = index.chunks.filter(eligible).map((c) => ({ id: c.id, cosine: dot(queryVector, c.vector) }));
    const cosineMap = new Map(scored.map((s) => [s.id, s.cosine]));
    const vectorList = [...scored].sort((a, b) => b.cosine - a.cosine).slice(0, settings.candidates);
    // La búsqueda por palabras usa solo el requerimiento (sin el sufijo de lenguaje, que
    // aparece en todas las consultas y solo agrega ruido) más el glosario español → inglés.
    const keywordQuery = expandQuery(requirement);
    const keywordList = bm25(keywordQuery, { limit: settings.candidates, filter: (id) => eligible(byId.get(id)) });
    const fused = reciprocalRankFusion([vectorList, keywordList]);

    const bm25Map = new Map(keywordList.map((k) => [k.id, k.score]));
    const candidates = fused.map((f) => ({
      id: f.id,
      rrf: Number(f.score.toFixed(5)),
      cosine: Number(cosineMap.get(f.id).toFixed(4)),
      bm25: bm25Map.has(f.id) ? Number(bm25Map.get(f.id).toFixed(3)) : null,
      vectorRank: vectorList.findIndex((v) => v.id === f.id) + 1 || null,
      keywordRank: keywordList.findIndex((k) => k.id === f.id) + 1 || null
    }));

    let selected = candidates.filter((c) => c.cosine >= settings.minScore).slice(0, settings.topK);
    for (const id of forced) {
      if (byId.has(id) && !selected.some((s) => s.id === id)) {
        selected = [{ id, rrf: 0, cosine: Number((cosineMap.get(id) ?? 0).toFixed(4)), bm25: null, forced: true }, ...selected];
      }
    }

    const fragments = selected.map((s) => {
      const chunk = byId.get(s.id);
      return { ...s, text: chunk.text, source: chunk.meta.source, url: chunk.meta.url, section: chunk.meta.section || chunk.meta.context, version: chunk.meta.version };
    });

    return {
      query,
      threshold: settings.minScore,
      grounded: fragments.length > 0,
      candidates,
      fragments
    };
  };
}

let state = null;

/** Carga el índice una sola vez al arrancar. Sin índice, el servidor sigue sin RAG. */
export function initRetriever({ log = console.log } = {}) {
  if (!config.rag.enabled) {
    state = { enabled: false, reason: 'RAG_ENABLED=false' };
    log('  RAG:         desactivado (RAG_ENABLED=false)');
    return state;
  }
  const file = path.resolve(config.rag.indexPath);
  const index = loadIndex(file);
  if (!index) {
    state = { enabled: false, reason: `No existe ${config.rag.indexPath}` };
    log(`  RAG:         SIN ÍNDICE (${config.rag.indexPath}); respuestas "sin respaldo documental". Corre npm run ingest.`);
    return state;
  }
  if (index.model !== config.rag.embeddingModel) {
    log(`  RAG:         aviso: el índice usa ${index.model} y la configuración ${config.rag.embeddingModel}`);
  }
  state = { enabled: true, retrieve: createRetriever(index), size: index.chunks.length, model: index.model };
  log(`  RAG:         ${index.chunks.length} fragmentos (${index.model}), umbral ${config.rag.minScore}, top ${config.rag.topK}`);
  if (config.test.mode) log(`  RAG:         MODO PRUEBA activo; fragmentos forzados: ${config.test.forceIds.join(', ') || 'ninguno'}`);
  return state;
}

export function ragStatus() {
  return state;
}

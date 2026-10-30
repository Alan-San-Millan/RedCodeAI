import { GoogleGenAI } from '@google/genai';
import { config, EMBEDDING_DIMENSIONS } from '../config.js';
import { normalize } from './vector.js';

let client = null;
function getClient() {
  if (!config.apiKey) throw new Error('Falta GEMINI_API_KEY para generar embeddings.');
  if (!client) client = new GoogleGenAI({ apiKey: config.apiKey });
  return client;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Genera embeddings normalizados. `taskType` es RETRIEVAL_DOCUMENT para el corpus
 * y RETRIEVAL_QUERY para las consultas. Reintenta ante cuota (429) o saturación (5xx).
 */
export async function embedTexts(texts, taskType, { batchSize = 50, pauseMs = 1500, onProgress } = {}) {
  const ai = getClient();
  const vectors = [];
  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize);
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await ai.models.embedContent({
          model: config.rag.embeddingModel,
          contents: batch,
          config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS, abortSignal: AbortSignal.timeout(60000) }
        });
        break;
      } catch (error) {
        const status = Number(error?.status);
        if (!RETRYABLE.has(status) || attempt >= 5) throw error;
        const wait = [2000, 5000, 15000, 30000, 60000][attempt];
        onProgress?.(`HTTP ${status}; reintento ${attempt + 1} en ${wait / 1000}s`);
        await sleep(wait);
      }
    }
    const values = response.embeddings.map((e) => e.values);
    if (values.length !== batch.length) throw new Error(`Se pidieron ${batch.length} embeddings y llegaron ${values.length}.`);
    for (const v of values) {
      if (v.length !== EMBEDDING_DIMENSIONS) throw new Error(`Embedding de ${v.length} dimensiones (se esperaban ${EMBEDDING_DIMENSIONS}).`);
      vectors.push(normalize(v));
    }
    onProgress?.(`${Math.min(start + batchSize, texts.length)}/${texts.length}`);
    if (start + batchSize < texts.length) await sleep(pauseMs);
  }
  return vectors;
}

export async function embedQuery(text) {
  const [vector] = await embedTexts([text], 'RETRIEVAL_QUERY');
  return vector;
}

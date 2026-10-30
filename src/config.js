import 'dotenv/config';

/**
 * Modelo por defecto. Probado end-to-end contra la API real con salida estructurada
 * (responseSchema): es el que respondió de forma estable en las pruebas de este proyecto.
 * gemini-3.7-flash y gemini-3.5-flash(-lite) están disponibles pero devolvieron 503
 * "high demand" al usar responseSchema durante las pruebas; gemini-2.5-flash ya no
 * está disponible para API keys nuevas (404). gemini-1.5-flash y gemini-2.0-flash
 * están retirados. Si esto cambia, ajusta GEMINI_MODEL en .env sin tocar código.
 */
const DEFAULT_MODEL = 'gemini-3.6-flash';

/**
 * Temperature baja por decisión de ingeniería: el servicio produce código, y el código
 * debe ser consistente y reproducible entre ejecuciones (ver diapositiva 14).
 */
const DEFAULT_TEMPERATURE = 0.2;

const MIN_REQUIREMENT_LENGTH = 15;
const MAX_REQUIREMENT_LENGTH = 4000;

function readFloat(raw, fallback, min, max) {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readInt(raw, fallback) {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function readBool(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(String(raw).trim().toLowerCase());
}

/** Dimensiones del embedding: fijas porque el índice y las consultas deben coincidir. */
export const EMBEDDING_DIMENSIONS = 768;

export const config = {
  port: readInt(process.env.PORT, 3000),
  apiKey: (process.env.GEMINI_API_KEY || '').trim(),
  model: (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
  temperature: readFloat(process.env.GEMINI_TEMPERATURE, DEFAULT_TEMPERATURE, 0, 1),
  timeoutMs: readInt(process.env.GEMINI_TIMEOUT_MS, 90000),
  minRequirementLength: MIN_REQUIREMENT_LENGTH,
  maxRequirementLength: MAX_REQUIREMENT_LENGTH,

  rag: {
    enabled: readBool(process.env.RAG_ENABLED, true),
    embeddingModel: (process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001').trim(),
    indexPath: (process.env.RAG_INDEX_PATH || 'data/rag-index.json').trim(),
    // Candidatos por cada vía (coseno y palabras clave) antes de fusionar.
    candidates: 8,
    // Máximo de fragmentos que llegan al prompt; el mínimo útil es 3 si superan el umbral.
    topK: readInt(process.env.RAG_TOP_K, 5),
    // Similitud coseno mínima. PROVISIONAL: se calibra con scripts/calibrate.js.
    minScore: readFloat(process.env.RAG_MIN_SCORE, 0.66, 0, 1)
  },

  rateLimit: {
    max: readInt(process.env.RATE_LIMIT_MAX, 10),
    windowMs: readInt(process.env.RATE_LIMIT_WINDOW_MS, 60000)
  },

  // Solo para la evaluación (npm run eval). Nunca activos por defecto.
  test: {
    capture: readBool(process.env.RAG_TEST_CAPTURE, false),
    mode: readBool(process.env.RAG_TEST_MODE, false),
    forceIds: (process.env.RAG_TEST_FORCE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  }
};

/**
 * Única fuente de verdad de los lenguajes soportados: el servidor la usa para validar
 * y el navegador la consume desde /api/config para construir el selector.
 * `highlight` es el identificador que entiende highlight.js.
 */
export const LANGUAGES = [
  { id: 'python', label: 'Python', highlight: 'python', conventions: 'PEP 8, type hints y docstrings' },
  { id: 'javascript', label: 'JavaScript', highlight: 'javascript', conventions: 'ES2022, módulos ESM y JSDoc' },
  { id: 'typescript', label: 'TypeScript', highlight: 'typescript', conventions: 'tipado estricto y sin any' },
  { id: 'java', label: 'Java', highlight: 'java', conventions: 'convenciones de Oracle y Javadoc' },
  { id: 'csharp', label: 'C#', highlight: 'csharp', conventions: 'convenciones de .NET y comentarios XML' },
  { id: 'go', label: 'Go', highlight: 'go', conventions: 'gofmt y manejo explícito de errores' },
  { id: 'rust', label: 'Rust', highlight: 'rust', conventions: 'rustfmt, Result/Option y sin unwrap innecesario' },
  { id: 'c', label: 'C', highlight: 'c', conventions: 'C11, gestión manual de memoria y funciones seguras (snprintf en vez de sprintf)' },
  { id: 'cpp', label: 'C++', highlight: 'cpp', conventions: 'C++17 y la biblioteca estándar' },
  { id: 'php', label: 'PHP', highlight: 'php', conventions: 'PSR-12 y declaraciones de tipo' },
  { id: 'ruby', label: 'Ruby', highlight: 'ruby', conventions: 'guía de estilo de la comunidad Ruby' },
  { id: 'kotlin', label: 'Kotlin', highlight: 'kotlin', conventions: 'convenciones oficiales y null safety' },
  { id: 'swift', label: 'Swift', highlight: 'swift', conventions: 'Swift API Design Guidelines' },
  { id: 'sql', label: 'SQL', highlight: 'sql', conventions: 'SQL estándar, legible y con alias claros' },
  { id: 'bash', label: 'Bash', highlight: 'bash', conventions: 'set -euo pipefail y variables entrecomilladas' }
];

export const DEFAULT_LANGUAGE = 'python';

export function findLanguage(id) {
  return LANGUAGES.find((language) => language.id === id) || null;
}

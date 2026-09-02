import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompts/system-prompt.js';

/**
 * Esquema de respuesta. Fijar la forma de la salida es más fiable que parsear markdown:
 * el frontend recibe siempre los mismos campos y no tiene que separar código de prosa.
 * `propertyOrdering` obliga al modelo a resolver la comprensión (Función 1) antes de
 * escribir el código, que es el orden en el que razona mejor.
 */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  propertyOrdering: [
    'status', 'title', 'artifact', 'dataStructures', 'conditions',
    'edgeCases', 'code', 'explanation', 'suggestedTest', 'assumptions'
  ],
  required: ['status', 'title', 'artifact', 'code', 'explanation'],
  properties: {
    status: {
      type: Type.STRING,
      enum: ['ok', 'unclear'],
      description: 'ok si el requerimiento se pudo resolver; unclear si falta información esencial.'
    },
    title: { type: Type.STRING, description: 'Título corto (máx. 6 palabras) que resume el requerimiento.' },
    artifact: { type: Type.STRING, description: 'Artefacto generado: función, clase, script, consulta, etc.' },
    dataStructures: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Estructuras de datos de entrada y salida detectadas.' },
    conditions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Condiciones, filtros y restricciones detectadas en el texto.' },
    edgeCases: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Casos borde contemplados en la implementación.' },
    code: { type: Type.STRING, description: 'Código fuente en texto plano, sin cercas de markdown.' },
    explanation: { type: Type.STRING, description: 'De 2 a 4 frases en español sobre la lógica implementada.' },
    suggestedTest: { type: Type.STRING, description: 'Prueba unitaria sugerida, en texto plano y sin cercas de markdown.' },
    assumptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Supuestos que fue necesario tomar.' }
  }
};

let client = null;

function getClient() {
  if (!config.apiKey) {
    throw new AppError('El servidor no tiene configurada una API key de Gemini.', {
      status: 503,
      code: 'missing_key',
      hint: 'Copia .env.example como .env y coloca tu clave gratuita de aistudio.google.com/apikey en GEMINI_API_KEY.'
    });
  }
  if (!client) client = new GoogleGenAI({ apiKey: config.apiKey });
  return client;
}

/** Quita cercas de markdown si el modelo las incluye pese a la instrucción. */
function stripFences(value) {
  const text = String(value ?? '').trim();
  const fenced = text.match(/^```[\w+-]*\s*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : text).trim();
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

/**
 * Respaldo por si el modelo devuelve markdown en lugar del JSON del esquema
 * (puede pasar si se cambia GEMINI_MODEL por uno sin soporte de structured output).
 */
function parseMarkdownFallback(text) {
  const block = text.match(/```[\w+-]*\s*\n([\s\S]*?)```/);
  if (!block) return null;
  return {
    status: 'ok',
    title: 'Código generado',
    artifact: '',
    code: block[1].trim(),
    explanation: text.replace(/```[\s\S]*?```/g, '').trim().slice(0, 1200),
    suggestedTest: '',
    dataStructures: [],
    conditions: [],
    edgeCases: [],
    assumptions: []
  };
}

function normalize(raw) {
  const status = raw.status === 'unclear' ? 'unclear' : 'ok';
  const code = stripFences(raw.code);

  if (status === 'ok' && !code) {
    throw new AppError('Gemini respondió sin código utilizable.', {
      status: 502,
      code: 'empty_code',
      hint: 'Vuelve a intentarlo o reformula el requerimiento con más detalle.'
    });
  }

  return {
    status,
    title: String(raw.title || '').trim() || 'Requerimiento sin título',
    artifact: String(raw.artifact || '').trim(),
    code,
    explanation: String(raw.explanation || '').trim(),
    suggestedTest: stripFences(raw.suggestedTest),
    dataStructures: toStringArray(raw.dataStructures),
    conditions: toStringArray(raw.conditions),
    edgeCases: toStringArray(raw.edgeCases),
    assumptions: toStringArray(raw.assumptions)
  };
}

/**
 * Ejecuta el flujo completo: prompt de sistema con las tres funciones → Gemini →
 * respuesta estructurada lista para pintar en la interfaz.
 */
export async function generateSolution({ requirement, language, temperature }) {
  const startedAt = Date.now();
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: config.model,
    contents: buildUserPrompt({ requirement, language }),
    config: {
      systemInstruction: buildSystemPrompt(language),
      temperature,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      abortSignal: AbortSignal.timeout(config.timeoutMs)
    }
  });

  const text = (response.text || '').trim();
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason;
    if (reason === 'MAX_TOKENS') {
      throw new AppError('La respuesta se cortó por longitud antes de completarse.', {
        status: 502,
        code: 'max_tokens',
        hint: 'Divide el requerimiento en partes más pequeñas.'
      });
    }
    if (reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT') {
      throw new AppError('Gemini bloqueó la respuesta por sus filtros de contenido.', {
        status: 422,
        code: 'blocked',
        hint: 'Reformula el requerimiento evitando contenido que pueda considerarse sensible.'
      });
    }
    throw new AppError('Gemini devolvió una respuesta vacía.', {
      status: 502,
      code: 'empty_response',
      hint: 'Vuelve a intentarlo en unos segundos.'
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = parseMarkdownFallback(text);
    if (!parsed) {
      throw new AppError('No se pudo interpretar la respuesta de Gemini.', {
        status: 502,
        code: 'unparsable',
        hint: 'Vuelve a intentarlo. Si se repite, revisa que GEMINI_MODEL admita salida estructurada.'
      });
    }
  }

  return {
    ...normalize(parsed),
    language: language.id,
    languageLabel: language.label,
    highlight: language.highlight,
    meta: {
      model: config.model,
      temperature,
      elapsedMs: Date.now() - startedAt,
      tokens: response.usageMetadata?.totalTokenCount ?? null
    }
  };
}

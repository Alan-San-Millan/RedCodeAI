import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const CAPTURE_DIR = path.resolve('tests', 'rag-eval', 'captures');

/**
 * Modo de captura para la evaluación (RAG_TEST_CAPTURE=1): guarda el texto EXACTO que
 * sale hacia Gemini en una solicitud, para comprobar la prueba U2. Fuera de ese modo
 * devuelve null y no escribe nada; el servidor nunca registra cuerpos de solicitud.
 */
export function startCapture() {
  if (!config.test.capture) return null;
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const file = path.join(CAPTURE_DIR, `${id}.json`);
  const records = [];
  return {
    id,
    record(entry) {
      records.push({ at: new Date().toISOString(), ...entry });
      fs.writeFileSync(file, JSON.stringify(records, null, 2));
    }
  };
}

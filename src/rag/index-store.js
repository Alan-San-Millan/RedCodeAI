import fs from 'node:fs';
import path from 'node:path';

/** Carga el índice JSON. Devuelve null si no existe (el servidor arranca sin RAG). */
export function loadIndex(file) {
  if (!fs.existsSync(file)) return null;
  const index = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(index.chunks)) throw new Error(`El índice ${file} no tiene la forma esperada.`);
  return index;
}

export function saveIndex(file, index) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Un fragmento por línea: el archivo sigue siendo JSON válido y los diffs de git son legibles.
  const header = { ...index, chunks: undefined };
  const lines = index.chunks.map((c) => JSON.stringify({ ...c, vector: c.vector.map((v) => Number(v.toFixed(6))) }));
  const json = `${JSON.stringify(header, null, 2).replace(/\n}$/, '')},\n  "chunks": [\n    ${lines.join(',\n    ')}\n  ]\n}\n`;
  fs.writeFileSync(file, json, 'utf8');
}

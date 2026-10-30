import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, buildBm25 } from '../../src/rag/bm25.js';
import { reciprocalRankFusion } from '../../src/rag/fusion.js';
import { expandQuery } from '../../src/rag/glossary.js';
import { createRetriever, appliesTo } from '../../src/rag/retriever.js';
import { normalize } from '../../src/rag/vector.js';

test('tokenize conserva IDs CWE, quita acentos y palabras vacías', () => {
  assert.deepEqual(tokenize('¿Cómo evito la CWE-89 en SQL?'), ['evito', 'cwe-89', 'sql']);
});

test('BM25 prioriza el documento con el término exacto', () => {
  const search = buildBm25([
    { id: 'a', text: 'Use parameterized queries to prevent SQL injection (CWE-89)' },
    { id: 'b', text: 'Validate all input on a trusted system' },
    { id: 'c', text: 'Quote shell arguments to avoid command injection' }
  ]);
  assert.equal(search('CWE-89')[0].id, 'a');
  assert.equal(search('shell injection')[0].id, 'c');
  assert.deepEqual(search('kubernetes'), []);
});

test('RRF premia lo que aparece arriba en ambas listas', () => {
  const fused = reciprocalRankFusion([
    [{ id: 'x' }, { id: 'y' }, { id: 'z' }],
    [{ id: 'y' }, { id: 'w' }]
  ]);
  assert.equal(fused[0].id, 'y');
  assert.deepEqual(fused.map((f) => f.id).sort(), ['w', 'x', 'y', 'z']);
});

test('el glosario agrega equivalentes en inglés sin tocar el texto original', () => {
  const q = 'Valida la contraseña contra la base de datos';
  const expanded = expandQuery(q);
  assert.ok(expanded.startsWith(q));
  for (const word of ['validation', 'password', 'database']) assert.match(expanded, new RegExp(word));
  assert.equal(expandQuery('Kubernetes'), 'Kubernetes');
});

test('appliesTo filtra por lenguaje', () => {
  assert.ok(appliesTo({ meta: { languages: ['all'] } }, 'python'));
  assert.ok(appliesTo({ meta: { languages: ['c', 'cpp'] } }, 'c'));
  assert.ok(!appliesTo({ meta: { languages: ['c', 'cpp'] } }, 'python'));
});

function syntheticIndex() {
  const chunk = (id, vector, languages = ['all'], extra = {}) => ({ id, text: id, vector: normalize(vector), meta: { languages, source: 'S', url: 'https://example.org' }, ...extra });
  return {
    chunks: [
      chunk('close', [1, 0, 0]),
      chunk('medium', [0.8, 0.6, 0]),
      chunk('far', [0, 0, 1]),
      chunk('c-only', [1, 0.01, 0], ['c']),
      chunk('poisoned', [1, 0.02, 0], ['all'], { flagged: true })
    ]
  };
}
const python = { id: 'python', label: 'Python' };
const settings = { candidates: 8, topK: 5, minScore: 0.7 };

test('el recuperador aplica umbral, filtro de lenguaje y excluye fragmentos marcados', async () => {
  const retrieve = createRetriever(syntheticIndex(), { embed: async () => normalize([1, 0, 0]), settings, test: { mode: false, forceIds: [] } });
  const result = await retrieve({ requirement: 'algo', language: python });
  const ids = result.fragments.map((f) => f.id);
  assert.deepEqual(ids.sort(), ['close', 'medium']);
  assert.equal(result.grounded, true);
});

test('sin fragmentos sobre el umbral la respuesta queda sin respaldo', async () => {
  const retrieve = createRetriever(syntheticIndex(), { embed: async () => normalize([0, 1, 0]), settings, test: { mode: false, forceIds: [] } });
  const result = await retrieve({ requirement: 'algo', language: python });
  assert.equal(result.grounded, false);
  assert.deepEqual(result.fragments, []);
});

test('un fragmento marcado solo entra forzado y en modo prueba', async () => {
  const forcedOff = createRetriever(syntheticIndex(), { embed: async () => normalize([0, 1, 0]), settings, test: { mode: false, forceIds: ['poisoned'] } });
  assert.equal((await forcedOff({ requirement: 'x', language: python })).fragments.length, 0);
  const forcedOn = createRetriever(syntheticIndex(), { embed: async () => normalize([0, 1, 0]), settings, test: { mode: true, forceIds: ['poisoned'] } });
  const result = await forcedOn({ requirement: 'x', language: python });
  assert.deepEqual(result.fragments.map((f) => f.id), ['poisoned']);
  assert.equal(result.fragments[0].forced, true);
});

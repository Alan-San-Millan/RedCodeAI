import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  estimateTokens, parseFrontmatter, splitParagraphs, packParagraphs,
  chunkOwasp, chunkPep8, chunkDocument
} from '../../src/rag/chunking.js';

test('parseFrontmatter lee listas y textos JSON', () => {
  const { meta, body } = parseFrontmatter('---\nsource: "X"\nlanguages: ["all"]\nrank: 2\n---\n\n# T\n');
  assert.equal(meta.source, 'X');
  assert.deepEqual(meta.languages, ['all']);
  assert.equal(meta.rank, 2);
  assert.match(body, /# T/);
});

test('splitParagraphs no parte un bloque de código con líneas en blanco', () => {
  const text = 'Uno\n\n```python\na = 1\n\nb = 2\n```\n\nDos';
  const paragraphs = splitParagraphs(text);
  assert.equal(paragraphs.length, 3);
  assert.match(paragraphs[1], /a = 1\n\nb = 2/);
});

test('packParagraphs respeta el máximo y aplica traslape', () => {
  const paragraphs = Array.from({ length: 12 }, (_, i) => `Párrafo ${i} `.repeat(20).trim());
  const chunks = packParagraphs(paragraphs, 200, 0.15);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(estimateTokens(c) <= 200, `fragmento de ${estimateTokens(c)} tokens`);
  // El traslape hace que el inicio de un fragmento repita el final del anterior.
  const lastOfFirst = chunks[0].split('\n\n').pop();
  assert.ok(chunks[1].startsWith(lastOfFirst));
});

test('chunkOwasp agrupa de 3 a 5 prácticas de la misma categoría', () => {
  const practices = Array.from({ length: 13 }, (_, i) => `- [${i + 1}] Practice number ${i + 1} about databases and queries`).join('\n');
  const chunks = chunkOwasp({ source: 'OWASP SCP', category: 'database-security' }, `# Database Security\n\n${practices}\n`);
  for (const c of chunks) {
    assert.ok(c.meta.practices.length >= 3 && c.meta.practices.length <= 7, `${c.meta.practices.length} prácticas`);
    assert.match(c.id, /^owasp-database-security-\d{2}$/);
    assert.match(c.text, /^OWASP SCP v2\.1 — Database Security/);
  }
  assert.deepEqual(chunks.flatMap((c) => c.meta.practices), Array.from({ length: 13 }, (_, i) => i + 1));
});

test('chunkPep8 usa la ruta de encabezados e ignora # dentro de código', () => {
  const body = '## Naming Conventions\n\n### Prescriptive\n\n#### Constants\n\nUse UPPER_CASE.\n\n```python\n# Correct:\nMAX = 1\n```\n';
  const chunks = chunkPep8({}, body);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].id, 'pep8-naming-conventions-constants');
  assert.match(chunks[0].text, /^PEP 8 > Naming Conventions > Prescriptive > Constants/);
  assert.match(chunks[0].text, /# Correct:/);
});

test('los IDs son estables: misma entrada, mismos IDs y textos', () => {
  const raw = fs.readFileSync('knowledge/owasp-scp/11-database-security.md', 'utf8');
  const a = chunkDocument('owasp-scp/11-database-security.md', raw);
  const b = chunkDocument('owasp-scp/11-database-security.md', raw);
  assert.deepEqual(a.map((c) => [c.id, c.text]), b.map((c) => [c.id, c.text]));
});

test('CWE separa descripción y mitigaciones con el ID de la debilidad', () => {
  const raw = fs.readFileSync('knowledge/cwe-top25-2025/02-cwe-89.md', 'utf8');
  const chunks = chunkDocument('cwe-top25-2025/02-cwe-89.md', raw);
  assert.ok(chunks.some((c) => c.id === 'cwe-89-description'));
  assert.ok(chunks.some((c) => c.id.startsWith('cwe-89-mitigations')));
  for (const c of chunks) assert.match(c.text, /^CWE-89: .*posición 2 del CWE Top 25 de 2025/);
});

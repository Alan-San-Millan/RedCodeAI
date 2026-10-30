#!/usr/bin/env node
/**
 * Descarga las fuentes oficiales del corpus y las convierte a Markdown en knowledge/.
 * Se ejecuta a mano y muy de vez en cuando: `node scripts/build-corpus.js`.
 * Requiere `pdftotext` (incluido en Git para Windows / poppler-utils) solo para OWASP.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE = path.join(ROOT, 'knowledge');
const CACHE = path.join(ROOT, '.cache', 'corpus-src');
const TODAY = new Date().toISOString().slice(0, 10);

const SOURCES = {
  owaspPdf: 'https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/assets/docs/OWASP_SCP_Quick_Reference_Guide_v21.pdf',
  owaspPage: 'https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/',
  cweTop25: 'https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html',
  cweXmlZip: 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip',
  pep8Rst: 'https://raw.githubusercontent.com/python/peps/main/peps/pep-0008.rst',
  pep8Page: 'https://peps.python.org/pep-0008/'
};

async function download(url, file) {
  const target = path.join(CACHE, file);
  if (fs.existsSync(target)) return target;
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: HTTP ${res.status}`);
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  return target;
}

function slug(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function frontmatter(meta) {
  const lines = Object.entries(meta).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: [${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `${key}: ${JSON.stringify(value)}`;
  });
  return `---\n${lines.join('\n')}\n---\n\n`;
}

function write(rel, content) {
  const file = path.join(KNOWLEDGE, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\n{3,}/g, '\n\n'), 'utf8');
}

/* ── OWASP Secure Coding Practices v2.1 ─────────────────────────────── */

async function buildOwasp() {
  const pdf = await download(SOURCES.owaspPdf, 'owasp-scp-v21.pdf');
  const txt = path.join(CACHE, 'owasp-scp-v21.txt');
  execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, txt]);
  const lines = fs.readFileSync(txt, 'utf8').split(/\r?\n/);

  // El índice del PDF repite los títulos; la lista real empieza en la segunda aparición.
  const starts = lines.map((l, i) => (l.trim() === 'Secure Coding Practices Checklist' ? i : -1)).filter((i) => i >= 0);
  const start = starts[starts.length - 1];
  const end = lines.findIndex((l, i) => i > start && /^Appendix A:/.test(l.trim()));
  if (start < 0 || end < 0) throw new Error('No se encontró la lista de verificación de OWASP en el PDF.');

  const categories = [];
  let current = null;
  let item = null;
  for (const raw of lines.slice(start + 1, end)) {
    // El PDF antepone viñetas en el área de uso privado de Unicode (p. ej. U+F09F).
    const trimmed = raw.replace(/\f/g, '').replace(/[-•·]/g, '').trim();
    if (!trimmed || /^Version 2\.0\s+\d+$/.test(trimmed) || trimmed === 'November 2010') continue;
    const category = trimmed.match(/^([A-Z][A-Za-z ]+):$/);
    if (category) {
      current = { name: category[1], items: [] };
      categories.push(current);
      item = null;
      continue;
    }
    const practice = trimmed.match(/^\[(\d+)\]\s+(.*)$/);
    if (practice && current) {
      item = { number: Number(practice[1]), text: practice[2] };
      current.items.push(item);
      continue;
    }
    if (item) {
      const sub = trimmed.match(/^[o•]\s+(.*)$/);
      item.text += sub ? `\n    - ${sub[1]}` : ` ${trimmed}`;
    }
  }

  const total = categories.reduce((n, c) => n + c.items.length, 0);
  if (categories.length !== 14) throw new Error(`OWASP: se esperaban 14 categorías y se encontraron ${categories.length}.`);

  categories.forEach((cat, index) => {
    const meta = {
      source: 'OWASP Secure Coding Practices - Quick Reference Guide',
      version: '2.1 (Draft v2.1 - With identities added; pie de página: Version 2.0, November 2010)',
      url: SOURCES.owaspPage,
      license: 'CC BY-SA 3.0 - Copyright 2010 The OWASP Foundation',
      retrieved_at: TODAY,
      category: slug(cat.name),
      languages: ['all'],
      cwe: []
    };
    const body = cat.items.map((i) => `- [${i.number}] ${i.text.replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n /g, '\n  ')}`).join('\n');
    write(`owasp-scp/${String(index + 1).padStart(2, '0')}-${slug(cat.name)}.md`,
      `${frontmatter(meta)}# ${cat.name}\n\n${body}\n`);
  });
  return { categories: categories.length, practices: total };
}

/* ── CWE Top 25 2025 ────────────────────────────────────────────────── */

function unzipFirstEntry(buffer) {
  // ZIP mínimo: lee la primera entrada del directorio local (método deflate).
  if (buffer.readUInt32LE(0) !== 0x04034b50) throw new Error('El archivo de CWE no es un ZIP válido.');
  const method = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  const offset = 30 + nameLength + extraLength;
  const name = buffer.toString('utf8', 30, 30 + nameLength);
  const data = buffer.subarray(offset, offset + compressedSize);
  return { name, content: (method === 8 ? inflateRawSync(data) : data).toString('utf8') };
}

function xhtmlToMarkdown(fragment) {
  return fragment
    .replace(/<xhtml:li>/g, '\n- ').replace(/<\/xhtml:li>/g, '')
    .replace(/<xhtml:p>/g, '\n\n').replace(/<\/xhtml:p>/g, '')
    .replace(/<xhtml:br\/>/g, '\n')
    .replace(/<\/?xhtml:(ul|ol|div)[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

const LANGUAGE_MAP = {
  C: ['c'], 'C++': ['cpp'], Java: ['java'], 'C#': ['csharp'], PHP: ['php'], Python: ['python'],
  Ruby: ['ruby'], JavaScript: ['javascript', 'typescript'], Go: ['go'], Rust: ['rust'], SQL: ['sql'],
  Shell: ['bash'], Kotlin: ['kotlin'], Swift: ['swift'],
  'Memory-Unsafe': ['c', 'cpp'],
  Interpreted: ['python', 'javascript', 'typescript', 'php', 'ruby', 'bash']
};

function cweLanguages(weakness) {
  const platforms = weakness.match(/<Applicable_Platforms>([\s\S]*?)<\/Applicable_Platforms>/)?.[1] || '';
  const declared = [...platforms.matchAll(/<Language (?:Name|Class)="([^"]+)"/g)].map((m) => m[1]);
  if (!declared.length || declared.includes('Not Language-Specific')) return ['all'];
  const mapped = [...new Set(declared.flatMap((d) => LANGUAGE_MAP[d] || []))];
  return mapped.length ? mapped : ['all'];
}

async function buildCwe() {
  const page = fs.readFileSync(await download(SOURCES.cweTop25, 'cwe-top25-2025.html'), 'utf8');
  const ranking = [...new Set([...page.matchAll(/CWE-(\d+)/g)].map((m) => m[1]))].slice(0, 25);
  if (ranking.length !== 25) throw new Error(`CWE: se esperaban 25 debilidades y se encontraron ${ranking.length}.`);

  const { name, content: xml } = unzipFirstEntry(fs.readFileSync(await download(SOURCES.cweXmlZip, 'cwec_latest.xml.zip')));
  const [, catalogVersion, catalogDate] = xml.match(/Version="([^"]+)"\s+Date="([^"]+)"/) || [];

  ranking.forEach((id, index) => {
    const weakness = xml.match(new RegExp(`<Weakness ID="${id}"[\\s\\S]*?</Weakness>`))?.[0];
    if (!weakness) throw new Error(`CWE-${id} no está en ${name}.`);
    const title = weakness.match(/Name="([^"]+)"/)[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const description = xhtmlToMarkdown(weakness.match(/<Description>([\s\S]*?)<\/Description>/)[1]);
    const extended = xhtmlToMarkdown(weakness.match(/<Extended_Description>([\s\S]*?)<\/Extended_Description>/)?.[1] || '');
    const mitigations = [...(weakness.match(/<Potential_Mitigations>([\s\S]*?)<\/Potential_Mitigations>/)?.[1] || '')
      .matchAll(/<Mitigation(?:\s+Mitigation_ID="([^"]+)")?>([\s\S]*?)<\/Mitigation>/g)]
      .map(([, mitId, body], i) => {
        const phases = [...body.matchAll(/<Phase>([^<]+)<\/Phase>/g)].map((m) => m[1]).join(', ');
        const strategy = body.match(/<Strategy>([^<]+)<\/Strategy>/)?.[1];
        const text = xhtmlToMarkdown(body.match(/<Description>([\s\S]*?)<\/Description>/)?.[1] || '');
        const effectiveness = body.match(/<Effectiveness>([^<]+)<\/Effectiveness>/)?.[1];
        const heading = [`Mitigation ${mitId || i + 1}`, phases && `Phase: ${phases}`, strategy && `Strategy: ${strategy}`].filter(Boolean).join(' | ');
        return `### ${heading}\n\n${text}${effectiveness ? `\n\nEffectiveness: ${effectiveness}` : ''}`;
      });

    const meta = {
      source: 'CWE Top 25 Most Dangerous Software Weaknesses 2025',
      version: `Top 25 2025; descripciones y mitigaciones del catálogo CWE ${catalogVersion} (${catalogDate})`,
      url: `https://cwe.mitre.org/data/definitions/${id}.html`,
      license: 'CWE Terms of Use - Copyright 2006-2026, The MITRE Corporation',
      retrieved_at: TODAY,
      category: 'weakness',
      languages: cweLanguages(weakness),
      cwe: [`CWE-${id}`],
      rank: index + 1
    };
    const body = [
      `# CWE-${id}: ${title}`,
      `Posición ${index + 1} del CWE Top 25 de 2025.`,
      `## Description\n\n${description}${extended ? `\n\n${extended}` : ''}`,
      `## Potential Mitigations\n\n${mitigations.join('\n\n')}`
    ].join('\n\n');
    write(`cwe-top25-2025/${String(index + 1).padStart(2, '0')}-cwe-${id}.md`, `${frontmatter(meta)}${body}\n`);
  });
  return { weaknesses: ranking.length, catalog: `${catalogVersion} (${catalogDate})` };
}

/* ── PEP 8 ──────────────────────────────────────────────────────────── */

function rstToMarkdown(rst) {
  const lines = rst.split(/\r?\n/);
  const out = [];
  const levels = { '=': '##', '-': '###', '~': '####' };
  let i = 0;
  // Saltar la cabecera de metadatos del PEP (hasta la primera línea vacía).
  while (i < lines.length && lines[i].trim() !== '') i++;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    if (line.trim() && /^(=+|-+|~+)$/.test(next) && next.length >= line.trim().length) {
      out.push(`${levels[next[0]]} ${line.trim()}`);
      i += 2;
      continue;
    }
    if (/^\s*\.\. _/.test(line) || /^\s*\.\. \[/.test(line)) { i++; continue; }

    const codeDirective = line.match(/^(\s*)\.\. code-block::/);
    const literal = !codeDirective && /::\s*$/.test(line) && !/^\s*\.\./.test(line);
    if (codeDirective || literal) {
      if (literal) out.push(line.replace(/::\s*$/, line.trim() === '::' ? '' : ':'));
      const base = codeDirective ? codeDirective[1].length : line.match(/^\s*/)[0].length;
      i++;
      while (i < lines.length && /^\s*:\w+:/.test(lines[i])) i++;
      const block = [];
      while (i < lines.length && (lines[i].trim() === '' || lines[i].match(/^\s*/)[0].length > base)) {
        block.push(lines[i]);
        i++;
      }
      while (block.length && block[block.length - 1].trim() === '') block.pop();
      while (block.length && block[0].trim() === '') block.shift();
      if (block.length) {
        const indent = Math.min(...block.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length));
        out.push('', '```python', ...block.map((l) => l.slice(indent)), '```', '');
      }
      continue;
    }

    out.push(line
      .replace(/``([^`]+)``/g, '`$1`')
      .replace(/`([^`<]+?)\s*<([^>]+)>`_+/g, '[$1]($2)')
      .replace(/:pep:`(\d+)`/g, 'PEP $1')
      .replace(/:[a-z]+:`([^`]+)`/g, '`$1`')
      .replace(/`([^`]+)`_/g, '$1')
      .replace(/\s*\[#[\w-]+\]_/g, ''));
    i++;
  }
  return out.join('\n');
}

async function buildPep8() {
  const rst = fs.readFileSync(await download(SOURCES.pep8Rst, 'pep-0008.rst'), 'utf8');
  const meta = {
    source: 'PEP 8 - Style Guide for Python Code',
    version: `Status: Active; Created: 05-Jul-2001; ${rst.match(/^Post-History:[\s\S]*?\n\n/m)?.[0].split(',').pop().trim() || ''}`.trim(),
    url: SOURCES.pep8Page,
    license: 'Dominio público (Guido van Rossum, Barry Warsaw, Alyssa Coghlan)',
    retrieved_at: TODAY,
    category: 'style',
    languages: ['python'],
    cwe: []
  };
  write('pep8/pep-0008.md', `${frontmatter(meta)}# PEP 8 – Style Guide for Python Code\n\n${rstToMarkdown(rst)}\n`);
  return { headings: (rst.match(/\n(=+|-+|~+)\n/g) || []).length };
}

/* ── CHANGELOG del proyecto ─────────────────────────────────────────── */

function buildChangelog() {
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const block = (from, to) => {
    const start = changelog.indexOf(from);
    const end = changelog.indexOf(to, start + from.length);
    if (start < 0 || end < 0) throw new Error(`CHANGELOG: no se encontró el bloque que empieza con "${from}".`);
    return changelog.slice(start, end).trim();
  };
  const base = {
    source: 'Registro de decisiones del proyecto (CHANGELOG.md)',
    version: 'Entrada del 2026-09-04',
    url: 'https://github.com/Alan-San-Millan/RedCodeAI/blob/main/CHANGELOG.md',
    license: 'Fuente interna del proyecto',
    retrieved_at: TODAY,
    category: 'lessons-learned',
    cwe: []
  };
  write('changelog/2026-09-04-utf8-manual-en-c.md', frontmatter({ ...base, languages: ['c', 'cpp'], cwe: ['CWE-787', 'CWE-125'] })
    + '# Error real: tabla UTF-8 escrita a mano en C\n\n'
    + block('**Hallazgo importante', '**Otras observaciones') + '\n');
  write('changelog/2026-09-04-cambios-no-solicitados.md', frontmatter({ ...base, languages: ['all'] })
    + '# Observación: cambios no solicitados al extender código\n\n'
    + block('**Otras observaciones', '**Cambio de producto') + '\n');
  return { entries: 2 };
}

/* ── Main ───────────────────────────────────────────────────────────── */

fs.mkdirSync(CACHE, { recursive: true });
const report = {
  owasp: await buildOwasp(),
  cwe: await buildCwe(),
  pep8: await buildPep8(),
  changelog: buildChangelog()
};
console.log(JSON.stringify(report, null, 2));

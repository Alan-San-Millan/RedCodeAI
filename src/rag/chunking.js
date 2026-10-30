/**
 * Fragmentación por estructura del documento (no por número fijo de caracteres),
 * según la sección 3 del documento técnico. Todo es determinista: el mismo texto
 * produce siempre los mismos fragmentos y los mismos IDs.
 */

/** Estimación de tokens sin tokenizador: ~4 caracteres por token en inglés/español. */
export function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

export function slugify(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function parseFrontmatter(raw) {
  const match = String(raw).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: String(raw) };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    try {
      meta[kv[1]] = JSON.parse(kv[2]);
    } catch {
      meta[kv[1]] = kv[2];
    }
  }
  return { meta, body: match[2] };
}

/** Divide en párrafos (separados por línea en blanco) sin partir bloques de código cercados. */
export function splitParagraphs(text) {
  const paragraphs = [];
  let current = [];
  let inFence = false;
  for (const line of String(text).split('\n')) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (!inFence && line.trim() === '' ) {
      if (current.length) paragraphs.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current.join('\n'));
  return paragraphs.map((p) => p.trim()).filter(Boolean);
}

/**
 * Agrupa párrafos en bloques de hasta `maxTokens`. Con `overlapRatio` > 0, cada bloque
 * nuevo arranca repitiendo los últimos párrafos del anterior hasta cubrir esa proporción.
 * Un párrafo que solo ya excede el límite se parte por líneas.
 */
export function packParagraphs(paragraphs, maxTokens, overlapRatio = 0) {
  const units = paragraphs.flatMap((p) => {
    if (estimateTokens(p) <= maxTokens) return [p];
    const pieces = [];
    let buffer = [];
    for (const line of p.split('\n')) {
      if (buffer.length && estimateTokens([...buffer, line].join('\n')) > maxTokens) {
        pieces.push(buffer.join('\n'));
        buffer = [];
      }
      buffer.push(line);
    }
    if (buffer.length) pieces.push(buffer.join('\n'));
    return pieces;
  });

  // Se mide siempre el texto ya unido, para contar también los separadores.
  const size = (parts) => estimateTokens(parts.join('\n\n'));
  const chunks = [];
  let current = [];
  for (const unit of units) {
    if (current.length && size([...current, unit]) > maxTokens) {
      chunks.push(current);
      const overlap = [];
      const target = size(current) * overlapRatio;
      for (let i = current.length - 1; i >= 0 && overlapRatio > 0 && size(overlap) < target; i--) {
        if (size([current[i], ...overlap, unit]) > maxTokens) break;
        overlap.unshift(current[i]);
      }
      current = overlap;
    }
    current.push(unit);
  }
  if (current.length) chunks.push(current);
  return chunks.map((c) => c.join('\n\n'));
}

function makeChunk(id, context, content, meta, extra = {}) {
  const text = `${context}\n\n${content}`.trim();
  return { id, text, tokens: estimateTokens(text), meta: { ...meta, context, ...extra } };
}

/* ── OWASP: grupos de 3 a 5 prácticas de una misma categoría (150–300 tokens) ── */

export function chunkOwasp(meta, body) {
  const title = body.match(/^# (.+)$/m)?.[1]?.trim() || meta.category;
  const practices = body.split('\n').reduce((list, line) => {
    if (/^- \[\d+\]/.test(line)) list.push(line);
    else if (list.length && line.trim()) list[list.length - 1] += `\n${line}`;
    return list;
  }, []);

  const groups = [];
  let current = [];
  for (const practice of practices) {
    const tokens = estimateTokens([...current, practice].join('\n'));
    const full = current.length >= 5 || (current.length >= 3 && (tokens > 300 || estimateTokens(current.join('\n')) >= 150));
    if (full) {
      groups.push(current);
      current = [];
    }
    current.push(practice);
  }
  if (current.length) {
    if (current.length < 3 && groups.length) groups[groups.length - 1].push(...current);
    else groups.push(current);
  }

  const context = `${meta.source} v2.1 — ${title}`;
  return groups.map((group, i) => {
    const numbers = group.map((p) => Number(p.match(/^- \[(\d+)\]/)[1]));
    return makeChunk(`owasp-${slugify(title)}-${String(i + 1).padStart(2, '0')}`, context, group.join('\n'), meta, {
      section: title,
      practices: numbers
    });
  });
}

/* ── CWE: una sección por debilidad, descripción o mitigaciones (200–450 tokens) ── */

export function chunkCwe(meta, body) {
  const title = body.match(/^# (.+)$/m)?.[1]?.trim();
  const cweId = (meta.cwe && meta.cwe[0]) || title.match(/CWE-\d+/)[0];
  const num = cweId.replace('CWE-', '');
  const context = `${title} (posición ${meta.rank} del CWE Top 25 de 2025)`;
  const description = body.match(/## Description\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() || '';
  const mitigationsText = body.match(/## Potential Mitigations\n([\s\S]*)$/)?.[1]?.trim() || '';
  const mitigations = mitigationsText.split(/\n(?=### )/).map((m) => m.trim()).filter(Boolean);

  const chunks = [];
  const descParts = packParagraphs(splitParagraphs(description), 450);
  descParts.forEach((part, i) => {
    const suffix = descParts.length > 1 ? `-${i + 1}` : '';
    chunks.push(makeChunk(`cwe-${num}-description${suffix}`, context, `Description:\n${part}`, meta, { section: 'description' }));
  });

  const mitParts = packParagraphs(mitigations, 450);
  mitParts.forEach((part, i) => {
    const suffix = mitParts.length > 1 ? `-${i + 1}` : '';
    chunks.push(makeChunk(`cwe-${num}-mitigations${suffix}`, context, `Potential Mitigations:\n${part}`, meta, { section: 'mitigations' }));
  });
  return chunks;
}

/* ── PEP 8: una subsección por encabezado, hasta 400 tokens, 15 % de traslape ── */

export function chunkPep8(meta, body) {
  const sections = [];
  const path = [];
  let current = null;
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    const heading = !inFence && line.match(/^(#{2,4}) (.+)$/);
    if (heading) {
      const level = heading[1].length - 2;
      path.length = level;
      path[level] = heading[2].trim();
      current = { path: [...path], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const used = new Set();
  const chunks = [];
  for (const section of sections) {
    const content = section.lines.join('\n').trim();
    if (!content) continue;
    const top = slugify(section.path[0]);
    const leaf = section.path.length > 1 ? `-${slugify(section.path[section.path.length - 1])}` : '';
    let baseId = `pep8-${top}${leaf}`;
    for (let n = 2; used.has(baseId); n++) baseId = `pep8-${top}${leaf}-${n}`;
    used.add(baseId);

    const context = `PEP 8 > ${section.path.join(' > ')}`;
    const parts = packParagraphs(splitParagraphs(content), 400, 0.15);
    parts.forEach((part, i) => {
      chunks.push(makeChunk(parts.length > 1 ? `${baseId}-${i + 1}` : baseId, context, part, meta, {
        section: section.path.join(' > ')
      }));
    });
  }
  return chunks;
}

/* ── CHANGELOG: una entrada = un fragmento ── */

export function chunkChangelog(meta, body, fileName) {
  const title = body.match(/^# (.+)$/m)?.[1]?.trim() || fileName;
  const content = body.replace(/^# .+$/m, '').trim();
  const context = `Lección del proyecto (${meta.version}): ${title}`;
  return [makeChunk(`changelog-${slugify(fileName.replace(/\.md$/, ''))}`, context, content, meta, { section: title })];
}

/** Elige la estrategia según la carpeta de la fuente. */
export function chunkDocument(relPath, raw) {
  const { meta, body } = parseFrontmatter(raw);
  const [folder] = relPath.replace(/\\/g, '/').split('/');
  const fileName = relPath.replace(/\\/g, '/').split('/').pop();
  const fullMeta = { ...meta, file: relPath.replace(/\\/g, '/') };
  if (folder === 'owasp-scp') return chunkOwasp(fullMeta, body);
  if (folder === 'cwe-top25-2025') return chunkCwe(fullMeta, body);
  if (folder === 'pep8') return chunkPep8(fullMeta, body);
  if (folder === 'changelog') return chunkChangelog(fullMeta, body, fileName);
  throw new Error(`No hay estrategia de fragmentación para la carpeta "${folder}" (${relPath}).`);
}

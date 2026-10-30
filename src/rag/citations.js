/**
 * Verificación de citas en el servidor (paso 8 del diagrama): una cita solo se acepta si
 * su ID está entre los fragmentos recuperados en ESTA solicitud. Las demás se descartan
 * y se cuentan, porque una cita inventada con apariencia de fuente es peor que ninguna.
 */
export function verifyCitations(references, fragments) {
  const retrieved = new Map((fragments || []).map((f) => [f.id, f]));
  const valid = [];
  const discarded = [];
  const seen = new Set();

  for (const ref of Array.isArray(references) ? references : []) {
    const id = String(ref?.id ?? '').trim();
    const applied = String(ref?.applied ?? '').trim();
    if (!id) {
      discarded.push({ id, applied, reason: 'cita sin id' });
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const fragment = retrieved.get(id);
    if (!fragment) {
      discarded.push({ id, applied, reason: 'el id no está entre los fragmentos recuperados' });
      continue;
    }
    valid.push({
      id,
      applied,
      source: fragment.source,
      section: fragment.section,
      version: fragment.version,
      url: fragment.url
    });
  }
  return { valid, discarded };
}

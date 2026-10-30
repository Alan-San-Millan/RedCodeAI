import { config } from '../config.js';
import { ragStatus } from '../rag/retriever.js';
import { verifyCitations } from '../rag/citations.js';
import { generateSolution } from './gemini.service.js';
import { maskSecrets, maskingNotice } from '../security/secrets.js';
import { startCapture } from '../security/capture.js';

/**
 * Flujo de una solicitud: enmascarar secretos → recuperación → generación con fuentes →
 * verificación de citas. Todo lo que sale hacia Gemini usa el texto ya enmascarado.
 * Si la recuperación falla (cuota de embeddings, red), se genera igual pero marcado como
 * "sin respaldo documental" y con el motivo en retrieval.error.
 */
export async function handleGenerate(input) {
  const { language, temperature } = input;
  const masking = maskSecrets(input.requirement);
  const requirement = masking.text;
  const capture = startCapture();
  const onOutbound = capture ? (entry) => capture.record(entry) : undefined;
  const notices = masking.masked ? [{ type: 'secrets-masked', message: maskingNotice(masking.findings), findings: masking.findings }] : [];

  const rag = ragStatus();
  let retrieval = { enabled: Boolean(rag?.enabled), grounded: false, threshold: config.rag.minScore, fragments: [], candidates: [] };

  if (rag?.enabled) {
    try {
      const result = await rag.retrieve({ requirement, language });
      onOutbound?.({ kind: 'embedContent', model: rag.model, taskType: 'RETRIEVAL_QUERY', contents: result.query });
      retrieval = { enabled: true, ...result };
    } catch (error) {
      retrieval.error = `No se pudo recuperar documentación (${error?.status || error?.name || 'error'}): se generó sin respaldo documental.`;
    }
  } else if (rag) {
    retrieval.error = `RAG inactivo: ${rag.reason}.`;
  }

  const result = await generateSolution({ requirement, language, temperature, fragments: retrieval.fragments, onOutbound });
  const { valid, discarded } = verifyCitations(result.references, retrieval.fragments);
  if (discarded.length) console.warn(`[citas] ${discarded.length} cita(s) descartada(s): ${discarded.map((d) => d.id || '(vacía)').join(', ')}`);

  return {
    ...result,
    references: valid,
    grounded: retrieval.grounded,
    notices,
    ...(capture ? { captureId: capture.id } : {}),
    retrieval: {
      enabled: retrieval.enabled,
      threshold: retrieval.threshold,
      grounded: retrieval.grounded,
      error: retrieval.error || null,
      fragments: retrieval.fragments.map(({ id, cosine, rrf, source, section, version, url, forced }) => ({ id, cosine, rrf, source, section, version, url, ...(forced ? { forced } : {}) })),
      discardedCitations: discarded
    }
  };
}

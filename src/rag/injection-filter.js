/**
 * Filtro de ingesta contra inyección indirecta (OWASP LLM01/LLM08): marca fragmentos
 * con frases imperativas dirigidas al modelo. Un fragmento marcado no entra al índice.
 * Es deliberadamente conservador: prefiere excluir de más y que una persona lo revise.
 */
const PATTERNS = [
  { name: 'ignorar-instrucciones', re: /\bignor(a|e|en|ar|es)\s+(todas\s+|todo\s+|tus\s+|las\s+|los\s+|cualquier\s+)*(instrucciones|indicaciones|reglas|[oó]rdenes)\b/i },
  { name: 'ignore-instructions', re: /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+|your\s+)*(previous|prior|above|earlier|preceding|system)?\s*(instructions|rules|directions|prompts?)\b/i },
  { name: 'instruccion-para-el-asistente', re: /\binstrucci[oó]n(es)?\s+(para|al)\s+(el\s+)?(asistente|modelo|agente|ia|llm)\b/i },
  { name: 'instruction-for-the-assistant', re: /\binstructions?\s+(for|to)\s+(the\s+)?(assistant|model|ai|llm|agent)\b/i },
  { name: 'prompt-de-sistema', re: /\b(system\s+prompt|prompt\s+(de|del)\s+sistema|system\s+message|mensaje\s+de\s+sistema)\b/i },
  { name: 'dirigido-al-modelo', re: /\b(asistente|assistant|modelo|model|ia|ai|llm)\s*[:,]\s*(siempre|always|nunca|never|agrega|add|incluye|include|ignora|ignore|responde|respond|revela|reveal)\b/i },
  { name: 'cambio-de-rol', re: /\b(you\s+are\s+now|from\s+now\s+on\s+you|a\s+partir\s+de\s+ahora\s+(eres|debes)|ahora\s+eres)\b/i },
  { name: 'nuevas-instrucciones', re: /\b(new\s+instructions|nuevas\s+instrucciones)\s*:/i }
];

/** Devuelve los nombres de los patrones que coinciden (lista vacía = fragmento limpio). */
export function detectInjection(text) {
  return PATTERNS.filter(({ re }) => re.test(String(text))).map(({ name }) => name);
}

export const INJECTION_PATTERN_NAMES = PATTERNS.map((p) => p.name);

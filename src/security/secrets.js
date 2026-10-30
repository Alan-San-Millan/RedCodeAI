/**
 * Detector de secretos (OWASP LLM02): enmascara credenciales y datos personales ANTES de
 * que el texto salga hacia Gemini (embedding de la consulta y generación). En la capa
 * gratuita, Google puede usar el contenido para mejorar sus productos.
 *
 * Es una red de seguridad, no una garantía: un secreto sin formato reconocible
 * (por ejemplo, una contraseña suelta en prosa) no se detecta.
 */
const ASSIGNMENT_KEYS = String.raw`[\w-]*?(?:password|passwd|pwd|contrase(?:ñ|n)a|secret|secreto|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret)[\w-]*`;

const RULES = [
  {
    type: 'private-key',
    re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----/g,
    replace: () => '[REDACTED:private-key]'
  },
  { type: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: () => '[REDACTED:google-api-key]' },
  // Formato nuevo de claves de Google AI Studio.
  { type: 'google-api-key', re: /\bAQ\.[0-9A-Za-z_-]{30,}/g, replace: () => '[REDACTED:google-api-key]' },
  { type: 'api-key', re: /\bsk-(?:proj-|live-|test-|ant-)?[A-Za-z0-9_-]{20,}/g, replace: () => '[REDACTED:api-key]' },
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replace: () => '[REDACTED:aws-access-key]' },
  { type: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, replace: () => '[REDACTED:github-token]' },
  {
    // password = "..." · secret: '...' · "api_key": "..."  → se enmascara solo el valor.
    type: 'secret-assignment',
    re: new RegExp(String.raw`(["']?\b${ASSIGNMENT_KEYS}["']?\s*[:=]\s*)(["'\`])((?:(?!\2)[^\n]){1,300})\2`, 'gi'),
    replace: (_m, prefix, quote, value) => (value.startsWith('[REDACTED') ? _m : `${prefix}${quote}[REDACTED:secret]${quote}`)
  },
  {
    // PASSWORD=abc123 · token: s3cr3tValue  → solo valores con pinta de secreto (≥ 8 caracteres,
    // con letra y dígito, sin paréntesis), para no tocar `token: str` ni `password = get_password()`.
    type: 'secret-assignment',
    re: new RegExp(String.raw`(\b${ASSIGNMENT_KEYS}\s*[:=]\s*)(?![\["'\`])([^\s"'\`,;()\[\]{}]{8,})`, 'gi'),
    replace: (m, prefix, value) => (/[A-Za-z]/.test(value) && /\d/.test(value) && !value.startsWith('[REDACTED') ? `${prefix}[REDACTED:secret]` : m)
  },
  { type: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: () => '[REDACTED:email]' }
];

const LABELS = {
  'private-key': 'llave privada',
  'google-api-key': 'clave de API de Google',
  'api-key': 'clave de API',
  'aws-access-key': 'clave de acceso de AWS',
  'github-token': 'token de GitHub',
  'secret-assignment': 'contraseña o secreto asignado en el código',
  email: 'correo electrónico'
};

export function maskSecrets(input) {
  let text = String(input ?? '');
  const counts = new Map();
  for (const rule of RULES) {
    text = text.replace(rule.re, (...args) => {
      const replaced = rule.replace(...args);
      if (replaced !== args[0]) counts.set(rule.type, (counts.get(rule.type) || 0) + 1);
      return replaced;
    });
  }
  const findings = [...counts.entries()].map(([type, count]) => ({ type, label: LABELS[type], count }));
  return { text, masked: findings.length > 0, findings };
}

export function maskingNotice(findings) {
  const total = findings.reduce((n, f) => n + f.count, 0);
  const detail = findings.map((f) => `${f.label} (${f.count})`).join(', ');
  return `Se enmascararon ${total} dato(s) sensible(s) antes de enviar tu solicitud a Gemini: ${detail}. El código usa marcadores [REDACTED]; no pegues secretos reales.`;
}

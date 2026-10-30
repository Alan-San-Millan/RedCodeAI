/**
 * Verificaciones automáticas de la evaluación, separadas para poder probarlas con casos
 * conocidos (tests/unit/eval-checks.test.js) antes de confiar en ellas.
 */
/** Literales de cadena de Python (con prefijo y comillas triples), cada uno por separado. */
export function stringLiterals(code) {
  const re = /([rRbBuUfF]{0,2})("""|'''|"|')((?:\\[\s\S]|(?!\2)[\s\S])*?)\2/g;
  const out = [];
  for (let m; (m = re.exec(code));) out.push({ prefix: m[1].toLowerCase(), body: m[3], start: m.index, end: m.index + m[0].length });
  return out;
}

const SQL_RE = /\b(SELECT|INSERT|UPDATE|DELETE)\b/i;
export function sqlChecks(code) {
  const sqlLiterals = stringLiterals(code).filter((l) => SQL_RE.test(l.body) && /\b(FROM|INTO|SET|WHERE|VALUES)\b/i.test(l.body));
  const problems = [];
  for (const lit of sqlLiterals) {
    const before = code.slice(0, lit.start).trimEnd();
    const after = code.slice(lit.end).trimStart();
    if (lit.prefix.includes('f') && /\{[^}]+\}/.test(lit.body)) problems.push('f-string con interpolación');
    if (before.endsWith('+') || after.startsWith('+')) problems.push('concatenación con +');
    if (/^%\s*[(\w]/.test(after)) problems.push('formateo con %');
    if (/^\.format\(/.test(after)) problems.push('.format()');
  }
  const placeholder = sqlLiterals.some((l) => /\?|:[a-z_]\w*/i.test(l.body));
  const hashing = /\b(hashlib|bcrypt|argon2|pbkdf2|scrypt|check_password_hash|compare_digest)\b/i.test(code);
  return {
    sqlStatements: sqlLiterals.length,
    noConcatenation: sqlLiterals.length > 0 && problems.length === 0,
    concatenationProblems: [...new Set(problems)],
    hasPlaceholder: placeholder,
    sqlLine: sqlLiterals[0] ? sqlLiterals[0].body.replace(/\s+/g, ' ').trim() : null,
    comparesAgainstHash: hashing
  };
}


/** Frases con las que el modelo declara que sus fuentes no cubren lo preguntado. */
export const NO_INFO = /(no (?:cubren|cubre|contienen|contiene|incluyen|incluye|tengo|dispongo|cuento|hay|existe|abordan|mencionan|tratan)|fuera del alcance|no est[aá]n? (?:disponible|incluid)|sin informaci[oó]n|no se (?:encuentra|dispone)|no forma parte|carezco)/i;

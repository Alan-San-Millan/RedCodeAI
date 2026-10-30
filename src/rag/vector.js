/**
 * gemini-embedding-001 solo entrega vectores normalizados a 3072 dimensiones;
 * a 768 hay que normalizarlos para que el producto punto sea la similitud coseno.
 */
export function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!norm) return vector.map(() => 0);
  return vector.map((v) => v / norm);
}

export function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function cosine(a, b) {
  const na = Math.sqrt(dot(a, a));
  const nb = Math.sqrt(dot(b, b));
  if (!na || !nb) return 0;
  return dot(a, b) / (na * nb);
}

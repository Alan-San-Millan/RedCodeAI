/**
 * Reciprocal Rank Fusion: combina listas ordenadas sin tener que comparar puntajes de
 * escalas distintas (coseno vs. BM25). score(d) = Σ 1 / (k + rango_en_cada_lista).
 */
export function reciprocalRankFusion(lists, k = 60) {
  const scores = new Map();
  for (const list of lists) {
    list.forEach((item, index) => {
      scores.set(item.id, (scores.get(item.id) || 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Búsqueda por palabras clave (BM25 simple, sin dependencias). Complementa al coseno
 * capturando términos exactos: "SQL", "shell", "CWE-89", nombres de funciones.
 */
const STOPWORDS = new Set((
  // Español: artículos, preposiciones, pronombres y verbos de petición sin contenido técnico.
  'a al algo algun alguna alguno ante como con contra cual cuales cuando de del desde donde dos el ella ' +
  'ellos en entre era es esa ese eso esta estas este esto estos fue ha hay la las le les lo los mas me mi ' +
  'mis muy no nos o otra otro para pero por porque que quien se ser si sin sobre son su sus te ti tu tus ' +
  'un una uno unos unas y ya u yo debo debe deben hazme haz necesito quiero quisiera puedes podrias ' +
  'favor dime dice decir muestrame muestra cual cuales todo toda todos todas cada ' +
  // Inglés.
  'the of and or to in is are be for on with as by it this that an at from not if use should can ' +
  'will was were has have had its their there which who what when where how'
).split(' '));

export function tokenize(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .match(/cwe-\d+|[a-z0-9_]+/g)?.filter((t) => t.length > 1 && !STOPWORDS.has(t)) || [];
}

export function buildBm25(documents, { k1 = 1.2, b = 0.75 } = {}) {
  const docs = documents.map((d) => {
    const terms = tokenize(d.text);
    const tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
    return { id: d.id, length: terms.length, tf };
  });
  const df = new Map();
  for (const doc of docs) for (const t of doc.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avgLength = docs.reduce((s, d) => s + d.length, 0) / (docs.length || 1);
  const N = docs.length;

  return function search(query, { limit = 8, filter = () => true } = {}) {
    const terms = [...new Set(tokenize(query))];
    const results = [];
    for (const doc of docs) {
      if (!filter(doc.id)) continue;
      let score = 0;
      for (const t of terms) {
        const f = doc.tf.get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
        score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (doc.length / avgLength)));
      }
      if (score > 0) results.push({ id: doc.id, score });
    }
    return results.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id)).slice(0, limit);
  };
}

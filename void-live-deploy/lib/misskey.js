// The same ask in different words is one miss (list item 26): "What is a black hole?", "whats a black hole" and
// "tell me about black holes" count together on the board. Only the board merges; each row is stored as typed.
const FILLER = /^(?:please|pls|hey|hi|ok|okay|void|so|um|uh|can you|could you|would you|will you|i want to|i want|i'd like to|id like to|i need|show me|tell me about|tell me|give me|find me|find|look up|search for|search|what is|what's|whats|what are|who is|who's|whos|who was|what was)\s+/;
const TRAIL = /\s+(?:please|pls|for me|now|right now|thanks|thank you)$/;
export function missKey(ask) {
  let t = String(ask || '').toLowerCase().replace(/[’']/g, "'").replace(/[?!.,;:"“”()]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) { const n = t.replace(FILLER, '').replace(TRAIL, '').trim(); if (n === t) break; t = n; }
  const words = t.split(' ').filter((w) => w && !/^(a|an|the)$/.test(w))
    .map((w) => (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w));
  return words.join(' ') || String(ask || '').toLowerCase().trim();
}
// rows: [{ ask, count, first, last, fallback }] -> one row per key, named by its most-asked wording, with the other wordings
export function mergeMisses(rows) {
  const by = new Map();
  for (const r of rows || []) {
    if (!r || !r.ask) continue;
    const k = missKey(r.ask), g = by.get(k);
    if (!g) { by.set(k, { ...r, count: +r.count || 0, _words: [[r.ask, +r.count || 0]] }); continue; }
    g.count += +r.count || 0;
    if (r.first && (!g.first || r.first < g.first)) g.first = r.first;
    if (r.last && (!g.last || r.last > g.last)) { g.last = r.last; if (r.fallback) g.fallback = r.fallback; }
    g._words.push([r.ask, +r.count || 0]);
  }
  return [...by.values()].map((g) => {
    const words = g._words.sort((a, b) => b[1] - a[1]);
    const out = { ask: words[0][0], count: g.count, first: g.first, last: g.last, fallback: g.fallback };
    if (words.length > 1) out.variants = words.slice(1, 6).map((w) => w[0]);
    return out;
  });
}

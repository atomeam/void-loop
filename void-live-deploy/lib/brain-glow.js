// brain-glow: what Verse Brain was thinking about a moment ago survives a reload (owner, 2026-10-30: "go all out fixing stuff and make it
// all better"). The kept knowledge (lib/brain-mind.js knowledgeOf) holds what the brain learned, not which ideas were lit, so after a reload
// the words the visitor just told it were dark and dropped out of what it shows (the memory orbs card shows its brightest ideas). The page's
// host (lib/brain-host.js) keeps this glow on the device (lib/brain-store.js keepGlow) and puts it back into the new brain: each word comes
// back as an idea, as bright as it was, dimmed by how long the page was away (half as bright every HALF_MS), so a visit next week starts
// dark. Owner keys and other key-like words are never kept. Nothing is sent anywhere; Forget on the Verse Brain card clears it.
// Pure: tools/brain-glow.test.mjs.
import { tell } from './brain.js';

export const VERSION = 1, MAX_GLOW = 16, MIN_ACT = 0.02, HALF_MS = 10 * 60 * 1000;
const keyLike = (w) => w.length >= 16 && /\d/.test(w) && /[a-z]/.test(w);
const fine = (w) => typeof w === 'string' && /^[a-z0-9' -]{2,23}$/.test(w) && !keyLike(w);

/** the brain's lit ideas, brightest first, at most max: { v, at, ideas: [{ word, act }] }. at: the time it was read. Pure. */
export function glowOf(b, at = 0, max = MAX_GLOW) {
  const C = b && b.concepts, N = b && b.ws && b.ws.nodes, ideas = [];
  if (C && N && Array.isArray(C.words)) {
    const order = C.node.map((n, k) => ({ n, k })).filter(({ n }) => Number.isInteger(n) && n >= 0 && n < N.n && N.act[n] >= MIN_ACT).sort((p, q) => N.act[q.n] - N.act[p.n]);
    for (const { n, k } of order) { const word = C.words[k]; if (!fine(word)) continue; ideas.push({ word, act: Math.round(Math.min(1, N.act[n]) * 1000) / 1000 }); if (ideas.length >= max) break; }
  }
  return { v: VERSION, at: Number.isFinite(at) ? at : 0, ideas };
}

/** the same glow, as a string that changes only when the lit words or their brightness (to 0.05) change: saved only when it differs. Pure. */
export const glowKey = (g) => (g && Array.isArray(g.ideas) ? g.ideas.map((i) => i.word + ':' + Math.round(i.act * 20)).join(' ') : '');

/** put a kept glow back into a brain, dimmed by the time since it was kept (now - glow.at). A word the brain does not hold yet becomes an
 *  idea again; one it holds is lit at least as bright as it was. A record of the wrong shape changes nothing. Returns the words lit. */
export function loadGlow(b, g, now = 0) {
  if (!b || !g || g.v !== VERSION || !Array.isArray(g.ideas)) return [];
  const age = Math.max(0, (Number.isFinite(now) ? now : 0) - (Number.isFinite(g.at) ? g.at : 0)), dim = Math.pow(0.5, age / HALF_MS);
  const C = b.concepts, N = b.ws.nodes, lit = [];
  // the dimmest first, so the brightest is the newest idea, as it was before the reload
  const ideas = g.ideas.slice(0, MAX_GLOW).filter((i) => i && fine(i.word) && Number.isFinite(i.act)).reverse();
  for (const { word, act } of ideas) {
    const a = Math.min(1, Math.max(0, act)) * dim; if (a < MIN_ACT) continue;
    let k = C.words.indexOf(word); const before = k >= 0 ? N.act[C.node[k]] : 0;
    if (k < 0) { tell(b, word); k = C.words.indexOf(word); if (k < 0) continue; }
    N.act[C.node[k]] = Math.max(before, a); lit.push(word);
  }
  return lit.reverse();
}

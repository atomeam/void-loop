// brain-field — Verse Brain on the shared field (lib/shared-field.js, also at skills/field.js). Two ways, both numbers only:
//   in:  every other skill's live slot (a memory orb, say) is felt: feltFrom answers { x, y, act } for each, and the senses organ lays
//        it into the brain's memory layer where it sits, so what a visitor makes on another card becomes part of what the brain remembers.
//   out: the brain's ideas (its concept nodes) are written into slots of their own (position, a still velocity, the node's embedding,
//        its activation, the brain's provenance), so other skills see the brain in the field. Never the words: labels stay in the brain.
// A slot is claimed only where provenance is 0 or the brain's own code, the same rule lib/orb-field.js keeps, so no memory is written over.
// Every open Mind Field mode is felt the same way: its card keeps one slot of its own numbers (lib/mode-field.js).
import { KIND, EMB, nodesOf } from './brain-workspace.js';
import { MODES } from './mind-field-modes.js';

export const SKILL = 'verse-brain', MAX_FELT = 64, MAX_OUT = 16;

/** every live slot that is not the brain's, strongest first, at most MAX_FELT. field is the shared-field module. */
export function feltFrom(field, code) {
  return field.slots(0.02).filter((s) => s.code !== code).sort((a, b) => b.act - a.act).slice(0, MAX_FELT).map((s) => ({ x: s.x, y: s.y, act: Math.min(1, s.act) }));
}

/** a link that publishes the brain's concept nodes: { code, held, publish(b), close() }. */
export function linkBrain(field) {
  field.init();
  const L = field.layout, code = field.provenanceOf(SKILL), held = new Map(); // node index -> slot
  const put = (start, arr) => field.writeRegion(start, arr.length, arr, SKILL);
  const free = (i) => { const s = held.get(i); held.delete(i); put(L.act + s, [0]); put(L.prov + s, [0]); };
  function claim(i) {
    if (held.has(i)) return held.get(i);
    const prov = field.readRegion(L.prov, L.N), taken = new Set(held.values());
    for (let s = 0; s < L.N; s++) if (!taken.has(s) && (prov[s] === 0 || prov[s] === code)) { held.set(i, s); return s; }
    return -1;
  }
  return {
    code, get held() { return held.size; },
    publish(b) {
      const N = b.ws.nodes, top = nodesOf(b.ws, KIND.concept).sort((p, q) => N.act[q] - N.act[p]).slice(0, MAX_OUT), keep = new Set(top);
      for (const i of [...held.keys()]) if (!keep.has(i)) free(i);
      for (const i of top) {
        const s = claim(i); if (s < 0) break;
        const emb = new Float32Array(L.D); for (let k = 0; k < Math.min(EMB, L.D); k++) emb[k] = N.emb[i * EMB + k];
        put(L.pos + 3 * s, [N.x[i], N.y[i], 0]); put(L.vel + 3 * s, [0, 0, 0]); put(L.emb + L.D * s, emb);
        put(L.act + s, [Math.max(0.05, Math.min(1, N.act[i]))]); put(L.prov + s, [code]);
      }
      return held.size;
    },
    close() { for (const i of [...held.keys()]) free(i); }
  };
}

/** the line the card shows under the brain's words: how many memories it feels from other cards, whose they are, and how many ideas of
 *  its own it holds there. census is shared-field census(); felt is feltFrom(...).length; own is the link's held. Numbers in, words out. */
const CARD_NAMES = { ...Object.fromEntries(MODES.map((m) => [m.id, m.name])), 'agent-fluid-memory-orbs': 'Memory orbs' }; // each Mind Field mode by its switcher name
export function fieldSays(census, felt, own) {
  const others = Object.entries(census.held || {}).filter(([who]) => who !== SKILL).map(([who, n]) => (CARD_NAMES[who] || who.replace(/-/g, ' ')) + ' (' + n + ')');
  const mine = own ? ' It holds ' + own + ' of its own idea' + (own === 1 ? '' : 's') + ' there.' : '';
  if (!felt) return 'Shared field: nothing from other cards yet. Open a Mind Field mode or "memory orbs" and it shows here as a pink ring.' + mine;
  return 'Shared field: feels ' + felt + ' memor' + (felt === 1 ? 'y' : 'ies') + ' from other cards' + (others.length ? ': ' + others.join(', ') : '') + '.' + mine;
}

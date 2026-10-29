// mode-field, every Mind Field mode on the page joins Verse Brain through the shared field (lib/shared-field.js, also skills/field.js;
// owner, 2026-10-29: "combine all the builds into one entity", "all the pages are supposed to be able to work together", "dont fake it").
// One slot per open mode card, under the mode's own id: the card's own numbers, nothing made up for it.
//   position:   where the card's field has its attention (metrics cx, cy), on the stage's 0..1
//   embedding:  entropy, activity, consensus, the attention's x and y, pointer over, pointer down, tilt x, tilt y (the rest 0)
//   activation: the card's activity (0..1), so a calm field is felt faintly and a still one not at all
// Verse Brain feels the slot in its memory layer where it sits and names the mode on its card (lib/brain-field.js). A slot is claimed
// only where it is free or the mode's own, and freed when the card leaves. The memory orbs write their own orbs (lib/orb-field.js), so
// mountField does not link them here. Numbers only: never words, never the pointer's path.

const clamp01 = (v) => { const n = +v; return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; };

/** link one mode card to the field: { code, get slot(), write(metrics, input), close() }. field is the shared-field module. */
export function linkMode(field, id) {
  field.init();
  const L = field.layout, code = field.provenanceOf(id);
  let slot = -1;
  const put = (start, arr) => field.writeRegion(start, arr.length, arr, id);
  function claim() {
    const prov = field.readRegion(L.prov, L.N);
    for (let s = L.N - 1; s >= 0; s--) if (prov[s] === code) return s; // its own slot from before (a reload of the card)
    for (let s = L.N - 1; s >= 0; s--) if (prov[s] === 0) return s; // from the far end: the orbs and the brain take from the start
    return -1;
  }
  return {
    code, get slot() { return slot; },
    write(m, input = {}) {
      if (slot < 0 || field.readRegion(L.prov + slot, 1)[0] !== code) slot = claim();
      if (slot < 0) return false;
      const x = clamp01(m && m.cx != null ? m.cx : 0.5), y = clamp01(m && m.cy != null ? m.cy : 0.5);
      const emb = new Float32Array(L.D);
      [clamp01(m && m.entropy), clamp01(m && m.activity), clamp01(m && m.consensus), x, y, input.over ? 1 : 0, input.down ? 1 : 0, +input.tiltX || 0, +input.tiltY || 0].forEach((v, k) => { if (k < L.D) emb[k] = v; });
      put(L.pos + 3 * slot, [x, y, 0]); put(L.vel + 3 * slot, [0, 0, 0]); put(L.emb + L.D * slot, emb);
      put(L.act + slot, [clamp01(m && m.activity)]); put(L.prov + slot, [code]);
      return true;
    },
    close() { if (slot >= 0 && field.readRegion(L.prov + slot, 1)[0] === code) { put(L.act + slot, [0]); put(L.prov + slot, [0]); } slot = -1; }
  };
}

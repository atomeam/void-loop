// orb-memories: the memory orbs card shows what Verse really remembers, not only the fluid's own orbs (owner, 2026-10-30: "build anything
// you need or want to help you right into Verse connect it all to work seemlessly"). Three sources, all on the visitor's own device:
//   ideas   Verse Brain's concepts on this page (the page's brain, lib/brain-host.js window.verseBrainHost, the same brain the Verse Brain
//           card shows): each word the visitor told Verse, where the brain's workspace holds it and as bright as its activation there
//   heard   when this page has no brain: the words a brain on another tab posts (lib/brain-bridge.js connectBrain). Their places are not
//           sent, so each is placed by the word itself (the same word, the same place)
//   field   every other card's live slot in the shared field (lib/shared-field.js slots): a Mind Field mode where its attention is
// Each memory pulls a little dye into the fluid where it sits, so the fluid's own orbs pool on what Verse remembers. Nothing is sent to a
// server or stored here. Pure: tools/orb-memories.test.mjs.
import { MODES } from './mind-field-modes.js';

export const MAX_IDEAS = 8, MAX_FIELD = 8, PULL = 0.1;
const NAMES = { ...Object.fromEntries(MODES.map((m) => [m.id, m.name])), 'verse-brain': 'Verse Brain' };
const clamp01 = (v) => { const n = +v; return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; };
const clean = (w) => String(w == null ? '' : w).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };

/** the brain's ideas with their words: its concepts, brightest first, at most max. b is a lib/brain.js brain. Pure. */
export function ideasOf(b, max = MAX_IDEAS) {
  const C = b && b.concepts, N = b && b.ws && b.ws.nodes;
  if (!C || !N || !Array.isArray(C.words) || !Array.isArray(C.node)) return [];
  const out = [], seen = new Set();
  const order = C.node.map((n, k) => ({ n, k })).filter(({ n }) => Number.isInteger(n) && n >= 0 && n < N.n).sort((p, q) => N.act[q.n] - N.act[p.n]);
  for (const { n, k } of order) {
    const word = clean(C.words[k]), key = word.toLowerCase(); if (!word || seen.has(key)) continue; seen.add(key);
    out.push({ key: 'idea:' + key, kind: 'idea', word, x: clamp01(N.x[n]), y: clamp01(N.y[n]), act: clamp01(N.act[n]), from: 'Verse Brain' });
    if (out.length >= max) break;
  }
  return out;
}

/** a place for a word heard from another tab: the same for the same word, inside the card's margins. Pure. */
export function placeOf(word) {
  const h = fnv(clean(word).toLowerCase());
  return { x: 0.1 + 0.8 * ((h & 0xffff) / 0xffff), y: 0.12 + 0.76 * ((h >>> 16) / 0xffff) };
}

/** the words a brain on another tab posted (a connectBrain state): newest first, what it wants brightest. Pure. */
export function heardOf(state, max = MAX_IDEAS) {
  if (!state || !Array.isArray(state.words)) return [];
  const wants = new Set((Array.isArray(state.wants) ? state.wants : []).map((w) => clean(w).toLowerCase())), out = [], seen = new Set();
  for (const w of state.words.slice().reverse()) {
    const word = clean(w), key = word.toLowerCase(); if (!word || seen.has(key)) continue; seen.add(key);
    out.push({ key: 'idea:' + key, kind: 'heard', word, ...placeOf(word), act: wants.has(key) ? 1 : 0.6, from: 'Verse Brain' });
    if (out.length >= max) break;
  }
  return out;
}

/** other cards' live slots (shared-field slots()): never this card's own (own is its code), nor an owner in skip. Brightest first. Pure. */
export function fieldOf(slots, { own = 0, skip = [], max = MAX_FIELD } = {}) {
  if (!Array.isArray(slots)) return [];
  return slots.filter((s) => s && s.code !== own && !skip.includes(s.owner)).sort((p, q) => q.act - p.act).slice(0, max)
    .map((s) => ({ key: 'slot:' + s.slot, kind: 'field', word: '', x: clamp01(s.x), y: clamp01(s.y), act: clamp01(s.act), from: NAMES[s.owner] || String(s.owner || 'a card').replace(/-/g, ' ') }));
}

/** every memory the card shows: the brain's ideas on this page, else the words heard from another tab; then the other cards' slots. With
 *  the brain's ideas shown in words, its numbers-only slots are not shown a second time. Pure. */
export function memoriesOf({ brain = null, heard = null, slots = [], own = 0 } = {}) {
  const ideas = ideasOf(brain), words = ideas.length ? ideas : heardOf(heard);
  return [...words, ...fieldOf(slots, { own, skip: ideas.length ? ['verse-brain'] : [] })];
}

/** the words to hand on, in the order shown, each once. Pure. */
export const wordsOf = (mems) => [...new Set((mems || []).filter((m) => m.word).map((m) => m.word))];

/** where the memories pull the fluid: [{ x, y, dye }] in cells, a brighter memory pulling more. GW, GH: the fluid's grid. Pure. */
export const pullsOf = (mems, GW, GH) => (mems || []).map((m) => ({ x: m.x * GW, y: m.y * GH, dye: PULL * (0.3 + 0.7 * m.act) }));

/** the card's line: how many memories, their words, and which other cards hold slots. Pure. */
export function memorySays(mems) {
  const list = mems || [], words = wordsOf(list), cards = {};
  for (const m of list) if (m.kind === 'field') cards[m.from] = (cards[m.from] || 0) + 1;
  const others = Object.entries(cards).map(([who, n]) => who + ' (' + n + ')');
  if (!list.length) return 'No memories yet: tell Verse something (or open Verse Brain) and its words float here as orbs.';
  const said = words.length ? 'Verse remembers ' + words.slice(0, 5).join(', ') + (words.length > 5 ? ' and ' + (words.length - 5) + ' more' : '') + '. Tap a word to remind it.' : '';
  return [said, others.length ? 'From the shared field: ' + others.join(', ') + '.' : ''].filter(Boolean).join(' ');
}

// The card answers Verse as it thinks (owner via the team, 2026-10-30: the orbs "should feel alive on the stage, respond to what Verse
// remembers"): a memory that is new, or that Verse thinks about again (its brightness jumps), stirs the fluid where it sits, once, so an
// orb gathers there while you watch, and its word pulses. STIR is the jump that counts; a stir is as strong as the jump (or the brightness,
// for a new memory), from STIR_MIN up to 1.
export const STIR = 0.2, STIR_MIN = 0.35;
/** the memories that stir now: [{ key, x, y, word, strength }]. before: Map key -> brightness from the last pass (updated in place).
 *  Memories that left are dropped from it, so coming back counts as new. Pure apart from before, which the caller owns. */
export function stirsOf(before, mems) {
  const out = [], live = new Set();
  for (const m of mems || []) {
    if (!m || m.key == null) continue; live.add(m.key);
    const act = clamp01(m.act), was = before.get(m.key);
    if (was === undefined || act - was >= STIR) out.push({ key: m.key, x: clamp01(m.x), y: clamp01(m.y), word: m.word || '', strength: Math.max(STIR_MIN, Math.min(1, was === undefined ? act : act - was + STIR_MIN)) });
    before.set(m.key, act);
  }
  for (const k of [...before.keys()]) if (!live.has(k)) before.delete(k);
  return out;
}
/** the remembered word an orb is nearest, within r (both in 0..1 of the card), or ''. Pure. */
export function wordNear(mems, x, y, r = 0.12) {
  let best = '', bd = r * r;
  for (const m of mems || []) { if (!m || !m.word) continue; const dx = clamp01(m.x) - x, dy = clamp01(m.y) - y, d = dx * dx + dy * dy; if (d <= bd) { bd = d; best = m.word; } }
  return best;
}

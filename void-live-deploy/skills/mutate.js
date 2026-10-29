/**
 * mutate skill - the mutation chamber (asked by the owner, 2026-10-18, stage pack E, the Opposite Era). "mutate this card" / "mutate the
 * sticky": the picked or named thing evolves in front of you, one generation a second: a seeded genome (hue, scale, border, corners,
 * tilt) steps each tick and the thing is drawn from it (a CSS filter, transform and border), with a "gen N" tag on its corner. "lock
 * generation 7" freezes it at exactly that generation (earlier or later than now: the genome is replayed from the seed, so generation 7
 * is always the same generation 7); "stop mutating" clears it. Nothing is saved: a mutation is a show, not a change to the thing.
 * "mutate a gene" and "what is a mutation" are not this. The genome and its steps are pure and tested in tools/stage-pack-e.test.mjs.
 */
import { rng, elOf, nameOf } from '../lib/opposite-era.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** { act: 'start', target } | { act: 'lock', gen } | { act: 'stop' } | null. target: 'this' (the picked thing) or the kind or name named. Pure. */
export function mutateOf(text) {
  const t = CLEAN(text);
  let m = /^(?:start\s+)?mutat(?:e|ing)\s+(?:(this|it|that)(?:\s+(?:card|thing|one))?|(?:the|my)\s+(?:selected\s+|picked\s+)?([a-z][a-z0-9 -]{0,30}?))$/.exec(t);
  if (m) { const w = m[1] ? 'this' : m[2].replace(/\s+(?:card|thing|one)$/, ''); return { act: 'start', target: /^(?:this|card|thing|one|selected|picked|selection)$/.test(w) ? 'this' : w }; }
  if (/^(?:start\s+)?(?:the\s+)?mutation(?:\s+chamber)?$/.test(t) || /^(?:start\s+)?mutating$/.test(t)) return { act: 'start', target: 'this' };
  m = /^(?:lock|freeze|keep|hold)(?:\s+(?:it\s+)?at)?\s+(?:gen(?:eration)?|g)\s*(\d{1,5})$/.exec(t);
  if (m) return { act: 'lock', gen: +m[1] };
  if (/^(?:stop|end|halt|cancel)\s+(?:the\s+)?(?:mutating|mutation|mutations|mutation\s+chamber)$/.test(t) || /^stop\s+mutating\s+(?:it|this|that)$/.test(t)) return { act: 'stop' };
  return null;
}

export const LIMITS = { hue: [0, 360], scale: [0.6, 1.6], border: [0, 8], radius: [0, 40], tilt: [-20, 20] };
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
/** generation 0: a plain thing. Pure. */
export const base = () => ({ hue: 0, scale: 1, border: 0, radius: 0, tilt: 0 });
/** one generation on from g, with r as the random source: hue drifts, scale, border, corners and tilt wander within LIMITS. Pure. */
export function stepGenome(g, r) {
  return {
    hue: ((g.hue + (r() - 0.5) * 80) % 360 + 360) % 360,
    scale: clamp(g.scale + (r() - 0.5) * 0.24, LIMITS.scale),
    border: clamp(g.border + (r() - 0.5) * 3, LIMITS.border),
    radius: clamp(g.radius + (r() - 0.5) * 12, LIMITS.radius),
    tilt: clamp(g.tilt + (r() - 0.5) * 8, LIMITS.tilt),
  };
}
/** the genome at generation gen from a seed: the same seed and gen always give the same genome. Pure. */
export function genomeAt(seed, gen) {
  const r = rng(seed); let g = base();
  for (let i = 0; i < Math.max(0, Math.floor(+gen || 0)); i++) g = stepGenome(g, r);
  return g;
}
/** how a genome is drawn: inline style values. Pure. */
export function styleOf(g) {
  return {
    filter: 'hue-rotate(' + Math.round(g.hue) + 'deg) saturate(' + (1 + g.border / 8).toFixed(2) + ')',
    transform: 'scale(' + g.scale.toFixed(3) + ') rotate(' + g.tilt.toFixed(1) + 'deg)',
    border: g.border > 0.3 ? Math.round(g.border) + 'px solid hsl(' + Math.round(g.hue) + ' 80% 60%)' : '',
    borderRadius: g.radius > 1 ? Math.round(g.radius) + 'px' : '',
  };
}
/** the gen tag's words. Pure. */
export const tagOf = (gen, locked) => 'gen ' + gen + (locked ? ' · locked' : '');

let state = null; // { id, seed, gen, locked, timer }
function paint(st) {
  if (!state) return;
  const el = elOf(st, state.id); if (!el) return;
  const s = styleOf(genomeAt(state.seed, state.gen));
  el.style.filter = s.filter; el.style.transform = s.transform; el.style.border = s.border; el.style.borderRadius = s.borderRadius;
  let tag = el.querySelector(':scope > .mutate-gen');
  if (!tag) { tag = document.createElement('span'); tag.className = 'mutate-gen'; tag.style.cssText = 'position:absolute;top:-10px;right:-6px;font:11px/1.4 ui-monospace,monospace;padding:0 6px;border-radius:8px;background:#111;color:#fff;pointer-events:none;z-index:3'; el.appendChild(tag); }
  tag.textContent = tagOf(state.gen, state.locked);
  tag.dataset.gen = String(state.gen); if (state.locked) tag.dataset.locked = '1'; else delete tag.dataset.locked;
}
function clear(st) {
  if (!state) return;
  clearInterval(state.timer);
  const el = elOf(st, state.id);
  if (el) { el.style.filter = ''; el.style.transform = ''; el.style.border = ''; el.style.borderRadius = ''; const tag = el.querySelector(':scope > .mutate-gen'); if (tag) tag.remove(); }
  state = null;
}
/** the thing an ask names: the picked one (or the last put up) for 'this', else the first whose kind or name has the word */
export function targetOf(st, target) {
  const things = st.things(), all = Object.values(things).filter((t) => t && t.id && t.kind !== 'figure');
  if (!target || target === 'this') return things[st.selected()] || all[all.length - 1] || null;
  const w = String(target).toLowerCase(), kind = st.targetKind ? st.targetKind(w) : null;
  return all.find((t) => t.kind === w || (kind && t.kind === kind)) || all.find((t) => (String(t.name || t.title || t.label || '')).toLowerCase().includes(w)) || null;
}
export const mutating = () => (state ? { id: state.id, gen: state.gen, locked: state.locked } : null);

async function run(text, api) {
  const want = mutateOf(text);
  if (!want) return 'none';
  const st = api.stage;
  if (want.act === 'stop') { const had = !!state; clear(st); api.say(had ? 'the mutation stops · back to how it was' : 'nothing is mutating'); return 'mutate'; }
  if (want.act === 'lock') {
    if (!state) { api.say('nothing is mutating · "mutate this card" first'); return 'mutate'; }
    clearInterval(state.timer); state.gen = want.gen; state.locked = true; paint(st);
    api.say('locked at generation ' + want.gen);
    return 'mutate';
  }
  const th = targetOf(st, want.target);
  if (!th) { api.say(want.target === 'this' ? 'nothing to mutate · put something on the stage first' : 'no ' + want.target + ' on the stage to mutate'); return 'mutate'; }
  clear(st);
  state = { id: th.id, seed: (Date.now() % 100000) + 1, gen: 1, locked: false, timer: 0 };
  st.select(th.id);
  paint(st);
  state.timer = setInterval(() => { if (!state) return; if (!elOf(st, state.id)) { clear(st); return; } state.gen++; paint(st); }, 1000); // a thing thrown off the stage ends its mutation
  api.say('mutating the ' + nameOf(th) + ' · "lock generation 7" freezes it, "stop mutating" clears it');
  return 'mutate';
}

export default {
  name: 'mutate',
  examples: ['mutate this card', 'lock generation 7', 'stop mutating'],
  nearMisses: ['mutate a gene', 'what is a mutation', 'genetic mutation in fruit flies'],
  match(lower, text) { return !!mutateOf(text || lower); },
  run,
  mutateOf, stepGenome, genomeAt, styleOf, tagOf,
};

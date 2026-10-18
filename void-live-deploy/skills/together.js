/**
 * together skill — two figures on the stage pick something to do with each other (frontier #4, the owner's 2026-10-11 piece:
 * "figures left together pick something to do"). Each figure advertises what it offers, from what it is (its script's tags,
 * skills/scripts.js), and scores the other's offers by its own needs, the way The Sims' objects advertise affordances that
 * each Sim scores by its needs. The pair takes the best of trade, spar, inspect and argue, and Verse says why: "the police
 * officer and the thief spar: the thief offers a scuffle and the police officer wants one". Ask "what are they doing". Pure
 * choosing, no model; the same pair always picks the same, whichever came first. Then the two act it out on the stage: they
 * walk to each other and do the kind's own move for a few seconds (skills/figures3d.js meet).
 */
import { fallbackScript } from './scripts.js';
import { append } from './notepad.js';
import { togetherLine } from '../lib/bridges.js';

export const KINDS = ['trade', 'spar', 'inspect', 'argue'];

// what a figure with this tag offers the other
const OFFERS = {
  person: ['trade', 'argue'], chef: ['trade'], sprite: ['inspect', 'trade'], police: ['spar', 'argue'], troublemaker: ['spar', 'argue'],
  idea: ['argue', 'inspect'], animal: ['inspect'], cat: ['spar'], dog: ['spar'], zombie: ['spar'], shark: ['spar'],
  object: ['inspect'], place: ['inspect'], food: ['inspect'], flower: ['inspect'], cloud: ['inspect'], sun: ['inspect'],
  fire: ['inspect'], ice: ['inspect'], water: ['inspect'],
};
// how much a figure with this tag wants each interaction (0..1; a figure's need is the most any of its tags wants)
const NEEDS = {
  person: { trade: 0.6, argue: 0.4, inspect: 0.3 }, chef: { trade: 0.9 }, sprite: { inspect: 0.6, trade: 0.3 },
  police: { spar: 0.9, argue: 0.4 }, troublemaker: { argue: 0.7, spar: 0.6 }, idea: { argue: 0.9, inspect: 0.3 },
  animal: { inspect: 0.7 }, cat: { spar: 0.6 }, dog: { spar: 0.6 }, zombie: { spar: 0.6 }, shark: { spar: 0.6 },
};
const OFFER_WORD = { trade: 'something to trade', spar: 'a scuffle', inspect: 'something to look at', argue: 'an argument' };
const VERB = { trade: 'trade', spar: 'spar', inspect: 'look each other over', argue: 'argue' };
const UNOFFERED = 0.25; // wanting what the other does not offer still counts a little
const ENOUGH = 0.3; // below this the two just keep to themselves

const tagsOf = (script) => (script && Array.isArray(script.tags) ? script.tags : []);

/** what this figure offers, in KINDS order. Pure. */
export function offersOf(script) {
  const out = new Set();
  for (const t of tagsOf(script)) for (const k of OFFERS[t] || []) out.add(k);
  return KINDS.filter((k) => out.has(k));
}

/** how much this figure wants each interaction, 0..1. Pure. */
export function needsOf(script) {
  const out = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const t of tagsOf(script)) for (const [k, v] of Object.entries(NEEDS[t] || {})) out[k] = Math.max(out[k], v);
  return out;
}

const nameOf = (f) => String((f && (f.title || f.kindOf)) || 'sprite').trim().toLowerCase();
const scriptOf = (f) => (f && f.script) || fallbackScript((f && f.body) || 'sprite', f && f.title);

/** what two figures do together: { kind, score, why } or null when neither wants anything the other has. Pure. */
export function choose(a, b) {
  const sa = scriptOf(a), sb = scriptOf(b), oa = offersOf(sa), ob = offersOf(sb), na = needsOf(sa), nb = needsOf(sb);
  let best = null;
  for (const k of KINDS) { // a tie goes to the earlier kind, so the choice never depends on the order of the two
    const score = na[k] * (ob.includes(k) ? 1 : UNOFFERED) + nb[k] * (oa.includes(k) ? 1 : UNOFFERED);
    if (!best || score > best.score + 1e-9) best = { kind: k, score };
  }
  if (!best || best.score < ENOUGH) return null;
  const k = best.kind;
  // the one who wants it more is the wanter; the other offers it (when both want it equally, the first offers)
  const [wanter, giver] = na[k] > nb[k] ? [a, b] : [b, a];
  const why = 'the ' + nameOf(a) + ' and the ' + nameOf(b) + ' ' + VERB[k] + ': the ' + nameOf(giver) + ' offers ' + OFFER_WORD[k]
    + ' and the ' + nameOf(wanter) + ' wants ' + (k === 'inspect' ? 'a closer look' : 'one');
  return { kind: k, score: +best.score.toFixed(3), why };
}

/** the ask: "what are they doing", "what would they do together", "what are the figures doing". Pure. */
export function togetherAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return /^what (?:are|would|will|might|do|could) (?:they|the figures|those two|these two|the two|the two of them|them)(?: two)? (?:be )?(?:doing|do)(?: together| now| next| with each other)?\s*[?.!]*$/.test(t);
}

async function run(text, api) {
  if (!togetherAsk(text)) return 'none';
  const figs = Object.values(api.stage.things()).filter((t) => t && t.kind === 'figure');
  if (figs.length < 2) { api.say(figs.length ? 'one figure has no one to be with yet: summon another, "bring a dog"' : 'summon two figures first: "summon a zombie", then "bring a dog"'); return 'together'; }
  const [a, b] = figs.slice(-2); // the two that came last
  const c = choose(a, b);
  if (c) append(api.stage, togetherLine(c)); // their argument is also written down (asked by Void, 2026-10-16: figures together -> the notepad)
  api.say(c ? c.why : 'the ' + nameOf(a) + ' and the ' + nameOf(b) + ' have nothing the other wants, so each keeps to itself');
  // and they act it out on the stage: walk to each other, then the kind's own move (skills/figures3d.js meet; no 3D, no harm)
  if (c && typeof document !== 'undefined') import('./figures3d.js').then((m) => m.meet && m.meet(a.id, b.id, c.kind)).catch(() => {});
  return 'together';
}

export default {
  name: 'together',
  examples: ['what are they doing', 'what would they do together', 'what are the figures doing'],
  nearMisses: ['what are they doing in congress', 'what are you doing', 'what do zombies do', 'what is a figure'],
  match(lower, text) { return togetherAsk(text); },
  run,
  offersOf, needsOf, choose, togetherAsk,
};

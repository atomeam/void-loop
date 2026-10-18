// field-cards — F-038 Living Spatial Cards Mind (Grok's frontier idea, delivered to atomeam/a-to-mind.com 85651746; asked by the owner,
// 2026-10-17: "all of Grok's ideas are to be added to Void"). A 64x48 Gray-Scott reaction-diffusion lattice (u: the activator that
// is drawn and sampled, v: the substrate it feeds on; a logistic rule settled into a flat sheet, this keeps spots and stripes moving)
// whose feed, kill and diffusion are a genome, and five cards that live in it: each card pulls energy
// toward itself, drifts along the field's gradient, and takes its size, hue, blur and opacity from the field around it. Dragging a
// card seeds energy where it is. A small evolutionary mind scores each genome by replaying a short run from the current field and
// keeps the rules that give a complex, active field that answers the cards. Pure: no DOM, no clock, no Math.random; the skill
// (skills/living-cards-mind.js) mounts it on lib/field-stage.js and thinks in a Worker (lib/field-worker.js).
import { rng, makeGrid, idx, laplacian4, clamp, entropy, stats, randomGenome, evolveStep } from './field-kit.js';

export const GW = 64, GH = 48, CARDS = 5, POP = 6, TRIAL = 60, MIND_EVERY = 2;
export const SPEC = { feed: [0.018, 0.062], kill: [0.045, 0.066], diffU: [0.05, 0.11], diffV: [0.16, 0.22], attract: [0, 0.004] };
export const LABELS = ['idea', 'stage', 'card', 'mind', 'you'];
// family gravity (asked by Void, 2026-10-17: "cards with matching skill family IDs drift toward a common center"): each card belongs to
// one of Verse's skill families (skills/families.json names), and cards of one family are pulled toward the centre of the others until
// they sit REST apart; a card alone in its family feels nothing, and a held card pulls its family to it without being moved.
export const FAMILIES = { idea: 'Void itself', mind: 'Void itself', stage: 'The stage', card: 'The stage', you: 'Out in the world' };
export const GRAVITY = 0.0008, REST = 0.14;

const fix = (g) => Object.fromEntries(Object.keys(SPEC).map((k) => [k, clamp(Number(g && g[k]), SPEC[k][0], SPEC[k][1]) || SPEC[k][0]]));

/** a new field and its five cards from a seed. */
export function create(seed = 1) {
  const r = rng(seed), u = makeGrid(GW, GH), v = makeGrid(GW, GH, 1);
  const cards = LABELS.map((label, i) => ({ label, family: FAMILIES[label], x: 0.15 + (i % 3) * 0.35 + r() * 0.05, y: i < 3 ? 0.3 : 0.72, hue: Math.round(i * 72), local: 0 }));
  for (let n = 0; n < 10; n++) seedAt(u, r(), r(), 0.5, 2, v);
  for (const c of cards) seedAt(u, c.x, c.y, 0.5, 2, v);
  return { seed, u, v, genome: fix({ feed: 0.037, kill: 0.06, diffU: 0.08, diffV: 0.2, attract: 0.0015, ...(r() < 0.5 ? randomGenome(SPEC, r) : {}) }), cards, act: 0, t: 0, dragging: -1, boost: 0 };
}

/** the mean of u in a circle of radius rad cells around (x, y) in 0..1. Pure. */
export function sample(u, x, y, rad = 4) {
  const cx = Math.round(x * (GW - 1)), cy = Math.round(y * (GH - 1)); let s = 0, n = 0;
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad) { s += u[idx(cx + dx, cy + dy, GW, GH)]; n++; }
  return n ? s / n : 0;
}
/** put energy into u around (x, y): a pointer press or a dragged card. */
export function seedAt(u, x, y, amt = 0.5, rad = 3, v = null) {
  const cx = Math.round(x * (GW - 1)), cy = Math.round(y * (GH - 1));
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const d2 = dx * dx + dy * dy; if (d2 <= rad * rad) { const i = idx(cx + dx, cy + dy, GW, GH); u[i] = Math.min(1, u[i] + amt); if (v) v[i] = Math.max(0, v[i] - amt * 0.5); } }
}

/** one Gray-Scott step under a genome, with the cards as gentle sources of u; returns the mean absolute change of u (activity). Pure on its inputs. */
export function lattice(u, v, g, cards, k = 1) {
  const nu = new Float32Array(u.length), nv = new Float32Array(v.length), h = Math.min(1, k); let moved = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, a = u[i], b = v[i], r = b * a * a;
    let pull = 0; if (g.attract) for (const c of cards) { const dx = x / (GW - 1) - c.x, dy = y / (GH - 1) - c.y; pull += Math.exp(-(dx * dx + dy * dy) * 400); }
    nu[i] = clamp(a + h * (g.diffU * laplacian4(u, x, y, GW, GH) + r - (g.feed + g.kill) * a + g.attract * pull), 0, 1);
    nv[i] = clamp(b + h * (g.diffV * laplacian4(v, x, y, GW, GH) - r + g.feed * (1 - b)), 0, 1);
    moved += Math.abs(nu[i] - a);
  }
  u.set(nu); v.set(nv); return moved / u.length;
}
/** family gravity for card i: the step toward the centre of the other cards of its family, at most GRAVITY * k, stopping REST away;
 *  { dx, dy } is zero for a card alone in its family or one without a family. Pure. */
export function familyPull(cards, i, k = 1) {
  const c = cards[i], kin = c && c.family ? cards.filter((o, j) => j !== i && o.family === c.family) : [];
  if (!kin.length) return { dx: 0, dy: 0 };
  const dx = kin.reduce((t, o) => t + o.x, 0) / kin.length - c.x, dy = kin.reduce((t, o) => t + o.y, 0) / kin.length - c.y, d = Math.hypot(dx, dy);
  if (d <= REST) return { dx: 0, dy: 0 };
  const m = Math.min(GRAVITY * k, d - REST) / d; return { dx: dx * m, dy: dy * m };
}
/** the cards drift along the field's gradient (toward more energy) and toward their family, stay inside, and remember the field around
 *  them. Pure on its inputs. */
export function driftCards(u, cards, k = 1, held = -1) {
  const e = 1 / GW, pulls = cards.map((_, i) => familyPull(cards, i, k));
  cards.forEach((c, i) => {
    c.local = sample(u, c.x, c.y);
    if (i === held) return;
    const gx = sample(u, c.x + e * 3, c.y, 2) - sample(u, c.x - e * 3, c.y, 2), gy = sample(u, c.x, c.y + e * 3, 2) - sample(u, c.x, c.y - e * 3, 2);
    c.x = clamp(c.x + gx * 0.004 * k + pulls[i].dx, 0.06, 0.94); c.y = clamp(c.y + gy * 0.004 * k + pulls[i].dy, 0.08, 0.92);
  });
}

// velocity trail (asked by Void: "a 'velocity' visual, a faint motion trail, so users can see the momentum of the field when it's actively
// rearranging things"): each card's last TRAIL positions, newest last; the card draws them as a fading line, brighter the faster it moves
export const TRAIL = 20, TRAIL_EVERY = 25; // positions, one every 25 ms (the card's draw records them): half a second of path
export const TRAIL_MIN = 0.004; // the speed (field widths per position) below which a card leaves no trail: drifting is not moving
/** add a card's position to its trail, keeping the last `max`. Pure on its inputs. */
export function trailPush(trail, c, max = TRAIL) { trail.push({ x: c.x, y: c.y }); if (trail.length > max) trail.splice(0, trail.length - max); return trail; }
/** how fast a trail moved, in field widths per step over its length (0 when it is too short). Pure. */
export function trailSpeed(trail) {
  if (!trail || trail.length < 2) return 0; let d = 0;
  for (let i = 1; i < trail.length; i++) d += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
  return d / (trail.length - 1);
}
// displacement ripple (asked by Void, its next video trick: "a 'displacement' effect where a card appears to ripple the spatial field as it
// moves, making the stage feel less like a screen and more like a liquid"): a moving card drops a ripple every RIPPLE_EVERY ms; each grows
// to RIPPLE_R field widths over RIPPLE_LIFE ms and fades, and the card's draw bends the field inside its ring like a lens through water
export const RIPPLE_EVERY = 110, RIPPLE_LIFE = 900, RIPPLE_R = 0.2, RIPPLE_MAX = 30;
/** drop a ripple { x, y, t } for each card that moves (its trail at least TRAIL_MIN fast) when RIPPLE_EVERY ms have passed since `last`;
 *  drops the ones older than RIPPLE_LIFE and keeps at most RIPPLE_MAX. Returns the time of this drop (or `last`). Pure on its inputs. */
export function rippleTick(ripples, cards, trails, now, last = -Infinity) {
  for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t >= RIPPLE_LIFE) ripples.splice(i, 1);
  if (now - last < RIPPLE_EVERY) return last;
  (cards || []).forEach((c, i) => { if (c && trailSpeed(trails && trails[i]) >= TRAIL_MIN) ripples.push({ x: c.x, y: c.y, t: now }); });
  if (ripples.length > RIPPLE_MAX) ripples.splice(0, ripples.length - RIPPLE_MAX);
  return now;
}
/** how a ripple looks at `now`: { r } its radius in field widths (easing out, fast then slow) and { a } its strength (1 → 0). Pure. */
export function rippleAt(rp, now) {
  const k = clamp((now - rp.t) / RIPPLE_LIFE, 0, 1), e = 1 - (1 - k) * (1 - k);
  return { r: RIPPLE_R * e, a: 1 - k };
}
/** a step: dt in seconds; input { x, y, down } from the pointer seeds energy. */
export function step(s, dt = 1 / 60, input = {}) {
  const k = clamp(dt * 60, 0.25, 3);
  if (input.down) seedAt(s.u, input.x, input.y, 0.25, 2, s.v);
  if (s.dragging >= 0 && s.cards[s.dragging]) { const c = s.cards[s.dragging]; seedAt(s.u, c.x, c.y, 0.2, 2, s.v); s.boost = Math.min(5, s.boost + dt); }
  else s.boost = Math.max(0, s.boost - dt * 0.2);
  const a = lattice(s.u, s.v, s.genome, s.cards, k);
  s.act = s.act * 0.9 + a * 0.1; s.t += dt;
  driftCards(s.u, s.cards, k, s.dragging);
}

/** how a card looks from the field around it: { left, top (percent), scale, hue, blur (px), opacity }. Pure. */
export function cardStyle(c, activity = 0) {
  const v = clamp(c.local || 0, 0, 1);
  return { left: +(c.x * 100).toFixed(2), top: +(c.y * 100).toFixed(2), scale: +(0.82 + v * 0.45).toFixed(3), hue: Math.round((c.hue + v * 140) % 360), blur: +(Math.max(0, 1 - activity * 400) * 1.4).toFixed(2), opacity: +(0.6 + v * 0.4).toFixed(3) };
}

/** the field's numbers: entropy (how varied), activity (how much it moves), consensus (how much the field answers the cards: more energy
 *  around them than elsewhere), cx/cy (where its energy sits), each 0..1. Pure. */
export function measure(u, cards, act) {
  const st = stats(u), around = cards.length ? cards.reduce((t, c) => t + sample(u, c.x, c.y), 0) / cards.length : st.mean;
  let mx = 0, my = 0, m = 0; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const w = u[y * GW + x]; mx += w * x; my += w * y; m += w; }
  return { entropy: entropy(u, 16), activity: clamp(act * 400, 0, 1), consensus: clamp(0.5 + (around - st.mean) * 2, 0, 1), cx: m ? mx / m / (GW - 1) : 0.5, cy: m ? my / m / (GH - 1) : 0.5, variance: st.variance };
}
export const metrics = (s) => measure(s.u, s.cards, s.act);
/** what the mind rewards: a varied field that keeps moving and answers its cards. Pure. */
export const fitness = (m) => 0.45 * m.entropy + 0.35 * m.activity + 0.2 * m.consensus;

/** one generation, for a Worker or the page: replay TRIAL steps of each genome from the same snapshot and breed the next population.
 *  arg { pop, u, v, cards, seed, gen, boost } -> { pop, best, fitness, gen }. Synchronous and deterministic for its inputs. */
export function evolveCards(arg) {
  const r = rng((arg.seed || 1) * 7919 + (arg.gen || 0)), pop = (arg.pop && arg.pop.length ? arg.pop : Array.from({ length: POP }, () => randomGenome(SPEC, r))).map(fix);
  const fits = pop.map((g) => {
    const u = Float32Array.from(arg.u), v = Float32Array.from(arg.v), cards = (arg.cards || []).map((c) => ({ ...c })); let act = 0;
    for (let i = 0; i < TRIAL; i++) { act = act * 0.9 + lattice(u, v, g, cards, 1) * 0.1; if (i % 6 === 0) driftCards(u, cards, 6); }
    const m = measure(u, cards, act); return fitness(m) + (arg.boost > 0 ? 0.1 * m.consensus : 0); // a dragged card asks for rules that answer it
  });
  let bi = 0; fits.forEach((f, i) => { if (f > fits[bi]) bi = i; });
  return { pop: evolveStep(pop, fits, SPEC, r, { elite: 2 }).map(fix), best: pop[bi], fitness: fits[bi], gen: (arg.gen || 0) + 1 };
}
export const setGenome = (s, g) => { s.genome = fix(g); };
export const params = (s) => Object.fromEntries(Object.entries(s.genome).map(([k, v]) => [k, Math.round(v * 10000) / 10000]));

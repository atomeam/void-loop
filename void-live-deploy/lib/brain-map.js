// brain-map: Verse Brain drawn so anyone can see it is a real, working brain (owner, 2026-10-30: "really wow people by having things anyone
// can see and understand they are looking at a real functional brain"; 2026-10-29: "dont fake it"). The page that draws it is /brain/
// (brain/map.js); this module is the part that decides what is drawn, from the brain's own state, with no DOM and no clock:
//   lobes      the organs of lib/brain.js grouped by what they do, in plain words, and where each sits on the map
//   snap       a small copy of what changes: how many turns each organ has had (b.runs), how many cells each organ wrote in each region of
//              the shared working memory (ws.regionWrites, which the imagined futures put back), the words, goals, moments and choices
//   flowOf     between two snaps: the turns the attention gave (one spark from Attention to each organ that ran) and the writes each organ
//              made into the working memory (one spark from the organ to the region it wrote). Nothing moves on the map without one.
//   eventsOf   between two snaps: plain sentences, each about one organ, each from a change in the state ("Concepts learned "maps"")
//   pathOf     the events after an ask, in the order they happened: the path of that thought through the organs
// Tests: tools/brain-map.test.mjs (a real brain, stepped; no event or spark without a change in its state).

export const REGIONS_X = 4, REGIONS_Y = 3, REGIONS = REGIONS_X * REGIONS_Y; // lib/brain-workspace.js (the test checks they agree)
export const ACTIONS = ['rest', 'seed', 'gather', 'swirl', 'scatter', 'recall']; // lib/brain-organs.js ACTIONS (the test checks)
const OWNER_KEY = /^\s*(?:unlock\s*)+\S{16,}/i;
export const isKey = (t) => OWNER_KEY.test(String(t || ''));

/** the organs by what they do. An organ not named here goes in the last lobe, so a new organ is never left off the map. */
export const LOBES = [
  { id: 'feel', name: 'Feeling', note: 'what it senses of you', hue: 196, organs: ['senses', 'synapses', 'hearing'] },
  { id: 'guess', name: 'Guessing', note: 'what it expects next', hue: 268, organs: ['predictor', 'gestures', 'memory'] },
  { id: 'words', name: 'Words', note: 'the ideas you give it', hue: 318, organs: ['concepts'] },
  { id: 'decide', name: 'Deciding', note: 'what it does next', hue: 40, organs: ['will', 'arena'] },
  { id: 'life', name: 'Living tissue', note: 'the surface it thinks on', hue: 150, organs: ['tissue', 'gardener', 'rhythm', 'membrane', 'swarm'] },
  { id: 'flow', name: 'Moving matter', note: 'fluids and grains after its focus', hue: 176, organs: ['current', 'grains', 'pool', 'trace'] },
  { id: 'make', name: 'Making', note: 'what it builds and evolves', hue: 12, organs: ['painter', 'grower', 'formula', 'creature'] }
];
/** what each organ does, in a few plain words (the full job is in lib/brain-organs.js and its own module) */
export const ROLE = {
  senses: 'feels your pointer, tilt and sound', predictor: 'guesses your next move', gestures: 'names how you move', memory: 'expects what comes after a move',
  concepts: 'links the words you give it', tissue: 'the living surface', gardener: 'keeps the tissue at the edge of chaos', rhythm: 'keeps it in step',
  membrane: 'wraps what it attends to', swarm: 'particles that feed the tissue', synapses: 'a spiking eye that learns where to look', hearing: 'hears a hum as notes',
  painter: 'rewrites its own look', grower: 'grows a plant toward its focus', formula: 'evolves a formula for its tissue', creature: 'a creature that walks to its thought',
  current: 'a flow your drag stirs', grains: 'grains that learn to land', pool: 'a fluid that follows its focus', trace: 'holds where its focus was',
  will: 'decides what to do next', arena: 'tests whole brains in imagined futures'
};
export const regionName = (r) => ['top', 'middle', 'bottom'][Math.floor(r / REGIONS_X)] + ' ' + ['far left', 'left', 'right', 'far right'][r % REGIONS_X];

/** the lobes with every organ of ids placed once, in order. Pure. */
export function lobesOf(ids) {
  const known = new Set(LOBES.flatMap((l) => l.organs)), out = LOBES.map((l) => ({ ...l, organs: l.organs.filter((id) => ids.includes(id)) }));
  for (const id of ids) if (!known.has(id)) out[out.length - 1].organs.push(id);
  return out.filter((l) => l.organs.length);
}

// lobe centres in a unit box, shaped like a brain seen from the side (front to the right); Attention sits in the middle of them
const SPOT = { feel: [0.17, 0.36], guess: [0.4, 0.17], words: [0.66, 0.2], decide: [0.85, 0.44], life: [0.43, 0.78], flow: [0.71, 0.74], make: [0.16, 0.7] };
const HUB = [0.48, 0.47];
/** where everything goes for a map of w by h: { wide, hub, lobes: [{ ...lobe, x, y, r }], nodes: { id: { x, y, lobe, hue } }, grid: { x, y, w, h,
 *  cells: [{ r, x, y, w, h }] }, brain: { x, y, w, h } }. Wide puts the working memory beside the brain, tall puts it under. Pure. */
export function layout(ids, w, h) {
  const wide = w >= h * 1.15, lobes = lobesOf(ids);
  const brain = wide ? { x: w * 0.02, y: h * 0.04, w: w * 0.68, h: h * 0.92 } : { x: w * 0.02, y: h * 0.02, w: w * 0.96, h: h * 0.64 };
  const grid = wide ? { x: w * 0.73, y: h * 0.26, w: w * 0.25, h: Math.min(h * 0.5, w * 0.25 * 0.75) } : { x: w * 0.1, y: h * 0.7, w: w * 0.8, h: Math.min(h * 0.27, w * 0.8 * 0.6) };
  const at = (u, v) => ({ x: brain.x + u * brain.w, y: brain.y + v * brain.h });
  const unit = Math.min(brain.w, brain.h * 1.4), nodes = {};
  const placed = lobes.map((l) => {
    const c = at(...(SPOT[l.id] || [0.5, 0.9])), n = l.organs.length, r = n === 1 ? 0 : unit * (0.055 + 0.012 * n);
    l.organs.forEach((id, k) => { const a = -Math.PI / 2 + (k / n) * Math.PI * 2; nodes[id] = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.85, lobe: l.id, hue: l.hue }; });
    return { ...l, x: c.x, y: c.y, r: r + unit * 0.06 };
  });
  const cw = grid.w / REGIONS_X, ch = grid.h / REGIONS_Y;
  grid.cells = Array.from({ length: REGIONS }, (_, r) => ({ r, x: grid.x + (r % REGIONS_X) * cw, y: grid.y + Math.floor(r / REGIONS_X) * ch, w: cw, h: ch }));
  return { wide, w, h, brain, hub: at(...HUB), lobes: placed, nodes, grid, unit };
}

/** a small copy of what the map reads from a brain b (lib/brain.js) and its self s (selfOf, for the generations). Pure on b. */
export function snap(b, s = null) {
  const ws = b.ws, last = b.mind.episodes[b.mind.episodes.length - 1] || null, act = b.board.action;
  return {
    ticks: b.ticks, organs: ws.organs.slice(), runs: { ...b.runs }, rw: Array.from(ws.regionWrites), region: b.focus.region, thinking: b.board.thinking || null,
    words: b.concepts.words.slice(), goals: b.mind.goals.map((g) => g.word), episodes: b.mind.episodes.length + (b.mind.open ? 1 : 0),
    episode: last ? { action: typeof last.action === 'number' ? ACTIONS[last.action] : String(last.action), gain: last.gain } : null,
    chosen: b.will.chosen, action: act ? act.name : null, imagined: act && Array.isArray(act.imagined) ? act.imagined.map((f) => ({ action: f.action, utility: f.utility })) : [],
    err: b.reservoir.errAvg, gesture: b.board.gesture || null, motif: b.board.motif ? b.board.motif.id : null, futures: b.imagined, utility: b.utility,
    gens: s ? { painter: s.painter && s.painter.gen, grower: s.grower && s.grower.gen, formula: s.formula && s.formula.gen, creature: s.creature && s.creature.generations, arena: s.genome && s.genome.gen } : {}
  };
}

/** between two snaps of one brain: { turns: { organ: n }, writes: [{ organ, region, n }], cells, perRegion: [{ top, n }] }. Only what happened. */
export function flowOf(a, z) {
  const turns = {}, writes = [], W = z.organs.length + 1, per = Array.from({ length: REGIONS }, () => ({ top: null, n: 0, best: 0 }));
  if (!a || a.organs.length !== z.organs.length || z.ticks < a.ticks) return { turns, writes, cells: 0, perRegion: per.map(({ top, n }) => ({ top, n })) };
  for (const id of Object.keys(z.runs)) { const d = z.runs[id] - (a.runs[id] || 0); if (d > 0) turns[id] = d; }
  let cells = 0;
  for (let r = 0; r < REGIONS; r++) for (let o = 0; o < W; o++) {
    const d = z.rw[r * W + o] - a.rw[r * W + o]; if (d <= 0) continue;
    const organ = o < z.organs.length ? z.organs[o] : 'you'; writes.push({ organ, region: r, n: d }); cells += d;
    const p = per[r]; p.n += d; if (d > p.best) { p.best = d; p.top = organ; }
  }
  writes.sort((p, q) => q.n - p.n);
  return { turns, writes, cells, perRegion: per.map(({ top, n }) => ({ top, n })) };
}

const NAMES = { attention: 'Attention', you: 'You' };
export const nameOf = (id) => NAMES[id] || (id ? id[0].toUpperCase() + id.slice(1) : '');
const q = (w) => '"' + w + '"';
const list = (ws) => ws.length <= 1 ? ws.map(q).join('') : ws.slice(0, -1).map(q).join(', ') + ' and ' + q(ws[ws.length - 1]);
const r2 = (v) => Math.round(v * 100) / 100;

/** between two snaps: [{ organ, kind, text }], each from a change in the state. Pure. */
export function eventsOf(a, z) {
  const out = [], say = (organ, kind, text) => out.push({ organ, kind, text, tick: z.ticks });
  if (!a || z.ticks < a.ticks) return out;
  const fresh = z.words.filter((w) => !a.words.includes(w));
  if (fresh.length) say('concepts', 'learned', 'Concepts learned ' + list(fresh.slice(0, 4)) + (fresh.length > 4 ? ' and ' + (fresh.length - 4) + ' more' : '') + ', and linked ' + (fresh.length === 1 ? 'it' : 'them') + ' to what it knows.');
  const goals = z.goals.filter((w) => !a.goals.includes(w));
  if (goals.length) say('will', 'goal', 'It took up ' + (goals.length === 1 ? 'a goal' : goals.length + ' goals') + ': ' + list(goals.slice(0, 3)) + '. Goals pull its attention.');
  if (z.thinking && z.thinking !== a.thinking) say('concepts', 'thinking', 'It is thinking about ' + q(z.thinking) + ': that idea is the most active one it holds.');
  if (z.region !== a.region) say('attention', 'focus', 'Attention moved to the ' + regionName(z.region) + ', where the most surprise and input are.');
  if (z.chosen > a.chosen && z.action) {
    const f = z.imagined.filter((x) => x && x.action);
    say('will', 'chose', f.length > 1 ? 'Will imagined ' + f.length + ' futures (' + f.map((x) => x.action + ' ' + x.utility).join(', ') + ') and chose ' + z.action + ', the better one.' : 'Will chose ' + z.action + '.');
  }
  if (z.episodes > a.episodes && z.episode && z.episode.gain != null) say('memory', 'moment', 'Memory kept a moment: ' + z.episode.action + ' moved how well it is doing by ' + (z.episode.gain > 0 ? '+' : '') + z.episode.gain + '.');
  if (z.err > 0.04 && z.err > a.err * 1.6) say('predictor', 'surprise', 'Predictor missed: something moved where it did not expect, so its surprise rose to ' + r2(z.err) + '.');
  if (z.gesture && z.gesture !== a.gesture) say('gestures', 'gesture', 'Gestures saw a ' + z.gesture + ' move.');
  if (z.motif != null && z.motif !== a.motif) say('gestures', 'motif', 'Gestures recognised a pattern of moves it has seen before.');
  for (const [id, verb] of [['painter', 'rewrote the program that paints its look'], ['grower', 'rewrote the grammar of its plant'], ['formula', 'evolved its formula for the tissue'], ['creature', 'bred its creature'], ['arena', 'picked a new winning genome from imagined futures']]) {
    const g0 = a.gens[id], g1 = z.gens[id]; if (g1 != null && g0 != null && g1 > g0) say(id, 'gen', nameOf(id) + ' ' + verb + ' (generation ' + g1 + ').');
  }
  return out;
}

/** the path of a thought: the events from the ask on, the first of each organ, in order: [{ organ, text }], led by You. Pure. */
export function pathOf(events, text) {
  const steps = [{ organ: 'you', text: 'You said ' + q(String(text).trim().slice(0, 60)) + '.' }], seen = new Set();
  for (const e of events) { const k = e.organ + ':' + e.kind; if (seen.has(k) || e.kind === 'gen') continue; seen.add(k); steps.push({ organ: e.organ, text: e.text }); if (steps.length >= 7) break; }
  return steps;
}

/** the numbers under the map, from two snaps dt ms apart: { tps, turns, cells, futures, words, goals, moments }. Pure. */
export function countsOf(a, z, dt, flow) {
  const s = dt > 0 ? 1000 / dt : 0, turns = Object.values(flow.turns).reduce((x, v) => x + v, 0);
  return { tps: a ? Math.round((z.ticks - a.ticks) * s) : 0, turns: Math.round(turns * s), cells: Math.round(flow.cells * s), futures: a ? Math.round((z.futures - a.futures) * s) : 0,
    words: z.words.length, goals: z.goals.length, moments: z.episodes };
}

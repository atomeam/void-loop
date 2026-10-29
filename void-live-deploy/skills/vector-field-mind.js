/**
 * vector-field-mind skill — F-033 of Grok's frontier ideas (asked by the owner, 2026-10-17: "all of Grok's ideas are to be added to Verse"):
 * about 320 particles are carried by an 8x6 grid of control vectors, and a small evolutionary mind (6 genomes, thinking about once a
 * second in a Worker, or on the page when there is no Worker) reshapes the grid for spread-out paths, moderate energy and particles near
 * your pointer. The field's real local divergence and curl set the card's ink density (--ink-density): sharp and high-contrast when high,
 * soft charcoal when low. The law is lib/field-vector.js (pure, tested); the card is lib/field-stage.js. Canvas2D; WebGPU is the next step.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import * as V from '../lib/field-vector.js';

export const meta = (genome) => V.meta(genome);

function startMind(s, seed) {
  s.gen = 0; s.fit = 0; s.busy = false; s.minded = 'fixed field';
  try {
    const w = new Worker(new URL('../lib/field-vector-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { const d = e.data || {}; s.busy = false; if (d.genome) { V.setGenome(s, d.genome); s.gen = d.gen; s.fit = d.fitness; } };
    w.onerror = () => { s.worker = null; s.busy = false; s.local = V.createMind(seed); s.minded = 'thinking on the page'; };
    w.postMessage({ type: 'init', seed }); s.worker = w; s.minded = 'thinking in a Worker';
  } catch (_) { s.local = V.createMind(seed); s.minded = 'thinking on the page'; }
}
const idea = {
  id: 'vector-field-mind', title: 'Vector field mind', sub: 'a flow that evolves', W: 360, H: 270, warm: 20, trails: true,
  how: 'About 320 particles ride an 8x6 grid of arrows; the mind keeps the flow that spreads them out at a moderate pace and near your pointer. Move over it.',
  create(seed) { const s = V.create(seed, { n: 320 }); s.since = 0; startMind(s, seed); return s; },
  step(s, dt, input) {
    V.step(s, dt, input); s.since += dt;
    if (s.since >= V.MIND_EVERY && !s.busy) { // one thought a second, never a burst of them while the pointer moves
      s.since = 0; const pointer = input.over ? { x: input.x, y: input.y } : null;
      if (s.worker) { s.busy = true; s.worker.postMessage({ type: 'think', pointer }); }
      else if (s.local) { V.think(s.local, pointer); V.setGenome(s, s.local.best); s.gen = s.local.gen; s.fit = s.local.bestFit; }
    }
  },
  metrics: (s) => V.kitMetrics(V.measure(s)),
  morph: (s) => V.morphField(V.measure(s)),
  vars: (s) => V.inkVars(V.measure(s)),
  params: (s) => ({ genome: Object.fromEntries(Object.entries(s.genome).map(([k, v]) => [k, Math.round(v * 1000) / 1000])), gen: s.gen }),
  status: (s) => { const m = V.measure(s); return 'gen ' + s.gen + ' · fitness ' + s.fit.toFixed(2) + ' · div ' + m.div.toFixed(2) + ' · curl ' + m.curl.toFixed(2) + ' · ' + s.minded; },
  dispose(s) { if (s.worker) { s.worker.terminate(); s.worker = null; } },
  draw(g, s, W, H) {
    g.fillStyle = 'rgba(5,4,12,0.2)'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,140,255,.16)'; g.lineWidth = 1; g.beginPath(); // the control grid: the arrows the mind is shaping
    for (let j = 0; j < V.ROWS; j++) for (let i = 0; i < V.COLS; i++) { const x = (i / (V.COLS - 1)) * W, y = (j / (V.ROWS - 1)) * H, u = s.field[(j * V.COLS + i) * 2], v = s.field[(j * V.COLS + i) * 2 + 1]; g.moveTo(x, y); g.lineTo(x + u * 9, y + v * 9); }
    g.stroke();
    const p = s.p; for (let i = 0; i < p.n; i++) { const sp = Math.min(1, Math.hypot(p.vx[i], p.vy[i]) / V.SPEED / 1.5); g.fillStyle = 'hsla(' + Math.round(190 + sp * 120) + ',80%,' + Math.round(55 + sp * 20) + '%,.85)'; g.fillRect(p.x[i] * W - 1, p.y[i] * H - 1, 2, 2); }
  }
};

export default fieldSkill({
  name: 'vector-field-mind',
  words: '(?:evolving |evolutionary |local )?(?:vector|flow) field(?: mind)?|vector field mind|vector (?:logo )?(?:of|for) .+|create a vector of .+|give me a svg of .+',
  examples: ['show me a vector field mind', 'vector field mind', 'evolving vector field', 'flow field mind', 'create a vector of a leaf', 'give me a svg of a star'],
  nearMisses: ['what is a vector field', 'vector field definition', 'divergence of a vector field'],
  idea, say: 'Vector field mind (F-033): particles ride a flow that a small mind keeps evolving · move over it, tap Sound on for the drone'
});

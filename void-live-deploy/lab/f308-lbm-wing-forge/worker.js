// Evolves the wing in the background against the visitor's painted rocks, then hot-swaps it into the page.
import { fitness, esStep, rng } from './core.js';
const CONDS = [{ u0: 0.1, tau: 0.6 }, { u0: 0.08, tau: 0.56 }];
let running = false;
self.onmessage = (e) => {
  const m = e.data;
  if (m.cmd === 'stop') { running = false; return; }
  if (m.cmd !== 'evolve' || running) return;
  running = true;
  const r = rng((Math.random() * 1e9) | 0);
  const rocks = m.rocks ? new Uint8Array(m.rocks) : null;
  let mean = m.mean.slice(), best = { f: fitness(mean, CONDS, rocks), cand: mean };
  self.postMessage({ type: 'gen', gen: 0, mean, best: best.cand, f: best.f });
  for (let gen = 1; gen <= (m.gens || 8) && running; gen++) {
    const o = esStep(mean, 0.2, 0.9, 3, (g) => fitness(g, CONDS, rocks), r);
    mean = o.mean; if (o.best.f > best.f) best = o.best;
    self.postMessage({ type: 'gen', gen, mean, best: best.cand, f: best.f });
  }
  running = false; self.postMessage({ type: 'done', best: best.cand, f: best.f });
};

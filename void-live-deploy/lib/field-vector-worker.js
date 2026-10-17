// field-vector-worker — the F-033 mind's thinking, off the main thread. It only schedules: every message runs lib/field-vector.js `think` on its own
// copy of the mind and answers with the best genome. { type: 'think', pointer: {x,y}|null } -> { genome, fitness, gen }. No clock, no storage, no network.
import { createMind, think } from './field-vector.js';
let mind = null;
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === 'init') { mind = createMind(+m.seed || 1); return; }
  if (!mind) mind = createMind(1);
  think(mind, m.pointer && Number.isFinite(m.pointer.x) ? { x: m.pointer.x, y: m.pointer.y } : null);
  self.postMessage({ genome: mind.best, fitness: mind.bestFit, gen: mind.gen });
};

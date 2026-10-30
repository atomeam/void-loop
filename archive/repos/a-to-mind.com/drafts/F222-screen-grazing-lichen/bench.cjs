const { Model, Colony, scene } = require('./core.js');
const W = 96, H = 60, T = 1500, out = {};
for (const kind of ['scroll', 'ball', 'video', 'mixed']) for (const mode of ['surprise', 'random', 'sweep', 'none']) {
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const m = new Model(W, H); const c = mode === 'none' ? null : new Colony(m, 64, { mode, seed });
    const f = new Float32Array(W * H);
    for (let t = 0; t < T; t++) { if (c) c.step(); m.ingest(scene(kind, W, H, t, f)); }
    const tail = m.errHist.slice(-500); rows.push({ err: +(tail.reduce((a, b) => a + b, 0) / tail.length * 1000).toFixed(3), updates: m.updates });
  }
  out[kind + ':' + mode] = { meanErrX1000: +(rows.reduce((a, r) => a + r.err, 0) / rows.length).toFixed(3), updatesPerFrame: Math.round(rows[0].updates / T), rows: rows.map(r => r.err) };
}
// Full-learning ceiling: every cell learns every frame (9x-90x the budget).
for (const kind of ['scroll', 'ball', 'video', 'mixed']) { const m = new Model(W, H), f = new Float32Array(W * H); for (let t = 0; t < T; t++) { m.learnMask.fill(1); m.ingest(scene(kind, W, H, t, f)); } const tail = m.errHist.slice(-500); out[kind + ':all-cells'] = { meanErrX1000: +(tail.reduce((a, b) => a + b, 0) / tail.length * 1000).toFixed(3), updatesPerFrame: Math.round(m.updates / T) }; }
console.log(JSON.stringify(out, null, 1));

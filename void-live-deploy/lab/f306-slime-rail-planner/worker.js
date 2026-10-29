// Evolves slime physics in the background on the visitor's own city map plus a fresh random map each generation.
importScripts('core.js');
let es = new SlimeCore.ES(Date.now() % 100000), cities = null, gen = 0, running = true, W = 112, H = 112;
onmessage = e => {
  const m = e.data;
  if (m.cities) cities = m.cities.map(c => ({ x: c.x, y: c.y }));
  if (m.mu) es.mu = m.mu.slice();
  if ('running' in m) running = m.running;
};
function tick() {
  if (running && cities && cities.length >= 2) {
    const before = es.mu.slice(), mapSeed = 1000 + gen;
    const fit = g => {
      const a = scoreOn(g, cities, gen * 7 + 1), b = SlimeCore.evaluate(g, [mapSeed], { W, H, cities: Math.max(3, cities.length) }).fitness;
      return 0.6 * a + 0.4 * b;
    };
    const r = es.generation(6, fit);
    const stepNorm = Math.sqrt(es.mu.reduce((s, v, i) => s + (v - before[i]) ** 2, 0));
    gen++;
    postMessage({ gen, mu: es.mu, mean: r.mean, stepNorm });
  }
  setTimeout(tick, 30);
}
function scoreOn(g, cs, seed) {
  const w = new SlimeCore.World(W, H, 3000, cs, g, seed);
  for (let s = 0; s < 260; s++) w.step();
  return SlimeCore.score(SlimeCore.extract(w.trail, W, H, cs, w.p.k), cs).fitness;
}
tick();

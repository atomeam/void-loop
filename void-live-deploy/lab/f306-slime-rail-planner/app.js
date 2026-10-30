'use strict';
const C = SlimeCore, W = 112, H = 112, NA = 3000;
const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), overlay = document.getElementById('overlay');
const small = document.createElement('canvas'); small.width = W; small.height = H; const sctx = small.getContext('2d'), img = sctx.createImageData(W, H);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let genome = [0.5, 0.4, 0.4, 0.6, 0.4, 0.4], cities, world, net = null, sc = null, gen = 0, curve = [], routeMode = false, sel = [], route = null, routeT = 0, paused = false;
// restore from hash or storage
try {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('g')) genome = h.get('g').split(',').map(Number).slice(0, 6);
  if (h.get('c')) cities = h.get('c').split(';').map(p => { const [x, y] = p.split(',').map(Number); return { x, y }; });
  else if (localStorage.f306g) genome = JSON.parse(localStorage.f306g);
} catch (e) {}
if (!cities || cities.length < 2) cities = C.makeCities(7, W, H, (Math.random() * 1e6) | 0);
function rebuild() { world = new C.World(W, H, NA, cities, genome, (Math.random() * 1e6) | 0); route = null; sel = []; drawCities(); worker && worker.postMessage({ cities }); }
let worker = null;
try { worker = new Worker('worker.js'); } catch (e) { document.getElementById('msg').textContent = 'Background learning needs Web Workers; the slime still grows with fixed physics.'; }
if (worker) {
  worker.postMessage({ cities, mu: genome });
  worker.onmessage = e => {
    const m = e.data; gen = m.gen; genome = m.mu.slice(); world.setGenome(genome); curve.push(m.mean); if (curve.length > 60) curve.shift();
    localStorage.f306g = JSON.stringify(genome);
    document.getElementById('mGen').textContent = gen;
    const p = document.getElementById('panel'), k = Math.min(1, m.stepNorm * 6); // panel bends with the size of each learning step
    p.style.transform = reduce ? '' : `skewX(${(-k * 6).toFixed(2)}deg)`;
    p.style.borderRadius = `${(6 + genome[0] * 20).toFixed(0)}px ${(6 + genome[2] * 20).toFixed(0)}px ${(6 + genome[3] * 20).toFixed(0)}px ${(6 + genome[5] * 20).toFixed(0)}px`;
    drawSpark();
  };
}
world = new C.World(W, H, NA, cities, genome, 7);
function drawCities() {
  overlay.innerHTML = '';
  cities.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'city'; b.textContent = String.fromCharCode(65 + i);
    b.style.left = (c.x / W * 100) + '%'; b.style.top = (c.y / H * 100) + '%'; b.style.width = b.style.height = '22px';
    b.setAttribute('aria-label', 'City ' + b.textContent + (routeMode ? ', pick for route' : ', remove'));
    b.onclick = ev => { ev.stopPropagation(); cityClick(i); };
    overlay.appendChild(b);
  });
}
function cityClick(i) {
  if (routeMode) { sel.push(i); overlay.children[i].classList.add('sel'); if (sel.length === 2) { traceRoute(sel[0], sel[1]); routeMode = false; document.getElementById('bRoute').textContent = 'Trace a route'; } return; }
  if (cities.length <= 2) return; cities.splice(i, 1); rebuild();
}
cv.addEventListener('click', ev => {
  if (routeMode) return;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
  if (x < 4 || y < 4 || x > W - 4 || y > H - 4 || cities.length >= 14) return;
  cities.push({ x, y }); rebuild();
});
function traceRoute(a, b) { // BFS over the extracted network mask, keep parents
  if (!net) return; const mask = net.mask, n = W * H, P = new Int32Array(n).fill(-1);
  const s = (cities[a].y | 0) * W + (cities[a].x | 0), t = (cities[b].y | 0) * W + (cities[b].x | 0), q = [s]; P[s] = s;
  for (let h = 0; h < q.length && P[t] < 0; h++) { const u = q[h], ux = u % W, uy = (u / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const vx = ux + dx, vy = uy + dy; if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue; const v = vy * W + vx; if (mask[v] && P[v] < 0) { P[v] = u; q.push(v); } } }
  const msg = document.getElementById('msg');
  if (P[t] < 0) { msg.textContent = `No rail yet between ${String.fromCharCode(65 + a)} and ${String.fromCharCode(65 + b)}. Give the slime a moment.`; sel = []; drawCities(); return; }
  route = []; for (let v = t; v !== s; v = P[v]) route.push(v); route.push(s); route.reverse(); routeT = 0;
  const e = Math.hypot(cities[a].x - cities[b].x, cities[a].y - cities[b].y);
  msg.textContent = `Route ${String.fromCharCode(65 + a)} to ${String.fromCharCode(65 + b)}: ${route.length} cells of track, ${(route.length / Math.max(1, e)).toFixed(2)}× the straight line.`;
}
function drawSpark() {
  const s = document.getElementById('spark'), g = s.getContext('2d'); g.clearRect(0, 0, s.width, s.height); if (curve.length < 2) return;
  const lo = Math.min(...curve), hi = Math.max(...curve) + 1e-6; g.strokeStyle = '#ffd27a'; g.lineWidth = 1.5; g.beginPath();
  curve.forEach((v, i) => { const x = i / (curve.length - 1) * s.width, y = s.height - 3 - (v - lo) / (hi - lo) * (s.height - 6); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
}
let frame = 0;
function loop() {
  if (!paused || frame % 2 === 0) { world.step(); world.step(); }
  if (frame % 15 === 0) { // measure the live network with the exact scorer the optimiser uses
    net = C.extract(world.trail, W, H, cities, world.p.k); sc = C.score(net, cities);
    document.getElementById('mConn').textContent = Math.round(sc.connFrac * 100) + '% of pairs';
    document.getElementById('mCost').textContent = sc.costRatio.toFixed(1) + '×';
    document.getElementById('mStr').textContent = sc.connFrac ? sc.meanStretch.toFixed(2) + '×' : '–';
    cities.forEach((c, i) => { const deg = net.dist[i].filter((d, j) => j !== i && d > 0).length, el = overlay.children[i]; if (!el) return;
      const sz = 18 + deg * 4; el.style.width = el.style.height = sz + 'px'; el.style.boxShadow = `0 0 ${deg * 5}px #ffd27a`; });
  }
  const t = world.trail, d = img.data, th = net ? net.th : 1;
  for (let i = 0; i < W * H; i++) { const v = t[i] / (th * 2.2), a = v > 1 ? 1 : v, rail = net && net.mask[i];
    d[i * 4] = 40 * a + (rail ? 150 : 0) * a; d[i * 4 + 1] = 120 * a + (rail ? 90 : 0) * a; d[i * 4 + 2] = 255 * a; d[i * 4 + 3] = 255; }
  if (route) { routeT = Math.min(route.length, routeT + (reduce ? route.length : 2));
    for (let k = 0; k < routeT; k++) { const i = route[k]; d[i * 4] = 255; d[i * 4 + 1] = 220; d[i * 4 + 2] = 120; } }
  sctx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(small, 0, 0, cv.width, cv.height);
  frame++; requestAnimationFrame(loop);
}
document.getElementById('bPause').onclick = e => { paused = !paused; worker && worker.postMessage({ running: !paused }); e.target.textContent = paused ? 'Resume learning' : 'Pause learning'; };
document.getElementById('bRoute').onclick = e => { routeMode = !routeMode; sel = []; drawCities(); e.target.textContent = routeMode ? 'Pick two cities…' : 'Trace a route'; };
document.getElementById('bNew').onclick = () => { cities = C.makeCities(5 + ((Math.random() * 5) | 0), W, H, (Math.random() * 1e6) | 0); rebuild(); };
document.getElementById('bShare').onclick = () => {
  const u = location.origin + location.pathname + '#g=' + genome.map(v => v.toFixed(3)).join(',') + '&c=' + cities.map(c => c.x.toFixed(1) + ',' + c.y.toFixed(1)).join(';');
  history.replaceState(null, '', u); navigator.clipboard && navigator.clipboard.writeText(u).catch(() => {}); document.getElementById('msg').textContent = 'Link copied: it carries this map and the learned slime physics.';
};
drawCities(); loop();

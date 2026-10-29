import { makeTunnel, setObstacles, step, wingMask, SPEC, GENES, DEFAULT_GENOME, decode, score } from './core.js';
const { W, H, chord, cx, cy } = SPEC;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const off = new OffscreenCanvas(W, H), octx = off.getContext('2d'), img = octx.createImageData(W, H);
const panel = document.getElementById('panel'), hud = document.getElementById('hud'), logEl = document.getElementById('log');
const liftEl = document.getElementById('lift'), dragEl = document.getElementById('drag');
let genome = DEFAULT_GENOME.slice();
try { const h = new URLSearchParams(location.hash.slice(1)); if (h.get('g')) genome = h.get('g').split(',').map(Number).slice(0, 5); else { const s = JSON.parse(localStorage.getItem('f308-genome') || 'null'); if (s) genome = s; } } catch {}
const rocks = new Uint8Array(W * H);
const tunnel = makeTunnel(W, H, 0.1, 0.6);
function rebuild() { setObstacles(tunnel, wingMask(W, H, genome, chord, cx, cy), rocks); localStorage.setItem('f308-genome', JSON.stringify(genome)); syncSliders(); }
// sliders
const genesEl = document.getElementById('genes'); const sliders = [];
const fmt = (i) => { const d = decode(genome); return [Math.round(d.aoa * 180 / Math.PI) + '°', (d.m * 100).toFixed(1) + '%', (d.p * 100 | 0) + '%', (d.t * 100).toFixed(0) + '%', Math.round(d.flap * 180 / Math.PI) + '°'][i]; };
GENES.forEach((n, i) => { const l = document.createElement('label'); l.innerHTML = `<span>${n}</span><input type=range min=0 max=1 step=0.001><output></output>`; const inp = l.querySelector('input'); inp.oninput = () => { genome[i] = +inp.value; rebuild(); }; genesEl.append(l); sliders.push(l); });
function syncSliders() { sliders.forEach((l, i) => { l.querySelector('input').value = genome[i]; l.querySelector('output').textContent = fmt(i); }); }
rebuild();
// painting rocks
let painting = false, erase = false;
function paint(e) { const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) / r.width * W), y = Math.floor((e.clientY - r.top) / r.height * H);
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i, Y = y + j; if (X < 3 || X >= W - 2 || Y < 0 || Y >= H || i * i + j * j > 5) continue; rocks[Y * W + X] = erase ? 0 : 1; }
  setObstacles(tunnel, tunnel.body, rocks); }
cv.addEventListener('pointerdown', (e) => { painting = true; erase = e.shiftKey || e.button === 2; cv.setPointerCapture(e.pointerId); paint(e); });
cv.addEventListener('pointermove', (e) => painting && paint(e));
cv.addEventListener('pointerup', () => { painting = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
// streak particles
const P = 900, px = new Float32Array(P), py = new Float32Array(P);
for (let i = 0; i < P; i++) { px[i] = Math.random() * W; py[i] = Math.random() * H; }
let cl = 0, cd = 0;
function frame() {
  for (let s = 0; s < 6; s++) step(tunnel);
  const k = 1 / (0.5 * tunnel.u0 * tunnel.u0 * chord);
  cl += 0.03 * (-tunnel.fy * k - cl); cd += 0.03 * (tunnel.fx * k - cd);
  const d = img.data, { ux, uy, solid, body } = tunnel;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = y * W + x, o = n * 4;
    if (body[n]) { d[o] = 240; d[o + 1] = 244; d[o + 2] = 255; d[o + 3] = 255; continue; }
    if (solid[n]) { d[o] = 70; d[o + 1] = 74; d[o + 2] = 86; d[o + 3] = 255; continue; }
    const xr = Math.min(W - 1, x + 1), xl = Math.max(0, x - 1), yd = (y + 1) % H, yu = (y - 1 + H) % H;
    const curl = (uy[y * W + xr] - uy[y * W + xl]) - (ux[yd * W + x] - ux[yu * W + x]);
    const v = Math.max(-1, Math.min(1, curl * 18)), sp = Math.hypot(ux[n], uy[n]) / tunnel.u0;
    d[o] = 10 + Math.max(0, v) * 230; d[o + 1] = 12 + sp * 28 + Math.abs(v) * 60; d[o + 2] = 22 + Math.max(0, -v) * 230 + sp * 20; d[o + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, cv.width, cv.height);
  const sx = cv.width / W, sy = cv.height / H; ctx.fillStyle = 'rgba(220,240,255,.55)';
  for (let i = 0; i < P; i++) { const n = (py[i] | 0) * W + (px[i] | 0); px[i] += ux[n] * 6; py[i] += uy[n] * 6;
    if (px[i] >= W - 1 || px[i] < 0 || solid[(py[i] | 0) * W + (px[i] | 0)] || Math.random() < 0.003) { px[i] = Math.random() * 2; py[i] = Math.random() * H; }
    if (py[i] < 0) py[i] += H; if (py[i] >= H) py[i] -= H; ctx.fillRect(px[i] * sx, py[i] * sy, 1.6, 1.6); }
  // UI physically follows the air: panel tilts with lift, its border thickens with drag, arrows sit on the wing
  panel.style.transform = `rotate(${Math.max(-8, Math.min(8, -cl * 9))}deg)`;
  panel.style.borderWidth = `${1 + Math.min(5, cd * 4)}px`;
  const r = cv.getBoundingClientRect(), wx = r.left + (cx + chord * 0.1) / W * r.width, wy = r.top + cy / H * r.height;
  const lh = Math.min(r.height * 0.45, Math.abs(cl) * r.height * 0.35);
  liftEl.style.left = wx + 'px'; liftEl.style.height = lh + 'px'; liftEl.style.top = (cl >= 0 ? wy - lh : wy) + 'px';
  dragEl.style.left = wx + 'px'; dragEl.style.top = wy + 'px'; dragEl.style.width = Math.min(r.width * 0.4, cd * r.width * 0.12) + 'px';
  hud.textContent = `lift coeff ${cl.toFixed(2)} · drag coeff ${cd.toFixed(2)} · L/D ${(cl / Math.max(cd, 0.05)).toFixed(2)} · score ${score({ cl, cd }).toFixed(2)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// evolution worker
const worker = new Worker('./worker.js', { type: 'module' }); let evolving = false;
const evBtn = document.getElementById('evolve');
worker.onmessage = (e) => { const m = e.data;
  if (m.type === 'gen') { genome = m.best.slice(); rebuild(); logEl.textContent = `generation ${m.gen}: best training score ${m.f.toFixed(2)} (hot-swapped)`; }
  if (m.type === 'done') { evolving = false; evBtn.textContent = 'Evolve wing'; logEl.textContent += ' · done'; window.__f308done = m.f; } };
evBtn.onclick = () => { if (evolving) { worker.postMessage({ cmd: 'stop' }); return; } evolving = true; evBtn.textContent = 'Stop';
  worker.postMessage({ cmd: 'evolve', mean: genome, rocks: Array.from(rocks), gens: +(new URLSearchParams(location.search).get('gens') || 8) }); };
document.getElementById('reset').onclick = () => { genome = DEFAULT_GENOME.slice(); rebuild(); };
document.getElementById('clear').onclick = () => { rocks.fill(0); setObstacles(tunnel, tunnel.body, rocks); };
document.getElementById('copy').onclick = async () => { const u = location.href.split('#')[0] + '#g=' + genome.map((v) => v.toFixed(3)).join(','); try { await navigator.clipboard.writeText(u); logEl.textContent = 'link copied'; } catch { logEl.textContent = u; } };
window.__f308 = { get cl() { return cl; }, get cd() { return cd; }, get genome() { return genome; }, rocks, paint };

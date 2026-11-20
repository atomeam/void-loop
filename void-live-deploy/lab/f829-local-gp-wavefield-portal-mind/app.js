const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = innerWidth, H = innerHeight;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

const N = 48;
const h = 1 / N;
let u = new Float32Array(N*N), v = new Float32Array(N*N); // displacement, velocity
let src = new Float32Array(N*N);

// GP nodes
const OPS = ['+', '-', '*', '/', 'sin', 'cos', 'abs'];
function randExpr(depth = 0) {
  if (depth > 4 || Math.random() < 0.35) {
    const terms = ['o', 'p', 't', (Math.random()*2-1).toFixed(2)];
    return terms[Math.floor(Math.random()*terms.length)];
  }
  const op = OPS[Math.floor(Math.random()*OPS.length)];
  if (['sin','cos','abs'].includes(op)) return `${op}(${randExpr(depth+1)})`;
  return `(${randExpr(depth+1)}${op}${randExpr(depth+1)})`;
}
function evalExpr(expr, o, p, t) {
  try {
    const fn = new Function('o','p','t','Math', `return ${expr};`);
    let val = fn(o, p, t, Math);
    if (!isFinite(val)) val = 0;
    return Math.max(-4, Math.min(4, val));
  } catch { return 0; }
}

let pop = Array.from({length:16}, () => ({expr: randExpr(), fit: 0}));
let best = pop[0];
let gen = 0;

function evolve() {
  pop.sort((a,b) => b.fit - a.fit);
  best = pop[0];
  const next = pop.slice(0, 4); // elites
  while (next.length < 16) {
    const a = pop[Math.floor(Math.random()*8)].expr;
    const b = pop[Math.floor(Math.random()*8)].expr;
    // crude crossover: splice strings
    const mid = Math.floor(a.length/2);
    let child = a.slice(0, mid) + b.slice(mid);
    if (Math.random() < 0.3) child = randExpr(); // mutation
    next.push({expr: child, fit: 0});
  }
  pop = next;
  gen++;
  document.getElementById('gen').textContent = gen;
}

// sensors
let orient = 0, pointer = 0, lastX = W/2, lastY = H/2;
addEventListener('deviceorientation', e => {
  orient = Math.hypot(e.beta||0, e.gamma||0) / 90;
});
addEventListener('pointermove', e => {
  pointer = Math.hypot(e.clientX - lastX, e.clientY - lastY) / 20;
  lastX = e.clientX; lastY = e.clientY;
});

// portals
const portalsEl = document.getElementById('portals');
const portals = [];
for (let i = 0; i < 3; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.style.left = (20 + i*28) + '%';
  el.style.top = (30 + i*15) + '%';
  el.textContent = best.expr;
  portalsEl.appendChild(el);
  portals.push({el, x: parseFloat(el.style.left)/100 * W, y: parseFloat(el.style.top)/100 * H, amp: 0});
  let drag = false, ox, oy;
  el.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - portals[i].x; oy = e.clientY - portals[i].y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    portals[i].x = e.clientX - ox; portals[i].y = e.clientY - oy;
    el.style.left = portals[i].x + 'px'; el.style.top = portals[i].y + 'px';
    // inject seed
    const ix = Math.floor((portals[i].x / W) * N), iy = Math.floor((portals[i].y / H) * N);
    if (ix>=0 && ix<N && iy>=0 && iy<N) {
      for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
        const x2 = ix+dx, y2 = iy+dy;
        if (x2>=0 && x2<N && y2>=0 && y2<N) src[y2*N+x2] += 0.5 * Math.exp(-(dx*dx+dy*dy));
      }
    }
  });
  el.addEventListener('pointerup', () => drag = false);
  el.addEventListener('click', () => { best.fit += 1; document.getElementById('fit').textContent = best.fit.toFixed(1); });
}

// persistence
const DB = 'f829-gp';
async function seal() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('g');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put({expr: best.expr, fit: best.fit}, 'best');
    const bc = new BroadcastChannel('f829-genome');
    bc.postMessage({expr: best.expr, fit: best.fit});
    alert('Sealed: ' + best.expr.slice(0,40) + '...');
  } catch(e) { console.warn(e); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { u.fill(0); v.fill(0); src.fill(0); };

// sim + render
let t = 0;
function step() {
  t += 0.016;
  const o = orient, p = pointer;
  const sourceAmp = evalExpr(best.expr, o, p, t);
  // add global source modulated by expr
  for (let i = 0; i < N*N; i++) src[i] *= 0.95;
  const cx = N/2 + Math.sin(t)*N/6, cy = N/2 + Math.cos(t*0.7)*N/6;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const d = Math.hypot(x-cx, y-cy);
    if (d < 4) src[y*N+x] += sourceAmp * 0.05 * Math.exp(-d*d/8);
  }
  // wave step
  const c2 = 0.25;
  for (let y=1; y<N-1; y++) for (let x=1; x<N-1; x++) {
    const i = y*N+x;
    const lap = u[i-1] + u[i+1] + u[i-N] + u[i+N] - 4*u[i];
    v[i] += c2 * lap + src[i] - 0.02 * v[i];
    v[i] *= 0.995;
  }
  for (let i=0; i<N*N; i++) u[i] += v[i];
  // update portals
  portals.forEach(pt => {
    const ix = Math.max(0, Math.min(N-1, Math.floor((pt.x/W)*N)));
    const iy = Math.max(0, Math.min(N-1, Math.floor((pt.y/H)*N)));
    pt.amp = Math.abs(u[iy*N+ix]);
    pt.el.textContent = best.expr;
    pt.el.style.transform = `scale(${1 + pt.amp*0.8})`;
    pt.el.style.borderColor = `hsl(${200 + pt.amp*60}, 70%, 60%)`;
  });
  // render
  const img = ctx.createImageData(N, N);
  for (let i=0; i<N*N; i++) {
    const val = Math.tanh(u[i]*2);
    const c = val > 0 ? [100+val*155, 80, 200] : [40, 80+(-val)*100, 180];
    img.data[i*4] = c[0]; img.data[i*4+1] = c[1]; img.data[i*4+2] = c[2]; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0, N, N, 0, 0, W, H);
  if (gen % 120 === 0 && Math.random() < 0.02) evolve();
  requestAnimationFrame(step);
}
// load sealed
(async () => {
  try {
    const db = await new Promise(res => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('g');
      r.onsuccess = () => res(r.result);
    });
    const tx = db.transaction('g');
    const req = tx.objectStore('g').get('best');
    req.onsuccess = () => { if (req.result) { best = req.result; pop[0] = best; } };
  } catch (e) { console.debug("lab f829-local-gp-wavefield-portal-mind:", e); }
  step();
})();
new BroadcastChannel('f829-genome').onmessage = e => {
  if (e.data.fit > best.fit) { best = e.data; pop[0] = best; }
};

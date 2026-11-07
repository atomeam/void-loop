const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Tiny KAN: 2 inputs (x,y normalized), 3 hidden edge functions, 2 outputs (density bias, hue)
// Each edge function is a simple cubic spline with 4 control points in [-1,1] → [-1,1]
const N_EDGES = 5; // visible cards
const knots = Array.from({length: N_EDGES}, () => [
  [-1, 0], [-0.33, 0.2], [0.33, -0.1], [1, 0]
]);

function evalSpline(k, t) { // t in [-1,1]
  // Simple piecewise linear for robustness, or cubic Hermite
  const pts = k;
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[3][0]) return pts[3][1];
  for (let i = 0; i < 3; i++) {
    if (t >= pts[i][0] && t <= pts[i+1][0]) {
      const u = (t - pts[i][0]) / (pts[i+1][0] - pts[i][0]);
      // cubic ease
      const s = u*u*(3-2*u);
      return pts[i][1] + (pts[i+1][1] - pts[i][1]) * s;
    }
  }
  return 0;
}

function kan(x, y) {
  // Map inputs through a few edges
  const e0 = evalSpline(knots[0], x);
  const e1 = evalSpline(knots[1], y);
  const e2 = evalSpline(knots[2], x*y);
  const e3 = evalSpline(knots[3], Math.sin(x*3));
  const e4 = evalSpline(knots[4], Math.cos(y*2));
  const dens = Math.tanh(e0 + e1*0.7 + e2*0.4);
  const hue = (e3 + e4 + 2) / 4;
  return { dens, hue };
}

// Build SVG cards
const container = document.getElementById('splines');
const cards = [];
for (let i = 0; i < N_EDGES; i++) {
  const card = document.createElement('div');
  card.className = 'spline-card';
  card.innerHTML = `<h4>Edge ${i}</h4><svg width="168" height="70" viewBox="-1.1 -1.2 2.2 2.4"></svg>`;
  container.appendChild(card);
  const svg = card.querySelector('svg');
  const pts = knots[i].map((p, j) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', '0.08');
    c.setAttribute('fill', '#8cf');
    c.setAttribute('cx', p[0]);
    c.setAttribute('cy', -p[1]); // y-up
    c.style.cursor = 'grab';
    svg.appendChild(c);
    return c;
  });
  // line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#6af');
  line.setAttribute('stroke-width', '0.03');
  svg.insertBefore(line, pts[0]);
  cards.push({ svg, pts, line, index: i });

  // drag
  let dragging = null;
  svg.addEventListener('pointerdown', e => {
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2.2 - 1.1;
    const my = -(((e.clientY - rect.top) / rect.height) * 2.4 - 1.2);
    let best = 0, bd = 1e9;
    knots[i].forEach((p, j) => {
      const d = Math.hypot(p[0]-mx, p[1]-my);
      if (d < bd) { bd = d; best = j; }
    });
    if (bd < 0.25) dragging = best;
  });
  window.addEventListener('pointermove', e => {
    if (dragging === null) return;
    const rect = svg.getBoundingClientRect();
    let mx = ((e.clientX - rect.left) / rect.width) * 2.2 - 1.1;
    let my = -(((e.clientY - rect.top) / rect.height) * 2.4 - 1.2);
    mx = Math.max(-1, Math.min(1, mx));
    my = Math.max(-1, Math.min(1, my));
    // keep x ordered
    if (dragging > 0) mx = Math.max(knots[i][dragging-1][0]+0.05, mx);
    if (dragging < 3) mx = Math.min(knots[i][dragging+1][0]-0.05, mx);
    knots[i][dragging] = [mx, my];
    updateCard(i);
  });
  window.addEventListener('pointerup', () => dragging = null);
}

function updateCard(i) {
  const c = cards[i];
  const k = knots[i];
  c.pts.forEach((p, j) => {
    p.setAttribute('cx', k[j][0]);
    p.setAttribute('cy', -k[j][1]);
  });
  let d = '';
  for (let t = -1; t <= 1; t += 0.05) {
    const y = evalSpline(k, t);
    d += (t===-1?'':' ') + t + ',' + (-y);
  }
  c.line.setAttribute('points', d);
}
knots.forEach((_,i) => updateCard(i));

// Field render
let evolve = false;
let residual = 0;
let mx = 0.5, my = 0.5;
canvas.addEventListener('pointermove', e => {
  mx = e.clientX / W;
  my = e.clientY / H;
});

function render() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  let resSum = 0, cnt = 0;
  const step = 4; // subsample for speed
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const nx = (x / W) * 2 - 1;
      const ny = (y / H) * 2 - 1;
      const { dens, hue } = kan(nx, ny);
      const v = (dens + 1) * 0.5;
      const h = hue * 360;
      // simple HSV to RGB approx
      const r = Math.sin(h * 0.017 + 0) * 0.5 + 0.5;
      const g = Math.sin(h * 0.017 + 2) * 0.5 + 0.5;
      const b = Math.sin(h * 0.017 + 4) * 0.5 + 0.5;
      const a = 180 + v * 75;
      for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
        const i = ((y+dy)*W + (x+dx)) * 4;
        if (i < data.length) {
          data[i] = r * a;
          data[i+1] = g * a;
          data[i+2] = b * a;
          data[i+3] = 255;
        }
      }
      if (Math.abs(nx - (mx*2-1)) < 0.1 && Math.abs(ny - (my*2-1)) < 0.1) {
        resSum += Math.abs(dens - 0.3); cnt++;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // pointer residual light evolution
  if (evolve && cnt > 0) {
    residual = resSum / cnt;
    // nudge a random knot slightly toward reducing residual (toy)
    if (Math.random() < 0.05) {
      const ei = Math.floor(Math.random()*N_EDGES);
      const pi = Math.floor(Math.random()*4);
      knots[ei][pi][1] += (Math.random()-0.5)*0.02;
      knots[ei][pi][1] = Math.max(-1, Math.min(1, knots[ei][pi][1]));
      updateCard(ei);
    }
  }
  document.getElementById('status').textContent =
    `KAN Spline · residual ${(residual*100).toFixed(1)}% · evolve ${evolve ? 'on' : 'off'} · drag curves`;
  requestAnimationFrame(render);
}
render();

document.getElementById('evolve').onclick = () => evolve = !evolve;

// Seal / Restore
async function seal() {
  const payload = { knots, ts: Date.now() };
  const str = JSON.stringify(payload);
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('verse-kan-mind', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ hash, payload }, 'latest');
  document.getElementById('status').textContent = `Sealed ${hash.slice(0,12)}…`;
}
async function restore() {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('verse-kan-mind', 1);
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('seals', 'readonly');
  const req = tx.objectStore('seals').get('latest');
  req.onsuccess = () => {
    if (req.result) {
      const p = req.result.payload;
      p.knots.forEach((k, i) => { if (knots[i]) knots[i] = k; });
      knots.forEach((_,i) => updateCard(i));
      document.getElementById('status').textContent = `Restored ${req.result.hash.slice(0,12)}…`;
    }
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;

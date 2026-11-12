const cv = document.getElementById('cv');
const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');
let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;

// --- Temporal buffer ---
const BUF = 32;
const hist = new Float32Array(BUF * 5); // x,y,vx,vy,dt
let hIdx = 0, hCount = 0;
let lastX = W/2, lastY = H/2, lastT = performance.now();

// --- Tiny multi-head attention (2 heads, d_model=8, d_k=4) ---
const HEADS = 2, D = 8, DK = 4;
let Wq = new Float32Array(D * DK * HEADS);
let Wk = new Float32Array(D * DK * HEADS);
let Wv = new Float32Array(D * DK * HEADS);
function randn() { return (Math.random()*2-1)*0.3; }
function initWeights() {
  for (let i = 0; i < Wq.length; i++) { Wq[i] = randn(); Wk[i] = randn(); Wv[i] = randn(); }
}
initWeights();

function project(src, Wmat, out) {
  const x = new Float32Array(D);
  x[0]=src[0]; x[1]=src[1]; x[2]=src[2]; x[3]=src[3]; x[4]=src[4];
  for (let h = 0; h < HEADS; h++) {
    for (let k = 0; k < DK; k++) {
      let s = 0;
      for (let d = 0; d < D; d++) s += x[d] * Wmat[(h*DK + k)*D + d];
      out[h*DK + k] = s;
    }
  }
}

function attend() {
  if (hCount < 2) return {x: lastX, y: lastY, score: 0};
  const cur = [ (lastX/W-0.5)*2, (lastY/H-0.5)*2, 0, 0, 0.016 ];
  const q = new Float32Array(HEADS*DK);
  project(cur, Wq, q);
  let maxScore = -Infinity, bestX = lastX, bestY = lastY;
  for (let i = 0; i < hCount; i++) {
    const base = ((hIdx - 1 - i + BUF) % BUF) * 5;
    const src = [hist[base], hist[base+1], hist[base+2], hist[base+3], hist[base+4]];
    const kk = new Float32Array(HEADS*DK);
    project(src, Wk, kk);
    let dot = 0;
    for (let j = 0; j < HEADS*DK; j++) dot += q[j] * kk[j];
    const score = dot / Math.sqrt(DK);
    if (score > maxScore) { maxScore = score; bestX = (src[0]*0.5+0.5)*W; bestY = (src[1]*0.5+0.5)*H; }
  }
  return {x: bestX, y: bestY, score: maxScore};
}

function hebbianUpdate(reward = 0.1) {
  const scale = reward * 0.02;
  for (let i = 0; i < Wq.length; i++) {
    Wq[i] += scale * (Math.random()-0.5);
    Wk[i] += scale * (Math.random()-0.5);
  }
}

const N = 400;
const px = new Float32Array(N), py = new Float32Array(N), pvx = new Float32Array(N), pvy = new Float32Array(N);
for (let i = 0; i < N; i++) { px[i] = Math.random()*W; py[i] = Math.random()*H; }

const ctx = cv.getContext('2d');
const portals = [];
function spawnPortal(x, y, score) {
  if (portals.length > 6) return;
  const el = document.createElement('div');
  el.className = 'portal';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.innerHTML = `attn ${score.toFixed(1)}`;
  el.onclick = () => {
    hebbianUpdate(0.15);
    el.classList.add('rewarded');
    setTimeout(() => el.classList.remove('rewarded'), 400);
    infoEl.textContent = 'Reinforced temporal pattern';
  };
  document.body.appendChild(el);
  portals.push({el, x, y});
}

addEventListener('pointermove', e => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT)/1000);
  const vx = (e.clientX - lastX) / (dt+0.001);
  const vy = (e.clientY - lastY) / (dt+0.001);
  const slot = hIdx * 5;
  hist[slot] = (e.clientX/W - 0.5)*2;
  hist[slot+1] = (e.clientY/H - 0.5)*2;
  hist[slot+2] = vx * 0.01;
  hist[slot+3] = vy * 0.01;
  hist[slot+4] = dt;
  hIdx = (hIdx + 1) % BUF;
  if (hCount < BUF) hCount++;
  lastX = e.clientX; lastY = e.clientY; lastT = now;
});

let ox = 0, oy = 0;
addEventListener('deviceorientation', e => {
  ox = (e.gamma || 0) / 90;
  oy = (e.beta || 0) / 90;
});

document.getElementById('seal').onclick = async () => {
  const data = { Wq: Array.from(Wq), Wk: Array.from(Wk), Wv: Array.from(Wv), t: Date.now() };
  const db = await new Promise(r => {
    const req = indexedDB.open('f697', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genome');
    req.onsuccess = () => r(req.result);
  });
  const tx = db.transaction('genome', 'readwrite');
  tx.objectStore('genome').put(data, 'attn');
  await new Promise(r => tx.oncomplete = r);
  infoEl.textContent = 'Genome sealed';
};

document.getElementById('clear').onclick = () => { hCount = 0; infoEl.textContent = 'History cleared'; };

(async () => {
  try {
    const db = await new Promise(r => {
      const req = indexedDB.open('f697', 1);
      req.onsuccess = () => r(req.result);
      req.onerror = () => r(null);
    });
    if (!db) return;
    const tx = db.transaction('genome', 'readonly');
    const data = await new Promise(r => {
      const rq = tx.objectStore('genome').get('attn');
      rq.onsuccess = () => r(rq.result);
    });
    if (data) {
      Wq.set(data.Wq); Wk.set(data.Wk); Wv.set(data.Wv);
      infoEl.textContent = 'Restored sealed genome';
    }
  } catch (e) { console.debug("lab f697-webgpu-temporal-attention-pointer-portal-mind:", e); }
})();

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - lastFrame)/1000);
  lastFrame = now;
  const att = attend();
  const tx = att.x + ox * 40;
  const ty = att.y + oy * 40;

  for (let i = 0; i < N; i++) {
    const dx = tx - px[i], dy = ty - py[i];
    const d = Math.hypot(dx, dy) + 1;
    pvx[i] += dx / d * 30 * dt;
    pvy[i] += dy / d * 30 * dt;
    pvx[i] *= 0.97; pvy[i] *= 0.97;
    px[i] += pvx[i]; py[i] += pvy[i];
    if (px[i] < 0 || px[i] > W) pvx[i] *= -0.7;
    if (py[i] < 0 || py[i] > H) pvy[i] *= -0.7;
  }

  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#6af';
  for (let i = 0; i < N; i++) {
    ctx.fillRect(px[i], py[i], 2, 2);
  }
  ctx.strokeStyle = '#f84';
  ctx.beginPath(); ctx.arc(tx, ty, 12, 0, 6.28); ctx.stroke();

  if (Math.random() < 0.02 && att.score > 0.5) {
    spawnPortal(tx + (Math.random()-0.5)*60, ty + (Math.random()-0.5)*60, att.score);
  }
  portals.forEach(p => {
    p.x += (tx - p.x) * 0.01;
    p.y += (ty - p.y) * 0.01;
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
  });

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; });
statusEl.textContent = 'ready';

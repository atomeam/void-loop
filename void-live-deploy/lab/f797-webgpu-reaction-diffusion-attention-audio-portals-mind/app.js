const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GW = 96, GH = 54;
const U = new Float32Array(GW * GH);
const V = new Float32Array(GW * GH);
const nextU = new Float32Array(GW * GH);
const nextV = new Float32Array(GW * GH);

// Classic Gray-Scott params
let F = 0.037, K = 0.06, Du = 0.16, Dv = 0.08;
function initField() {
  for (let i = 0; i < GW * GH; i++) { U[i] = 1; V[i] = 0; }
  // seed
  for (let y = GH/2-4; y < GH/2+4; y++)
    for (let x = GW/2-4; x < GW/2+4; x++) {
      const i = y * GW + x;
      U[i] = 0.5; V[i] = 0.25;
    }
}
initField();

function lap(arr, x, y) {
  const i = y * GW + x;
  return arr[((y+1)%GH)*GW + x] + arr[((y-1+GH)%GH)*GW + x] +
         arr[y*GW + (x+1)%GW] + arr[y*GW + (x-1+GW)%GW] - 4 * arr[i];
}

function stepRD(modX = 0.5, modY = 0.5, strength = 0) {
  const f = F + strength * 0.01 * (modX - 0.5);
  const k = K + strength * 0.005 * (modY - 0.5);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      const u = U[i], v = V[i];
      const uvv = u * v * v;
      nextU[i] = u + Du * lap(U, x, y) - uvv + f * (1 - u);
      nextV[i] = v + Dv * lap(V, x, y) + uvv - (f + k) * v;
      nextU[i] = Math.max(0, Math.min(1, nextU[i]));
      nextV[i] = Math.max(0, Math.min(1, nextV[i]));
    }
  }
  U.set(nextU); V.set(nextV);
}

// Tiny attention-like modulator (simplified multi-head)
const history = [];
const MAXH = 16;
let tiltX = 0, tiltY = 0;
window.addEventListener('deviceorientation', e => {
  tiltX = (e.gamma || 0) / 90;
  tiltY = (e.beta || 0) / 90;
});
let lastX = 0, lastY = 0;
document.addEventListener('pointermove', e => {
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  const speed = Math.hypot(dx, dy);
  history.push([dx/20, dy/20, speed/30, tiltX, tiltY, Math.random()*0.1]);
  if (history.length > MAXH) history.shift();
});

function attentionMod() {
  if (history.length < 4) return {x:0.5, y:0.5, s:0};
  // average recent as crude "attention"
  let sx=0, sy=0, ss=0;
  for (const h of history.slice(-8)) { sx += h[0]; sy += h[1]; ss += h[2]; }
  const n = 8;
  return { x: 0.5 + Math.tanh(sx/n)*0.4, y: 0.5 + Math.tanh(sy/n)*0.4, s: Math.min(1, ss/n) };
}

// Portals
const portals = [];
for (let i = 0; i < 6; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '•';
  el.style.left = (20 + Math.random()*60) + '%';
  el.style.top = (20 + Math.random()*60) + '%';
  document.body.appendChild(el);
  portals.push({ el, x: Math.random()*W, y: Math.random()*H, vx:0, vy:0 });
}

let dragging = null;
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('portal')) dragging = portals.find(p => p.el === e.target);
});
document.addEventListener('pointerup', () => dragging = null);
document.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = e.clientX; dragging.y = e.clientY;
    // inject seed
    const gx = Math.floor(e.clientX / W * GW);
    const gy = Math.floor(e.clientY / H * GH);
    for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
      const x = (gx+dx+GW)%GW, y = (gy+dy+GH)%GH;
      const i = y*GW + x;
      V[i] = Math.min(1, V[i] + 0.3 * Math.exp(-(dx*dx+dy*dy)));
      U[i] = Math.max(0, U[i] - 0.1);
    }
  }
});

// Audio
let audioCtx, oscs = [];
document.getElementById('audioBtn').onclick = () => {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 4; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = i % 2 ? 'sawtooth' : 'sine';
    osc.frequency.value = 110 * (i+1);
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.value = 0.05;
    osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc.start();
    oscs.push({ osc, gain, filter });
  }
  document.getElementById('audioBtn').textContent = 'Audio On';
};

function sampleV(px, py) {
  const gx = Math.floor(px / W * GW);
  const gy = Math.floor(py / H * GH);
  return V[gy * GW + gx] || 0;
}

function render() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / W * GW);
      const gy = Math.floor(y / H * GH);
      const v = V[gy * GW + gx];
      const i = (y * W + x) * 4;
      data[i] = v * 80;
      data[i+1] = v * 180 + 40;
      data[i+2] = 255 - v * 100;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function loop() {
  const mod = attentionMod();
  for (let s = 0; s < 3; s++) stepRD(mod.x, mod.y, mod.s);
  render();

  portals.forEach((p, i) => {
    if (dragging !== p) {
      const v = sampleV(p.x, p.y);
      // attract to higher V
      const gx = Math.floor(p.x / W * GW), gy = Math.floor(p.y / H * GH);
      let fx=0, fy=0;
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
        const nv = V[((gy+dy+GH)%GH)*GW + (gx+dx+GW)%GW];
        fx += dx * nv; fy += dy * nv;
      }
      p.vx += fx * 0.3; p.vy += fy * 0.3;
      p.vx *= 0.92; p.vy *= 0.92;
      p.x += p.vx; p.y += p.vy;
      p.x = Math.max(24, Math.min(W-24, p.x));
      p.y = Math.max(24, Math.min(H-24, p.y));
    }
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    const v = sampleV(p.x, p.y);
    p.el.style.background = `hsla(${200 + v*120}, 80%, ${40+v*30}%, 0.8)`;
    p.el.style.transform = `scale(${0.6 + v})`;
    if (oscs[i % oscs.length]) {
      const o = oscs[i % oscs.length];
      o.osc.frequency.setTargetAtTime(80 + v * 400, audioCtx.currentTime, 0.1);
      o.gain.gain.setTargetAtTime(0.02 + v * 0.08, audioCtx.currentTime, 0.1);
    }
  });

  document.getElementById('status').textContent = `mod ${mod.s.toFixed(2)}`;
  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = async () => {
  const genome = { F, K, history: history.slice(-8), t: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f797', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'current');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) { console.debug("lab f797-webgpu-reaction-diffusion-attention-audio-portals-mind:", e); }
  try {
    const bc = new BroadcastChannel('f797-seal');
    bc.postMessage(genome);
  } catch (e) { console.debug("lab f797-webgpu-reaction-diffusion-attention-audio-portals-mind:", e); }
  document.getElementById('status').textContent = 'Sealed';
};

// Load seal
(async () => {
  try {
    const db = await new Promise(res => {
      const r = indexedDB.open('verse-f797', 1);
      r.onsuccess = () => res(r.result);
    });
    const tx = db.transaction('genomes', 'readonly');
    const g = await new Promise(res => {
      const req = tx.objectStore('genomes').get('current');
      req.onsuccess = () => res(req.result);
    });
    if (g) { F = g.F || F; K = g.K || K; document.getElementById('status').textContent = 'Genome restored'; }
  } catch (e) { console.debug("lab f797-webgpu-reaction-diffusion-attention-audio-portals-mind:", e); }
})();

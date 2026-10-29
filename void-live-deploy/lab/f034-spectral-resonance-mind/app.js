const canvas = document.getElementById('void');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = document.getElementById('status');
let W, H;
const GW = 8, GH = 6, G = GW * GH;
let phases = new Float32Array(G);
let freqs = new Float32Array(G);
let params = { K: 1.8, spread: 0.4, kernel: 1.2 };
let morph = 0;
let particles = [];
const PN = 240;
let audioCtx, oscs = [];

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

function rand(a, b) { return a + Math.random() * (b - a); }
function init() {
  for (let i = 0; i < G; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    freqs[i] = 1 + (Math.random() - 0.5) * params.spread;
  }
  particles = [];
  for (let i = 0; i < PN; i++) {
    particles.push({ x: rand(0, W), y: rand(0, H), vx: 0, vy: 0 });
  }
}
init();

// Evolutionary mind in Worker
const workerCode = `
let pop = Array.from({length: 6}, () => ({
  p: { K: 0.8 + Math.random()*2.5, spread: 0.2 + Math.random()*0.8, kernel: 0.6 + Math.random()*1.6 },
  fit: 0
}));
let best = pop[0];
self.onmessage = (e) => {
  const { metrics } = e.data;
  const spectral = metrics.spectral || 0.5;
  const coh = metrics.coherence || 0.3;
  const energy = metrics.energy || 0;
  pop.forEach(g => {
    g.fit = spectral * 1.4 + coh * 0.8 + energy * 0.6 + Math.random() * 0.08;
  });
  pop.sort((a,b) => b.fit - a.fit);
  best = pop[0];
  for (let i = 3; i < 6; i++) {
    const p = pop[Math.floor(Math.random()*3)].p;
    pop[i].p = {
      K: Math.max(0.3, p.K + (Math.random()-0.5)*0.5),
      spread: Math.max(0.1, p.spread + (Math.random()-0.5)*0.2),
      kernel: Math.max(0.4, p.kernel + (Math.random()-0.5)*0.3)
    };
    pop[i].fit = 0;
  }
  self.postMessage({ best: best.p, fit: best.fit });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  params = e.data.best;
  morph = Math.min(1, (e.data.fit || 0) / 6);
  document.documentElement.style.setProperty('--morph', morph);
  document.documentElement.style.setProperty('--hue', 160 + morph * 160);
  statusEl.textContent = `fit ${e.data.fit.toFixed(2)} | K ${params.K.toFixed(2)} | morph ${morph.toFixed(2)}`;
  updateAudio();
};

function stepOscillators() {
  const { K, spread, kernel } = params;
  const next = new Float32Array(G);
  let freqSum = 0, freqVar = 0, phaseDiff = 0;
  for (let i = 0; i < G; i++) {
    const x = i % GW, y = (i / GW) | 0;
    let sumSin = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + GW) % GW, ny = (y + dy + GH) % GH;
        const j = ny * GW + nx;
        const d = Math.hypot(dx, dy);
        if (d < kernel + 0.5) {
          sumSin += Math.sin(phases[j] - phases[i]);
          n++;
        }
      }
    }
    const omega = freqs[i] * (1 + (Math.random()-0.5)*0.02);
    next[i] = phases[i] + 0.08 * (omega + (K / (n || 1)) * sumSin);
    freqSum += omega;
  }
  phases.set(next);
  const meanF = freqSum / G;
  for (let i = 0; i < G; i++) freqVar += (freqs[i] - meanF) ** 2;
  // coherence proxy: mean |sum exp(i*phase)|
  let cx = 0, cy = 0;
  for (let i = 0; i < G; i++) { cx += Math.cos(phases[i]); cy += Math.sin(phases[i]); }
  const coh = Math.hypot(cx, cy) / G;
  return { spectral: Math.min(1, freqVar / 2), coherence: coh, energy: 0 };
}

function advectParticles() {
  for (const p of particles) {
    const gx = Math.min(GW-1, Math.max(0, (p.x / W) * GW));
    const gy = Math.min(GH-1, Math.max(0, (p.y / H) * GH));
    const ix = gx | 0, iy = gy | 0;
    const fx = gx - ix, fy = gy - iy;
    // phase gradient approx
    const i00 = iy * GW + ix;
    const i10 = iy * GW + ((ix+1)%GW);
    const i01 = ((iy+1)%GH) * GW + ix;
    const dpx = phases[i10] - phases[i00];
    const dpy = phases[i01] - phases[i00];
    p.vx = (p.vx * 0.92 + Math.sin(dpx) * 1.8);
    p.vy = (p.vy * 0.92 + Math.sin(dpy) * 1.8);
    p.x = (p.x + p.vx + W) % W;
    p.y = (p.y + p.vy + H) % H;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, W, H);
  // oscillators as colored cells
  const cw = W / GW, ch = H / GH;
  for (let i = 0; i < G; i++) {
    const x = (i % GW) * cw, y = ((i / GW) | 0) * ch;
    const h = 180 + (phases[i] / (Math.PI*2)) * 120 + morph * 40;
    ctx.fillStyle = `hsla(${h}, 70%, 45%, 0.35)`;
    ctx.fillRect(x, y, cw, ch);
  }
  // particles
  ctx.fillStyle = `hsl(${200 + morph * 100}, 80%, 65%)`;
  for (const p of particles) {
    ctx.fillRect(p.x, p.y, 1.8, 1.8);
  }
}

let lastMind = 0;
let metrics = { spectral: 0.5, coherence: 0.3, energy: 0 };
function loop(t) {
  metrics = stepOscillators();
  advectParticles();
  draw();
  if (t - lastMind > 900) {
    worker.postMessage({ metrics });
    lastMind = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Interaction
canvas.addEventListener('pointermove', (e) => {
  const mx = e.clientX, my = e.clientY;
  const ix = Math.min(GW-1, Math.max(0, (mx / W) * GW)) | 0;
  const iy = Math.min(GH-1, Math.max(0, (my / H) * GH)) | 0;
  const i = iy * GW + ix;
  phases[i] += 0.8;
  metrics.energy = Math.min(1, metrics.energy + 0.15);
  for (const p of particles) {
    const dx = mx - p.x, dy = my - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 90) {
      p.vx += (dx / d) * 0.5;
      p.vy += (dy / d) * 0.5;
    }
  }
});
document.getElementById('seed').onclick = () => {
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(Math.random() * G);
    phases[i] += Math.PI;
  }
  metrics.energy = 1;
};

// Web Audio from dominant modes
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 4; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = ['sine','triangle','sine','sawtooth'][i];
    o.frequency.value = 110 + i * 55;
    g.gain.value = 0.03;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    oscs.push({ o, g });
  }
}
function updateAudio() {
  if (!audioCtx) return;
  const base = 100 + morph * 140 + params.K * 20;
  oscs.forEach((s, i) => {
    s.o.frequency.setTargetAtTime(base + i * 25 + metrics.spectral * 40, audioCtx.currentTime, 0.25);
    s.g.gain.setTargetAtTime(0.015 + morph * 0.05 + metrics.coherence * 0.03, audioCtx.currentTime, 0.3);
  });
}
document.body.addEventListener('pointerdown', initAudio, { once: true });

// Seal
document.getElementById('seal').onclick = async () => {
  const idb = await new Promise((res, rej) => {
    const r = indexedDB.open('f034-genomes', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('g', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = idb.transaction('g', 'readwrite');
  const payload = JSON.stringify(params) + morph + metrics.spectral;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('').slice(0,16));
  tx.objectStore('g').put({ id: Date.now(), params, morph, metrics, hash, t: new Date().toISOString() });
  statusEl.textContent = `sealed ${hash}`;
};

// Orientation bias
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma != null) {
      const bias = e.gamma / 180;
      for (let i = 0; i < G; i++) freqs[i] += bias * 0.002;
    }
  });
}

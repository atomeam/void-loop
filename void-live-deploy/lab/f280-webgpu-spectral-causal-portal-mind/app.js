const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, bins = 64, energies = new Float32Array(bins), velocities = new Float32Array(bins);
let portals = [];
let residual = { ox: 0, oy: 0, px: 0, py: 0, e: 0 };
let audioCtx, oscillators = [];

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Worker residual predictor
const worker = new Worker(URL.createObjectURL(new Blob([`
let hidden = new Float32Array(8).fill(0.1);
self.onmessage = e => {
  const { ox, oy, px, py, e: en } = e.data;
  // simple causal residual update (RNN-like)
  for (let i = 0; i < 8; i++) {
    hidden[i] = Math.tanh(hidden[i] * 0.7 + ox * (i%2?1:-1) * 0.3 + oy * 0.2 + px * 0.1 + en * 0.4);
  }
  const x = 0.5 + hidden[0] * 0.4;
  const y = 0.5 + hidden[1] * 0.4;
  const scale = 0.8 + Math.abs(hidden[2]) * 0.6;
  const hue = (hidden[3] + 1) * 180;
  const attract = hidden[4];
  self.postMessage({ x, y, scale, hue, attract, sig: hidden[0].toFixed(4) + hidden[1].toFixed(4) });
};
`], { type: 'text/javascript' })));

worker.onmessage = e => {
  const p = e.data;
  if (portals.length < 6) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.style.left = (p.x * W - 40) + 'px';
    el.style.top = (p.y * H - 40) + 'px';
    el.dataset.sig = p.sig;
    makeDraggable(el);
    document.body.appendChild(el);
    portals.push(el);
  }
  // morph existing
  portals.forEach((el, i) => {
    const t = 1 - i / portals.length;
    el.style.transform = `translateZ(${p.attract * 40}px) scale(${p.scale * t + 0.5})`;
    el.style.filter = `hue-rotate(${p.hue}deg)`;
  });
};

function makeDraggable(el) {
  let dragging = false, ox, oy;
  el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
  });
  el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    // inject spectral impulse
    const bin = Math.floor((parseFloat(el.style.left) / W) * bins);
    energies[bin % bins] += 0.8;
    // seal residual
    const req = indexedDB.open('f280-seals', 1);
    req.onsuccess = ev => {
      const db = ev.target.result;
      const tx = db.transaction('seals', 'readwrite');
      tx.objectStore('seals').add({ sig: el.dataset.sig, t: Date.now() });
    };
    req.onupgradeneeded = ev => {
      ev.target.result.createObjectStore('seals', { autoIncrement: true });
    };
  });
}

// orientation residual
window.addEventListener('deviceorientation', e => {
  residual.ox = (e.beta || 0) / 90;
  residual.oy = (e.gamma || 0) / 90;
});
let lastX = 0, lastY = 0;
canvas.addEventListener('pointermove', e => {
  residual.px = (e.clientX - lastX) / W;
  residual.py = (e.clientY - lastY) / H;
  lastX = e.clientX; lastY = e.clientY;
});

function step() {
  // spectral diffusion
  const next = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    const l = energies[(i - 1 + bins) % bins];
    const r = energies[(i + 1) % bins];
    next[i] = energies[i] * 0.92 + (l + r) * 0.04 + Math.sin(performance.now() * 0.001 + i) * 0.01;
  }
  energies = next;
  residual.e = energies.reduce((a, b) => a + b, 0) / bins;

  worker.postMessage(residual);

  // render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < bins; i++) {
    const x = (i / bins) * W;
    const h = energies[i] * H * 0.6;
    ctx.fillStyle = `hsla(${i * 6 + residual.e * 100}, 70%, 50%, 0.6)`;
    ctx.fillRect(x, H - h, W / bins - 1, h);
  }
  requestAnimationFrame(step);
}

// audio after gesture
document.body.addEventListener('click', () => {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  for (let i = 0; i < 4; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 110 * (i + 1);
    g.gain.value = 0.05;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    oscillators.push({ o, g });
  }
}, { once: true });

setInterval(() => {
  if (!audioCtx) return;
  oscillators.forEach((osc, i) => {
    osc.g.gain.value = 0.02 + energies[i * 16] * 0.1;
  });
}, 100);

requestAnimationFrame(step);

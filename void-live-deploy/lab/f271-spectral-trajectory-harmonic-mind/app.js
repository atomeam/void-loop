const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W, H;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Trajectory buffer
const HIST = 64;
let vxHist = new Float32Array(HIST);
let vyHist = new Float32Array(HIST);
let histIdx = 0;
let lastX = W/2, lastY = H/2;

// Harmonics (freq, amp, phase) — evolved
const NH = 5;
let harmonics = Array.from({length: NH}, (_, i) => ({
  freq: 0.05 + i * 0.08,
  amp: 0.3 + Math.random() * 0.4,
  phase: Math.random() * Math.PI * 2
}));

// Particles
const NP = 48;
let particles = Array.from({length: NP}, () => ({
  x: W/2 + (Math.random()-0.5)*200,
  y: H/2 + (Math.random()-0.5)*200,
  vx: 0, vy: 0,
  hue: 200 + Math.random()*80,
  life: 1
}));

// Pointer / orient
let pointer = { x: W/2, y: H/2, speed: 0 };
let orient = { beta: 0, gamma: 0 };
let hasOrient = false;
let bestFitness = 0.1;
let entropy = 0.4;

// Worker
let worker = null;
try {
  const workerCode = `
    let pop = [];
    const POP = 8, NH = 5;
    function randH() {
      return Array.from({length: NH}, () => ({
        freq: 0.02 + Math.random()*0.4,
        amp: Math.random()*0.8,
        phase: Math.random()*Math.PI*2
      }));
    }
    for (let i = 0; i < POP; i++) pop.push({ h: randH(), fit: 0 });
    self.onmessage = e => {
      const { spectrum, residual } = e.data;
      pop.forEach(ind => {
        let err = 0;
        for (let k = 0; k < Math.min(spectrum.length, NH); k++) {
          const target = spectrum[k] || 0;
          const pred = ind.h[k].amp * Math.sin(ind.h[k].phase);
          err += Math.abs(target - pred);
        }
        ind.fit = 1 / (1 + err + residual * 0.3) + Math.random()*0.02;
      });
      pop.sort((a,b) => b.fit - a.fit);
      const elite = pop[0].h.map(o => ({...o}));
      for (let i = 1; i < POP; i++) {
        pop[i].h = elite.map(h => ({
          freq: Math.max(0.01, h.freq + (Math.random()-0.5)*0.04),
          amp: Math.max(0.05, Math.min(1, h.amp + (Math.random()-0.5)*0.12)),
          phase: h.phase + (Math.random()-0.5)*0.4
        }));
      }
      self.postMessage({ best: elite, fitness: pop[0].fit });
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    harmonics = e.data.best;
    bestFitness = e.data.fitness;
  };
} catch (err) {
  status.textContent = 'Worker blocked — static harmonics.';
}

// Simple DFT power spectrum of speed series
function computeSpectrum() {
  const N = HIST;
  const spec = new Float32Array(NH);
  let total = 0;
  for (let k = 1; k <= NH; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const v = Math.hypot(vxHist[n], vyHist[n]);
      const ang = -2 * Math.PI * k * n / N;
      re += v * Math.cos(ang);
      im += v * Math.sin(ang);
    }
    const power = Math.sqrt(re*re + im*im) / N;
    spec[k-1] = power;
    total += power;
  }
  // entropy proxy
  let e = 0;
  if (total > 0.01) {
    for (let i = 0; i < NH; i++) {
      const p = spec[i] / total;
      if (p > 0.001) e -= p * Math.log(p);
    }
    e /= Math.log(NH);
  }
  return { spec, entropy: Math.min(1, e), residual: 1 - Math.min(1, total * 2) };
}

function updateParticles(spec) {
  const targets = harmonics.map((h, i) => {
    const ang = h.phase + performance.now() * 0.001 * h.freq * 8;
    const r = 80 + h.amp * 180;
    return {
      x: W/2 + Math.cos(ang) * r,
      y: H/2 + Math.sin(ang) * r * 0.7,
      hue: 180 + h.freq * 400
    };
  });
  particles.forEach((p, i) => {
    const t = targets[i % NH];
    const dx = t.x - p.x, dy = t.y - p.y;
    p.vx = p.vx * 0.92 + dx * 0.008;
    p.vy = p.vy * 0.92 + dy * 0.008;
    p.x += p.vx;
    p.y += p.vy;
    p.hue = t.hue;
    // clamp
    p.x = Math.max(20, Math.min(W-20, p.x));
    p.y = Math.max(20, Math.min(H-20, p.y));
  });
}

function draw(spec) {
  ctx.fillStyle = 'rgba(4,4,12,0.35)';
  ctx.fillRect(0, 0, W, H);
  // particles
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + Math.abs(p.vx+p.vy)*2, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${p.hue}, 75%, 62%, 0.85)`;
    ctx.fill();
  });
  // pointer
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(160,220,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // spectrum bars
  const barW = 18;
  spec.forEach((s, i) => {
    const bh = Math.min(120, s * 400);
    ctx.fillStyle = `hsla(${200 + i*30}, 70%, 55%, 0.7)`;
    ctx.fillRect(16 + i * (barW+4), H - 20 - bh, barW, bh);
  });
}

// Audio
let audioCtx = null, oscillators = [];
function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    oscillators = harmonics.map(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const pan = audioCtx.createStereoPanner();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(audioCtx.destination);
      osc.start();
      gain.gain.value = 0.02;
      return { osc, gain, pan };
    });
  } catch (e) {}
}

function updateAudio() {
  if (!audioCtx || !oscillators.length) return;
  const centroidX = particles.reduce((s, p) => s + p.x, 0) / particles.length;
  const panVal = (centroidX / W - 0.5) * 1.4;
  harmonics.forEach((h, i) => {
    const o = oscillators[i];
    if (!o) return;
    o.osc.frequency.setTargetAtTime(80 + h.freq * 420, audioCtx.currentTime, 0.05);
    o.gain.gain.setTargetAtTime(0.015 * h.amp * bestFitness, audioCtx.currentTime, 0.1);
    o.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, panVal)), audioCtx.currentTime, 0.05);
  });
}

let lastSend = 0;
function loop() {
  // record velocity
  const dx = pointer.x - lastX, dy = pointer.y - lastY;
  vxHist[histIdx] = dx;
  vyHist[histIdx] = dy;
  histIdx = (histIdx + 1) % HIST;
  lastX = pointer.x; lastY = pointer.y;
  pointer.speed = Math.hypot(dx, dy);

  const { spec, entropy: ent, residual } = computeSpectrum();
  entropy = ent;
  updateParticles(spec);
  draw(spec);
  updateAudio();

  // morph
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(3));
  document.documentElement.style.setProperty('--fitness', bestFitness.toFixed(3));
  document.documentElement.style.setProperty('--hue', (200 + bestFitness * 140 + entropy * 40).toFixed(0));

  if (worker && performance.now() - lastSend > 1600) {
    worker.postMessage({ spectrum: Array.from(spec), residual });
    lastSend = performance.now();
  }

  status.textContent = `Entropy ${entropy.toFixed(2)} | Fitness ${bestFitness.toFixed(2)} | Residual ${residual.toFixed(2)} | Harmonics live`;
  requestAnimationFrame(loop);
}

// Interactions
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  ensureAudio();
});
canvas.addEventListener('pointerdown', () => {
  ensureAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  status.textContent = 'Spectrum seeded.';
});
document.getElementById('seed').onclick = () => {
  pointer.speed = 1;
  status.textContent = 'Manual spectrum boost.';
};
document.getElementById('seal').onclick = async () => {
  const genome = { harmonics, fitness: bestFitness, ts: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f271', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'ts' });
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome);
    status.textContent = `Genome sealed ${new Date().toLocaleTimeString()}.`;
  } catch (err) {
    status.textContent = 'Seal failed (storage).';
  }
};

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      orient.beta = e.beta || 0;
      orient.gamma = e.gamma || 0;
      hasOrient = true;
      // mild bias on pointer
      pointer.x += orient.gamma * 0.3;
      pointer.y += orient.beta * 0.3;
    }
  });
}

loop();
status.textContent = 'Draw with pointer. Harmonics evolve to match your trajectory spectrum. Chrome and audio respond.';

const canvas = document.getElementById('void');
const ctx = canvas.getContext('2d', { alpha: false });
const statusEl = document.getElementById('status');
let W, H, N = 280;
let particles = [];
let params = { K: 1.4, freqLo: 0.8, freqHi: 2.2, noise: 0.05 };
let order = 0;
let morph = 0;
let pointerFreq = 0.5;
let audioCtx, oscs = [];
let pointerHist = [];
let lastPointer = { x: 0, y: 0, t: 0 };

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

function rand(a, b) { return a + Math.random() * (b - a); }
function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: rand(0, W), y: rand(0, H),
      theta: rand(0, Math.PI * 2),
      omega: rand(params.freqLo, params.freqHi),
      vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4)
    });
  }
}
initParticles();

const workerCode = `
let pop = Array.from({length: 5}, () => ({
  p: { K: 0.6 + Math.random()*2, freqLo: 0.4 + Math.random()*1, freqHi: 1.5 + Math.random()*2, noise: 0.02 + Math.random()*0.1 },
  fit: 0
}));
let best = pop[0];
self.onmessage = (e) => {
  const { spectralMatch, order, stats } = e.data;
  pop.forEach(g => {
    g.fit = spectralMatch * 3 + order * 1.5 + (stats.energy || 0) * 0.2 + Math.random()*0.05;
  });
  pop.sort((a,b) => b.fit - a.fit);
  best = pop[0];
  for (let i = 2; i < 5; i++) {
    const p = pop[Math.floor(Math.random()*2)].p;
    pop[i].p = {
      K: Math.max(0.2, Math.min(3.5, p.K + (Math.random()-0.5)*0.4)),
      freqLo: Math.max(0.2, p.freqLo + (Math.random()-0.5)*0.3),
      freqHi: Math.max(p.freqLo+0.5, p.freqHi + (Math.random()-0.5)*0.4),
      noise: Math.max(0.01, Math.min(0.2, p.noise + (Math.random()-0.5)*0.02))
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
  document.documentElement.style.setProperty('--freq', pointerFreq);
  statusEl.textContent = `fit ${e.data.fit.toFixed(2)} | K ${params.K.toFixed(2)} | order ${order.toFixed(2)} | f≈${pointerFreq.toFixed(2)}`;
  updateAudio();
};

function estimatePointerFreq() {
  if (pointerHist.length < 8) return 0.4;
  let crossings = 0;
  const mean = pointerHist.reduce((a,b)=>a+b,0) / pointerHist.length;
  for (let i = 1; i < pointerHist.length; i++) {
    if ((pointerHist[i-1] - mean) * (pointerHist[i] - mean) < 0) crossings++;
  }
  const rate = crossings / (pointerHist.length * 0.016);
  return Math.max(0.2, Math.min(3.5, rate * 0.5 + 0.3));
}

function stepField() {
  const { K, noise } = params;
  let cosSum = 0, sinSum = 0;
  const neigh = 48;
  for (let i = 0; i < N; i++) {
    const p = particles[i];
    let sumSin = 0, n = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = particles[j].x - p.x, dy = particles[j].y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < neigh && d > 0.1) {
        sumSin += Math.sin(particles[j].theta - p.theta);
        n++;
      }
    }
    const coupling = n ? (K / n) * sumSin : 0;
    p.theta += (p.omega + coupling + (Math.random()-0.5)*noise) * 0.016;
    p.theta = ((p.theta % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    p.x = (p.x + p.vx + Math.cos(p.theta)*0.3 + W) % W;
    p.y = (p.y + p.vy + Math.sin(p.theta)*0.3 + H) % H;
    cosSum += Math.cos(p.theta);
    sinSum += Math.sin(p.theta);
  }
  order = Math.hypot(cosSum / N, sinSum / N);
  return { energy: order * 2 };
}

function draw() {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    const hue = (p.theta / (Math.PI*2)) * 360;
    ctx.fillStyle = `hsl(${hue}, 75%, ${55 + morph*15}%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4 + morph, 0, Math.PI*2);
    ctx.fill();
  }
}

let lastMind = 0;
function loop(t) {
  const stats = stepField();
  draw();
  pointerFreq = estimatePointerFreq();
  const spectralMatch = 1 - Math.min(1, Math.abs(pointerFreq - (params.freqLo + params.freqHi)/2) / 2);
  if (t - lastMind > 650) {
    worker.postMessage({ spectralMatch, order, stats });
    lastMind = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  const dt = (now - lastPointer.t) / 1000 || 0.016;
  const speed = Math.hypot(dx, dy) / dt;
  pointerHist.push(speed * 0.01);
  if (pointerHist.length > 40) pointerHist.shift();
  lastPointer = { x: e.clientX, y: e.clientY, t: now };
  for (const p of particles) {
    const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (d < 70) p.theta += 0.4 * (1 - d/70);
  }
});
document.getElementById('kick').onclick = () => {
  for (let i = 0; i < 30; i++) particles[i].theta += Math.PI;
};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = ['sine','triangle','sine'][i];
    o.frequency.value = 110;
    g.gain.value = 0.03;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    oscs.push({ o, g });
  }
}
function updateAudio() {
  if (!audioCtx) return;
  const base = 70 + pointerFreq * 90 + morph * 40;
  oscs.forEach((s, i) => {
    s.o.frequency.setTargetAtTime(base * (1 + i * 0.5), audioCtx.currentTime, 0.15);
    s.g.gain.setTargetAtTime(0.015 + morph * 0.05 + order * 0.02, audioCtx.currentTime, 0.25);
  });
}
document.body.addEventListener('pointerdown', initAudio, { once: true });

document.getElementById('seal').onclick = async () => {
  const idb = await new Promise((res, rej) => {
    const r = indexedDB.open('f027-genomes', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('g', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = idb.transaction('g', 'readwrite');
  const payload = JSON.stringify({ params, order, pointerFreq, morph });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('').slice(0,16));
  tx.objectStore('g').put({ id: Date.now(), params, order, pointerFreq, morph, hash, t: new Date().toISOString() });
  statusEl.textContent = `sealed ${hash}`;
};

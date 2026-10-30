const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize();
addEventListener('resize', resize);

const N = 160;
const particles = [];
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 1.8, vy: (Math.random() - 0.5) * 1.8,
    hue: 200 + Math.random() * 80
  });
}

const hist = [];
const MAXH = 20;
let px = W/2, py = H/2;
let audioRms = 0;
let micEnabled = false;
let analyser, dataArray;

async function enableMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    micEnabled = true;
    document.getElementById('mic').textContent = 'Mic on';
  } catch (e) {
    alert('Mic denied or unavailable — pointer-only mode');
  }
}
document.getElementById('mic').onclick = enableMic;

const orbs = [];
for (let i = 0; i < 3; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = 'orb' + i;
  el.style.setProperty('--oh', 40 + i * 90);
  document.body.appendChild(el);
  const o = { el, x: 100 + i * 140, y: 90 + Math.random()*40, id: i };
  orbs.push(o);
  el.addEventListener('pointerdown', e => {
    e.target.setPointerCapture(e.pointerId);
    const move = ev => { o.x = ev.clientX; o.y = ev.clientY; };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  el.addEventListener('click', () => {
    worker.postMessage({ inject: true, delta: (Math.random()-0.5)*0.3 });
  });
}

const workerCode = `
let pop = [];
const P = 8;
const G = 5;
function rand() { return Math.random() * 2 - 1; }
for (let i = 0; i < P; i++) pop.push({ genes: Array.from({length: G}, rand), fit: 0 });
function predict(genes, hist, rms) {
  if (hist.length < 2) return { vx: 0, vy: 0 };
  const last = hist[hist.length-1], prev = hist[hist.length-2];
  const vx = (last.x - prev.x) * genes[1] + genes[0] + rms * genes[2];
  const vy = (last.y - prev.y) * genes[1] + genes[0] + rms * genes[2];
  return { vx, vy };
}
self.onmessage = e => {
  const { residual, hist, coherence, rms, inject, delta } = e.data;
  if (inject && typeof delta === 'number') {
    for (const ind of pop) ind.genes[2] += delta * 0.1;
  }
  for (const ind of pop) {
    const pred = predict(ind.genes, hist, rms || 0);
    const err = Math.hypot(pred.vx, pred.vy);
    ind.fit = (1 - Math.min(1, residual)) * 0.55 + (coherence || 0) * 0.25 + (1 - Math.min(1, err / 10)) * 0.15 + Math.random()*0.02;
  }
  pop.sort((a,b) => b.fit - a.fit);
  const best = pop[0];
  const child = { genes: best.genes.map(g => g + (Math.random()-0.5)*0.2), fit: 0 };
  pop[P-1] = child;
  self.postMessage({ best: best.genes, gen: Date.now() % 10000 });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
let bestGenes = [0.05, 0.6, 0.3, 0.15, 0.1];
let gen = 0;
worker.onmessage = e => {
  bestGenes = e.data.best;
  gen = e.data.gen;
  document.getElementById('gen').textContent = Math.floor(gen / 100);
};

addEventListener('pointermove', e => {
  px = e.clientX; py = e.clientY;
  hist.push({ x: px, y: py, t: performance.now() });
  if (hist.length > MAXH) hist.shift();
});

function computeResidual() {
  if (hist.length < 3) return 0.6;
  const last = hist[hist.length-1];
  const prev = hist[hist.length-2];
  const actualVx = last.x - prev.x;
  const actualVy = last.y - prev.y;
  const predVx = (prev.x - (hist[hist.length-3]?.x || prev.x)) * bestGenes[1] + bestGenes[0] + audioRms * bestGenes[2];
  const predVy = (prev.y - (hist[hist.length-3]?.y || prev.y)) * bestGenes[1] + bestGenes[0] + audioRms * bestGenes[2];
  return Math.min(1, Math.hypot(actualVx - predVx, actualVy - predVy) / 25);
}

let frame = 0;
function tick() {
  frame++;
  if (micEnabled && analyser) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    audioRms = sum / dataArray.length / 255;
  } else audioRms *= 0.95;

  const residual = computeResidual();
  const conf = 1 - residual;
  document.getElementById('res').textContent = residual.toFixed(2);
  document.getElementById('conf').textContent = conf.toFixed(2);
  document.getElementById('aud').textContent = audioRms.toFixed(2);

  const hue = 160 + residual * 160 + audioRms * 40;
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--glow', conf * 0.8 + audioRms * 0.4);

  const cohesion = 0.018 + bestGenes[3] * 0.025 * conf;
  const sep = 0.07 * residual + audioRms * 0.04;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let ax = 0, ay = 0;
    for (let j = 0; j < particles.length; j++) {
      if (i === j) continue;
      const q = particles[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 2000 && d2 > 1) {
        ax += dx / d2 * cohesion;
        ay += dy / d2 * cohesion;
        if (d2 < 350) { ax -= dx * sep; ay -= dy * sep; }
      }
    }
    for (const o of orbs) {
      const dx = o.x - p.x, dy = o.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 12000) { ax += dx / Math.max(d2, 80) * 0.12; ay += dy / Math.max(d2, 80) * 0.12; }
    }
    ax += (px - p.x) * 0.0006;
    ay += (py - p.y) * 0.0006;
    p.vx = p.vx * 0.91 + ax;
    p.vy = p.vy * 0.91 + ay;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 3.8) { p.vx *= 3.8/sp; p.vy *= 3.8/sp; }
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
    p.hue = (p.hue + residual * 1.5 + audioRms * 3) % 360;
  }

  ctx.fillStyle = `hsl(${hue}, 38%, 5%)`;
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    ctx.fillStyle = `hsla(${p.hue}, 68%, 58%, 0.82)`;
    ctx.fillRect(p.x - 1.4, p.y - 1.4, 2.8, 2.8);
  }

  for (const o of orbs) {
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
  }

  if (frame % 40 === 0) {
    let coherence = 0;
    for (let i = 0; i < Math.min(24, particles.length); i++) {
      coherence += Math.hypot(particles[i].vx, particles[i].vy);
    }
    coherence = 1 - Math.min(1, coherence / 24 / 2.5);
    worker.postMessage({ residual, hist: hist.slice(-5), coherence, rms: audioRms });
  }

  requestAnimationFrame(tick);
}
tick();

document.getElementById('seal').addEventListener('click', () => {
  try {
    localStorage.setItem('f176-best-genes', JSON.stringify(bestGenes));
    alert('Sealed best genes');
  } catch (e) { alert('Seal failed'); }
});

try {
  const saved = localStorage.getItem('f176-best-genes');
  if (saved) bestGenes = JSON.parse(saved);
} catch (e) {}

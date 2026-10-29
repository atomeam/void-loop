const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, gridW = 80, gridH = 50, cell = 8;
let field = new Float32Array(gridW * gridH);
let next = new Float32Array(gridW * gridH);
let params = [0.15, 0.08, 0.04, 0.6]; // diffusion, reaction, attractor, decay
let fitness = 0.5;
let voiceSpectrum = new Float32Array(32);
let fieldSpectrum = new Float32Array(32);
let micActive = false;
let analyser, micStream;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.max(4, Math.floor(Math.min(W / gridW, H / gridH)));
}
resize();
addEventListener('resize', resize);

// Seed field
for (let i = 0; i < field.length; i++) field[i] = Math.random() * 0.2;

// Worker mind
const workerCode = `
let pop = Array.from({length: 8}, () => Array.from({length: 4}, () => Math.random()*0.4 + 0.05));
let best = pop[0];
self.onmessage = (e) => {
  const { reward, spectrumMatch } = e.data;
  // simple evolutionary step
  pop.forEach((g, i) => {
    if (Math.random() < 0.3) g[Math.floor(Math.random()*4)] += (Math.random()-0.5)*0.08;
    g.forEach((v, j) => g[j] = Math.max(0.01, Math.min(1, v)));
  });
  // fitness proxy: prefer higher reward
  best = pop[Math.floor(Math.random()*pop.length)];
  self.postMessage({ params: best, fitness: reward || 0.5 });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  params = e.data.params;
  fitness = e.data.fitness;
};

// Audio
async function enableMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const actx = new AudioContext();
    const src = actx.createMediaStreamSource(micStream);
    analyser = actx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    micActive = true;
    document.getElementById('status').textContent = 'Mic active. Speak or hum to resonate the lattice.';
  } catch (err) {
    document.getElementById('status').textContent = 'Mic denied or unavailable. Using pointer only.';
  }
}
document.getElementById('mic').onclick = enableMic;

function stepLattice() {
  const [diff, react, attract, decay] = params;
  for (let y = 1; y < gridH-1; y++) {
    for (let x = 1; x < gridW-1; x++) {
      const i = y * gridW + x;
      let sum = field[i-1] + field[i+1] + field[i-gridW] + field[i+gridW];
      let v = field[i] + diff * (sum/4 - field[i]) + react * field[i] * (1 - field[i]) - decay * field[i];
      // attractor near center or pointer later
      next[i] = Math.max(0, Math.min(1, v));
    }
  }
  [field, next] = [next, field];
}

function computeFieldSpectrum() {
  // crude: bin activity by x-position as "frequency"
  fieldSpectrum.fill(0);
  for (let i = 0; i < field.length; i++) {
    const bin = Math.floor((i % gridW) / gridW * 32);
    fieldSpectrum[bin] += field[i];
  }
  const max = Math.max(...fieldSpectrum) || 1;
  for (let i = 0; i < 32; i++) fieldSpectrum[i] /= max;
}

function getVoiceSpectrum() {
  if (!micActive || !analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  for (let i = 0; i < 32; i++) voiceSpectrum[i] = data[i] / 255;
}

function resonanceScore() {
  let match = 0;
  for (let i = 0; i < 32; i++) match += 1 - Math.abs(voiceSpectrum[i] - fieldSpectrum[i]);
  return match / 32;
}

let pointer = { x: 0.5, y: 0.5 };
canvas.onpointermove = (e) => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
  // seed energy
  const gx = Math.floor(pointer.x * gridW);
  const gy = Math.floor(pointer.y * gridH);
  const i = gy * gridW + gx;
  if (i >= 0 && i < field.length) field[i] = Math.min(1, field[i] + 0.4);
};

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const hue = 180 + fitness * 140;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const v = field[y * gridW + x];
      if (v < 0.05) continue;
      ctx.fillStyle = `hsla(${hue + v*60}, 70%, ${30 + v*50}%, ${0.6 + v*0.4})`;
      ctx.fillRect(x * cell, y * cell, cell-1, cell-1);
    }
  }
}

function morphUI() {
  const scale = 0.98 + fitness * 0.04;
  const blur = (1 - fitness) * 2;
  document.body.style.filter = `hue-rotate(${fitness * 90}deg) blur(${blur}px)`;
  document.body.style.background = `radial-gradient(circle at ${pointer.x*100}% ${pointer.y*100}%, #1a1a2e, #0a0a12)`;
  document.getElementById('hud').style.transform = `scale(${scale})`;
}

function loop() {
  stepLattice();
  computeFieldSpectrum();
  getVoiceSpectrum();
  const reward = resonanceScore() * 0.7 + Math.random() * 0.1;
  if (Math.random() < 0.05) worker.postMessage({ reward, spectrumMatch: reward });
  draw();
  morphUI();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = async () => {
  const text = JSON.stringify({ params, fitness, ts: Date.now() });
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  document.getElementById('status').textContent = `Sealed: ${hash} (local only)`;
  // IndexedDB stub
  try {
    const req = indexedDB.open('void-f037', 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put({ hash, params, fitness, ts: Date.now() });
    };
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('genomes', { keyPath: 'hash' });
    };
  } catch {}
};

document.getElementById('reset').onclick = () => {
  for (let i = 0; i < field.length; i++) field[i] = Math.random() * 0.15;
  params = [0.15, 0.08, 0.04, 0.6];
};

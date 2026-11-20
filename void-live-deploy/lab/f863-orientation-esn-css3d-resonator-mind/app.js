const N = 48;          // reservoir size
const M = 8;           // resonators
const INPUT_DIM = 6;   // orientation residual + pointer bins
const READOUT_DIM = 4; // posX bias, posY, scale, hue offset

// Reservoir state
let r = new Float32Array(N);
let Wrec = [];         // sparse recurrent
let Win = [];          // input weights
let Wout = [];         // readout (adapted)
let reward = 0;
let lastReward = 0;

// Inputs
let ori = { alpha: 0, beta: 0, gamma: 0 };
let prevOri = { alpha: 0, beta: 0, gamma: 0 };
let ptr = { x: 0, y: 0, vx: 0, vy: 0 };
let lastPtr = { x: 0, y: 0 };

// Audio
let audioCtx, oscs = [], gains = [];

// DOM resonators
const stage = document.getElementById('stage');
const resonators = [];
const statusEl = document.getElementById('status');

function randn() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.5; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function initReservoir() {
  // Sparse recurrent ~10% density, spectral radius ~0.9
  Wrec = Array.from({length: N}, () => new Float32Array(N));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (Math.random() < 0.1) Wrec[i][j] = randn() * 0.9;
    }
  }
  // Input weights
  Win = Array.from({length: N}, () => new Float32Array(INPUT_DIM));
  for (let i = 0; i < N; i++)
    for (let k = 0; k < INPUT_DIM; k++) Win[i][k] = randn() * 0.5;
  // Readout
  Wout = Array.from({length: READOUT_DIM}, () => new Float32Array(N).fill(0));
}

function reservoirStep(input) {
  const next = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) sum += Wrec[i][j] * r[j];
    for (let k = 0; k < INPUT_DIM; k++) sum += Win[i][k] * input[k];
    next[i] = Math.tanh(sum);
  }
  r = next;
  return r;
}

function readout() {
  const out = new Float32Array(READOUT_DIM);
  for (let d = 0; d < READOUT_DIM; d++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += Wout[d][i] * r[i];
    out[d] = s;
  }
  return out;
}

function lmsUpdate(target, lr = 0.01) {
  // Simple LMS on readout for each dimension
  for (let d = 0; d < READOUT_DIM; d++) {
    let pred = 0;
    for (let i = 0; i < N; i++) pred += Wout[d][i] * r[i];
    const err = target[d] - pred;
    for (let i = 0; i < N; i++) Wout[d][i] += lr * err * r[i];
  }
  reward += Math.abs(target[0]) + Math.abs(target[1]);
}

function getInput() {
  const dAlpha = ((ori.alpha - prevOri.alpha + 540) % 360) - 180;
  const dBeta = ori.beta - prevOri.beta;
  const dGamma = ori.gamma - prevOri.gamma;
  prevOri = { ...ori };
  return [
    clamp(dAlpha / 30, -1, 1),
    clamp(dBeta / 20, -1, 1),
    clamp(dGamma / 20, -1, 1),
    clamp(ptr.vx / 40, -1, 1),
    clamp(ptr.vy / 40, -1, 1),
    Math.sin(Date.now() * 0.002) * 0.3
  ];
}

function createResonators() {
  for (let i = 0; i < M; i++) {
    const el = document.createElement('div');
    el.className = 'resonator';
    el.textContent = 'R' + (i + 1);
    el.style.left = (20 + Math.random() * 60) + '%';
    el.style.top = (20 + Math.random() * 50) + '%';
    el.dataset.idx = i;
    el.addEventListener('pointerdown', onTeach);
    stage.appendChild(el);
    resonators.push(el);
  }
}

function onTeach(e) {
  e.preventDefault();
  const el = e.currentTarget;
  const idx = +el.dataset.idx;
  // Target: preferred offset based on click position relative to stage
  const rect = stage.getBoundingClientRect();
  const tx = (e.clientX - rect.left) / rect.width * 2 - 1;
  const ty = (e.clientY - rect.top) / rect.height * 2 - 1;
  const target = [tx * 0.8, ty * 0.8, 1.2, (idx * 40) % 360];
  lmsUpdate(target, 0.02);
  el.style.boxShadow = '0 0 30px white';
  setTimeout(() => el.style.boxShadow = '', 300);
  statusEl.textContent = `Taught R${idx+1} · reward: ${reward.toFixed(1)}`;
}

function updateVisuals(out) {
  const meanAct = r.reduce((a, b) => a + Math.abs(b), 0) / N;
  document.documentElement.style.setProperty('--activity', meanAct.toFixed(2));
  document.documentElement.style.setProperty('--hue', (200 + out[3] * 40) % 360);

  resonators.forEach((el, i) => {
    const phase = (i / M) * Math.PI * 2;
    const local = r[i % N];
    const px = 50 + out[0] * 25 + Math.sin(phase + local * 2) * 18;
    const py = 45 + out[1] * 20 + Math.cos(phase + local) * 15;
    const sc = 0.7 + Math.abs(local) * 0.6 + out[2] * 0.2;
    const rz = local * 40 + out[0] * 20;
    const rx = Math.sin(Date.now() * 0.001 + i) * 15 + local * 25;
    const ry = Math.cos(Date.now() * 0.0013 + i) * 12;
    el.style.transform = `translate3d(${px}vw, ${py}vh, ${local * 80}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
    el.style.setProperty('--h', (180 + i * 25 + out[3] * 30 + local * 60) % 360);
  });

  // Audio modulation
  if (audioCtx && audioCtx.state === 'running') {
    oscs.forEach((osc, k) => {
      const freq = 120 + meanAct * 180 + Math.abs(r[k * 5 % N]) * 80;
      osc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
      gains[k].gain.setTargetAtTime(0.04 + meanAct * 0.06, audioCtx.currentTime, 0.1);
    });
  }
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let k = 0; k < 3; k++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = k === 0 ? 'sine' : k === 1 ? 'triangle' : 'sawtooth';
    osc.frequency.value = 140 + k * 60;
    gain.gain.value = 0.03;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    oscs.push(osc);
    gains.push(gain);
  }
}

async function sealGenome() {
  const data = {
    Wout: Wout.map(w => Array.from(w)),
    reward,
    ts: Date.now()
  };
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'f863');
    await tx.complete;
  } catch (e) { console.warn(e); }
  if (bc) bc.postMessage({ type: 'genome', data, fitness: reward });
  statusEl.textContent = `Sealed · reward ${reward.toFixed(1)}`;
}

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('verse-f863', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

let bc;
function initBroadcast() {
  try {
    bc = new BroadcastChannel('f863-genome');
    bc.onmessage = (ev) => {
      if (ev.data.type === 'genome' && ev.data.fitness > reward) {
        const d = ev.data.data;
        Wout = d.Wout.map(w => Float32Array.from(w));
        reward = d.reward * 0.9;
        statusEl.textContent = 'Adopted stronger genome';
      }
    };
  } catch (e) { console.debug("lab f863-orientation-esn-css3d-resonator-mind:", e); }
}

// Event listeners
window.addEventListener('deviceorientation', (e) => {
  ori.alpha = e.alpha || 0;
  ori.beta = e.beta || 0;
  ori.gamma = e.gamma || 0;
});
window.addEventListener('pointermove', (e) => {
  ptr.x = e.clientX;
  ptr.y = e.clientY;
  ptr.vx = e.clientX - lastPtr.x;
  ptr.vy = e.clientY - lastPtr.y;
  lastPtr.x = e.clientX;
  lastPtr.y = e.clientY;
});

document.getElementById('sealBtn').onclick = sealGenome;
document.getElementById('audioBtn').onclick = () => {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
};

// Main loop
function loop() {
  const input = getInput();
  reservoirStep(input);
  const out = readout();
  updateVisuals(out);
  requestAnimationFrame(loop);
}

// Boot
initReservoir();
createResonators();
initBroadcast();
// Load previous seal if any
(async () => {
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('f863');
    req.onsuccess = () => {
      if (req.result) {
        Wout = req.result.Wout.map(w => Float32Array.from(w));
        reward = req.result.reward || 0;
        statusEl.textContent = 'Restored sealed genome';
      }
    };
  } catch (e) { console.debug("lab f863-orientation-esn-css3d-resonator-mind:", e); }
})();
loop();

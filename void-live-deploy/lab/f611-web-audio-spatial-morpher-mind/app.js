const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Audio graph — the spatial mind substrate
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx, osc, noise, filterBank = [], analyser, gainNode, masterGain;
let isMuted = false;
let spectrum = new Uint8Array(128);

function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioCtx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.15;
  masterGain.connect(audioCtx.destination);

  // Noise source
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  noise.start();

  // Oscillator
  osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 110;
  osc.start();

  // Filter bank (5 bandpass)
  for (let i = 0; i < 5; i++) {
    const f = audioCtx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 200 + i * 400;
    f.Q.value = 8;
    filterBank.push(f);
  }
  // Simple graph: noise + osc → filters in parallel → analyser → master
  const merger = audioCtx.createGain();
  noise.connect(merger);
  osc.connect(merger);
  filterBank.forEach(f => merger.connect(f));
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  filterBank.forEach(f => f.connect(analyser));
  analyser.connect(masterGain);
}

// Tiny local RNN (Elman-style, 6-8-4)
let rnn = {
  Wih: Array(8).fill(0).map(() => Array(6).fill(0).map(() => (Math.random()-0.5)*0.5)),
  Whh: Array(8).fill(0).map(() => Array(8).fill(0).map(() => (Math.random()-0.5)*0.3)),
  Who: Array(4).fill(0).map(() => Array(8).fill(0).map(() => (Math.random()-0.5)*0.4)),
  h: Array(8).fill(0),
  bias: Array(8).fill(0).map(() => (Math.random()-0.5)*0.1)
};
function tanh(x) { return Math.tanh(x); }
function rnnStep(input) { // input[6]
  const hNew = Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    let s = rnn.bias[i];
    for (let j = 0; j < 6; j++) s += rnn.Wih[i][j] * input[j];
    for (let j = 0; j < 8; j++) s += rnn.Whh[i][j] * rnn.h[j];
    hNew[i] = tanh(s);
  }
  rnn.h = hNew;
  const out = Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) out[i] += rnn.Who[i][j] * rnn.h[j];
    out[i] = Math.tanh(out[i]);
  }
  return out;
}

// Resonators (DOM cards)
const resonators = [];
function createResonators() {
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'resonator';
    el.innerHTML = `<div>Band ${i+1}</div><div class="bar" style="width:40%"></div><div class="freq">-- Hz</div>`;
    el.style.left = (20 + i * 110) + 'px';
    el.style.top = (80 + Math.random()*40) + 'px';
    document.body.appendChild(el);
    resonators.push({ el, band: i, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0 });
    makeDraggable(el, resonators[i]);
  }
}
function makeDraggable(el, r) {
  let dragging = false, ox, oy;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-r.x; oy=e.clientY-r.y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; r.x = e.clientX - ox; r.y = e.clientY - oy; el.style.left = r.x+'px'; el.style.top = r.y+'px'; });
  el.addEventListener('pointerup', () => { dragging=false; });
}

// State
let pointer = { x:0, y:0, vx:0, vy:0 };
let orient = { beta:0, gamma:0 };
addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x; pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
});

let energy = 0;
function update() {
  if (!audioCtx) { requestAnimationFrame(update); return; }
  // Input vector
  const input = [
    pointer.vx / 20, pointer.vy / 20,
    orient.beta / 90, orient.gamma / 90,
    Math.sin(Date.now()/1000), Math.cos(Date.now()/1300)
  ];
  const out = rnnStep(input); // [-1,1] x4

  // Modulate audio
  osc.frequency.value = 80 + (out[0]+1)*120;
  filterBank.forEach((f, i) => {
    const base = 180 + i * 380;
    f.frequency.value = base + out[1]*200 + Math.sin(Date.now()/800 + i)*40;
    f.Q.value = 4 + (out[2]+1)*6;
    // Drag influence
    const r = resonators[i];
    if (r) {
      const dx = (r.x / W - 0.5) * 2;
      f.frequency.value += dx * 300;
    }
  });
  masterGain.gain.value = isMuted ? 0 : 0.12 + (out[3]+1)*0.08;

  // Spectrum
  analyser.getByteFrequencyData(spectrum);
  energy = spectrum.reduce((a,b)=>a+b,0) / spectrum.length / 255;
  document.documentElement.style.setProperty('--energy', energy.toFixed(2));
  document.documentElement.style.setProperty('--hue', (200 + energy*80).toFixed(0));

  // Update resonators
  resonators.forEach((r, i) => {
    const mag = spectrum[Math.floor(i * spectrum.length / 5)] / 255;
    r.el.querySelector('.bar').style.width = (20 + mag*70) + '%';
    r.el.querySelector('.freq').textContent = Math.round(filterBank[i].frequency.value) + ' Hz';
    // Gentle float toward energy
    r.vy += (Math.random()-0.5)*0.2;
    r.y += r.vy * 0.3;
    r.vy *= 0.95;
    if (r.y < 60) r.y = 60; if (r.y > H-100) r.y = H-100;
    r.el.style.top = r.y + 'px';
  });

  // Visual field (simple spectrum bars)
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const barW = W / spectrum.length;
  for (let i = 0; i < spectrum.length; i++) {
    const h = (spectrum[i]/255) * H * 0.6;
    ctx.fillStyle = `hsla(${200 + i*0.5}, 70%, ${40 + spectrum[i]/5}%, 0.7)`;
    ctx.fillRect(i*barW, H - h, barW-1, h);
  }
  requestAnimationFrame(update);
}

// Seal / Restore
const DB_NAME = 'verse-f611';
const STORE = 'mind';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function seal() {
  if (!audioCtx) return;
  const state = {
    rnn,
    filters: filterBank.map(f => ({ freq: f.frequency.value, Q: f.Q.value })),
    oscFreq: osc.frequency.value,
    energy,
    ts: Date.now()
  };
  const json = JSON.stringify(state);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ state, hash }, 'latest');
  document.getElementById('log').textContent = 'Sealed: ' + hash.slice(0,12) + '…';
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('latest');
    req.onsuccess = () => {
      if (!req.result) return;
      const { state } = req.result;
      rnn = state.rnn;
      if (audioCtx && state.filters) {
        state.filters.forEach((p, i) => {
          if (filterBank[i]) {
            filterBank[i].frequency.value = p.freq;
            filterBank[i].Q.value = p.Q;
          }
        });
        osc.frequency.value = state.oscFreq || 110;
      }
      document.getElementById('log').textContent = 'Restored sealed mind';
    };
  } catch (e) { console.debug("lab f611-web-audio-spatial-morpher-mind:", e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('mute').onclick = () => { isMuted = !isMuted; document.getElementById('mute').textContent = isMuted ? 'Unmute' : 'Mute'; };

// Boot
function boot() {
  initAudio();
  createResonators();
  update();
  document.getElementById('status').textContent = 'Audio mind live. Tilt or move pointer. Drag bands to retune.';
}
// Resume on gesture
document.body.addEventListener('pointerdown', () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });
boot();

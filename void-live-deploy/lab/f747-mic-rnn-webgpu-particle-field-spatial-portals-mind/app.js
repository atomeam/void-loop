const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 400;
const particles = Array.from({length: N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2
}));

// Tiny RNN: 6 inputs -> 8 hidden -> 4 outputs
let Wh = new Float32Array(8*6).map(() => (Math.random()-0.5)*0.3);
let Uh = new Float32Array(8*8).map(() => (Math.random()-0.5)*0.1);
let Wo = new Float32Array(4*8).map(() => (Math.random()-0.5)*0.4);
let h = new Float32Array(8);
let fitness = 0;

function rnnForward(inputs) {
  // inputs: [px, py, pvx, pvy, micRms, tiltX] normalized
  const nh = new Float32Array(8);
  for (let i = 0; i < 8; i++) {
    let s = 0;
    for (let j = 0; j < 6; j++) s += Wh[i*6+j] * inputs[j];
    for (let j = 0; j < 8; j++) s += Uh[i*8+j] * h[j];
    nh[i] = Math.tanh(s);
  }
  h.set(nh);
  const out = new Float32Array(4);
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let j = 0; j < 8; j++) s += Wo[i*8+j] * h[j];
    out[i] = Math.tanh(s);
  }
  return out; // [forceX, forceY, viscosity, attract]
}

let pointer = {x: W/2, y: H/2, vx: 0, vy: 0};
let lastP = {...pointer};
addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.vx = pointer.x - lastP.x; pointer.vy = pointer.y - lastP.y;
  lastP = {x: pointer.x, y: pointer.y};
});

let micRms = 0, tiltX = 0, tiltY = 0;
let audioCtx, analyser, micStream;
document.getElementById('micBtn').onclick = async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({audio: true});
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    statusEl.textContent = 'Mic active. Speak or make sound to influence the field.';
  } catch(e) { statusEl.textContent = 'Mic denied. Pointer-only mode.'; }
};

function updateMic() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i]-128)/128;
    sum += v*v;
  }
  micRms = Math.sqrt(sum / data.length);
}

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
}

const portals = [];
for (let i = 0; i < 6; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'V';
  el.onclick = () => rewardPortal(i);
  document.body.appendChild(el);
  portals.push({el, x: Math.random()*W, y: Math.random()*H, tone: 220 + i*40});
}

function rewardPortal(idx) {
  fitness += 1.5;
  // simple mutation toward current outputs
  for (let i = 0; i < Wh.length; i++) Wh[i] += (Math.random()-0.5)*0.05;
  for (let i = 0; i < Uh.length; i++) Uh[i] += (Math.random()-0.5)*0.02;
  for (let i = 0; i < Wo.length; i++) Wo[i] += (Math.random()-0.5)*0.08;
  // play tone
  if (audioCtx) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.value = portals[idx].tone + micRms*200;
    g.gain.value = 0.1;
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  }
  statusEl.textContent = `Rewarded portal ${idx+1}. Fitness: ${fitness.toFixed(1)}`;
}

function seal() {
  const genome = {Wh: Array.from(Wh), Uh: Array.from(Uh), Wo: Array.from(Wo), fitness, h: Array.from(h)};
  localStorage.setItem('verse-f747-genome', JSON.stringify(genome));
  // try IndexedDB
  const req = indexedDB.open('verse-f747', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath: 'id'});
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({id: 'best', ...genome});
  };
  if (window.BroadcastChannel) {
    const bc = new BroadcastChannel('f747-genomes');
    bc.postMessage(genome);
  }
  statusEl.textContent = `Sealed. Fitness ${fitness.toFixed(1)}. Other tabs can receive.`;
}
document.getElementById('sealBtn').onclick = seal;

// receive
if (window.BroadcastChannel) {
  const bc = new BroadcastChannel('f747-genomes');
  bc.onmessage = e => {
    const g = e.data;
    if (g.fitness > fitness) {
      Wh.set(g.Wh); Uh.set(g.Uh); Wo.set(g.Wo); fitness = g.fitness;
      statusEl.textContent = `Adopted superior genome (fit ${fitness.toFixed(1)})`;
    }
  };
}

// load
try {
  const saved = JSON.parse(localStorage.getItem('verse-f747-genome') || 'null');
  if (saved && saved.Wh) {
    Wh.set(saved.Wh); Uh.set(saved.Uh); Wo.set(saved.Wo); fitness = saved.fitness || 0;
  }
} catch (e) { console.debug("lab f747-mic-rnn-webgpu-particle-field-spatial-portals-mind:", e); }

document.getElementById('clearBtn').onclick = () => {
  localStorage.removeItem('verse-f747-genome');
  Wh = new Float32Array(8*6).map(() => (Math.random()-0.5)*0.3);
  Uh = new Float32Array(8*8).map(() => (Math.random()-0.5)*0.1);
  Wo = new Float32Array(4*8).map(() => (Math.random()-0.5)*0.4);
  fitness = 0;
  statusEl.textContent = 'Reset to random genome.';
};

function step() {
  updateMic();
  const inputs = [
    pointer.x / W * 2 - 1,
    pointer.y / H * 2 - 1,
    pointer.vx / 20,
    pointer.vy / 20,
    micRms * 3,
    tiltX
  ];
  const policy = rnnForward(inputs); // forceX, forceY, visc, attract

  // simple forces
  for (const p of particles) {
    // pointer attract / repel based on policy[3]
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    const d2 = dx*dx + dy*dy + 100;
    const f = (policy[3] > 0 ? 1 : -1) * 80 / d2;
    p.vx += dx * f + policy[0] * 0.4 + (Math.random()-0.5)*0.1;
    p.vy += dy * f + policy[1] * 0.4 + (Math.random()-0.5)*0.1;
    // viscosity
    p.vx *= 0.98 - policy[2]*0.02;
    p.vy *= 0.98 - policy[2]*0.02;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
  }

  // position portals at high-density samples (simple: near random high-speed particles)
  for (let i = 0; i < portals.length; i++) {
    const sample = particles[(i * 67 + Math.floor(Date.now()/50)) % N];
    portals[i].x = portals[i].x * 0.92 + sample.x * 0.08;
    portals[i].y = portals[i].y * 0.92 + sample.y * 0.08;
    portals[i].el.style.left = portals[i].x + 'px';
    portals[i].el.style.top = portals[i].y + 'px';
    const hue = 180 + policy[0]*60 + micRms*40;
    portals[i].el.style.background = `radial-gradient(circle, hsla(${hue},80%,60%,0.8), hsla(${hue},80%,60%,0.1))`;
  }

  // draw
  ctx.fillStyle = 'rgba(10,12,16,0.18)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#5ce1e6';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

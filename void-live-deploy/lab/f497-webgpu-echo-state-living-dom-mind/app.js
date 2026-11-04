const stage = document.getElementById('stage');
const status = document.getElementById('status');
const N = 64; // reservoir nodes (CPU fallback size; GPU can be larger)
const cards = [];
const cardCount = 8;
let reservoir = new Float32Array(N);
let readout = new Float32Array(N * 2); // forces x,y
let energy = 0;
let pointer = {x:0, y:0, vx:0, vy:0};
let orient = {alpha:0, beta:0, gamma:0};
let micEnergy = 0;

// Create living cards
for (let i = 0; i < cardCount; i++) {
  const c = document.createElement('div');
  c.className = 'card';
  c.textContent = `Node ${i}`;
  c.style.left = (Math.random()*window.innerWidth*0.8) + 'px';
  c.style.top = (Math.random()*window.innerHeight*0.7) + 'px';
  stage.appendChild(c);
  cards.push({
    el: c,
    x: parseFloat(c.style.left),
    y: parseFloat(c.style.top),
    vx: 0, vy: 0,
    id: i
  });
}

// Pointer
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.alpha = e.alpha || 0;
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// Optional mic
async function tryMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let v of data) sum += v;
      micEnergy = sum / data.length / 255;
    }, 100);
  } catch (e) { console.warn(e); }
}
tryMic();

// Simple CPU Echo State update (WebGPU path would mirror this)
function stepReservoir() {
  const leak = 0.8;
  const inputScale = 0.15;
  // Inject inputs into first few nodes
  reservoir[0] = Math.tanh(reservoir[0] * leak + pointer.vx * inputScale);
  reservoir[1] = Math.tanh(reservoir[1] * leak + pointer.vy * inputScale);
  reservoir[2] = Math.tanh(reservoir[2] * leak + orient.beta * 0.01);
  reservoir[3] = Math.tanh(reservoir[3] * leak + orient.gamma * 0.01);
  reservoir[4] = Math.tanh(reservoir[4] * leak + micEnergy * 2);
  // Sparse random recurrence (fixed seed-like)
  for (let i = 5; i < N; i++) {
    const prev = reservoir[(i*7) % N] * 0.3 + reservoir[(i*13) % N] * 0.2;
    reservoir[i] = Math.tanh(reservoir[i] * leak + prev * 0.4);
  }
  // Energy
  energy = 0;
  for (let v of reservoir) energy += v*v;
  energy = Math.sqrt(energy / N);
}

// Force from readout (simple projection)
function getForce(i) {
  const idx = i % N;
  return {
    fx: reservoir[idx] * 2 + readout[idx*2] * energy,
    fy: reservoir[(idx+1)%N] * 2 + readout[idx*2+1] * energy
  };
}

// Physics loop
function animate() {
  stepReservoir();
  const w = window.innerWidth, h = window.innerHeight;
  cards.forEach((card, i) => {
    const f = getForce(i);
    // Verlet-like
    card.vx = card.vx * 0.92 + f.fx * 0.4;
    card.vy = card.vy * 0.92 + f.fy * 0.4;
    card.x += card.vx;
    card.y += card.vy;
    // Bounds
    if (card.x < 10) { card.x = 10; card.vx *= -0.5; }
    if (card.x > w-150) { card.x = w-150; card.vx *= -0.5; }
    if (card.y < 10) { card.y = 10; card.vy *= -0.5; }
    if (card.y > h-100) { card.y = h-100; card.vy *= -0.5; }
    // Feedback energy
    const ke = card.vx*card.vx + card.vy*card.vy;
    reservoir[(i*3)%N] += ke * 0.001;
    // Update DOM
    card.el.style.left = card.x + 'px';
    card.el.style.top = card.y + 'px';
    const high = Math.abs(reservoir[i%N]) > 0.6 || energy > 0.7;
    card.el.classList.toggle('high', high);
    if (high && Math.random() < 0.02) {
      card.el.textContent = `E${energy.toFixed(2)} #${(Math.abs(reservoir[i%N])*1000|0).toString(16)}`;
    }
  });
  // Morph
  document.documentElement.style.setProperty('--energy', energy.toFixed(2));
  document.documentElement.style.setProperty('--hue', (200 + energy*80).toFixed(0));
  status.textContent = `Reservoir energy: ${energy.toFixed(3)} | nodes active`;
  requestAnimationFrame(animate);
}
animate();

// Seal / restore
async function seal() {
  const data = { reservoir: Array.from(reservoir), readout: Array.from(readout), energy, t: Date.now() };
  const str = JSON.stringify(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f497-mind', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({hash, data}, 'latest');
    status.textContent = `Sealed ${hash.slice(0,8)}…`;
  } catch(e) {
    localStorage.setItem('f497-seal', str);
    status.textContent = 'Sealed (ls)';
  }
}
async function restore() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f497-mind', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readonly');
    const req = tx.objectStore('seals').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        reservoir.set(req.result.data.reservoir);
        readout.set(req.result.data.readout);
        status.textContent = 'Restored seal';
      }
    };
  } catch(e) {
    const s = localStorage.getItem('f497-seal');
    if (s) {
      const data = JSON.parse(s);
      reservoir.set(data.reservoir);
      status.textContent = 'Restored (ls)';
    }
  }
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
window.addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

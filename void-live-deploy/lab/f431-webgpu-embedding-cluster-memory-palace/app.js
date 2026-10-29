const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const input = document.getElementById('input');
const sealEl = document.getElementById('seal');
let w, h, particles = [], crystals = [], sealed = 0;
let tilt = {x: 0, y: 0};
let audioCtx, gain;

function resize() {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
}
addEventListener('resize', resize); resize();

// Simple hash embedding (8-dim)
function embed(text) {
  const v = new Float32Array(8);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    v[i % 8] += (c * (i + 1) % 97) / 97 - 0.5;
  }
  const n = Math.hypot(...v) || 1;
  return v.map(x => x / n);
}

function seed(text) {
  const emb = embed(text || 'void');
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: 0, vy: 0,
      emb: Float32Array.from(emb),
      life: 1
    });
  }
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && input.value.trim()) {
    seed(input.value.trim());
    input.value = '';
  }
});

// Worker mind: simple residual clustering fitness (stub evolutionary)
const workerCode = `
let best = [1, 0.5]; // attraction, noise
onmessage = e => {
  const {energy, diversity} = e.data;
  // hill-climb
  best[0] = Math.max(0.2, Math.min(2, best[0] + (diversity > 0.3 ? 0.05 : -0.02)));
  best[1] = Math.max(0.1, Math.min(1, best[1] + (energy > 0.5 ? -0.01 : 0.02)));
  postMessage({attract: best[0], noise: best[1], fitness: energy * diversity});
};
`;
const blob = new Blob([workerCode], {type: 'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
let attract = 1, noise = 0.4;
worker.onmessage = e => { attract = e.data.attract; noise = e.data.noise; };

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 45;
    tilt.y = (e.beta || 0) / 45;
  });
}

// Audio
function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.value = 0.1;
}
addEventListener('click', initAudio, {once: true});

function step() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0, 0, w, h);

  // Update particles: similarity attraction + gravity + noise
  let energy = 0, diversity = 0;
  const samples = particles.slice(0, 40);
  for (let p of particles) {
    let ax = tilt.x * 0.2, ay = tilt.y * 0.2;
    for (let o of samples) {
      if (o === p) continue;
      const sim = p.emb.reduce((s, v, i) => s + v * o.emb[i], 0);
      const dx = o.x - p.x, dy = o.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 180) {
        const f = sim * attract / d;
        ax += dx * f * 0.01;
        ay += dy * f * 0.01;
      }
    }
    p.vx = (p.vx + ax + (Math.random() - 0.5) * noise) * 0.92;
    p.vy = (p.vy + ay + (Math.random() - 0.5) * noise) * 0.92;
    p.x = (p.x + p.vx + w) % w;
    p.y = (p.y + p.vy + h) % h;
    energy += Math.hypot(p.vx, p.vy);
    // draw
    ctx.fillStyle = `hsla(${(p.emb[0]*360+180)%360},70%,60%,0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, 6.28);
    ctx.fill();
  }
  energy = Math.min(1, energy / (particles.length * 2 + 1));
  diversity = Math.min(1, new Set(particles.map(p => Math.round(p.emb[0]*10))).size / 8);

  // Crystals at rough centroids of high-sim groups (simple)
  if (Math.random() < 0.02 && particles.length > 20) {
    const cx = particles.reduce((s,p)=>s+p.x,0)/particles.length;
    const cy = particles.reduce((s,p)=>s+p.y,0)/particles.length;
    const el = document.createElement('div');
    el.className = 'crystal';
    el.style.left = (cx - 30) + 'px';
    el.style.top = (cy - 30) + 'px';
    el.style.width = '60px';
    el.style.height = '60px';
    el.textContent = 'cluster';
    el.dataset.x = cx; el.dataset.y = cy;
    document.body.appendChild(el);
    crystals.push(el);
    makeDraggable(el);
  }
  // Morph crystals
  crystals.forEach(c => {
    const s = 0.6 + energy * 0.8;
    c.style.transform = `scale(${s}) rotate(${diversity*20}deg)`;
    c.style.background = `hsla(${energy*180},70%,50%,0.25)`;
  });
  // Chrome morph
  document.body.style.filter = `hue-rotate(${diversity*40}deg) brightness(${0.9 + energy*0.3})`;

  // Audio tones
  if (audioCtx && Math.random() < 0.05) {
    const osc = audioCtx.createOscillator();
    osc.frequency.value = 200 + diversity * 400 + energy * 200;
    osc.connect(gain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  }

  worker.postMessage({energy, diversity});
  requestAnimationFrame(step);
}
step();

function makeDraggable(el) {
  let dx, dy, dragging = false;
  el.onpointerdown = e => { dragging = true; dx = e.clientX - parseFloat(el.style.left); dy = e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (!dragging) return; el.style.left = (e.clientX - dx) + 'px'; el.style.top = (e.clientY - dy) + 'px'; };
  el.onpointerup = () => {
    if (!dragging) return;
    dragging = false;
    // Seal: remove nearby particles conceptually, persist
    sealed++;
    sealEl.textContent = 'Sealed: ' + sealed;
    // IndexedDB stub
    const dbReq = indexedDB.open('palace', 1);
    dbReq.onupgradeneeded = e => e.target.result.createObjectStore('memories', {keyPath: 'id', autoIncrement: true});
    dbReq.onsuccess = e => {
      const tx = e.target.result.transaction('memories', 'readwrite');
      tx.objectStore('memories').add({time: Date.now(), count: particles.length, energy});
    };
    el.remove();
    crystals = crystals.filter(c => c !== el);
  };
}

// Initial seeds
setTimeout(() => seed('void mind'), 500);
setTimeout(() => seed('spatial memory'), 1200);

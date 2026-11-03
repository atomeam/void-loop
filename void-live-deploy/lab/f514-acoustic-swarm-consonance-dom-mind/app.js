const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const N = 80;
let agents = [];
const cards = [];
let audioCtx, oscillators = [], gains = [];
let audioOn = false;
let pointer = { x: W/2, y: H/2, active: false };
let seedFreq = 440;

const INTERVALS = [
  { r: 1, name: 'unison' },
  { r: 3/2, name: 'perfect 5th' },
  { r: 4/3, name: 'perfect 4th' },
  { r: 5/4, name: 'major 3rd' },
  { r: 6/5, name: 'minor 3rd' },
  { r: 5/3, name: 'major 6th' },
  { r: 2, name: 'octave' }
];

function initAgents() {
  agents = [];
  for (let i = 0; i < N; i++) {
    agents.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5,
      freq: 200 + Math.random()*600,
      fitness: 0
    });
  }
}

function initCards() {
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = 'listening…';
    el.style.left = (20 + i*18) + '%';
    el.style.top = (30 + (i%2)*25) + '%';
    document.body.appendChild(el);
    cards.push({ el, x: 0, y: 0, scale: 1, hue: 200 });
  }
}

function consonance(f1, f2) {
  if (f1 <= 0 || f2 <= 0) return 0;
  const ratio = Math.max(f1, f2) / Math.min(f1, f2);
  let best = 1;
  for (const iv of INTERVALS) {
    const d = Math.abs(Math.log(ratio) - Math.log(iv.r));
    if (d < best) best = d;
  }
  return Math.max(0, 1 - best * 4); // 0..1
}

function stepAgents() {
  const sep = 22, align = 40, coh = 50;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    let fx = 0, fy = 0, count = 0, sumFreq = 0, conf = 0;
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue;
      const b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.1;
      if (d < sep) { fx -= dx/d; fy -= dy/d; }
      if (d < align) { fx += b.vx; fy += b.vy; count++; }
      if (d < coh) { fx += dx; fy += dy; }
      if (d < 60) {
        const c = consonance(a.freq, b.freq);
        conf += c;
        sumFreq += b.freq * c;
      }
    }
    if (count) { fx /= count; fy /= count; }
    // pointer attraction
    if (pointer.active) {
      const dx = pointer.x - a.x, dy = pointer.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      fx += (dx / d) * 0.8;
      fy += (dy / d) * 0.8;
    }
    a.vx = (a.vx + fx * 0.05) * 0.98;
    a.vy = (a.vy + fy * 0.05) * 0.98;
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > 2.2) { a.vx = a.vx / sp * 2.2; a.vy = a.vy / sp * 2.2; }
    a.x = (a.x + a.vx + W) % W;
    a.y = (a.y + a.vy + H) % H;
    a.fitness = conf / 5;
  }
}

function evolve() {
  agents.sort((a,b) => b.fitness - a.fitness);
  const half = Math.floor(N / 2);
  for (let i = half; i < N; i++) {
    const src = agents[i % half];
    agents[i].freq = src.freq * (0.92 + Math.random()*0.16);
    if (Math.random() < 0.15) agents[i].freq = 180 + Math.random()*700;
  }
}

function updateCards() {
  for (const card of cards) {
    const rect = card.el.getBoundingClientRect();
    card.x = rect.left + rect.width/2;
    card.y = rect.top + rect.height/2;
    let best = 0, bestFreq = 440, bestName = 'silence';
    for (const a of agents) {
      const d = Math.hypot(a.x - card.x, a.y - card.y);
      if (d < 120 && a.fitness > best) {
        best = a.fitness;
        bestFreq = a.freq;
        // find nearest interval to 440 or self
        let minD = 99, name = '';
        for (const iv of INTERVALS) {
          const target = 440 * iv.r;
          const dd = Math.abs(Math.log(bestFreq) - Math.log(target));
          if (dd < minD) { minD = dd; name = iv.name; }
        }
        bestName = name;
      }
    }
    const s = 0.8 + best * 0.6;
    const h = (bestFreq / 8) % 360;
    card.el.style.transform = `scale(${s})`;
    card.el.style.filter = `hue-rotate(${h}deg)`;
    card.el.style.opacity = 0.5 + best * 0.5;
    card.el.textContent = best > 0.2 ? bestName : 'listening…';
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  for (const a of agents) {
    const hue = (a.freq / 4) % 360;
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.85)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 3 + a.fitness * 4, 0, Math.PI*2);
    ctx.fill();
  }
}

function updateAudio() {
  if (!audioOn || !audioCtx) return;
  // simple: top 8 fittest agents drive voices
  const top = [...agents].sort((a,b)=>b.fitness-a.fitness).slice(0, 8);
  for (let i = 0; i < oscillators.length; i++) {
    const a = top[i];
    if (a && a.fitness > 0.15) {
      oscillators[i].frequency.setTargetAtTime(a.freq, audioCtx.currentTime, 0.05);
      gains[i].gain.setTargetAtTime(0.04 + a.fitness * 0.06, audioCtx.currentTime, 0.1);
    } else {
      gains[i].gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    }
  }
}

function loop() {
  stepAgents();
  updateCards();
  draw();
  updateAudio();
  requestAnimationFrame(loop);
}

setInterval(evolve, 2200);

// audio
document.getElementById('audioBtn').onclick = async () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 8; i++) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      g.gain.value = 0;
      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      oscillators.push(osc);
      gains.push(g);
    }
  }
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  audioOn = !audioOn;
  document.getElementById('audioBtn').textContent = audioOn ? 'Stop Audio' : 'Start Audio';
};

// pointer
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; });
addEventListener('pointerdown', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  seedFreq = 200 + Math.random() * 600;
  // inject a few nearby agents
  for (let k = 0; k < 6; k++) {
    const a = agents[Math.floor(Math.random()*N)];
    a.x = pointer.x + (Math.random()-0.5)*40;
    a.y = pointer.y + (Math.random()-0.5)*40;
    a.freq = seedFreq * (0.9 + Math.random()*0.2);
  }
});
addEventListener('pointerup', () => { pointer.active = false; });

// persistence
const DB_NAME = 'f514-acoustic';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ agents, t: Date.now() }, 'main');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  } catch (e) { document.getElementById('status').textContent = 'Seal failed (in-memory only)'; }
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('main');
    req.onsuccess = () => {
      if (req.result && req.result.agents) {
        agents = req.result.agents;
        document.getElementById('status').textContent = 'Restored from IndexedDB';
      }
    };
  } catch (e) { document.getElementById('status').textContent = 'No saved state'; }
}

document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;
document.getElementById('resetBtn').onclick = () => { initAgents(); document.getElementById('status').textContent = 'Reset'; };

initAgents();
initCards();
loop();

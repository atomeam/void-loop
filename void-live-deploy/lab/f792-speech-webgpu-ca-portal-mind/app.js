const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 96;
let lattice = new Float32Array(GRID * GRID);
let nextLat = new Float32Array(GRID * GRID);
const portals = [];
const transcriptRing = [];
let listening = false;
let recognition = null;

// Simple CA step (diffusion + decay + injection residual)
function stepCA() {
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = y * GRID + x;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        sum += lattice[(y+dy)*GRID + (x+dx)];
      }
      let v = sum / 9 * 0.92 + lattice[i] * 0.05;
      v = Math.max(0, Math.min(1.5, v));
      nextLat[i] = v;
    }
  }
  [lattice, nextLat] = [nextLat, lattice];
}

function injectAt(nx, ny, amt) {
  const x = Math.floor(nx * GRID) % GRID;
  const y = Math.floor(ny * GRID) % GRID;
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
  lattice[y * GRID + x] = Math.min(2, lattice[y * GRID + x] + amt);
  // slight neighbors
  if (x>0) lattice[y*GRID + x-1] += amt*0.3;
  if (x<GRID-1) lattice[y*GRID + x+1] += amt*0.3;
  if (y>0) lattice[(y-1)*GRID + x] += amt*0.3;
  if (y<GRID-1) lattice[(y+1)*GRID + x] += amt*0.3;
}

function samplePeak() {
  let best = 0, bx = 0.5, by = 0.5;
  for (let y = 2; y < GRID-2; y += 2) {
    for (let x = 2; x < GRID-2; x += 2) {
      const v = lattice[y*GRID + x];
      if (v > best) { best = v; bx = x / GRID; by = y / GRID; }
    }
  }
  return { x: bx, y: by, v: best };
}

function makePortal() {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '…';
  document.body.appendChild(el);
  let px = Math.random(), py = Math.random();
  let dragging = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX - parseFloat(el.style.left||0); oy=e.clientY - parseFloat(el.style.top||0); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; injectAt((e.clientX)/W, (e.clientY)/H, 0.4); });
  el.addEventListener('pointerup', () => dragging=false);
  portals.push({ el, x: px, y: py });
}

for (let i=0; i<8; i++) makePortal();

function updatePortals() {
  const peak = samplePeak();
  portals.forEach((p, i) => {
    if (!p.el.style.left) {
      p.x += (peak.x - p.x) * 0.02;
      p.y += (peak.y - p.y) * 0.02;
      p.el.style.left = (p.x * W - 70) + 'px';
      p.el.style.top = (p.y * H - 45) + 'px';
    }
    const scale = 0.7 + peak.v * 0.6;
    p.el.style.transform = `scale(${scale})`;
    p.el.style.background = `rgba(${20+peak.v*40}, ${30+peak.v*20}, ${60+peak.v*40}, 0.85)`;
    if (transcriptRing.length) p.el.textContent = transcriptRing[i % transcriptRing.length] || '…';
  });
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(GRID, GRID);
  for (let i=0; i<GRID*GRID; i++) {
    const v = Math.min(1, lattice[i]);
    img.data[i*4] = v*40;
    img.data[i*4+1] = v*80;
    img.data[i*4+2] = v*160 + 20;
    img.data[i*4+3] = 255;
  }
  // upscale simple
  const tmp = document.createElement('canvas');
  tmp.width = GRID; tmp.height = GRID;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);
  stepCA();
  updatePortals();
  requestAnimationFrame(draw);
}
draw();

// Speech
function startListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { document.getElementById('status').textContent = 'SpeechRecognition not available — use pointer drag to inject.'; return; }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
    const words = text.trim().split(/\s+/).filter(Boolean);
    words.forEach((w, idx) => {
      const h = w.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
      const nx = (h % 1000) / 1000;
      const ny = ((h >> 8) % 1000) / 1000;
      injectAt(nx, ny, 0.7);
      transcriptRing.push(w.slice(0, 24));
      if (transcriptRing.length > 20) transcriptRing.shift();
    });
    document.getElementById('status').textContent = 'Heard: ' + text.slice(-80);
  };
  recognition.onerror = e => document.getElementById('status').textContent = 'Speech error: ' + e.error;
  recognition.start();
  listening = true;
  document.getElementById('listen').textContent = 'Stop Listening';
}

document.getElementById('listen').onclick = () => {
  if (listening && recognition) { recognition.stop(); listening=false; document.getElementById('listen').textContent='Start Listening'; }
  else startListen();
};

// Seal (simple)
document.getElementById('seal').onclick = async () => {
  const data = { lattice: Array.from(lattice.slice(0, 200)), transcript: transcriptRing.slice(-10), ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => { const r = indexedDB.open('verse-f792',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('genomes'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'latest');
    document.getElementById('status').textContent = 'Sealed to IndexedDB.';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (memory only).'; }
};

document.getElementById('reset').onclick = () => { lattice.fill(0); transcriptRing.length=0; portals.forEach(p => { p.el.style.left=''; p.el.style.top=''; }); };

// Pointer inject fallback
canvas.addEventListener('pointerdown', e => injectAt(e.clientX/W, e.clientY/H, 0.8));

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const tilesEl = document.getElementById('tiles');
const statusEl = document.getElementById('status');
let W, H, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.width = innerWidth * dpr;
  H = canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize(); addEventListener('resize', resize);

// Cloth grid
const COLS = 22, ROWS = 14, SPACING = 28;
const points = [];
const springs = [];
let gravity = 0.08;
function initCloth() {
  points.length = 0; springs.length = 0;
  for (let y=0; y<ROWS; y++) {
    for (let x=0; x<COLS; x++) {
      const px = (innerWidth - (COLS-1)*SPACING)/2 + x*SPACING;
      const py = 80 + y*SPACING * 0.7;
      points.push({
        x: px, y: py, ox: px, oy: py,
        vx:0, vy:0, mass:1,
        pin: y===0, // top row pinned by default
        forceX:0, forceY:0
      });
    }
  }
  // structural springs
  for (let y=0; y<ROWS; y++) for (let x=0; x<COLS; x++) {
    const i = y*COLS + x;
    if (x < COLS-1) springs.push({a:i, b:i+1, rest:SPACING, k:0.4});
    if (y < ROWS-1) springs.push({a:i, b:i+COLS, rest:SPACING*0.7, k:0.4});
    if (x < COLS-1 && y < ROWS-1) springs.push({a:i, b:i+COLS+1, rest:Math.hypot(SPACING,SPACING*0.7), k:0.15});
  }
}
initCloth();

// Audio
let analyser, dataArray, micStream, audioCtx;
let spectralCentroid = 0, prevCentroid = 0, residual = 0;
let energy = 0.2;
async function enableMic() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    statusEl.textContent = 'Mic active · spectral drive on';
  } catch(e) {
    statusEl.textContent = 'Mic denied · pointer force only';
  }
}
document.getElementById('micBtn').onclick = enableMic;

// Tiles (DOM weavers)
const tiles = [];
function addTile(text = 'Verse fragment…') {
  const el = document.createElement('div');
  el.className = 'tile';
  const content = document.createElement('div'); content.className = 'content'; content.contentEditable = 'true'; content.textContent = text;
  el.append(content);
  tilesEl.appendChild(el);
  const t = {
    el,
    ix: Math.floor(Math.random()*(COLS-4))+2,
    iy: Math.floor(Math.random()*(ROWS-4))+2,
    pinned: false,
    drag: false
  };
  tiles.push(t);
  el.addEventListener('pointerdown', e => {
    t.drag = true;
    t.el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointerup', e => { t.drag = false; });
  el.addEventListener('click', e => {
    if (!t.drag) { t.pinned = !t.pinned; el.classList.toggle('pinned', t.pinned); }
  });
  return t;
}
for (let i=0; i<6; i++) addTile(['listen', 'weave', 'remember', 'tilt', 'seal', 'void'][i]);
document.getElementById('addTile').onclick = () => addTile('new note');

// Pointer force
let mouseX = innerWidth/2, mouseY = innerHeight/2, mouseDown = false;
canvas.addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener('pointerdown', () => mouseDown = true);
addEventListener('pointerup', () => mouseDown = false);

// Simulation
function step() {
  // Audio analysis
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0, weighted = 0, total = 0;
    for (let i=0; i<dataArray.length; i++) {
      const v = dataArray[i]/255;
      sum += v;
      weighted += v * i;
      total += v;
    }
    energy = Math.min(1, sum / dataArray.length * 3);
    spectralCentroid = total > 0 ? weighted / total : 0;
    residual = spectralCentroid - prevCentroid;
    prevCentroid = spectralCentroid * 0.9 + prevCentroid * 0.1; // simple predictor residual
  } else {
    energy = 0.15 + Math.sin(Date.now()/800)*0.05;
    residual = Math.sin(Date.now()/400)*0.02;
  }

  // Modulate springs by energy
  const kBase = 0.25 + energy * 0.6;
  for (const s of springs) s.k = kBase * (s.rest < SPACING+5 ? 1 : 0.4);

  // Forces
  for (const p of points) {
    p.forceX = 0; p.forceY = gravity * p.mass;
    if (!p.pin) {
      // residual turbulence
      p.forceX += residual * 12 * (Math.random()-0.5);
      p.forceY += residual * 8 * (Math.random()-0.5);
      // pointer wind when down
      if (mouseDown) {
        const dx = mouseX - p.x, dy = mouseY - p.y;
        const d = Math.hypot(dx,dy) || 1;
        if (d < 120) {
          p.forceX += (dx/d) * 2.2;
          p.forceY += (dy/d) * 2.2;
        }
      }
    }
  }

  // Spring forces
  for (const s of springs) {
    const a = points[s.a], b = points[s.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx,dy) || 1;
    const stretch = dist - s.rest;
    const force = stretch * s.k;
    const fx = (dx/dist) * force, fy = (dy/dist) * force;
    a.forceX += fx; a.forceY += fy;
    b.forceX -= fx; b.forceY -= fy;
  }

  // Integrate (semi-implicit Euler + damping)
  const damp = 0.92;
  for (const p of points) {
    if (p.pin) continue;
    p.vx = (p.vx + p.forceX / p.mass) * damp;
    p.vy = (p.vy + p.forceY / p.mass) * damp;
    p.x += p.vx;
    p.y += p.vy;
    // soft bounds
    if (p.x < 10) { p.x=10; p.vx*=-0.3; }
    if (p.x > innerWidth-10) { p.x=innerWidth-10; p.vx*=-0.3; }
    if (p.y > innerHeight-10) { p.y=innerHeight-10; p.vy*=-0.4; }
  }

  // Tile drag pulls cloth
  for (const t of tiles) {
    const idx = t.iy * COLS + t.ix;
    const p = points[idx];
    if (t.drag && !t.pinned) {
      const rect = t.el.getBoundingClientRect();
      const tx = rect.left + rect.width/2, ty = rect.top + rect.height/2;
      // pull nearby points toward mouse
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
        const ii = (t.iy+dy)*COLS + (t.ix+dx);
        if (ii>=0 && ii<points.length && !points[ii].pin) {
          points[ii].x += (mouseX - points[ii].x) * 0.15;
          points[ii].y += (mouseY - points[ii].y) * 0.15;
        }
      }
    }
    // position tile
    t.el.style.left = (p.x - 70) + 'px';
    t.el.style.top = (p.y - 45) + 'px';
    const scale = 0.85 + energy * 0.3 + Math.abs(residual)*2;
    t.el.style.transform = `scale(${Math.min(1.4, scale)}) rotate(${residual*20}deg)`;
    t.el.style.filter = `hue-rotate(${energy*80}deg) saturate(${1+energy})`;
  }

  // CSS chrome morph
  document.documentElement.style.setProperty('--energy', energy.toFixed(3));
  document.documentElement.style.setProperty('--hue', (200 + energy*60 + residual*40).toFixed(0));
  document.body.style.background = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 30%, ${8+energy*6}%)`;
}

function draw() {
  ctx.clearRect(0,0,innerWidth,innerHeight);
  ctx.strokeStyle = `hsla(${200+energy*40},70%,60%,0.35)`;
  ctx.lineWidth = 1;
  for (const s of springs) {
    const a = points[s.a], b = points[s.b];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.fillStyle = `hsla(${220+residual*100},80%,70%,0.7)`;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.pin ? 3.5 : 2, 0, Math.PI*2);
    ctx.fill();
  }
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// Seal / replay via IndexedDB
let db;
const req = indexedDB.open('verse-cloth-seals', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('seals', {keyPath:'id', autoIncrement:true});
};
req.onsuccess = e => { db = e.target.result; };
function seal() {
  if (!db) return;
  const snapshot = points.map(p => ({x:p.x, y:p.y, vx:p.vx, vy:p.vy, pin:p.pin}));
  const tilesSnap = tiles.map(t => ({ix:t.ix, iy:t.iy, text:t.el.querySelector('.content').innerText, pinned:t.pinned}));
  const tx = db.transaction('seals','readwrite');
  tx.objectStore('seals').add({
    t: Date.now(),
    energy, residual, spectralCentroid,
    points: snapshot,
    tiles: tilesSnap
  });
  statusEl.textContent = 'Sealed to IndexedDB · ' + new Date().toLocaleTimeString();
}
document.getElementById('sealBtn').onclick = seal;

function loadSeal() {
  if (!db) return;
  const tx = db.transaction('seals','readonly');
  const store = tx.objectStore('seals');
  const get = store.openCursor(null,'prev');
  get.onsuccess = e => {
    const c = e.target.result;
    if (!c) { statusEl.textContent = 'No seals yet'; return; }
    const s = c.value;
    // restore points
    if (s.points && s.points.length === points.length) {
      s.points.forEach((sp,i) => {
        points[i].x = sp.x; points[i].y = sp.y;
        points[i].vx = sp.vx*0.3; points[i].vy = sp.vy*0.3;
      });
    }
    statusEl.textContent = 'Replayed seal from ' + new Date(s.t).toLocaleTimeString();
  };
}
document.getElementById('loadBtn').onclick = loadSeal;

// WebGPU note: a compute shader could integrate the mass-spring in parallel,
// write positions to a storage buffer, and sample for DOM or render as textured mesh.
// Current path is Canvas2D for immediate runnability across browsers.

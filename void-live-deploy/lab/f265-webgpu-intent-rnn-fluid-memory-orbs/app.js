const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, particles = [], orbs = [], sealed = [], intent = {x:0, y:0}, densityMap = [];
let micOn = false, analyser, audioCtx;
const N = 800;
const ORB_THRESH = 12;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize); resize();

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: 0, vy: 0, life: 1
    });
  }
}
initParticles();

// Simple intent "RNN" state (online residual)
let rnnState = new Float32Array(8);
function updateIntent(px, py, tiltX, tiltY) {
  // Tiny online update: blend recent motion into state
  const dx = (px - (W/2)) / W;
  const dy = (py - (H/2)) / H;
  rnnState[0] = rnnState[0]*0.85 + dx*0.15;
  rnnState[1] = rnnState[1]*0.85 + dy*0.15;
  rnnState[2] = rnnState[2]*0.9 + (tiltX||0)*0.05;
  rnnState[3] = rnnState[3]*0.9 + (tiltY||0)*0.05;
  // Output intent force
  intent.x = rnnState[0] * 80 + rnnState[2] * 40;
  intent.y = rnnState[1] * 80 + rnnState[3] * 40;
  document.getElementById('intent').textContent = `intent: ${intent.x.toFixed(1)}, ${intent.y.toFixed(1)}`;
}

// Pointer + orientation
let lastPX = W/2, lastPY = H/2, tiltX=0, tiltY=0;
addEventListener('pointermove', e => {
  lastPX = e.clientX; lastPY = e.clientY;
  updateIntent(lastPX, lastPY, tiltX, tiltY);
});
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 90;
    tiltY = (e.beta || 0) / 90;
    updateIntent(lastPX, lastPY, tiltX, tiltY);
  });
}

// Particle step (CPU fallback; WebGPU path stubbed)
function step() {
  const bins = 16;
  densityMap = new Array(bins*bins).fill(0);
  const bx = W/bins, by = H/bins;
  for (let p of particles) {
    // Intent force + mild noise + damping
    p.vx = p.vx*0.96 + intent.x*0.002 + (Math.random()-0.5)*0.4;
    p.vy = p.vy*0.96 + intent.y*0.002 + (Math.random()-0.5)*0.4;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
    const ix = Math.min(bins-1, Math.floor(p.x / bx));
    const iy = Math.min(bins-1, Math.floor(p.y / by));
    densityMap[iy*bins + ix]++;
  }
  // Spawn orbs in high density
  for (let i = 0; i < densityMap.length; i++) {
    if (densityMap[i] > ORB_THRESH && Math.random() < 0.05) {
      const ix = i % bins, iy = Math.floor(i / bins);
      spawnOrb(ix*bx + bx/2, iy*by + by/2, densityMap[i]);
    }
  }
  // Morph UI
  const avgD = densityMap.reduce((a,b)=>a+b,0)/densityMap.length;
  document.documentElement.style.setProperty('--density', Math.min(1, avgD/20));
  document.body.style.filter = `hue-rotate(${avgD*2}deg)`;
}

function spawnOrb(x, y, dens) {
  if (orbs.length > 12) return;
  const el = document.createElement('div');
  el.className = 'orb';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.textContent = dens;
  el.dataset.x = x; el.dataset.y = y; el.dataset.dens = dens;
  let dragging = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => {
    dragging = true; ox = e.clientX - x; oy = e.clientY - y;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const nx = e.clientX - ox, ny = e.clientY - oy;
    el.style.left = nx + 'px'; el.style.top = ny + 'px';
  });
  el.addEventListener('pointerup', () => {
    if (dragging) sealOrb(el);
    dragging = false;
  });
  document.body.appendChild(el);
  orbs.push(el);
}

function sealOrb(el) {
  const rec = {
    intent: {...intent},
    dens: +el.dataset.dens,
    t: Date.now(),
    x: +el.dataset.x, y: +el.dataset.y
  };
  sealed.push(rec);
  // Bias RNN slightly toward sealed
  rnnState[0] += rec.intent.x * 0.0005;
  rnnState[1] += rec.intent.y * 0.0005;
  el.style.background = 'radial-gradient(circle, #22c55e, transparent)';
  setTimeout(() => el.remove(), 800);
  saveSealed();
  document.getElementById('status').textContent = `Sealed ${sealed.length} memories`;
}

function draw() {
  ctx.fillStyle = `rgba(10,10,12,${0.15 + document.documentElement.style.getPropertyValue('--density')*0.1})`;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#6ee7b7';
  for (let p of particles) {
    ctx.globalAlpha = 0.6;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB
let db;
const req = indexedDB.open('f265-void', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('sealed', {keyPath: 't'});
};
req.onsuccess = e => { db = e.target.result; loadSealed(); };
function saveSealed() {
  if (!db) return;
  const tx = db.transaction('sealed', 'readwrite');
  sealed.slice(-5).forEach(s => tx.objectStore('sealed').put(s));
}
function loadSealed() {
  if (!db) return;
  db.transaction('sealed').objectStore('sealed').getAll().onsuccess = e => {
    sealed = e.target.result || [];
    document.getElementById('status').textContent = `Loaded ${sealed.length} sealed`;
  };
}

document.getElementById('sealAll').onclick = () => {
  document.querySelectorAll('.orb').forEach(sealOrb);
};
document.getElementById('mic').onchange = async e => {
  micOn = e.target.checked;
  if (micOn && !audioCtx) {
    try {
      audioCtx = new AudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
    } catch {}
  }
};
// Simple mic energy inject (stub)
setInterval(() => {
  if (micOn && analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const energy = data.reduce((a,b)=>a+b,0)/data.length;
    if (energy > 40) {
      intent.x += (Math.random()-0.5)*energy*0.1;
      intent.y += (Math.random()-0.5)*energy*0.1;
    }
  }
}, 200);

// WebGPU stub note (actual compute would replace particle step)
if (navigator.gpu) {
  document.getElementById('status').textContent += ' · WebGPU available (CPU fallback active)';
}

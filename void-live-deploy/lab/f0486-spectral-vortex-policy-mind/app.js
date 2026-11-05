const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 48; // lattice
const particles = [];
const portals = [];
let mlp = { w1: [], b1: [], w2: [], b2: [] }; // tiny 3-8-4
function initMLP() {
  mlp.w1 = Array.from({length:3*8}, () => (Math.random()-0.5)*0.5);
  mlp.b1 = Array.from({length:8}, () => 0);
  mlp.w2 = Array.from({length:8*4}, () => (Math.random()-0.5)*0.3);
  mlp.b2 = Array.from({length:4}, () => 0);
}
initMLP();

function forward(x) { // x: [centroid, flux, energy] normalized
  const h = [];
  for (let i=0; i<8; i++) {
    let s = mlp.b1[i];
    for (let j=0; j<3; j++) s += x[j] * mlp.w1[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const o = [];
  for (let i=0; i<4; i++) {
    let s = mlp.b2[i];
    for (let j=0; j<8; j++) s += h[j] * mlp.w2[j*4 + i];
    o[i] = Math.tanh(s);
  }
  return o; // [strength, decay, injectX, injectY]
}

let audioCtx, analyser, dataArray, useMic = false, toneOsc;
async function startAudio(mic=false) {
  if (audioCtx) audioCtx.close();
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  if (mic) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const src = audioCtx.createMediaStreamSource(stream);
      src.connect(analyser);
      useMic = true;
    } catch(e) { console.warn(e); startTone(); }
  } else startTone();
  document.getElementById('status').textContent = useMic ? 'Mic active' : 'Synthetic tone';
}
function startTone() {
  toneOsc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.1;
  toneOsc.frequency.value = 220;
  toneOsc.connect(gain); gain.connect(analyser); toneOsc.start();
  useMic = false;
}

function getSpectral() {
  if (!analyser) return [0.3, 0.2, 0.4];
  analyser.getByteFrequencyData(dataArray);
  let sum = 0, weighted = 0, flux = 0, energy = 0;
  const prev = getSpectral.prev || dataArray.slice();
  for (let i=0; i<dataArray.length; i++) {
    const v = dataArray[i]/255;
    energy += v;
    weighted += i * v;
    flux += Math.abs(v - (prev[i]/255));
  }
  getSpectral.prev = dataArray.slice();
  const centroid = energy > 0 ? weighted / energy / dataArray.length : 0.5;
  return [centroid, flux / dataArray.length, energy / dataArray.length];
}

function spawnParticles() {
  particles.length = 0;
  for (let i=0; i<800; i++) {
    particles.push({x: Math.random()*W, y: Math.random()*H, vx:0, vy:0, life:1});
  }
}
spawnParticles();

function stepField(params) {
  const [strength, decay, ix, iy] = params;
  const injectX = (ix+1)/2 * W, injectY = (iy+1)/2 * H;
  for (const p of particles) {
    // simple vortex force around inject
    const dx = p.x - injectX, dy = p.y - injectY;
    const r2 = dx*dx + dy*dy + 100;
    const force = strength * 40 / r2;
    p.vx += -dy * force * 0.05;
    p.vy += dx * force * 0.05;
    p.vx *= 0.98 - decay*0.02;
    p.vy *= 0.98 - decay*0.02;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
  }
}

function detectCores() {
  // simple: sample high speed regions as cores
  const cores = [];
  for (let k=0; k<6; k++) {
    let best = particles[Math.floor(Math.random()*particles.length)];
    for (let s=0; s<20; s++) {
      const p = particles[Math.floor(Math.random()*particles.length)];
      if (Math.hypot(p.vx, p.vy) > Math.hypot(best.vx, best.vy)) best = p;
    }
    cores.push({x: best.x, y: best.y, v: Math.hypot(best.vx, best.vy)});
  }
  return cores;
}

function updatePortals(cores) {
  while (portals.length < cores.length) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'vortex ' + portals.length;
    el.onclick = () => rewardPortal(portals.length);
    document.body.appendChild(el);
    portals.push({el, x:0, y:0, v:0});
  }
  cores.forEach((c, i) => {
    if (!portals[i]) return;
    portals[i].x = c.x; portals[i].y = c.y; portals[i].v = c.v;
    portals[i].el.style.left = (c.x - 60) + 'px';
    portals[i].el.style.top = (c.y - 40) + 'px';
    const scale = 0.8 + Math.min(c.v / 5, 1.5);
    portals[i].el.style.transform = `scale(${scale})`;
    portals[i].el.style.boxShadow = `0 0 ${c.v*8}px hsla(${document.documentElement.style.getPropertyValue('--hue')||200},80%,60%,0.8)`;
  });
}

function rewardPortal(idx) {
  // simple Hebbian-ish update: strengthen weights a bit toward current input
  const feat = getSpectral();
  for (let i=0; i<mlp.w1.length; i++) mlp.w1[i] += 0.01 * (Math.random()-0.4);
  for (let i=0; i<mlp.w2.length; i++) mlp.w2[i] += 0.005 * (Math.random()-0.3);
  document.getElementById('status').textContent = 'Rewarded portal ' + idx + ' — policy evolved';
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')},70%,60%,0.6)`;
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI*2); ctx.fill();
  }
}

let last = 0;
function loop(t) {
  if (t - last > 30) {
    const feat = getSpectral();
    const params = forward(feat);
    stepField(params);
    const cores = detectCores();
    updatePortals(cores);
    const energy = feat[2];
    document.documentElement.style.setProperty('--energy', energy.toFixed(2));
    document.documentElement.style.setProperty('--hue', (180 + feat[0]*180).toFixed(0));
    last = t;
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// IndexedDB
const DB = 'f0486';
async function seal() {
  const db = await openDB();
  const tx = db.transaction('s', 'readwrite');
  tx.objectStore('s').put({id:1, mlp, particles: particles.slice(0,200), portals: portals.map(p=>({x:p.x,y:p.y,v:p.v}))});
  document.getElementById('status').textContent = 'Sealed to IndexedDB';
}
async function restore() {
  const db = await openDB();
  const req = db.transaction('s').objectStore('s').get(1);
  req.onsuccess = () => {
    if (req.result) {
      mlp = req.result.mlp;
      // particles partially restored
      document.getElementById('status').textContent = 'Restored from seal';
    }
  };
}
function openDB() {
  return new Promise(res => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('s', {keyPath:'id'});
    r.onsuccess = () => res(r.result);
  });
}

document.getElementById('mic').onclick = () => startAudio(true);
document.getElementById('tone').onclick = () => startAudio(false);
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { spawnParticles(); initMLP(); };
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

// auto start synthetic
startAudio(false);

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let pointer = {x: W/2, y: H/2, vx: 0, vy: 0};
let orient = {beta: 0, gamma: 0};
let micEnergy = 0;
let residual = 0;
let echoes = []; // {x,y,vx,vy,age,hue}
const MAX_ECHO = 80;
let tiles = [];

// Simple residual predictor in main (Worker noted)
let history = [];
function predictNext() {
  if (history.length < 4) return {x: pointer.x, y: pointer.y};
  // Linear residual from last deltas
  const d = history.slice(-3).map((p,i,a) => i ? {x:p.x-a[i-1].x, y:p.y-a[i-1].y} : {x:0,y:0});
  const avgDx = d.reduce((s,v)=>s+v.x,0)/d.length;
  const avgDy = d.reduce((s,v)=>s+v.y,0)/d.length;
  return {x: pointer.x + avgDx, y: pointer.y + avgDy};
}

function updatePredictor() {
  const pred = predictNext();
  residual = Math.hypot(pred.x - pointer.x, pred.y - pointer.y) * 0.05;
  residual = Math.min(residual + micEnergy * 0.3 + Math.abs(orient.beta)*0.01, 5);
  history.push({x: pointer.x, y: pointer.y});
  if (history.length > 20) history.shift();
  document.getElementById('res').textContent = residual.toFixed(2);
}

// Echo lattice
function spawnEcho(x, y, strength=1) {
  if (echoes.length >= MAX_ECHO) echoes.shift();
  echoes.push({
    x, y,
    vx: (Math.random()-0.5)*strength*2,
    vy: (Math.random()-0.5)*strength*2,
    age: 0,
    hue: (Date.now()/10 % 360)
  });
}

function updateEchoes() {
  const pred = predictNext();
  for (let e of echoes) {
    // Causal attraction to predicted future + residual turbulence
    const dx = pred.x - e.x, dy = pred.y - e.y;
    const dist = Math.hypot(dx,dy) || 1;
    e.vx += (dx/dist) * residual * 0.15 + (Math.random()-0.5)*residual*0.4;
    e.vy += (dy/dist) * residual * 0.15 + (Math.random()-0.5)*residual*0.4;
    // Orientation bias
    e.vx += orient.gamma * 0.02;
    e.vy += orient.beta * 0.02;
    e.x += e.vx; e.y += e.vy;
    e.vx *= 0.92; e.vy *= 0.92;
    e.age++;
    if (e.x < 0 || e.x > W || e.y < 0 || e.y > H) { e.vx *= -0.5; e.vy *= -0.5; }
  }
  echoes = echoes.filter(e => e.age < 400);
  document.getElementById('ec').textContent = echoes.length;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for (let e of echoes) {
    const alpha = Math.max(0, 1 - e.age/400);
    ctx.beginPath();
    ctx.arc(e.x, e.y, 2 + residual, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${e.hue}, 80%, 60%, ${alpha})`;
    ctx.fill();
    // Trail
    ctx.strokeStyle = `hsla(${e.hue}, 70%, 50%, ${alpha*0.4})`;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - e.vx*4, e.y - e.vy*4);
    ctx.stroke();
  }
  // Predicted point
  const p = predictNext();
  ctx.fillStyle = `rgba(255,100,100,${Math.min(residual,1)})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
  ctx.fill();
}

// DOM tiles as spatial participants
function createTile(x, y, text='echo note') {
  const t = document.createElement('div');
  t.className = 'tile';
  t.contentEditable = true;
  t.textContent = text;
  t.style.left = x + 'px';
  t.style.top = y + 'px';
  document.body.appendChild(t);
  let drag = false, ox, oy;
  t.addEventListener('pointerdown', e => { drag=true; ox=e.clientX-parseFloat(t.style.left); oy=e.clientY-parseFloat(t.style.top); t.setPointerCapture(e.pointerId); });
  t.addEventListener('pointermove', e => { if(drag){ t.style.left=(e.clientX-ox)+'px'; t.style.top=(e.clientY-oy)+'px'; spawnEcho(e.clientX, e.clientY, 1.5); } });
  t.addEventListener('pointerup', () => drag=false);
  tiles.push(t);
  return t;
}

document.getElementById('addTile').onclick = () => createTile(W/2 + Math.random()*100-50, H/2, 'new echo');
document.getElementById('seal').onclick = sealState;

// Pointer
canvas.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (Math.hypot(pointer.vx, pointer.vy) > 3) spawnEcho(pointer.x, pointer.y, 0.8);
});

// Orientation
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// Mic
let audioCtx, analyser;
document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
  } catch(e) { console.warn(e); }
};

function sampleMic() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  micEnergy = data.reduce((s,v)=>s+v,0) / data.length / 255;
}

// IndexedDB seal
let db;
const req = indexedDB.open('F467Echo', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('seals', {keyPath: 'id'});
req.onsuccess = e => db = e.target.result;

function sealState() {
  if (!db) return;
  const tx = db.transaction('seals', 'readwrite');
  const store = tx.objectStore('seals');
  const state = {
    id: Date.now(),
    residual,
    echoes: echoes.slice(0,20).map(e=>({x:e.x,y:e.y,hue:e.hue})),
    tiles: tiles.map(t => ({x: parseFloat(t.style.left), y: parseFloat(t.style.top), text: t.textContent})),
    ts: new Date().toISOString()
  };
  store.put(state);
  alert('Echo sealed to IndexedDB');
  // Inject wave
  for (let i=0; i<12; i++) spawnEcho(W/2, H/2, 3);
}

// CSS morph
function morphChrome() {
  document.body.style.filter = `hue-rotate(${residual*20}deg)`;
  document.body.style.background = `radial-gradient(circle at ${pointer.x}px ${pointer.y}px, #1a1a2e, #0a0a12)`;
}

function loop() {
  updatePredictor();
  sampleMic();
  updateEchoes();
  draw();
  morphChrome();
  requestAnimationFrame(loop);
}
loop();

// Initial
createTile(200, 150, 'causal echo');
createTile(400, 300, 'drag me');
for (let i=0; i<30; i++) spawnEcho(Math.random()*W, Math.random()*H, 1);

// WebGPU note: fallback Canvas2D; compute shader for echo advection would replace updateEchoes.

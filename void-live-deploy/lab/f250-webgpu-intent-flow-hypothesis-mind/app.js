const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W, H, gridW = 32, gridH = 18, cellW, cellH;
const vx = new Float32Array(gridW * gridH);
const vy = new Float32Array(gridW * gridH);
const dens = new Float32Array(gridW * gridH);
let pointer = {x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0};
let tilt = {x: 0, y: 0};
let spectral = 0;
let residual = 0;
let intent = {x: 0, y: 0};
let orbs = [];
const N_ORBS = 5;
let audioCtx, osc, gain;
let db;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cellW = W / gridW; cellH = H / gridH;
}
resize(); addEventListener('resize', resize);

// IndexedDB
const req = indexedDB.open('f250-intent', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('hypotheses', {keyPath: 'ts'});
req.onsuccess = e => db = e.target.result;

// Worker residual agent
const workerCode = `
let w = new Float32Array(20);
function init() { for(let i=0;i<w.length;i++) w[i] = (Math.random()-0.5)*0.4; }
init();
function forward(inp) {
  let h = 0;
  for(let i=0;i<5;i++) h += inp[i] * w[i];
  h = Math.tanh(h);
  return [h * w[5] + w[6], h * w[7] + w[8]];
}
onmessage = e => {
  const {tiltX, tiltY, spec, pvX, pvY, prevI} = e.data;
  const inp = [tiltX, tiltY, spec, pvX, pvY];
  const pred = forward(inp);
  const err = Math.hypot(pred[0]-prevI.x, pred[1]-prevI.y);
  // hill-climb
  for(let k=0;k<3;k++) {
    const i = Math.floor(Math.random()*w.length);
    const old = w[i];
    w[i] += (Math.random()-0.5)*0.08;
    const p2 = forward(inp);
    const e2 = Math.hypot(p2[0]-prevI.x, p2[1]-prevI.y);
    if(e2 > err) w[i] = old;
  }
  postMessage({intent: {x: pred[0], y: pred[1]}, residual: err});
};
`;
const blob = new Blob([workerCode], {type: 'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  intent = e.data.intent;
  residual = e.data.residual;
};

// Orbs
for(let i=0;i<N_ORBS;i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = 'H' + (i+1);
  el.style.left = (100 + i*120) + 'px';
  el.style.top = (200 + Math.sin(i)*40) + 'px';
  document.body.appendChild(el);
  orbs.push({el, x: 100+i*120, y: 200+Math.sin(i)*40, vx: 0, vy: 0, selected: false});
  el.addEventListener('pointerdown', startDrag);
}

let drag = null;
function startDrag(e) {
  const orb = orbs.find(o => o.el === e.target);
  if(!orb) return;
  drag = {orb, ox: e.clientX - orb.x, oy: e.clientY - orb.y};
  orb.el.setPointerCapture(e.pointerId);
}
addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.vx = pointer.x - pointer.prevX; pointer.vy = pointer.y - pointer.prevY;
  pointer.prevX = pointer.x; pointer.prevY = pointer.y;
  if(drag) {
    drag.orb.x = e.clientX - drag.ox;
    drag.orb.y = e.clientY - drag.oy;
  }
});
addEventListener('pointerup', e => {
  if(drag) {
    const o = drag.orb;
    o.selected = true;
    o.el.classList.add('selected');
    sealHypothesis(o);
    // inject source
    const gx = Math.floor(o.x / cellW), gy = Math.floor(o.y / cellH);
    const idx = gy * gridW + gx;
    if(idx >=0 && idx < vx.length) {
      vx[idx] += (Math.random()-0.5)*4;
      vy[idx] += (Math.random()-0.5)*4;
      dens[idx] += 0.8;
    }
    setTimeout(() => { o.selected = false; o.el.classList.remove('selected'); }, 1200);
    drag = null;
  }
});

function sealHypothesis(o) {
  if(!db) return;
  const tx = db.transaction('hypotheses', 'readwrite');
  tx.objectStore('hypotheses').put({ts: Date.now(), intent: {...intent}, residual, pos: {x: o.x, y: o.y}});
  status.textContent = `Sealed hypothesis · residual ${residual.toFixed(2)}`;
}

// Sensors
document.getElementById('orient').onclick = () => {
  if(DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => { if(p==='granted') listenOrient(); });
  else listenOrient();
};
function listenOrient() {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 45;
    tilt.y = (e.beta || 0) / 45;
  });
}
document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    setInterval(() => {
      analyser.getByteFrequencyData(data);
      spectral = data.reduce((a,b)=>a+b,0) / data.length / 255;
    }, 100);
    // generative audio
    osc = audioCtx.createOscillator();
    gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start();
  } catch(e) { console.warn(e); }
};
document.getElementById('seal').onclick = () => orbs.forEach(sealHypothesis);
document.getElementById('xr').onclick = () => {
  if(navigator.xr) navigator.xr.requestSession('immersive-ar').then(s => status.textContent = 'XR entered (stub)').catch(()=>{});
  else status.textContent = 'XR unsupported';
};

// Fluid step
function stepFluid() {
  // diffusion + decay
  for(let i=0;i<vx.length;i++) {
    vx[i] *= 0.96; vy[i] *= 0.96; dens[i] *= 0.92;
  }
  // inject intent at pointer
  const gx = Math.min(gridW-1, Math.max(0, Math.floor(pointer.x / cellW)));
  const gy = Math.min(gridH-1, Math.max(0, Math.floor(pointer.y / cellH)));
  const idx = gy * gridW + gx;
  vx[idx] += intent.x * 0.8 + tilt.x * 0.3;
  vy[idx] += intent.y * 0.8 + tilt.y * 0.3;
  dens[idx] += Math.abs(intent.x) + Math.abs(intent.y) + spectral * 0.4;
  // simple neighbor advection approximation
  const nvx = new Float32Array(vx), nvy = new Float32Array(vy);
  for(let y=1;y<gridH-1;y++) for(let x=1;x<gridW-1;x++) {
    const i = y*gridW + x;
    nvx[i] = (vx[i] + vx[i-1] + vx[i+1] + vx[i-gridW] + vx[i+gridW]) * 0.2;
    nvy[i] = (vy[i] + vy[i-1] + vy[i+1] + vy[i-gridW] + vy[i+gridW]) * 0.2;
  }
  vx.set(nvx); vy.set(nvy);
}

// Orbs follow flow
function stepOrbs() {
  orbs.forEach(o => {
    const gx = Math.min(gridW-1, Math.max(0, Math.floor(o.x / cellW)));
    const gy = Math.min(gridH-1, Math.max(0, Math.floor(o.y / cellH)));
    const i = gy * gridW + gx;
    o.vx = vx[i] * 12 + (Math.random()-0.5)*0.5;
    o.vy = vy[i] * 12 + (Math.random()-0.5)*0.5;
    o.x += o.vx; o.y += o.vy;
    o.x = Math.max(24, Math.min(W-24, o.x));
    o.y = Math.max(24, Math.min(H-24, o.y));
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
    const mag = Math.hypot(o.vx, o.vy);
    const sc = 0.8 + Math.min(1.2, mag * 0.15 + residual * 0.4);
    o.el.style.transform = `scale(${sc}) rotate(${o.vx*4}deg)`;
    o.el.style.background = `hsla(${(200 + residual*80 + mag*20) % 360}, 70%, 55%, 0.85)`;
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  // flow arrows / density
  for(let y=0;y<gridH;y++) for(let x=0;x<gridW;x++) {
    const i = y*gridW + x;
    const d = dens[i];
    if(d < 0.02) continue;
    ctx.fillStyle = `hsla(${200 + residual*60}, 60%, 50%, ${Math.min(0.6, d)})`;
    ctx.fillRect(x*cellW, y*cellH, cellW, cellH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(x*cellW + cellW/2, y*cellH + cellH/2);
    ctx.lineTo(x*cellW + cellW/2 + vx[i]*8, y*cellH + cellH/2 + vy[i]*8);
    ctx.stroke();
  }
}

function loop() {
  // feed worker
  worker.postMessage({
    tiltX: tilt.x, tiltY: tilt.y, spec: spectral,
    pvX: pointer.vx * 0.01, pvY: pointer.vy * 0.01,
    prevI: intent
  });
  stepFluid();
  stepOrbs();
  draw();
  // chrome
  document.documentElement.style.setProperty('--hue', 200 + residual * 120);
  document.documentElement.style.setProperty('--blur', Math.min(2, residual * 1.5) + 'px');
  if(osc) {
    osc.frequency.value = 110 + residual * 200 + Math.abs(intent.x)*40;
    gain.gain.value = 0.02 + residual * 0.04;
  }
  status.textContent = `Intent flow · residual ${residual.toFixed(2)} · |v| ${Math.hypot(intent.x,intent.y).toFixed(2)} · orbs ${orbs.length}`;
  requestAnimationFrame(loop);
}
loop();

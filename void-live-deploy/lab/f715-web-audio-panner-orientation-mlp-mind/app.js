const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let audioCtx, agents = [], orientation = {beta:0, gamma:0}, phase = 0, enabled = false;
const N = 6;

function createMLP() {
  return {
    w1: Array(3*6).fill(0).map(() => (Math.random()-0.5)*0.5),
    b1: Array(6).fill(0).map(() => (Math.random()-0.5)*0.1),
    w2: Array(6*3).fill(0).map(() => (Math.random()-0.5)*0.5),
    b2: Array(3).fill(0).map(() => (Math.random()-0.5)*0.1)
  };
}

function forward(mlp, inp) {
  const h = [];
  for (let i=0; i<6; i++) {
    let s = mlp.b1[i];
    for (let j=0; j<3; j++) s += inp[j] * mlp.w1[j*6 + i];
    h[i] = Math.tanh(s);
  }
  const out = [];
  for (let k=0; k<3; k++) {
    let s = mlp.b2[k];
    for (let i=0; i<6; i++) s += h[i] * mlp.w2[i*3 + k];
    out[k] = Math.tanh(s);
  }
  return out;
}

function initAgents() {
  agents = [];
  for (let i=0; i<N; i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    el.style.setProperty('--hue', (i*60)%360);
    el.textContent = i+1;
    document.body.appendChild(el);
    agents.push({
      el, mlp: createMLP(),
      x: Math.random()*W, y: Math.random()*H,
      vx:0, vy:0, freq: 220 + i*40, fitness: 1,
      osc: null, panner: null, gain: null
    });
  }
}

async function enable() {
  if (enabled) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  for (let a of agents) {
    a.osc = audioCtx.createOscillator();
    a.gain = audioCtx.createGain();
    a.panner = audioCtx.createPanner();
    a.panner.panningModel = 'HRTF';
    a.panner.distanceModel = 'inverse';
    a.osc.type = 'sine';
    a.osc.frequency.value = a.freq;
    a.gain.gain.value = 0.08;
    a.osc.connect(a.gain);
    a.gain.connect(a.panner);
    a.panner.connect(audioCtx.destination);
    a.osc.start();
  }
  if (DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch (e) { console.debug("lab f715-web-audio-panner-orientation-mlp-mind:", e); }
  }
  addEventListener('deviceorientation', e => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
  enabled = true;
  document.getElementById('status').textContent = 'Active';
}

function update() {
  phase += 0.02;
  const inp = [
    Math.sin(orientation.beta * Math.PI/180) * 0.5,
    Math.sin(orientation.gamma * Math.PI/180) * 0.5,
    Math.sin(phase)
  ];
  for (let a of agents) {
    const out = forward(a.mlp, inp);
    a.vx += out[0] * 0.5;
    a.vy += out[1] * 0.5;
    a.freq = 200 + out[2]*150 + a.fitness*10;
    a.vx *= 0.95; a.vy *= 0.95;
    a.x += a.vx; a.y += a.vy;
    if (a.x < 20) a.x = 20; if (a.x > W-20) a.x = W-20;
    if (a.y < 20) a.y = 20; if (a.y > H-20) a.y = H-20;
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    if (a.osc) {
      a.osc.frequency.setTargetAtTime(a.freq, audioCtx.currentTime, 0.05);
      const px = (a.x / W - 0.5) * 2;
      const py = (0.5 - a.y / H) * 2;
      a.panner.positionX.setValueAtTime(px, audioCtx.currentTime);
      a.panner.positionY.setValueAtTime(py, audioCtx.currentTime);
      a.panner.positionZ.setValueAtTime(0, audioCtx.currentTime);
    }
  }
  // Proximity transfer
  for (let i=0; i<N; i++) for (let j=i+1; j<N; j++) {
    const dx = agents[i].x - agents[j].x, dy = agents[i].y - agents[j].y;
    if (dx*dx + dy*dy < 10000) {
      const higher = agents[i].fitness > agents[j].fitness ? agents[i] : agents[j];
      const lower = higher === agents[i] ? agents[j] : agents[i];
      // transfer some weights
      for (let k=0; k<higher.mlp.w1.length; k++) {
        if (Math.random() < 0.1) lower.mlp.w1[k] = higher.mlp.w1[k] * 0.7 + lower.mlp.w1[k] * 0.3 + (Math.random()-0.5)*0.05;
      }
      lower.fitness *= 0.95;
      higher.fitness = Math.min(higher.fitness + 0.05, 5);
    }
  }
  // Draw trails
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  for (let a of agents) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 8, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${parseInt(a.el.style.getPropertyValue('--hue'))},70%,60%,0.6)`;
    ctx.fill();
  }
  requestAnimationFrame(update);
}

document.getElementById('enable').onclick = enable;
document.getElementById('seal').onclick = async () => {
  const best = agents.reduce((b,a) => a.fitness > b.fitness ? a : b, agents[0]);
  const data = { mlp: best.mlp, fitness: best.fitness };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f715', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'best');
    const bc = new BroadcastChannel('verse-f715');
    bc.postMessage(data);
    document.getElementById('status').textContent = 'Sealed';
  } catch(e) { console.warn(e); }
};
document.getElementById('reset').onclick = () => { agents.forEach(a => a.mlp = createMLP()); };
initAgents();
update();
// Load sealed if any
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f715', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => { if (req.result) agents.forEach(a => a.mlp = req.result.mlp); };
  } catch (e) { console.debug("lab f715-web-audio-panner-orientation-mlp-mind:", e); }
})();

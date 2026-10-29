const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gazeEl = document.getElementById('gaze');
const statusEl = document.getElementById('status');
let w, h;
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

// Tiny Elman RNN per agent
function makeRNN() {
  const i=4, hid=6, o=3;
  const rand = () => (Math.random()-0.5)*0.4;
  return {
    Wxh: Array.from({length:hid}, () => Array.from({length:i}, rand)),
    Whh: Array.from({length:hid}, () => Array.from({length:hid}, rand)),
    Why: Array.from({length:o}, () => Array.from({length:hid}, rand)),
    bh: Array(hid).fill(0),
    by: Array(o).fill(0),
    h: Array(hid).fill(0)
  };
}
function forward(rnn, x) {
  const {Wxh, Whh, Why, bh, by, h} = rnn;
  const nh = Array(h.length).fill(0);
  for (let j=0; j<h.length; j++) {
    let s = bh[j];
    for (let k=0; k<x.length; k++) s += Wxh[j][k] * x[k];
    for (let k=0; k<h.length; k++) s += Whh[j][k] * h[k];
    nh[j] = Math.tanh(s);
  }
  rnn.h = nh;
  const y = Array(Why.length).fill(0);
  for (let j=0; j<y.length; j++) {
    let s = by[j];
    for (let k=0; k<nh.length; k++) s += Why[j][k] * nh[k];
    y[j] = Math.tanh(s);
  }
  return y;
}
function cloneMutate(src, noise=0.05) {
  const dst = JSON.parse(JSON.stringify(src));
  const keys = ['Wxh','Whh','Why','bh','by'];
  keys.forEach(k => {
    if (Array.isArray(dst[k][0])) dst[k].forEach(row => row.forEach((_,i) => row[i] += (Math.random()-0.5)*noise));
    else dst[k].forEach((_,i) => dst[k][i] += (Math.random()-0.5)*noise);
  });
  dst.h = Array(dst.h.length).fill(0);
  return dst;
}

const N = 4;
const agents = Array.from({length:N}, (_,i) => ({
  id: i,
  rnn: makeRNN(),
  pos: {x: 200 + i*180, y: 200},
  fitness: 0,
  card: null
}));

// Create DOM cards
agents.forEach(a => {
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.innerHTML = `<h4>Mind ${a.id}</h4><div class="fit">fit: 0</div><div class="hid">h: ...</div>`;
  document.body.appendChild(card);
  a.card = card;
});

let gaze = {x: w/2, y: h/2, vx:0, vy:0};
let mode = 'pointer';
let xrSession = null;
let bestFitness = 0;

// Pointer fallback
let lastP = {x:0,y:0};
addEventListener('pointermove', e => {
  if (mode !== 'pointer') return;
  gaze.vx = (e.clientX - lastP.x) * 0.1;
  gaze.vy = (e.clientY - lastP.y) * 0.1;
  lastP = {x: e.clientX, y: e.clientY};
  gaze.x = e.clientX; gaze.y = e.clientY;
});

// DeviceOrientation fallback
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (mode === 'xr') return;
    if (e.beta != null) {
      mode = 'orientation';
      gaze.x = (e.gamma + 90) / 180 * w;
      gaze.y = (e.beta + 180) / 360 * h;
    }
  });
}

// WebXR
const xrBtn = document.getElementById('xrBtn');
xrBtn.onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    xrSession = await navigator.xr.requestSession(supported ? 'immersive-vr' : 'inline', {
      optionalFeatures: ['local-floor', 'bounded-floor']
    });
    mode = 'xr';
    xrBtn.textContent = 'Exit XR';
    xrSession.addEventListener('end', () => { xrSession = null; mode = 'pointer'; xrBtn.textContent = 'Enter WebXR'; });
    const loop = (t, frame) => {
      if (!xrSession) return;
      const pose = frame.getViewerPose(xrSession.viewerSpace || xrSession.referenceSpace);
      if (pose) {
        const o = pose.transform.orientation;
        gaze.x = w/2 + o.x * w * 0.4;
        gaze.y = h/2 + o.y * h * 0.4;
        gaze.vx = o.x * 2; gaze.vy = o.y * 2;
      }
      for (const src of xrSession.inputSources) {
        if (src.targetRayMode === 'gaze' && src.targetRaySpace) {
          const rayPose = frame.getPose(src.targetRaySpace, xrSession.referenceSpace || xrSession.viewerSpace);
          if (rayPose) {
            gaze.x = w/2 + rayPose.transform.position.x * 100;
            gaze.y = h/2 - rayPose.transform.position.y * 100;
          }
        }
      }
      xrSession.requestAnimationFrame(loop);
    };
    xrSession.requestAnimationFrame(loop);
  } catch (e) { console.warn(e); alert('XR failed: ' + e.message); }
};

function updateAgents() {
  const gx = (gaze.x / w - 0.5) * 2;
  const gy = (gaze.y / h - 0.5) * 2;
  agents.forEach(a => {
    const x = [gx, gy, gaze.vx*0.1, a.fitness*0.01];
    const y = forward(a.rnn, x);
    a.pos.x += y[0] * 8;
    a.pos.y += y[1] * 8;
    a.pos.x = Math.max(20, Math.min(w-160, a.pos.x));
    a.pos.y = Math.max(20, Math.min(h-100, a.pos.y));
    const scale = 0.8 + (y[2]+1)*0.3;
    a.card.style.left = a.pos.x + 'px';
    a.card.style.top = a.pos.y + 'px';
    a.card.style.transform = `scale(${scale})`;
    const dist = Math.hypot(a.pos.x + 70 - gaze.x, a.pos.y + 45 - gaze.y);
    a.fitness = Math.max(0, 100 - dist * 0.5);
    a.card.querySelector('.fit').textContent = `fit: ${a.fitness.toFixed(1)}`;
    a.card.querySelector('.hid').textContent = `h0: ${a.rnn.h[0].toFixed(2)}`;
    if (a.fitness > bestFitness) bestFitness = a.fitness;
  });
}

let transferTimer = 0;
function compete() {
  transferTimer++;
  if (transferTimer > 240) {
    transferTimer = 0;
    agents.sort((a,b) => b.fitness - a.fitness);
    const best = agents[0];
    for (let i=1; i<agents.length; i++) {
      agents[i].rnn = cloneMutate(best.rnn, 0.08);
      agents[i].fitness *= 0.7;
    }
    console.log('Genome transferred from', best.id);
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,w,h);
  gazeEl.style.display = 'block';
  gazeEl.style.left = gaze.x + 'px';
  gazeEl.style.top = gaze.y + 'px';
  ctx.strokeStyle = 'rgba(0,255,200,0.3)';
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.pos.x+70, a.pos.y+45, 6, 0, Math.PI*2);
    ctx.stroke();
  });
  statusEl.textContent = `Agents: ${N} | Mode: ${mode} | Best fitness: ${bestFitness.toFixed(1)} | Transfer in: ${Math.max(0,240-transferTimer)}`;
}

function loop() {
  updateAgents();
  compete();
  draw();
  requestAnimationFrame(loop);
}
loop();

// Seal to IndexedDB
const sealBtn = document.getElementById('sealBtn');
sealBtn.onclick = async () => {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const data = { id: best.id, weights: best.rnn, fitness: best.fitness, ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('void-gaze-rnn', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'best');
    await new Promise(r => tx.oncomplete = r);
    alert('Sealed best genome (agent ' + best.id + ')');
  } catch(e) { alert('IDB failed: ' + e.message); }
};

document.getElementById('transferBtn').onclick = () => { transferTimer = 999; };
document.getElementById('resetBtn').onclick = () => {
  agents.forEach(a => { a.rnn = makeRNN(); a.fitness = 0; a.pos = {x: Math.random()*w*0.6+100, y: Math.random()*h*0.6+100}; });
  bestFitness = 0;
};

// Load on start if present
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('void-gaze-rnn', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej();
    });
    const tx = db.transaction('genomes');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        agents[0].rnn = req.result.weights;
        console.log('Loaded sealed genome');
      }
    };
  } catch {}
})();

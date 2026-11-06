const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const W = 32, H = 24;
let cellW, cellH;
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  cellW = canvas.width / W;
  cellH = canvas.height / H;
}
resize();
addEventListener('resize', resize);

// LIF state
const V = new Float32Array(W * H);
const spike = new Uint8Array(W * H); // flash decay
let totalSpikes = 0;
const TAU = 20; // leak ms equiv
const TH = 1.0;
const RESET = 0.0;
const REST = 0.0;
const DT = 1.0 / 60;

function idx(x,y){ return y*W + x; }

function init() {
  for(let i=0;i<V.length;i++) V[i] = (Math.random()-0.5)*0.2;
  spike.fill(0);
  totalSpikes = 0;
}

// Orientation
let beta = 0, gamma = 0; // tilt
let mouseX = 0.5, mouseY = 0.5;
let useMouse = true;

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      beta = Math.max(-45, Math.min(45, e.beta || 0));
      gamma = Math.max(-45, Math.min(45, e.gamma || 0));
      useMouse = false;
    }
  });
}
canvas.addEventListener('mousemove', e => {
  mouseX = e.clientX / canvas.width;
  mouseY = e.clientY / canvas.height;
  if (useMouse) {
    beta = (mouseY - 0.5) * 60;
    gamma = (mouseX - 0.5) * 60;
  }
});

// Audio
let audioCtx, masterGain, muted = false;
const voices = [];
function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.15;
  masterGain.connect(audioCtx.destination);
}
function playSpike(x, y) {
  if (muted || !audioCtx || voices.length > 12) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner();
  osc.type = 'sine';
  osc.frequency.value = 180 + y * 18 + (Math.random()*10);
  panner.pan.value = (x / (W-1)) * 2 - 1;
  g.gain.setValueAtTime(0.3, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
  osc.connect(g); g.connect(panner); panner.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
  voices.push(osc);
  setTimeout(() => voices.shift(), 200);
}

// Update
function step() {
  // bias from orientation
  const edgeBias = Math.max(0, beta / 40); // more current when tilted back
  const sideBias = gamma / 80;

  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const i = idx(x,y);
      let I = 0;
      // edge injection
      if (x === 0) I += edgeBias * 0.8;
      if (x === W-1) I += edgeBias * 0.8;
      if (y === 0) I += sideBias * 0.5;
      if (y === H-1) I += -sideBias * 0.5;
      // neighbor excitatory (simple)
      let neigh = 0;
      if (x>0 && spike[idx(x-1,y)]>0) neigh += 0.35;
      if (x<W-1 && spike[idx(x+1,y)]>0) neigh += 0.35;
      if (y>0 && spike[idx(x,y-1)]>0) neigh += 0.35;
      if (y<H-1 && spike[idx(x,y+1)]>0) neigh += 0.35;
      I += neigh;

      // leaky integrate
      V[i] += DT * (-(V[i] - REST)/ (TAU*DT) + I);
      if (V[i] > TH) {
        V[i] = RESET;
        spike[i] = 8; // flash frames
        totalSpikes++;
        playSpike(x, y);
      } else if (spike[i] > 0) {
        spike[i]--;
      }
    }
  }
}

function render() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const i = idx(x,y);
      const s = spike[i];
      if (s > 0) {
        const a = s / 8;
        ctx.fillStyle = `rgba(100,200,255,${a})`;
        ctx.fillRect(x*cellW + 1, y*cellH + 1, cellW-2, cellH-2);
      } else if (V[i] > 0.4) {
        const a = Math.min(0.4, V[i]*0.3);
        ctx.fillStyle = `rgba(60,80,120,${a})`;
        ctx.fillRect(x*cellW + 2, y*cellH + 2, cellW-4, cellH-4);
      }
    }
  }
}

let last = 0, frames = 0, rate = 0;
function loop(t) {
  if (!last) last = t;
  const dt = t - last;
  last = t;
  step();
  render();
  frames++;
  if (frames % 30 === 0) {
    rate = totalSpikes;
    status.textContent = `spikes: ${totalSpikes} | β:${beta.toFixed(1)} γ:${gamma.toFixed(1)} | ${useMouse?'mouse':'device'}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// IndexedDB
const DB = 'f561-lif-mind';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('state','readwrite');
    tx.objectStore('state').put({V: Array.from(V), spikes: totalSpikes}, 'mind');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'Sealed to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed (in-memory)'; }
}
async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('state','readonly');
    const req = tx.objectStore('state').get('mind');
    req.onsuccess = () => {
      if (req.result) {
        const d = req.result;
        for(let i=0;i<V.length;i++) V[i] = d.V[i] || 0;
        totalSpikes = d.spikes || 0;
        status.textContent = 'Restored from seal';
      }
    };
  } catch(e) {}
}
load();

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { init(); status.textContent = 'Reset'; };
document.getElementById('pulse').onclick = () => {
  const cx = Math.floor(W/2), cy = Math.floor(H/2);
  V[idx(cx,cy)] = 1.5;
  V[idx(cx-1,cy)] = 1.2;
  V[idx(cx+1,cy)] = 1.2;
};
document.getElementById('mute').onclick = () => { muted = !muted; document.getElementById('mute').textContent = muted ? 'Unmute' : 'Mute'; };
canvas.addEventListener('click', ensureAudio);
document.body.addEventListener('click', ensureAudio);

init();
status.textContent = 'Move mouse or tilt · click to enable audio';

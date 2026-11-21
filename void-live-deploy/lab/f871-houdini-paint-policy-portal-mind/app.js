const workletCode = `
registerPaint('living-mind', class {
  static get inputProperties() {
    return ['--mind-freq', '--mind-phase', '--mind-density', '--mind-hue'];
  }
  paint(ctx, geom, props) {
    const freq = parseFloat(props.get('--mind-freq')) || 3;
    const phase = parseFloat(props.get('--mind-phase')) || 0;
    const density = parseFloat(props.get('--mind-density')) || 0.5;
    const hue = parseFloat(props.get('--mind-hue')) || 210;
    const w = geom.width, h = geom.height;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w * freq + phase;
        const ny = y / h * freq + phase * 0.7;
        const n = Math.sin(nx * 2) * Math.cos(ny * 3) * density;
        const v = Math.max(0, Math.min(1, (n + 1) * 0.5));
        const i = (y * w + x) * 4;
        data[i] = (hue / 360) * 255 * v;
        data[i+1] = 100 * v + 40;
        data[i+2] = 180 * v + 30;
        data[i+3] = 255 * (0.4 + v * 0.6);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
});
`;

let paintSupported = false;
try {
  const blob = new Blob([workletCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  CSS.paintWorklet.addModule(url).then(() => { paintSupported = true; log('Houdini paint worklet ready'); }).catch(e => { log('Worklet fail: ' + e.message); });
} catch (e) { log('Houdini unavailable'); }

const stage = document.getElementById('stage');
const logEl = document.getElementById('log');
function log(m) { logEl.textContent = m; }

const portals = [];
for (let i = 0; i < 5; i++) {
  const p = document.createElement('div');
  p.className = 'portal' + (paintSupported ? '' : ' fallback');
  p.style.left = (20 + i * 18) + '%';
  p.style.top = (30 + (i % 2) * 20) + '%';
  p.dataset.i = i;
  stage.appendChild(p);
  portals.push(p);
}

// Policy: 5 features → 4 actions
let W = new Float32Array(5 * 4);
for (let i = 0; i < W.length; i++) W[i] = (Math.random() - 0.5) * 0.4;
let params = [3, 0, 0.6, 210];
let lastReward = 0;
let dwell = 0;
let orient = {x: 0, y: 0};

function features() {
  const px = (window.mx || 0) / window.innerWidth * 2 - 1;
  const py = (window.my || 0) / window.innerHeight * 2 - 1;
  return [px, py, dwell, performance.now() / 10000 % 1, orient.x];
}

function policyStep() {
  const f = features();
  const out = new Float32Array(4);
  for (let o = 0; o < 4; o++) {
    let s = 0;
    for (let i = 0; i < 5; i++) s += f[i] * W[i * 4 + o];
    out[o] = Math.tanh(s);
  }
  params[0] = 2 + out[0] * 2;          // freq 2-4
  params[1] = out[1] * Math.PI;        // phase
  params[2] = 0.3 + (out[2] + 1) * 0.35; // density
  params[3] = 180 + out[3] * 80;       // hue
  portals.forEach(p => {
    p.style.setProperty('--mind-freq', params[0].toFixed(2));
    p.style.setProperty('--mind-phase', params[1].toFixed(2));
    p.style.setProperty('--mind-density', params[2].toFixed(2));
    p.style.setProperty('--mind-hue', params[3].toFixed(0));
  });
}

function updateWeights(reward) {
  const f = features();
  const lr = 0.05;
  for (let o = 0; o < 4; o++) {
    for (let i = 0; i < 5; i++) {
      W[i * 4 + o] += lr * reward * f[i];
    }
  }
  // soft clip
  for (let i = 0; i < W.length; i++) W[i] = Math.max(-1.5, Math.min(1.5, W[i]));
}

window.addEventListener('pointermove', e => { window.mx = e.clientX; window.my = e.clientY; dwell = Math.min(1, dwell + 0.01); });
window.addEventListener('pointerleave', () => dwell = 0);
portals.forEach(p => p.addEventListener('click', () => {
  const r = params[2] * 2 - 0.5; // reward from density
  updateWeights(r);
  lastReward = r;
  log('Reward ' + r.toFixed(2) + ' · sealed if high');
  if (r > 0.4) seal();
}));

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.x = (e.gamma || 0) / 90;
    orient.y = (e.beta || 0) / 180;
  });
}

// Persistence
const DB = 'verse-f871-houdini';
const BC = new BroadcastChannel('f871-genome');
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('s');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('s', 'readwrite');
    tx.objectStore('s').put({ W: Array.from(W), params }, 'genome');
    BC.postMessage({ W: Array.from(W), params });
    log('Sealed genome');
  } catch (e) { log('Seal fail'); }
}
BC.onmessage = e => { if (e.data.W) { W = new Float32Array(e.data.W); params = e.data.params; log('Adopted peer genome'); } };

async function load() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('s', 'readonly');
    const g = await new Promise(res => tx.objectStore('s').get('genome').onsuccess = e => res(e.target.result));
    if (g && g.W) { W = new Float32Array(g.W); params = g.params; log('Restored sealed genome'); }
  } catch (e) { console.debug("lab f871-houdini-paint-policy-portal-mind:", e); }
}
load();

setInterval(policyStep, 80);
policyStep();

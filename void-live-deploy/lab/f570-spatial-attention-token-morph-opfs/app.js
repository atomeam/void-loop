const NUM_PATHS = 6;
const TOKEN_LEN = 16;
const DIM = 4; // x,y,vx,t
let tokens = [];
let paths = [];
let weights = { q: Array(DIM).fill(0.5), k: Array(DIM).fill(0.5), v: Array(DIM).fill(0.5) };
let orient = { alpha:0, beta:0, gamma:0, enabled:false };
let opfsRoot = null;

async function initOPFS() {
  try {
    opfsRoot = await navigator.storage.getDirectory();
    const file = await opfsRoot.getFileHandle('f570-attention-morph.json', { create: false });
    const f = await file.getFile();
    const text = await f.text();
    const state = JSON.parse(text);
    tokens = state.tokens || [];
    weights = state.weights || weights;
    paths = state.paths || [];
    document.getElementById('status').textContent = 'Sealed state restored from OPFS';
    return true;
  } catch (e) {
    console.log('No OPFS seal or unavailable', e);
    return false;
  }
}

function randomPath(i) {
  const cx = 200 + (i % 3) * 300;
  const cy = 150 + Math.floor(i / 3) * 250;
  return {
    id: i,
    controls: Array.from({length:4}, () => ({x: cx + Math.random()*100-50, y: cy + Math.random()*80-40})),
    hue: Math.random()*360,
    width: 2 + Math.random()*3
  };
}

function initPaths() {
  paths = Array.from({length: NUM_PATHS}, (_,i) => randomPath(i));
  renderPaths();
}

function renderPaths() {
  const svg = document.getElementById('verse');
  svg.innerHTML = '';
  paths.forEach(p => {
    const d = `M ${p.controls[0].x} ${p.controls[0].y} C ${p.controls[1].x} ${p.controls[1].y}, ${p.controls[2].x} ${p.controls[2].y}, ${p.controls[3].x} ${p.controls[3].y}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'path');
    path.setAttribute('stroke', `hsl(${p.hue},70%,60%)`);
    path.setAttribute('stroke-width', p.width);
    svg.appendChild(path);
  });
}

function attentionStep(current) {
  if (tokens.length < 2) return;
  // Simple scaled dot-product attention
  const q = weights.q.map((w,i) => w * current[i]);
  let scores = tokens.map(t => {
    let dot = 0;
    for (let i=0; i<DIM; i++) dot += q[i] * weights.k[i] * t[i];
    return Math.exp(dot / Math.sqrt(DIM));
  });
  const sum = scores.reduce((a,b)=>a+b, 0.0001);
  scores = scores.map(s => s/sum);
  // Weighted sum of values
  let out = [0,0,0,0];
  tokens.forEach((t, idx) => {
    for (let i=0; i<DIM; i++) out[i] += scores[idx] * weights.v[i] * t[i];
  });
  // Project to path morphs
  paths.forEach((p, pi) => {
    const bias = (pi / NUM_PATHS) * 2 - 1;
    p.controls.forEach((c, ci) => {
      c.x += out[0] * 0.05 * (ci+1) + bias * out[2] * 2;
      c.y += out[1] * 0.05 * (ci+1) + bias * out[3] * 2;
      // bounds
      c.x = Math.max(20, Math.min(window.innerWidth-20, c.x));
      c.y = Math.max(20, Math.min(window.innerHeight-20, c.y));
    });
    p.hue = (p.hue + out[2]*10 + out[3]*5) % 360;
    p.width = Math.max(1, Math.min(8, p.width + out[1]*0.1));
  });
  renderPaths();
}

function pushToken(x, y, vx, vy) {
  const t = performance.now() / 1000 % 10;
  const token = [x/window.innerWidth, y/window.innerHeight, vx/50, t/10];
  if (orient.enabled) {
    token[0] += orient.beta / 180 * 0.2;
    token[1] += orient.gamma / 90 * 0.2;
  }
  tokens.push(token);
  if (tokens.length > TOKEN_LEN) tokens.shift();
  attentionStep(token);
}

let lastX = 0, lastY = 0;
document.addEventListener('pointermove', e => {
  const vx = e.clientX - lastX;
  const vy = e.clientY - lastY;
  pushToken(e.clientX, e.clientY, vx, vy);
  lastX = e.clientX; lastY = e.clientY;
});

document.getElementById('seal').onclick = async () => {
  if (!opfsRoot) {
    try { opfsRoot = await navigator.storage.getDirectory(); } catch(e) { alert('OPFS unavailable'); return; }
  }
  try {
    const file = await opfsRoot.getFileHandle('f570-attention-morph.json', { create: true });
    const writable = await file.createWritable();
    const state = { tokens, weights, paths, sealed: Date.now() };
    await writable.write(JSON.stringify(state));
    await writable.close();
    document.getElementById('status').textContent = 'Sealed to OPFS · ' + new Date().toLocaleTimeString();
  } catch(e) { console.error(e); alert('Seal failed'); }
};

document.getElementById('reset').onclick = () => {
  tokens = [];
  initPaths();
  document.getElementById('status').textContent = 'Reset · local mind cleared';
};

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') startOrient();
    });
  } else {
    startOrient();
  }
};

function startOrient() {
  orient.enabled = true;
  window.addEventListener('deviceorientation', e => {
    orient.alpha = e.alpha || 0;
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
  document.getElementById('status').textContent = 'Orientation causal bias enabled';
}

(async () => {
  const loaded = await initOPFS();
  if (!loaded) initPaths();
  else renderPaths();
  // idle tick
  setInterval(() => {
    if (tokens.length) attentionStep(tokens[tokens.length-1]);
  }, 100);
})();

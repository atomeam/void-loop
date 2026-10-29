const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const agentsEl = document.getElementById('agents');
const status = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Audio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();
function playTone(freq, dur = 0.12) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = Math.max(80, Math.min(1200, freq));
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}

// Orientation
let orient = { beta: 0, gamma: 0 };
let hasOrient = false;
document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') hasOrient = true;
    } catch(e) {}
  } else hasOrient = true;
  status.textContent = hasOrient ? 'Orientation active' : 'Using pointer fallback';
};
addEventListener('deviceorientation', e => {
  if (e.beta != null) { orient.beta = e.beta; orient.gamma = e.gamma; hasOrient = true; }
});

// Pointer fallback
let pointer = { x: W/2, y: H/2 };
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

// IndexedDB
const DB_NAME = 'f260-sealed';
const STORE = 'genomes';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveGenome(g) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({ id: 'champion', ...g, ts: Date.now() });
  return tx.complete;
}
async function loadGenome() {
  const db = await openDB();
  return new Promise(res => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get('champion');
    r.onsuccess = () => res(r.result);
  });
}

// BroadcastChannel for peer transfer (same-origin tabs)
const bc = new BroadcastChannel('f260-genome');
bc.onmessage = e => {
  if (e.data && e.data.weights) injectGenome(e.data.weights, e.data.hash);
};

// Simple hash
async function hashWeights(w) {
  const buf = new TextEncoder().encode(JSON.stringify(w));
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

// RNN: input 6, hidden 8, output 4
function makeRNN() {
  const ni=6, nh=8, no=4;
  const rand = () => (Math.random()-0.5)*0.8;
  return {
    Wxh: Array.from({length:nh*ni}, rand),
    Whh: Array.from({length:nh*nh}, rand),
    Why: Array.from({length:no*nh}, rand),
    bh: Array(nh).fill(0),
    by: Array(no).fill(0),
    h: Array(nh).fill(0)
  };
}
function rnnStep(rnn, x) {
  const nh=8, ni=6, no=4;
  const nh2 = new Array(nh).fill(0);
  for(let i=0;i<nh;i++) {
    let s = rnn.bh[i];
    for(let j=0;j<ni;j++) s += rnn.Wxh[i*ni+j] * x[j];
    for(let j=0;j<nh;j++) s += rnn.Whh[i*nh+j] * rnn.h[j];
    nh2[i] = Math.tanh(s);
  }
  rnn.h = nh2;
  const y = new Array(no).fill(0);
  for(let i=0;i<no;i++) {
    let s = rnn.by[i];
    for(let j=0;j<nh;j++) s += rnn.Why[i*nh+j] * rnn.h[j];
    y[i] = Math.tanh(s);
  }
  return y;
}
function cloneRNN(r) { return JSON.parse(JSON.stringify(r)); }
function mutateRNN(r, rate=0.15) {
  const m = cloneRNN(r);
  ['Wxh','Whh','Why','bh','by'].forEach(k => {
    m[k] = m[k].map(v => v + (Math.random()<rate ? (Math.random()-0.5)*0.4 : 0));
  });
  m.h = Array(8).fill(0);
  return m;
}

// Agents
const N = 5;
const agents = [];
function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = `A${i}`;
  el.style.setProperty('--hue', 180 + i*40);
  agentsEl.appendChild(el);
  const a = {
    id: i, el, rnn: makeRNN(),
    x: Math.random()* (W-100)+50, y: Math.random()*(H-100)+50,
    vx:0, vy:0, fitness: 0, hue: 180+i*40, freq: 220+i*40
  };
  el.onclick = () => {
    a.fitness += 1;
    playTone(a.freq);
    status.textContent = `Rewarded A${i} (fit ${a.fitness.toFixed(1)})`;
  };
  // Drag
  let dragging=false, ox=0, oy=0;
  el.onpointerdown = e => { dragging=true; ox=e.clientX-a.x; oy=e.clientY-a.y; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if(dragging){ a.x=e.clientX-ox; a.y=e.clientY-oy; a.vx=0; a.vy=0; } };
  el.onpointerup = () => dragging=false;
  return a;
}
for(let i=0;i<N;i++) agents.push(createAgent(i));

function injectGenome(weights, hash) {
  // Inject into lowest fitness
  agents.sort((a,b)=>a.fitness-b.fitness);
  const target = agents[0];
  target.rnn = mutateRNN({...target.rnn, ...weights}, 0.08);
  target.fitness = Math.max(0, target.fitness * 0.5);
  status.textContent = `Injected genome ${hash||'?'} into A${target.id}`;
}

// Competition loop
setInterval(async () => {
  agents.sort((a,b)=>b.fitness-a.fitness);
  const champ = agents[0];
  if (champ.fitness > 0.5) {
    const h = await hashWeights(champ.rnn);
    const payload = { weights: {Wxh:champ.rnn.Wxh, Whh:champ.rnn.Whh, Why:champ.rnn.Why, bh:champ.rnn.bh, by:champ.rnn.by}, hash:h, fit:champ.fitness };
    bc.postMessage(payload);
    await saveGenome(payload);
    status.textContent = `Sealed champion A${champ.id} hash ${h} (fit ${champ.fitness.toFixed(1)})`;
    // Mutate losers
    for(let i=2;i<agents.length;i++) agents[i].rnn = mutateRNN(champ.rnn, 0.2);
  }
  // Decay fitness slightly
  agents.forEach(a => a.fitness *= 0.95);
}, 6000);

document.getElementById('seal').onclick = async () => {
  agents.sort((a,b)=>b.fitness-a.fitness);
  const champ = agents[0];
  const h = await hashWeights(champ.rnn);
  const payload = { weights: {Wxh:champ.rnn.Wxh, Whh:champ.rnn.Whh, Why:champ.rnn.Why, bh:champ.rnn.bh, by:champ.rnn.by}, hash:h, fit:champ.fitness };
  await saveGenome(payload);
  bc.postMessage(payload);
  status.textContent = `Manual seal A${champ.id} ${h}`;
};
document.getElementById('load').onclick = async () => {
  const g = await loadGenome();
  if (g && g.weights) injectGenome(g.weights, g.hash);
  else status.textContent = 'No sealed genome';
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.rnn = makeRNN(); a.fitness=0; a.x=Math.random()*(W-100)+50; a.y=Math.random()*(H-100)+50; });
  status.textContent = 'Reset';
};

// Physics + step
function step() {
  const tiltX = hasOrient ? (orient.gamma / 45) : (pointer.x - W/2) / (W/2);
  const tiltY = hasOrient ? (orient.beta / 45) : (pointer.y - H/2) / (H/2);
  agents.forEach(a => {
    const nx = (a.x / W) * 2 - 1;
    const ny = (a.y / H) * 2 - 1;
    const input = [tiltX, tiltY, nx, ny, Math.tanh(a.fitness/10), Math.sin(Date.now()/1000 + a.id)];
    const out = rnnStep(a.rnn, input);
    // out: fx, fy, hueDelta, freqDelta
    a.vx += out[0] * 0.8 + tiltX * 0.3;
    a.vy += out[1] * 0.8 + tiltY * 0.3;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    a.x = Math.max(40, Math.min(W-40, a.x));
    a.y = Math.max(40, Math.min(H-40, a.y));
    a.hue = (a.hue + out[2]*8 + 360) % 360;
    a.freq = 180 + ((a.freq + out[3]*30 + 1000) % 800);
    a.el.style.left = (a.x - 40) + 'px';
    a.el.style.top = (a.y - 40) + 'px';
    a.el.style.setProperty('--hue', a.hue);
    a.el.style.transform = `scale(${1 + Math.min(0.4, a.fitness*0.05)})`;
    a.el.textContent = `A${a.id}\n${a.fitness.toFixed(1)}`;
  });

  // Canvas viz: trails + hidden bars
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(100,180,255,0.3)';
  ctx.lineWidth = 1;
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6, 0, Math.PI*2);
    ctx.stroke();
    // hidden activation bars
    const bx = a.x - 20, by = a.y + 50;
    a.rnn.h.forEach((v,i) => {
      ctx.fillStyle = `hsl(${a.hue},60%,${50+v*30}%)`;
      ctx.fillRect(bx + i*5, by, 4, -v*20);
    });
  });
  requestAnimationFrame(step);
}
step();

// Init status
status.textContent = 'Click Request Orientation or drag agents. Click to reward.';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const status = document.getElementById('status');
let w, h;
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

// Simple MLP: 3 inputs (beta, gamma, stability) -> 1 output (stickiness 0-1)
let weights = [0.1, 0.1, -0.2]; // input to output
let bias = 0.5;
let learningRate = 0.01;
function mlpForward(inputs) {
  let sum = bias;
  for (let i = 0; i < 3; i++) sum += weights[i] * inputs[i];
  return 1 / (1 + Math.exp(-sum)); // sigmoid
}
function mlpUpdate(inputs, target) {
  const pred = mlpForward(inputs);
  const err = target - pred;
  for (let i = 0; i < 3; i++) weights[i] += learningRate * err * inputs[i] * pred * (1 - pred);
  bias += learningRate * err * pred * (1 - pred);
  return pred;
}

// Tiles
const tiles = [];
const NUM = 8;
for (let i = 0; i < NUM; i++) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.textContent = 'Tile ' + (i+1);
  stage.appendChild(el);
  tiles.push({
    el,
    x: 100 + Math.random() * (innerWidth - 200),
    y: 100 + Math.random() * (innerHeight - 200),
    vx: 0, vy: 0,
    stick: 0.5
  });
}

let beta = 0, gamma = 0; // orientation
let hasOrient = false;
let stability = 0.5;

function requestOrient() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') addEventListener('deviceorientation', onOrient);
    });
  } else {
    addEventListener('deviceorientation', onOrient);
  }
  hasOrient = true;
  status.textContent = 'Orientation active. Tilt the device.';
}
document.getElementById('perm').onclick = requestOrient;

function onOrient(e) {
  beta = e.beta || 0; // -180 to 180
  gamma = e.gamma || 0;
}

// Mouse simulate
let mouseDown = false, mx=0, my=0;
addEventListener('mousedown', e => { mouseDown=true; mx=e.clientX; my=e.clientY; });
addEventListener('mouseup', () => mouseDown=false);
addEventListener('mousemove', e => {
  if (mouseDown) {
    beta = (e.clientY - my) * 0.5;
    gamma = (e.clientX - mx) * 0.5;
  }
});

// IndexedDB
let db;
const req = indexedDB.open('void-f293', 1);
req.onupgradeneeded = e => {
  const d = e.target.result;
  if (!d.objectStoreNames.contains('state')) d.createObjectStore('state');
};
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('state', 'readonly');
  const store = tx.objectStore('state');
  const get = store.get('weights');
  get.onsuccess = () => {
    if (get.result) {
      weights = get.result.weights || weights;
      bias = get.result.bias || bias;
      tiles.forEach((t,i) => {
        if (get.result.tiles && get.result.tiles[i]) {
          t.x = get.result.tiles[i].x;
          t.y = get.result.tiles[i].y;
        }
      });
      status.textContent += ' Restored from IndexedDB.';
    }
  };
};

function saveState() {
  if (!db) return;
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put({
    weights, bias,
    tiles: tiles.map(t => ({x:t.x, y:t.y}))
  }, 'weights');
}

document.getElementById('reset').onclick = () => {
  weights = [0.1,0.1,-0.2]; bias=0.5;
  tiles.forEach(t => { t.x = 100+Math.random()*(w-200); t.y=100+Math.random()*(h-200); t.vx=0; t.vy=0; });
  saveState();
};

// Loop
let last = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - last)/1000 || 0.016);
  last = t;

  // Canvas bg: simple gradient tilt
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,w,h);
  const g = ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0, `hsl(${(beta+90)%360},50%,15%)`);
  g.addColorStop(1, `hsl(${(gamma+180)%360},50%,10%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // Physics
  const gScale = 0.5;
  const ax = gamma * gScale * 0.1;
  const ay = beta * gScale * 0.1;
  let totalSpeed = 0;
  tiles.forEach(t => {
    t.vx += ax * dt * 60;
    t.vy += ay * dt * 60;
    const damp = 0.98 - t.stick * 0.3;
    t.vx *= damp;
    t.vy *= damp;
    t.x += t.vx;
    t.y += t.vy;
    // bounds
    if (t.x < 0) { t.x=0; t.vx*=-0.5; }
    if (t.x > w-80) { t.x=w-80; t.vx*=-0.5; }
    if (t.y < 0) { t.y=0; t.vy*=-0.5; }
    if (t.y > h-60) { t.y=h-60; t.vy*=-0.5; }
    t.el.style.left = t.x + 'px';
    t.el.style.top = t.y + 'px';
    totalSpeed += Math.hypot(t.vx, t.vy);
  });
  stability = Math.max(0, 1 - totalSpeed / (NUM * 5));

  // MLP update: target higher stickiness when unstable
  const inputs = [beta/90, gamma/90, stability];
  const target = 1 - stability; // learn to stick more when unstable
  const stick = mlpUpdate(inputs, target);
  tiles.forEach(t => {
    t.stick = stick;
    t.el.style.background = `rgba(${40+stick*100}, ${60}, ${100+stick*50}, 0.7)`;
  });

  status.textContent = `beta:${beta.toFixed(1)} gamma:${gamma.toFixed(1)} stick:${stick.toFixed(2)} stab:${stability.toFixed(2)}`;
  if (Math.random() < 0.02) saveState(); // periodic save

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

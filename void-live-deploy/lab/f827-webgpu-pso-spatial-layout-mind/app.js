const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 8;
const cards = [];
for (let i = 0; i < N; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = 'Card ' + (i+1);
  el.style.left = (100 + i*30) + 'px';
  el.style.top = (100 + i*40) + 'px';
  document.body.appendChild(el);
  cards.push({ el, x: 100+i*30, y: 100+i*40, vx: 0, vy: 0, bestX: 0, bestY: 0, bestFit: -1e9 });
  makeDraggable(el, cards[cards.length-1]);
}

let gBestX = 400, gBestY = 300, gBestFit = -1e9;
let attractors = [];
let orient = { beta: 0, gamma: 0 };
let fitness = 0;

function makeDraggable(el, card) {
  let dx, dy;
  el.onpointerdown = e => {
    dx = e.clientX - card.x; dy = e.clientY - card.y;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (e.buttons) {
      card.x = e.clientX - dx; card.y = e.clientY - dy;
      el.style.left = card.x + 'px'; el.style.top = card.y + 'px';
    }
  };
}

addEventListener('click', e => {
  if (e.target.classList.contains('card') || e.target.tagName === 'BUTTON') return;
  attractors.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (attractors.length > 5) attractors.shift();
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
  });
}

function computeFitness(card) {
  let f = 0;
  // attractor proximity
  attractors.forEach(a => {
    const d = Math.hypot(card.x - a.x, card.y - a.y);
    f += 200 / (d + 20);
  });
  // orientation bias (prefer down-tilt direction)
  const prefX = Math.sin(orient.gamma * Math.PI/180) * 100;
  const prefY = Math.sin(orient.beta * Math.PI/180) * 100;
  f -= Math.hypot(card.x - (innerWidth/2 + prefX), card.y - (innerHeight/2 + prefY)) * 0.05;
  // non-overlap simple
  cards.forEach(o => {
    if (o === card) return;
    const d = Math.hypot(card.x - o.x, card.y - o.y);
    if (d < 140) f -= (140 - d) * 0.5;
  });
  return f;
}

function psoStep() {
  const w = 0.7, c1 = 1.4, c2 = 1.4;
  cards.forEach(card => {
    const fit = computeFitness(card);
    if (fit > card.bestFit) { card.bestFit = fit; card.bestX = card.x; card.bestY = card.y; }
    if (fit > gBestFit) { gBestFit = fit; gBestX = card.x; gBestY = card.y; }
    // velocity
    const r1 = Math.random(), r2 = Math.random();
    card.vx = w * card.vx + c1 * r1 * (card.bestX - card.x) + c2 * r2 * (gBestX - card.x);
    card.vy = w * card.vy + c1 * r1 * (card.bestY - card.y) + c2 * r2 * (gBestY - card.y);
    card.vx *= 0.95; card.vy *= 0.95;
    card.x += card.vx * 0.5; card.y += card.vy * 0.5;
    // clamp
    card.x = Math.max(20, Math.min(innerWidth - 140, card.x));
    card.y = Math.max(20, Math.min(innerHeight - 100, card.y));
    card.el.style.left = card.x + 'px';
    card.el.style.top = card.y + 'px';
    card.el.style.transform = `scale(${1 + Math.min(0.2, Math.max(0, fit)/500)})`;
  });
  fitness = gBestFit;
}

function draw() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // attractors
  attractors.forEach(a => {
    ctx.fillStyle = 'rgba(255,128,0,0.4)';
    ctx.beginPath(); ctx.arc(a.x, a.y, 30, 0, 7); ctx.fill();
  });
  // swarm trails simple
  cards.forEach(c => {
    ctx.fillStyle = 'rgba(100,150,255,0.3)';
    ctx.beginPath(); ctx.arc(c.x + 60, c.y + 40, 8, 0, 7); ctx.fill();
  });
  document.getElementById('status').innerHTML = `F827 PSO Layout | Fitness: ${fitness.toFixed(1)} | <button id="seal">Seal</button> <button id="reset">Reset</button> <button id="download">JSON</button>`;
  // rebind buttons
  document.getElementById('seal').onclick = seal;
  document.getElementById('reset').onclick = reset;
  document.getElementById('download').onclick = download;
}

function seal() {
  const data = { positions: cards.map(c => ({x:c.x,y:c.y})), fitness: gBestFit, t: Date.now() };
  try {
    const req = indexedDB.open('f827-pso-layout', 1);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('layouts', 'readwrite');
      tx.objectStore('layouts').put(data, 'best');
    };
    req.onupgradeneeded = e => e.target.result.createObjectStore('layouts');
  } catch (e) { console.debug("lab f827-webgpu-pso-spatial-layout-mind:", e); }
  try {
    const bc = new BroadcastChannel('f827-genome');
    bc.postMessage(data);
  } catch (e) { console.debug("lab f827-webgpu-pso-spatial-layout-mind:", e); }
  alert('Sealed layout (fitness ' + gBestFit.toFixed(1) + ')');
}

function reset() {
  cards.forEach((c,i) => {
    c.x = 100 + i*40; c.y = 100 + i*50;
    c.vx = c.vy = 0; c.bestFit = -1e9;
  });
  gBestFit = -1e9; attractors = [];
}

function download() {
  const data = { positions: cards.map(c => ({x:c.x,y:c.y,label:c.el.textContent})), fitness: gBestFit };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f827-layout.json';
  a.click();
}

function loop() {
  psoStep();
  draw();
  requestAnimationFrame(loop);
}
loop();

// listen for genome
try {
  const bc = new BroadcastChannel('f827-genome');
  bc.onmessage = e => {
    if (e.data.fitness > gBestFit) {
      // adopt
      e.data.positions.forEach((p,i) => { if (cards[i]) { cards[i].x = p.x; cards[i].y = p.y; } });
      gBestFit = e.data.fitness;
    }
  };
} catch (e) { console.debug("lab f827-webgpu-pso-spatial-layout-mind:", e); }

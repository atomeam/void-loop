const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const svg = document.getElementById('svg');
const status = document.getElementById('status');
function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  svg.setAttribute('width', innerWidth); svg.setAttribute('height', innerHeight);
}
resize(); addEventListener('resize', resize);

const N = 7;
const cards = [];
for (let i = 0; i < N; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<h3>Memory ${i+1}</h3><p contenteditable="true">Double-click to edit. Drag me. Click to reward.</p>`;
  el.style.left = (80 + (i%4)*180) + 'px';
  el.style.top = (120 + Math.floor(i/4)*140) + 'px';
  document.body.appendChild(el);
  cards.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, fitness:0 });
}

let orient = { beta:0, gamma:0 };
let ptr = { x:0, y:0, vx:0, vy:0 };
let lastPtr = { x:0, y:0, t:0 };
let weights = Array(18).fill(0).map(() => (Math.random()-0.5)*0.3);
let fitness = 0;
const KEY = 'verse-f623';
const bc = new BroadcastChannel('f623-genome');

function mlp(input) {
  const h = [0,0,0,0];
  for (let i=0;i<4;i++) {
    let s = weights[i*6];
    for (let j=0;j<6;j++) s += weights[i*6+j+1]*input[j];
    h[i] = Math.tanh(s);
  }
  const o = [0,0,0];
  for (let i=0;i<3;i++) {
    let s = weights[24+i*4];
    for (let j=0;j<4;j++) s += weights[24+i*4+j+1]*h[j];
    o[i] = Math.tanh(s);
  }
  return o;
}

function updateMLP(reward) {
  const input = getInput();
  const out = mlp(input);
  for (let i=0;i<weights.length;i++) {
    weights[i] += 0.002 * reward * (Math.random()-0.5) * Math.abs(out[i%3]||0.1);
    weights[i] = Math.max(-2, Math.min(2, weights[i]));
  }
  fitness = Math.max(0, fitness * 0.98 + reward * 0.1);
}

function getInput() {
  return [
    orient.beta/90, orient.gamma/90,
    ptr.vx/20, ptr.vy/20,
    (ptr.x/innerWidth)*2-1, (ptr.y/innerHeight)*2-1
  ];
}

function drawResidual() {
  ctx.fillStyle = '#0d0d0f';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const input = getInput();
  const mag = Math.hypot(...input);
  ctx.fillStyle = `hsla(${200 + mag*40},60%,50%,0.08)`;
  for (let x=0;x<canvas.width;x+=40) {
    for (let y=0;y<canvas.height;y+=40) {
      const d = Math.hypot(x-ptr.x, y-ptr.y)/300;
      ctx.globalAlpha = Math.max(0, 0.15 - d*0.1);
      ctx.fillRect(x,y,36,36);
    }
  }
  ctx.globalAlpha = 1;
}

function updateConnections() {
  svg.innerHTML = '';
  const out = mlp(getInput());
  for (let i=0;i<cards.length;i++) {
    for (let j=i+1;j<cards.length;j++) {
      const a = cards[i], b = cards[j];
      const dist = Math.hypot(a.x-b.x, a.y-b.y);
      if (dist < 280) {
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1', a.x+70); line.setAttribute('y1', a.y+40);
        line.setAttribute('x2', b.x+70); line.setAttribute('y2', b.y+40);
        line.setAttribute('stroke', `hsla(${180+out[0]*60},70%,60%,${0.4-dist/700})`);
        line.setAttribute('stroke-width', 1 + Math.abs(out[1])*2);
        svg.appendChild(line);
      }
    }
  }
}

function step() {
  const input = getInput();
  const out = mlp(input);
  cards.forEach((c,i) => {
    const biasX = out[0] * 0.8 + (orient.gamma||0)*0.02;
    const biasY = out[1] * 0.8 + (orient.beta||0)*0.02;
    c.vx = c.vx*0.92 + biasX;
    c.vy = c.vy*0.92 + biasY;
    c.x += c.vx; c.y += c.vy;
    c.x = Math.max(10, Math.min(innerWidth-150, c.x));
    c.y = Math.max(60, Math.min(innerHeight-100, c.y));
    c.el.style.left = c.x+'px';
    c.el.style.top = c.y+'px';
    c.el.style.transform = `scale(${0.85 + Math.abs(out[2])*0.3}) rotate(${out[0]*8}deg)`;
    c.el.style.borderColor = `hsl(${200 + out[1]*40},50%,40%)`;
  });
  drawResidual();
  updateConnections();
  status.textContent = `fit ${fitness.toFixed(2)} · β ${orient.beta.toFixed(0)}° γ ${orient.gamma.toFixed(0)}°`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

addEventListener('pointermove', e => {
  const t = performance.now();
  if (lastPtr.t) {
    ptr.vx = (e.clientX - lastPtr.x) / Math.max(1, t-lastPtr.t) * 16;
    ptr.vy = (e.clientY - lastPtr.y) / Math.max(1, t-lastPtr.t) * 16;
  }
  ptr.x = e.clientX; ptr.y = e.clientY;
  lastPtr = {x:e.clientX, y:e.clientY, t};
});

if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
  document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(p => {
    if (p==='granted') addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
  }).catch(()=>{}), {once:true});
} else {
  addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
}

cards.forEach(c => {
  let dragging = false, ox=0, oy=0;
  c.el.addEventListener('pointerdown', e => {
    if (e.target.isContentEditable) return;
    dragging = true; ox = e.clientX - c.x; oy = e.clientY - c.y;
    c.el.setPointerCapture(e.pointerId);
  });
  c.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    c.x = e.clientX - ox; c.y = e.clientY - oy;
  });
  c.el.addEventListener('pointerup', e => {
    dragging = false;
    if (Math.hypot(e.movementX, e.movementY) < 4) {
      updateMLP(1.2);
      c.fitness += 1;
      c.el.style.boxShadow = '0 0 20px #7ec8e3';
      setTimeout(() => c.el.style.boxShadow = '', 300);
    }
  });
});

document.getElementById('seal').onclick = async () => {
  const db = await idb();
  const tx = db.transaction('store','readwrite');
  tx.objectStore('store').put({ weights, fitness, ts:Date.now() }, KEY);
  bc.postMessage({ weights, fitness, hash: weights.slice(0,4).reduce((a,b)=>a+b,0).toFixed(3) });
  status.textContent = 'sealed';
};
document.getElementById('restore').onclick = async () => {
  const db = await idb();
  const req = db.transaction('store').objectStore('store').get(KEY);
  req.onsuccess = () => {
    if (req.result) { weights = req.result.weights; fitness = req.result.fitness; status.textContent = 'restored'; }
  };
};
document.getElementById('reset').onclick = () => {
  weights = weights.map(() => (Math.random()-0.5)*0.3);
  fitness = 0;
  status.textContent = 'reset';
};

bc.onmessage = e => {
  if (e.data.fitness > fitness + 0.5) {
    weights = e.data.weights;
    fitness = e.data.fitness * 0.9;
    status.textContent = 'migrated higher genome';
  }
};

function idb() {
  return new Promise((res,rej) => {
    const r = indexedDB.open('verse-f623',1);
    r.onupgradeneeded = () => r.result.createObjectStore('store');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

idb().then(db => {
  const req = db.transaction('store').objectStore('store').get(KEY);
  req.onsuccess = () => { if (req.result) { weights = req.result.weights; fitness = req.result.fitness; } };
});

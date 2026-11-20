const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

let axiom = 'F';
let rules = { 'F': 'F[+F]F[-F]F' };
let angle = 25;
let step = 8;
let iterations = 5;
let currentString = '';
let growth = [];
let orient = { beta:0, gamma:0 };
let pointerBias = 0;

function rewrite() {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const c of s) next += rules[c] || c;
    s = next;
    if (s.length > 8000) break;
  }
  currentString = s;
  growth = [];
  // simple turtle to collect segments
  let x = canvas.width/2, y = canvas.height*0.7, a = -Math.PI/2;
  const stack = [];
  for (const c of s) {
    if (c === 'F' || c === 'G') {
      const nx = x + Math.cos(a)*step, ny = y + Math.sin(a)*step;
      growth.push({x1:x, y1:y, x2:nx, y2:ny});
      x = nx; y = ny;
    } else if (c === '+') a += (angle + pointerBias)*Math.PI/180;
    else if (c === '-') a -= (angle - pointerBias)*Math.PI/180;
    else if (c === '[') stack.push({x,y,a});
    else if (c === ']') { const s = stack.pop(); if(s){x=s.x;y=s.y;a=s.a;} }
  }
}

function mutate() {
  const keys = Object.keys(rules);
  if (!keys.length) return;
  const k = keys[Math.floor(Math.random()*keys.length)];
  let r = rules[k];
  const ops = ['F','+','-','[',']'];
  const idx = Math.floor(Math.random() * (r.length+1));
  const op = ops[Math.floor(Math.random()*ops.length)];
  if (Math.random() < 0.5 && r.length > 3) r = r.slice(0,idx) + r.slice(idx+1);
  else r = r.slice(0,idx) + op + r.slice(idx);
  rules[k] = r.slice(0,40);
  status.textContent = `mutated ${k} → ${rules[k]}`;
  rewrite();
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#6af';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const g of growth) {
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
  }
  ctx.stroke();
  // bias indicator
  ctx.fillStyle = '#f6a';
  ctx.fillRect(20, canvas.height-20, 10+Math.abs(pointerBias)*2, 4);
}

function loop() {
  rewrite();
  draw();
  requestAnimationFrame(loop);
}
loop();

canvas.addEventListener('pointerdown', e => {
  pointerBias = (e.clientX / canvas.width - 0.5) * 40;
  mutate();
});
canvas.addEventListener('pointermove', e => {
  if (e.buttons) pointerBias = (e.clientX / canvas.width - 0.5) * 30;
});

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
    pointerBias = (orient.gamma || 0) * 0.4;
  });
}

document.getElementById('seal').onclick = async () => {
  const genome = { axiom, rules, angle, step, iterations };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f849-lsystem',1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(genome, 'current');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'sealed to IndexedDB';
    try { new BroadcastChannel('f849-genome').postMessage(genome); } catch (e) { console.debug("lab f849-webgpu-lsystem-spatial-growth-mind:", e); }
  } catch(e) { status.textContent = 'seal failed (session only)'; }
};

document.getElementById('reset').onclick = () => {
  rules = { 'F': 'F[+F]F[-F]F' };
  axiom = 'F';
  rewrite();
  status.textContent = 'reset';
};

// restore if any
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f849-lsystem',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readonly');
    const g = await new Promise(r => {
      const req = tx.objectStore('genomes').get('current');
      req.onsuccess = () => r(req.result);
    });
    if (g) { Object.assign({axiom,rules,angle,step,iterations}, g); status.textContent = 'restored genome'; }
  } catch (e) { console.debug("lab f849-webgpu-lsystem-spatial-growth-mind:", e); }
})();

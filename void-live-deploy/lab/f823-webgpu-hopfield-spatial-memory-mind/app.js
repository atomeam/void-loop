const N_PORTALS = 6;
const DIM = N_PORTALS * 2; // x,y each
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
let W = new Float32Array(DIM * DIM); // weight matrix
let patterns = [];
let state = new Float32Array(DIM);
let portals = [];
let pointer = {x:0, y:0, active:false};
let w, h;

function resize() {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function rand(a,b){ return a + Math.random()*(b-a); }

function createPortals() {
  for(let i=0; i<N_PORTALS; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.contentEditable = true;
    el.innerHTML = `Portal ${i+1}<br><small>drag me</small>`;
    el.style.left = rand(40, w-180) + 'px';
    el.style.top = rand(80, h-140) + 'px';
    portalsEl.appendChild(el);
    portals.push({el, x:0, y:0, vx:0, vy:0});
    // drag
    let ox, oy, dragging=false;
    el.addEventListener('pointerdown', e => {
      dragging=true; ox=e.clientX - parseFloat(el.style.left); oy=e.clientY - parseFloat(el.style.top);
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if(!dragging) return;
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
    });
    el.addEventListener('pointerup', () => dragging=false);
  }
}
createPortals();

function getState() {
  for(let i=0; i<N_PORTALS; i++) {
    const r = portals[i].el.getBoundingClientRect();
    state[i*2] = (r.left + 70) / w * 2 - 1;
    state[i*2+1] = (r.top + 45) / h * 2 - 1;
  }
  return state;
}

function hebbianUpdate(s) {
  // outer product, zero diagonal
  for(let i=0; i<DIM; i++) {
    for(let j=0; j<DIM; j++) {
      if(i!==j) W[i*DIM + j] += s[i] * s[j];
    }
  }
  // normalize slightly
  for(let i=0; i<W.length; i++) W[i] *= 0.98;
}

function recallStep() {
  getState();
  const h_field = new Float32Array(DIM);
  for(let i=0; i<DIM; i++) {
    let sum = 0;
    for(let j=0; j<DIM; j++) sum += W[i*DIM + j] * state[j];
    // pointer bias: if near a portal component
    const px = (pointer.x / w)*2 -1;
    const py = (pointer.y / h)*2 -1;
    if(i%2===0) sum += (pointer.active ? 0.4 : 0) * (px - state[i]);
    else sum += (pointer.active ? 0.4 : 0) * (py - state[i]);
    h_field[i] = sum;
  }
  // soft update + blend positions
  for(let i=0; i<N_PORTALS; i++) {
    const tx = Math.tanh(h_field[i*2]) * 0.5 + 0.5;
    const ty = Math.tanh(h_field[i*2+1]) * 0.5 + 0.5;
    const el = portals[i].el;
    const curX = parseFloat(el.style.left) || 0;
    const curY = parseFloat(el.style.top) || 0;
    const targetX = tx * (w - 140);
    const targetY = ty * (h - 90);
    el.style.left = (curX * 0.92 + targetX * 0.08) + 'px';
    el.style.top = (curY * 0.92 + targetY * 0.08) + 'px';
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,w,h);
  // simple energy visualization: particles or lines between portals colored by affinity
  getState();
  for(let i=0; i<N_PORTALS; i++) {
    for(let j=i+1; j<N_PORTALS; j++) {
      const affinity = Math.abs(W[(i*2)*DIM + (j*2)] + W[(i*2+1)*DIM + (j*2+1)]);
      ctx.strokeStyle = `hsla(${200 + affinity*40}, 70%, 60%, ${Math.min(0.4, affinity)})`;
      ctx.lineWidth = 1 + affinity*2;
      const r1 = portals[i].el.getBoundingClientRect();
      const r2 = portals[j].el.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(r1.left+70, r1.top+45);
      ctx.lineTo(r2.left+70, r2.top+45);
      ctx.stroke();
    }
  }
  // pointer probe
  if(pointer.active) {
    ctx.fillStyle = 'rgba(100,180,255,0.3)';
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 30, 0, Math.PI*2); ctx.fill();
  }
}

function loop() {
  recallStep();
  draw();
  requestAnimationFrame(loop);
}
loop();

addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; pointer.active=true; });
addEventListener('pointerdown', e => { pointer.active=true; });
addEventListener('pointerup', () => pointer.active=false);

document.getElementById('imprint').onclick = () => {
  const s = getState().slice();
  patterns.push(s);
  hebbianUpdate(s);
  statusEl.textContent = `Imprinted pattern #${patterns.length}. Attractors active.`;
};

document.getElementById('clear').onclick = () => {
  W.fill(0); patterns=[];
  statusEl.textContent = 'Memories cleared.';
};

document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f823', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('mem');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem','readwrite');
    tx.objectStore('mem').put({W: Array.from(W), patterns, html: portals.map(p=>p.el.innerHTML)}, 'genome');
    await new Promise(r => tx.oncomplete=r);
    statusEl.textContent = 'Genome sealed to IndexedDB.';
  } catch(e) { statusEl.textContent = 'Seal failed (IDB blocked?)'; }
};

// restore
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f823', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem','readonly');
    const req = tx.objectStore('mem').get('genome');
    req.onsuccess = () => {
      if(req.result) {
        const g = req.result;
        W.set(g.W);
        patterns = g.patterns || [];
        g.html.forEach((h,i) => { if(portals[i]) portals[i].el.innerHTML = h; });
        statusEl.textContent = `Restored ${patterns.length} patterns.`;
      }
    };
  } catch (e) { console.debug("lab f823-webgpu-hopfield-spatial-memory-mind:", e); }
})();

// WebGPU stub: if available, we could enhance visualization, but pure JS dynamics are primary
if(navigator.gpu) {
  statusEl.textContent += ' | WebGPU available (visualization path ready)';
}

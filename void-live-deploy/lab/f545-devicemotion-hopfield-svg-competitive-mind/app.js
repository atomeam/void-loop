const N = 64;
const NUM_AGENTS = 7;
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');

// Hopfield weights (symmetric, zero diagonal)
let W = Array.from({length:N}, () => Array(N).fill(0));
let patterns = [];
let agents = [];

function randomPattern() {
  return Array.from({length:N}, () => Math.random() > 0.5 ? 1 : -1);
}

function hebbianUpdate(p, lr=0.1) {
  for (let i=0; i<N; i++) {
    for (let j=i+1; j<N; j++) {
      const d = lr * p[i] * p[j];
      W[i][j] += d;
      W[j][i] += d;
    }
  }
  // normalize roughly
  for (let i=0; i<N; i++) for (let j=0; j<N; j++) W[i][j] = Math.max(-1, Math.min(1, W[i][j]));
}

function recall(state, steps=8) {
  let s = state.slice();
  for (let t=0; t<steps; t++) {
    const ns = s.slice();
    for (let i=0; i<N; i++) {
      let h = 0;
      for (let j=0; j<N; j++) if (j!==i) h += W[i][j] * s[j];
      ns[i] = h >= 0 ? 1 : -1;
    }
    s = ns;
  }
  return s;
}

function patternToPath(p, id) {
  // Decode binary to 8 control points (x,y in 0-1)
  const pts = [];
  for (let k=0; k<8; k++) {
    const base = k*8;
    let x = 0, y = 0;
    for (let b=0; b<4; b++) x += (p[base+b] > 0 ? 1 : 0) * (1 << b);
    for (let b=0; b<4; b++) y += (p[base+4+b] > 0 ? 1 : 0) * (1 << b);
    pts.push([20 + (x/15)*60, 20 + (y/15)*60]);
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i=1; i<pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
  d += ' Z';
  return d;
}

class Agent {
  constructor(i) {
    this.id = i;
    this.x = 100 + Math.random()* (window.innerWidth-200);
    this.y = 100 + Math.random()* (window.innerHeight-200);
    this.vx = (Math.random()-0.5)*1.2;
    this.vy = (Math.random()-0.5)*1.2;
    this.state = randomPattern();
    this.el = document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.el.setAttribute('class','agent');
    this.el.setAttribute('width','100');
    this.el.setAttribute('height','100');
    this.path = document.createElementNS('http://www.w3.org/2000/svg','path');
    this.path.setAttribute('fill','none');
    this.path.setAttribute('stroke',`hsl(${i*50},70%,60%)`);
    this.path.setAttribute('stroke-width','2');
    this.el.appendChild(this.path);
    stage.appendChild(this.el);
    this.morph();
  }
  morph() {
    const recalled = recall(this.state);
    this.state = recalled;
    this.path.setAttribute('d', patternToPath(recalled, this.id));
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 20 || this.x > window.innerWidth-120) this.vx *= -1;
    if (this.y < 20 || this.y > window.innerHeight-120) this.vy *= -1;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    // occasional recall
    if (Math.random() < 0.02) this.morph();
  }
  collide(other) {
    const dx = this.x - other.x, dy = this.y - other.y;
    const dist = Math.hypot(dx,dy);
    if (dist < 80 && dist > 0) {
      // simple repulsion
      const f = 0.8 / dist;
      this.vx += dx * f; this.vy += dy * f;
      other.vx -= dx * f; other.vy -= dy * f;
      // sealed transfer if closer / higher stability proxy (lower velocity)
      if (Math.hypot(this.vx,this.vy) < Math.hypot(other.vx,other.vy) && Math.random() < 0.3) {
        // transfer fragment: copy some weights influenced by this agent's state
        const frag = this.state.slice(0,16);
        hebbianUpdate(frag.map(v => v), 0.05);
        statusEl.textContent = `Agent ${this.id} sealed fragment to field (from ${other.id})`;
      }
    }
  }
}

function init() {
  agents = [];
  for (let i=0; i<NUM_AGENTS; i++) agents.push(new Agent(i));
  // seed one pattern
  const p = randomPattern();
  patterns.push(p);
  hebbianUpdate(p, 0.2);
  statusEl.textContent = 'Initialized. Move or tilt to imprint.';
}

// Imprint from motion or pointer
let motionBuf = [];
window.addEventListener('devicemotion', e => {
  if (!e.accelerationIncludingGravity) return;
  const a = e.accelerationIncludingGravity;
  motionBuf.push(Math.abs(a.x||0) + Math.abs(a.y||0) + Math.abs(a.z||0));
  if (motionBuf.length > 32) motionBuf.shift();
  if (motionBuf.length === 32 && motionBuf.reduce((s,v)=>s+v,0)/32 > 3) {
    const p = motionBuf.map(v => v > 4 ? 1 : -1).concat(Array(N-32).fill(0)).slice(0,N).map(v => v|| (Math.random()>0.5?1:-1));
    hebbianUpdate(p, 0.08);
    patterns.push(p);
    if (patterns.length > 8) patterns.shift();
    statusEl.textContent = 'Motion pattern imprinted';
  }
});

let lastX=0, lastY=0;
stage.addEventListener('pointermove', e => {
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  if (Math.hypot(dx,dy) > 8) {
    const p = Array.from({length:N}, (_,i) => ((dx+dy) * (i%7) > 0 ? 1 : -1));
    hebbianUpdate(p, 0.04);
    statusEl.textContent = 'Pointer trajectory imprinted';
  }
});

document.getElementById('imprint').onclick = () => {
  const p = randomPattern();
  hebbianUpdate(p, 0.15);
  patterns.push(p);
  agents.forEach(a => a.morph());
  statusEl.textContent = 'Manual pattern imprinted & recalled';
};

document.getElementById('reset').onclick = () => {
  W = Array.from({length:N}, () => Array(N).fill(0));
  patterns = [];
  statusEl.textContent = 'Weights reset';
};

document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f545-hopfield',1);
      r.onupgradeneeded = () => r.result.createObjectStore('mem');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem','readwrite');
    tx.objectStore('mem').put({W, patterns, t:Date.now()}, 'seal');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed: '+e.message; }
};

// Load seal
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f545-hopfield',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem','readonly');
    const req = tx.objectStore('mem').get('seal');
    req.onsuccess = () => {
      if (req.result) {
        W = req.result.W || W;
        patterns = req.result.patterns || [];
        statusEl.textContent = 'Loaded sealed memory';
        agents.forEach(a => a.morph());
      }
    };
  } catch (e) { console.warn('f545-devicemotion-hopfield-svg-competitive-mind:', e); }
})();

function loop() {
  for (let i=0; i<agents.length; i++) {
    agents[i].update();
    for (let j=i+1; j<agents.length; j++) agents[i].collide(agents[j]);
  }
  requestAnimationFrame(loop);
}

init();
loop();

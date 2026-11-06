const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let orient = { beta: 0, gamma: 0 };
addEventListener('deviceorientation', e => { orient.beta = e.beta || 0; orient.gamma = e.gamma || 0; });
let pointer = { x: W/2, y: H/2, down: false };
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('pointerdown', e => { pointer.down = true; });
addEventListener('pointerup', e => { pointer.down = false; });

// Tiny MLP: 4 -> 8 -> 2
class MLP {
  constructor() {
    this.w1 = Array.from({length: 4*8}, () => (Math.random()-0.5)*0.5);
    this.b1 = Array(8).fill(0);
    this.w2 = Array.from({length: 8*2}, () => (Math.random()-0.5)*0.5);
    this.b2 = Array(2).fill(0);
  }
  forward(x) { // x: [var, prox, beta, gamma]
    const h = Array(8).fill(0);
    for (let i = 0; i < 8; i++) {
      let s = this.b1[i];
      for (let j = 0; j < 4; j++) s += x[j] * this.w1[j*8 + i];
      h[i] = Math.tanh(s);
    }
    const o = Array(2).fill(0);
    for (let i = 0; i < 2; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 8; j++) s += h[j] * this.w2[j*2 + i];
      o[i] = Math.tanh(s);
    }
    return o; // [splitBias, mergeBias]
  }
  reward(scale = 0.01) {
    for (let i = 0; i < this.w1.length; i++) this.w1[i] += (Math.random()-0.5)*scale;
    for (let i = 0; i < this.w2.length; i++) this.w2[i] += (Math.random()-0.5)*scale;
  }
  serialize() { return { w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 }; }
  deserialize(s) { Object.assign(this, s); }
}
let policy = new MLP();

// Quadtree node
class Node {
  constructor(x, y, w, h, depth = 0) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.depth = depth;
    this.value = Math.random() * 0.5;
    this.variance = 0;
    this.children = null;
    this.el = null;
    this.id = Math.random().toString(36).slice(2, 8);
  }
  isLeaf() { return !this.children; }
  split() {
    if (this.depth >= 6 || this.w < 40 || this.h < 30) return;
    const hw = this.w/2, hh = this.h/2;
    this.children = [
      new Node(this.x, this.y, hw, hh, this.depth+1),
      new Node(this.x+hw, this.y, hw, hh, this.depth+1),
      new Node(this.x, this.y+hh, hw, hh, this.depth+1),
      new Node(this.x+hw, this.y+hh, hw, hh, this.depth+1)
    ];
    this.children.forEach(c => c.value = this.value + (Math.random()-0.5)*0.2);
  }
  merge() {
    if (!this.children) return;
    this.value = this.children.reduce((s, c) => s + c.value, 0) / 4;
    this.children.forEach(c => c.destroy());
    this.children = null;
  }
  destroy() {
    if (this.el) this.el.remove();
    if (this.children) this.children.forEach(c => c.destroy());
  }
  update(dt, t) {
    const cx = this.x + this.w/2, cy = this.y + this.h/2;
    const prox = Math.hypot(pointer.x - cx, pointer.y - cy) / Math.hypot(W, H);
    const inp = [this.variance, 1 - Math.min(prox, 1), orient.beta/90, orient.gamma/90];
    const [splitB, mergeB] = policy.forward(inp);
    if (this.isLeaf()) {
      if (splitB > 0.4 && this.variance > 0.1) this.split();
      // inject from pointer
      if (pointer.down && prox < 0.15) this.value = Math.min(1, this.value + 0.02);
    } else {
      if (mergeB > 0.5 && this.variance < 0.05) this.merge();
      this.children.forEach(c => c.update(dt, t));
      this.variance = this.children.reduce((s, c) => s + Math.abs(c.value - this.value), 0) / 4;
    }
    this.value += (Math.random()-0.5)*0.005;
    this.value = Math.max(0, Math.min(1, this.value));
    this.variance = Math.abs(this.value - 0.5);
  }
  embody() {
    if (!this.isLeaf()) { this.children.forEach(c => c.embody()); return; }
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'portal';
      this.el.dataset.id = this.id;
      portalsEl.appendChild(this.el);
      this.el.addEventListener('pointerdown', e => {
        e.stopPropagation();
        policy.reward(0.02); // reward engagement
        this.value = Math.min(1, this.value + 0.1);
      });
    }
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.width = this.w + 'px';
    this.el.style.height = this.h + 'px';
    this.el.innerHTML = `<div class="val">${this.value.toFixed(2)}</div><div class="meta">d${this.depth} v${this.variance.toFixed(2)}</div>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
    this.el.style.background = `hsla(${200 + this.value*60}, 50%, 25%, 0.4)`;
  }
}
let root = new Node(0, 0, W, H);

function collectLeaves(n, arr = []) {
  if (n.isLeaf()) arr.push(n);
  else n.children.forEach(c => collectLeaves(c, arr));
  return arr;
}

let t = 0;
function loop() {
  t += 0.016;
  root.update(0.016, t);
  root.embody();
  // density viz
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, W, H);
  const leaves = collectLeaves(root);
  leaves.forEach(l => {
    ctx.fillStyle = `hsla(${200 + l.value*80}, 60%, 40%, ${0.15 + l.value*0.3})`;
    ctx.fillRect(l.x, l.y, l.w, l.h);
  });
  // entropy / depth
  const depths = leaves.map(l => l.depth);
  const maxD = Math.max(...depths, 0);
  const ent = leaves.reduce((s, l) => s + -l.value*Math.log(l.value+0.01), 0) / leaves.length;
  document.documentElement.style.setProperty('--depth', maxD);
  document.documentElement.style.setProperty('--entropy', Math.min(1, ent));
  statusEl.textContent = `depth: ${maxD} · entropy: ${ent.toFixed(2)} · portals: ${leaves.length}`;
  requestAnimationFrame(loop);
}
loop();

// Seal / restore
const DB = 'verse-f605';
async function seal() {
  const genome = { policy: policy.serialize(), t, hash: Math.random().toString(36) };
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => {
      const tx = e.target.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(genome, 'latest');
      statusEl.textContent += ' · sealed';
    };
  } catch (err) { console.warn(err); }
}
async function restore() {
  try {
    const req = indexedDB.open(DB, 1);
    req.onsuccess = e => {
      const tx = e.target.result.transaction('genomes');
      const get = tx.objectStore('genomes').get('latest');
      get.onsuccess = () => {
        if (get.result) {
          policy.deserialize(get.result.policy);
          statusEl.textContent += ' · restored';
        }
      };
    };
  } catch (err) { console.debug("lab f605-webgpu-quadtree-policy-partition-mind:", err); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { root.destroy(); root = new Node(0, 0, W, H); policy = new MLP(); };

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stats = document.getElementById('stats');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

class Node {
  constructor(x, y, w, h, depth = 0) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.depth = depth;
    this.density = 0;
    this.children = null;
    this.labelEl = null;
  }
  isLeaf() { return !this.children; }
  contains(px, py) {
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }
  split() {
    if (this.depth >= 6 || this.w < 20) return;
    const hw = this.w / 2, hh = this.h / 2;
    this.children = [
      new Node(this.x, this.y, hw, hh, this.depth+1),
      new Node(this.x+hw, this.y, hw, hh, this.depth+1),
      new Node(this.x, this.y+hh, hw, hh, this.depth+1),
      new Node(this.x+hw, this.y+hh, hw, hh, this.depth+1)
    ];
    this.children.forEach(c => c.density = this.density * 0.25);
    this.removeLabel();
  }
  merge() {
    if (!this.children) return;
    this.density = this.children.reduce((s,c) => s + c.density, 0) / 4;
    this.children.forEach(c => c.removeLabel());
    this.children = null;
  }
  removeLabel() {
    if (this.labelEl) { this.labelEl.remove(); this.labelEl = null; }
  }
  ensureLabel() {
    if (!this.labelEl && this.isLeaf() && this.density > 0.5) {
      this.labelEl = document.createElement('div');
      this.labelEl.className = 'label';
      document.body.appendChild(this.labelEl);
    }
    if (this.labelEl) {
      this.labelEl.style.left = (this.x + this.w/2) + 'px';
      this.labelEl.style.top = (this.y + this.h/2) + 'px';
      this.labelEl.textContent = this.density.toFixed(1);
      this.labelEl.style.opacity = Math.min(1, this.density / 10);
      if (this.density < 0.3) this.removeLabel();
    }
  }
}

let root = new Node(0, 0, W, H);
let leaves = [];
function collectLeaves(n) {
  if (n.isLeaf()) leaves.push(n);
  else n.children.forEach(collectLeaves);
}

function findLeaf(px, py, n = root) {
  if (n.isLeaf()) return n;
  for (const c of n.children) if (c.contains(px, py)) return findLeaf(px, py, c);
  return n;
}

let pointer = {x: W/2, y: H/2, active: false};
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  const leaf = findLeaf(pointer.x, pointer.y);
  if (leaf) leaf.density += 2.5;
});
canvas.addEventListener('pointerleave', () => pointer.active = false);

function update() {
  leaves = [];
  collectLeaves(root);
  // decay + diffusion-ish
  for (const l of leaves) {
    l.density *= 0.985;
    if (l.density > 8 && l.depth < 6) l.split();
  }
  // merge check from bottom
  function tryMerge(n) {
    if (!n.children) return;
    n.children.forEach(tryMerge);
    if (n.children.every(c => c.isLeaf() && c.density < 1.2)) n.merge();
  }
  tryMerge(root);
  // recollect and labels
  leaves = [];
  collectLeaves(root);
  for (const l of leaves) l.ensureLabel();
  const maxD = Math.max(...leaves.map(l => l.density), 0);
  stats.textContent = `leaves: ${leaves.length} | maxD: ${maxD.toFixed(1)}`;
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,W,H);
  leaves.forEach(l => {
    const a = Math.min(0.8, l.density / 15);
    ctx.fillStyle = `hsla(${200 + l.density*8}, 70%, 50%, ${a})`;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + a*0.3})`;
    ctx.strokeRect(l.x+0.5, l.y+0.5, l.w-1, l.h-1);
  });
  // pointer
  if (pointer.active) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 4, 0, 7); ctx.fill();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB
const DB = 'f565-quadtree-mind';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tree');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveTree() {
  const db = await openDB();
  const tx = db.transaction('tree', 'readwrite');
  // simple serialize: collect all leaf bounds+density
  const data = leaves.map(l => ({x:l.x,y:l.y,w:l.w,h:l.h,d:l.density,depth:l.depth}));
  tx.objectStore('tree').put(data, 'state');
  return tx.complete;
}
async function loadTree() {
  try {
    const db = await openDB();
    const tx = db.transaction('tree', 'readonly');
    const req = tx.objectStore('tree').get('state');
    return new Promise(res => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  } catch { return null; }
}
// Note: full tree rebuild from leaves is approximate; for prototype we re-inject densities into a fresh tree on load
async function restore() {
  const data = await loadTree();
  if (!data) return;
  root = new Node(0,0,W,H);
  // re-inject by simulating past density into leaves (simplified)
  data.forEach(d => {
    const leaf = findLeaf(d.x + d.w/2, d.y + d.h/2);
    if (leaf) leaf.density = Math.max(leaf.density, d.d * 0.8);
  });
  // force some splits by density
  for (let i=0; i<3; i++) update();
}

document.getElementById('seal').onclick = async () => {
  await saveTree();
  stats.textContent += ' | sealed';
};
document.getElementById('reset').onclick = () => {
  root.removeLabel && root.removeLabel();
  document.querySelectorAll('.label').forEach(el => el.remove());
  root = new Node(0,0,W,H);
};
document.getElementById('pulse').onclick = () => {
  const leaf = findLeaf(W/2, H/2);
  if (leaf) leaf.density += 20;
};

window.addEventListener('resize', () => {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  root = new Node(0,0,W,H);
  document.querySelectorAll('.label').forEach(el => el.remove());
});

// load on start
restore();

// optional BroadcastChannel
try {
  const ch = new BroadcastChannel('f565-density');
  ch.onmessage = e => {
    if (e.data.type === 'pulse') {
      const leaf = findLeaf(e.data.x, e.data.y);
      if (leaf) leaf.density += e.data.amt;
    }
  };
  // could post on strong injects, omitted for simplicity
} catch (e) { console.warn('f565-adaptive-quadtree-spatial-mind:', e); }

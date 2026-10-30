const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const particles = Array.from({length: 70}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

let action = 'attract';
let treeDepth = 1;
const orbs = [];
function makeOrb(label) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = label;
  el.onclick = () => reward(label);
  document.body.appendChild(el);
  return el;
}
for (let i = 0; i < 3; i++) orbs.push(makeOrb('path-' + i));

// Simple main-thread decision tree stub (Worker path noted)
let tree = { feature: 0, threshold: 0.5, left: 'attract', right: 'repel', examples: 0 };
function classify(features) {
  // features: [nx, ny, speed, density]
  const f = features[tree.feature] || 0;
  return f > tree.threshold ? tree.right : tree.left;
}
function reward(label) {
  tree.examples = (tree.examples || 0) + 1;
  treeDepth = Math.min(4, 1 + Math.floor(tree.examples / 3));
  document.getElementById('status').textContent = 'rewarded · depth ' + treeDepth + ' · examples ' + tree.examples;
  // Grow: flip threshold slightly
  tree.threshold = Math.max(0.1, Math.min(0.9, tree.threshold + (Math.random()-0.5)*0.1));
}

let mx = W/2, my = H/2, pmx = mx, pmy = my;
addEventListener('pointermove', e => { pmx = mx; pmy = my; mx = e.clientX; my = e.clientY; });

function densityAt(x, y) {
  let c = 0;
  for (const p of particles) if ((p.x-x)**2 + (p.y-y)**2 < 80*80) c++;
  return c / particles.length;
}

function step() {
  const dx = mx - pmx, dy = my - pmy;
  const speed = Math.hypot(dx, dy) / 10;
  const dens = densityAt(mx, my);
  const features = [mx/W, my/H, Math.min(1, speed), dens];
  action = classify(features);

  const force = action === 'attract' ? 0.15 : action === 'repel' ? -0.12 : 0.05;
  for (const p of particles) {
    const fx = (mx - p.x) * force * 0.01;
    const fy = (my - p.y) * force * 0.01;
    p.vx = (p.vx + fx) * 0.96;
    p.vy = (p.vy + fy) * 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.5;
    if (p.y < 0 || p.y > H) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }

  // Position orbs near clusters / pointer
  orbs.forEach((el, i) => {
    const ang = (i / orbs.length) * Math.PI * 2 + performance.now()/2000;
    const ox = mx + Math.cos(ang) * 120;
    const oy = my + Math.sin(ang) * 80;
    el.style.transform = `translate(${ox-60}px, ${oy-20}px)`;
    el.textContent = action + ' · f' + tree.feature + '>' + tree.threshold.toFixed(2) + ' · d' + treeDepth;
    el.style.opacity = 0.7 + dens * 0.3;
  });

  // Render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = action === 'attract' ? '#6cf' : action === 'repel' ? '#f66' : '#fc6';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Persistence
const dbName = 'f296-tree';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tree');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('tree', 'readwrite');
    tx.objectStore('tree').put({ tree, depth: treeDepth, gen: Date.now() }, 'champion');
    await new Promise(r => tx.oncomplete = r);
    document.getElementById('status').textContent = 'sealed';
  } catch(e) { document.getElementById('status').textContent = 'seal failed'; }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('tree', 'readonly');
    const req = tx.objectStore('tree').get('champion');
    req.onsuccess = () => {
      if (req.result) {
        tree = req.result.tree;
        treeDepth = req.result.depth || 1;
        document.getElementById('status').textContent = 'loaded · examples ' + (tree.examples||0);
      }
    };
  } catch(e) { document.getElementById('status').textContent = 'load failed'; }
};

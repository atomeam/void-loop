const W = 96, H = 96, THRESH = 4;
let lattice = new Int16Array(W * H);
let topples = new Float32Array(W * H);
let oriX = 0, oriY = 0, ptrX = 0, ptrY = 0;
let rateBias = 0, threshBias = 0;
let fitness = 0;
const portals = [];
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const stats = document.getElementById('stats');

function idx(x, y) { return y * W + x; }

function initLattice() {
  for (let i = 0; i < lattice.length; i++) lattice[i] = (Math.random() * 3) | 0;
  topples.fill(0);
}

function addGrains(x, y, n) {
  x = Math.max(1, Math.min(W-2, x));
  y = Math.max(1, Math.min(H-2, y));
  lattice[idx(x, y)] += n;
}

function topple() {
  const q = [];
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    if (lattice[idx(x,y)] >= THRESH + threshBias) q.push([x,y]);
  }
  let avalanche = 0;
  while (q.length) {
    const [x,y] = q.pop();
    const i = idx(x,y);
    if (lattice[i] < THRESH + threshBias) continue;
    const t = Math.floor(lattice[i] / THRESH);
    lattice[i] -= t * THRESH;
    topples[i] += t;
    avalanche += t;
    const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx,dy] of neigh) {
      const nx = x+dx, ny = y+dy;
      if (nx>0 && nx<W-1 && ny>0 && ny<H-1) {
        lattice[idx(nx,ny)] += t;
        if (lattice[idx(nx,ny)] >= THRESH + threshBias) q.push([nx,ny]);
      }
    }
  }
  return avalanche;
}

function render() {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < lattice.length; i++) {
    const h = lattice[i];
    const t = Math.min(255, topples[i] * 8);
    const r = Math.min(255, h * 40 + t);
    const g = Math.min(255, t * 0.5);
    const b = Math.min(255, 80 + h * 20);
    img.data[i*4] = r; img.data[i*4+1] = g; img.data[i*4+2] = b; img.data[i*4+3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
}

function updatePortals() {
  portals.forEach((p, pi) => {
    let best = 0, bx = p.x, by = p.y;
    const r = 8;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = (p.x + dx + W) % W, y = (p.y + dy + H) % H;
      const v = topples[idx(x,y)];
      if (v > best) { best = v; bx = x; by = y; }
    }
    p.x += (bx - p.x) * 0.08;
    p.y += (by - p.y) * 0.08;
    const scale = 0.8 + Math.min(1.5, best * 0.05);
    p.el.style.transform = `translate(${(p.x/W)*cv.width - 35}px, ${(p.y/H)*cv.height - 35}px) scale(${scale})`;
  });
}

function spawnPortals() {
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = '•';
    el.onclick = () => {
      addGrains(Math.round(portals[i].x), Math.round(portals[i].y), 8);
      fitness += 1;
      rateBias += (Math.random()-0.5)*0.2;
      threshBias = Math.max(-1, Math.min(1, threshBias + (Math.random()-0.5)*0.1));
    };
    portalsEl.appendChild(el);
    portals.push({ x: Math.random()*W, y: Math.random()*H, el });
  }
}

function loop() {
  const cx = (oriX * 0.5 + ptrX * 0.5 + 1) * 0.5 * W;
  const cy = (oriY * 0.5 + ptrY * 0.5 + 1) * 0.5 * H;
  const rate = 1 + rateBias;
  if (Math.random() < rate * 0.15) addGrains(cx|0, cy|0, 1);
  const av = topple();
  if (av > 20) {
    for (let i = 0; i < topples.length; i++) topples[i] *= 0.98;
  }
  updatePortals();
  render();
  stats.textContent = `fit ${fitness.toFixed(0)} | rate ${rate.toFixed(2)} | thresh ${ (THRESH+threshBias).toFixed(1) } | ori ${oriX.toFixed(2)},${oriY.toFixed(2)}`;
  requestAnimationFrame(loop);
}

function resize() {
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

document.getElementById('oriBtn').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', e => {
        oriX = (e.gamma || 0) / 45;
        oriY = (e.beta || 0) / 45;
      });
    });
  } else {
    window.addEventListener('deviceorientation', e => {
      oriX = (e.gamma || 0) / 45;
      oriY = (e.beta || 0) / 45;
    });
  }
};

window.addEventListener('pointermove', e => {
  ptrX = (e.clientX / window.innerWidth - 0.5) * 2;
  ptrY = (e.clientY / window.innerHeight - 0.5) * 2;
});

document.getElementById('sealBtn').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f687', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put({
      lattice: Array.from(lattice),
      topples: Array.from(topples),
      rateBias, threshBias, fitness,
      ts: Date.now()
    }, 'state');
    await new Promise(r => tx.oncomplete = r);
    stats.textContent = 'Sealed to IndexedDB';
  } catch (e) { stats.textContent = 'Seal failed (private?)'; }
};

document.getElementById('resetBtn').onclick = () => { initLattice(); fitness = 0; };

async function loadSeal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f687', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('state');
    req.onsuccess = () => {
      const s = req.result;
      if (s && s.lattice) {
        lattice = Int16Array.from(s.lattice);
        topples = Float32Array.from(s.topples || []);
        rateBias = s.rateBias || 0;
        threshBias = s.threshBias || 0;
        fitness = s.fitness || 0;
        stats.textContent = 'Restored sealed lattice';
      }
    };
  } catch (e) { console.debug("lab f687-webgpu-sandpile-orientation-avalanche-mind:", e); }
}

initLattice();
spawnPortals();
loadSeal().then(() => loop());

const W = 80, H = 60, CELL = 10;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
cv.width = W * CELL; cv.height = H * CELL;
const status = document.getElementById('status');
const info = document.getElementById('info');

let grid = new Int16Array(W * H);
let cells = []; // {id, genome:{targetVol, adhesion, motility}, vol, fitness, cx, cy}
let nextId = 1;
let temperature = 1.2;
let hand = {x: W/2, y: H/2, injecting: false, grasping: false};
let portals = [];

function randGenome() {
  return {
    targetVol: 40 + Math.random()*80,
    adhesion: 0.5 + Math.random()*1.5,
    motility: 0.3 + Math.random()*0.7
  };
}

function initCells(n = 6) {
  grid.fill(0);
  cells = [];
  nextId = 1;
  for (let i = 0; i < n; i++) {
    const id = nextId++;
    const g = randGenome();
    const cx = 10 + Math.random()*(W-20);
    const cy = 10 + Math.random()*(H-20);
    cells.push({id, genome: g, vol: 0, fitness: 0, cx, cy});
    // seed small blob
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = Math.floor(cx+dx), y = Math.floor(cy+dy);
      if (x>=0 && x<W && y>=0 && y<H) grid[y*W+x] = id;
    }
  }
  updateVolumes();
}

function updateVolumes() {
  const vols = new Map();
  for (let i = 0; i < grid.length; i++) {
    const id = grid[i];
    if (id) vols.set(id, (vols.get(id)||0) + 1);
  }
  cells.forEach(c => {
    c.vol = vols.get(c.id) || 0;
    const volErr = Math.abs(c.vol - c.genome.targetVol);
    c.fitness = Math.max(0, 100 - volErr * 0.8 - (c.vol < 5 ? 40 : 0));
    // centroid rough
    let sx=0, sy=0, cnt=0;
    for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (grid[y*W+x]===c.id) { sx+=x; sy+=y; cnt++; }
    if (cnt) { c.cx = sx/cnt; c.cy = sy/cnt; }
  });
  cells = cells.filter(c => c.vol > 2);
}

function energyDelta(x, y, oldId, newId) {
  if (oldId === newId) return 0;
  let dE = 0;
  // volume
  const oldCell = cells.find(c => c.id === oldId);
  const newCell = cells.find(c => c.id === newId);
  if (oldCell) dE += Math.abs((oldCell.vol-1) - oldCell.genome.targetVol) - Math.abs(oldCell.vol - oldCell.genome.targetVol);
  if (newCell) dE += Math.abs((newCell.vol+1) - newCell.genome.targetVol) - Math.abs(newCell.vol - newCell.genome.targetVol);
  // adhesion: count neighbor mismatches
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  for (const [dx,dy] of dirs) {
    const nx = x+dx, ny = y+dy;
    if (nx<0||nx>=W||ny<0||ny>=H) continue;
    const nid = grid[ny*W+nx];
    if (nid && nid !== oldId) dE -= (oldCell ? oldCell.genome.adhesion : 1);
    if (nid && nid !== newId) dE += (newCell ? newCell.genome.adhesion : 1);
  }
  return dE;
}

function stepCPM(steps = 800) {
  for (let s = 0; s < steps; s++) {
    const x = Math.floor(Math.random()*W);
    const y = Math.floor(Math.random()*H);
    const i = y*W + x;
    const oldId = grid[i];
    // pick neighbor as candidate
    const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
    const [dx,dy] = dirs[Math.floor(Math.random()*dirs.length)];
    const nx = x+dx, ny = y+dy;
    if (nx<0||nx>=W||ny<0||ny>=H) continue;
    const newId = grid[ny*W+nx];
    if (newId === oldId) continue;
    let dE = energyDelta(x, y, oldId, newId);
    // hand bias
    const dist = Math.hypot(x - hand.x, y - hand.y);
    if (hand.injecting && dist < 6) dE -= 3;
    if (hand.grasping && dist < 4 && oldId && newId && oldId !== newId) {
      // force transfer chance
      if (Math.random() < 0.15) {
        const from = cells.find(c => c.id === oldId);
        const to = cells.find(c => c.id === newId);
        if (from && to) to.genome = {...from.genome};
      }
    }
    if (dE <= 0 || Math.random() < Math.exp(-dE / temperature)) {
      grid[i] = newId;
    }
  }
  updateVolumes();
}

function paint() {
  const img = ctx.createImageData(cv.width, cv.height);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const id = grid[y*W + x];
      let r=8,g=8,b=20;
      if (id) {
        const hue = (id * 47) % 360;
        r = Math.floor(120 + 80 * Math.sin(hue*0.017));
        g = Math.floor(100 + 100 * Math.sin(hue*0.017 + 2));
        b = Math.floor(180 + 70 * Math.sin(hue*0.017 + 4));
      }
      for (let py = 0; py < CELL; py++) for (let px = 0; px < CELL; px++) {
        const idx = ((y*CELL+py)*cv.width + (x*CELL+px)) * 4;
        data[idx]=r; data[idx+1]=g; data[idx+2]=b; data[idx+3]=255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // hand marker
  ctx.fillStyle = hand.grasping ? '#f66' : hand.injecting ? '#6f6' : '#aaa';
  ctx.beginPath(); ctx.arc(hand.x*CELL, hand.y*CELL, 8, 0, Math.PI*2); ctx.fill();
}

function updatePortals() {
  document.querySelectorAll('.portal').forEach(p => p.remove());
  portals = [];
  const top = cells.filter(c => c.fitness > 30).sort((a,b)=>b.fitness-a.fitness).slice(0,5);
  top.forEach(c => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = `Cell ${c.id}\nV:${c.vol|0} T:${c.genome.targetVol|0}\nF:${c.fitness|0}`;
    el.style.left = (c.cx * CELL) + 'px';
    el.style.top = (c.cy * CELL) + 'px';
    el.style.whiteSpace = 'pre';
    document.body.appendChild(el);
    // simple drag
    let ox, oy;
    el.onpointerdown = e => { ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); };
    el.onpointermove = e => { if (e.buttons) { el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; } };
    portals.push(el);
  });
}

function loop() {
  stepCPM(600);
  paint();
  updatePortals();
  const best = cells.reduce((m,c)=>c.fitness>m?c.fitness:m,0);
  info.textContent = `Cells: ${cells.length} | Best fitness: ${best|0}`;
  requestAnimationFrame(loop);
}

// pointer as hand
cv.addEventListener('pointermove', e => {
  const rect = cv.getBoundingClientRect();
  hand.x = (e.clientX - rect.left) / CELL;
  hand.y = (e.clientY - rect.top) / CELL;
});
cv.addEventListener('pointerdown', e => { hand.injecting = true; hand.grasping = e.shiftKey || e.button===2; });
cv.addEventListener('pointerup', () => { hand.injecting = false; hand.grasping = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

// buttons
document.getElementById('inject').onclick = () => { hand.injecting = true; setTimeout(()=>hand.injecting=false, 800); };
document.getElementById('reset').onclick = () => { initCells(6); };
document.getElementById('seal').onclick = seal;

// IndexedDB seal
let db;
const req = indexedDB.open('f579-cpm-cell-mind', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('seal');
req.onsuccess = e => { db = e.target.result; loadSeal(); };
function seal() {
  if (!db) return;
  const best = cells.reduce((m,c)=>c.fitness>(m?.fitness||0)?c:m, null);
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({
    genome: best ? best.genome : null,
    grid: Array.from(grid),
    cells: cells.map(c=>({id:c.id, genome:c.genome})),
    ts: Date.now()
  }, 'best');
  status.textContent = 'Sealed best genome';
  setTimeout(()=>status.textContent = 'F579 CPM Cell Mind — pointer as hand', 1500);
}
function loadSeal() {
  if (!db) return initCells();
  const tx = db.transaction('seal','readonly');
  const g = tx.objectStore('seal').get('best');
  g.onsuccess = () => {
    if (g.result && g.result.grid) {
      grid = Int16Array.from(g.result.grid);
      cells = (g.result.cells||[]).map(c=>({...c, vol:0, fitness:0, cx:0, cy:0}));
      nextId = Math.max(0,...cells.map(c=>c.id))+1;
      updateVolumes();
      status.textContent = 'Restored sealed mind';
    } else initCells();
  };
  g.onerror = () => initCells();
}

// optional WebXR attempt (graceful)
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (supported) status.textContent += ' | WebXR available (hand-tracking experimental)';
  }).catch(()=>{});
}

initCells();
loop();

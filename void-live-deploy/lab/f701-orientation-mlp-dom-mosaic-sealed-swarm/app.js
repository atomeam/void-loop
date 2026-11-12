const N = 6, TILE = 70, GAP = 10;
const mosaic = document.getElementById('mosaic');
const status = document.getElementById('status');
let tiles = [];
let ori = {beta:0, gamma:0};
let pointer = {x:0, y:0, active:false};
const dbName = 'verse-f701';
const bc = new BroadcastChannel('f701-genome');

function randn() { return (Math.random()-0.5)*2; }
function createMLP() {
  return {
    w1: Array(5*8).fill(0).map(randn),
    b1: Array(8).fill(0).map(randn),
    w2: Array(8*3).fill(0).map(randn),
    b2: Array(3).fill(0).map(randn)
  };
}
function forward(m, inp) {
  const h = [];
  for (let i=0; i<8; i++) {
    let s = m.b1[i];
    for (let j=0; j<5; j++) s += inp[j] * m.w1[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const o = [];
  for (let i=0; i<3; i++) {
    let s = m.b2[i];
    for (let j=0; j<8; j++) s += h[j] * m.w2[j*3 + i];
    o[i] = Math.tanh(s);
  }
  return o;
}
function mutate(m, rate=0.15) {
  const nm = JSON.parse(JSON.stringify(m));
  for (let k of ['w1','b1','w2','b2']) for (let i=0; i<nm[k].length; i++) if (Math.random()<rate) nm[k][i] += randn()*0.3;
  return nm;
}
function transfer(src, dst) {
  dst.mlp = mutate(src.mlp, 0.2);
  dst.fitness = src.fitness * 0.7;
}

function initTiles(load=null) {
  mosaic.innerHTML = '';
  tiles = [];
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const el = document.createElement('div');
    el.className = 'tile';
    const t = {
      el, x: x*(TILE+GAP)+50, y: y*(TILE+GAP)+80,
      vx:0, vy:0, mlp: createMLP(), fitness:1, hue:180, hover:0
    };
    if (load && load[tiles.length]) {
      Object.assign(t, load[tiles.length]);
      t.el = el;
    }
    el.textContent = '•';
    el.onclick = () => { t.fitness += 5; status.textContent = `Rewarded ${t.fitness.toFixed(1)}`; };
    el.onmouseenter = () => t.hover = 1;
    el.onmouseleave = () => t.hover = 0;
    mosaic.appendChild(el);
    tiles.push(t);
  }
}

function update() {
  const dens = tiles.map(t => 0);
  for (let i=0; i<tiles.length; i++) for (let j=i+1; j<tiles.length; j++) {
    const d = Math.hypot(tiles[i].x-tiles[j].x, tiles[i].y-tiles[j].y);
    if (d < 100) { dens[i]++; dens[j]++; }
  }
  tiles.forEach((t,i) => {
    const residual = dens[i] - 2;
    const inp = [ori.beta/90, ori.gamma/90, residual/5, (Date.now()%2000)/1000-1, (t.x/window.innerWidth)*2-1];
    const o = forward(t.mlp, inp);
    t.vx = o[0]*1.8; t.vy = o[1]*1.8;
    t.hue = 180 + o[2]*120;
    t.x += t.vx; t.y += t.vy;
    t.x = Math.max(20, Math.min(window.innerWidth-80, t.x));
    t.y = Math.max(60, Math.min(window.innerHeight-80, t.y));
    t.fitness = Math.max(0, t.fitness * 0.995 + t.hover*0.1);
    if (t.fitness > 8) t.el.classList.add('high'); else t.el.classList.remove('high');
    t.el.style.left = t.x + 'px';
    t.el.style.top = t.y + 'px';
    t.el.style.background = `hsl(${t.hue},70%,40%)`;
    t.el.textContent = t.fitness.toFixed(1);
  });
  // adjacency transfer
  for (let i=0; i<tiles.length; i++) for (let j=i+1; j<tiles.length; j++) {
    const d = Math.hypot(tiles[i].x-tiles[j].x, tiles[i].y-tiles[j].y);
    if (d < 90) {
      if (tiles[i].fitness > tiles[j].fitness * 1.3) transfer(tiles[i], tiles[j]);
      else if (tiles[j].fitness > tiles[i].fitness * 1.3) transfer(tiles[j], tiles[i]);
    }
  }
  requestAnimationFrame(update);
}

window.addEventListener('deviceorientation', e => { ori.beta = e.beta||0; ori.gamma = e.gamma||0; });
window.addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; pointer.active=true; });
document.getElementById('seal').onclick = async () => {
  const data = tiles.map(t => ({x:t.x,y:t.y,mlp:t.mlp,fitness:t.fitness,hue:t.hue}));
  const req = indexedDB.open(dbName,1);
  req.onupgradeneeded = () => req.result.createObjectStore('genomes');
  req.onsuccess = () => {
    const tx = req.result.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'best');
    status.textContent = 'Sealed to IndexedDB';
  };
  bc.postMessage(data);
};
document.getElementById('reset').onclick = () => initTiles();
bc.onmessage = e => { if (Array.isArray(e.data)) initTiles(e.data); status.textContent='Genome received'; };

// load
const req = indexedDB.open(dbName,1);
req.onupgradeneeded = () => req.result.createObjectStore('genomes');
req.onsuccess = () => {
  const tx = req.result.transaction('genomes');
  const g = tx.objectStore('genomes').get('best');
  g.onsuccess = () => initTiles(g.result);
  g.onerror = () => initTiles();
};
req.onerror = () => initTiles();

update();

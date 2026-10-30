const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const energyEl = document.getElementById('energy');
const cardsEl = document.getElementById('cards');
let w, h, nodes = [], edges = [], energy = 0.3, orient = {b:0, g:0};
let worker, matrix = null, vocab = [];
const MAX_NODES = 48;
const cardMap = new Map();

function resize() {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Seed vocab
const seedVocab = ['void','mind','spatial','graph','concept','attention','force','gravity','card','morph','local','ai','orientation','pointer','seal','lattice'];
function initGraph() {
  nodes = []; edges = []; vocab = [...seedVocab];
  seedVocab.forEach((label, i) => {
    nodes.push({
      id: i, label, x: w/2 + (Math.random()-0.5)*200, y: h/2 + (Math.random()-0.5)*200,
      vx:0, vy:0, degree:0
    });
  });
  // initial weak edges
  for (let i=0;i<8;i++) {
    const a = Math.floor(Math.random()*nodes.length);
    const b = Math.floor(Math.random()*nodes.length);
    if (a!==b) edges.push({a,b,w:0.2});
  }
  updateDegrees();
}
initGraph();

function updateDegrees() {
  nodes.forEach(n => n.degree=0);
  edges.forEach(e => { if (nodes[e.a]) nodes[e.a].degree++; if (nodes[e.b]) nodes[e.b].degree++; });
}

// Worker association mind
const workerCode = `
let vocab = [];
let M = null; // flat co-occurrence
let size = 0;
function idx(i,j){ return i*size + j; }
self.onmessage = e => {
  if (e.data.type === 'init') {
    vocab = e.data.vocab;
    size = vocab.length;
    M = new Float32Array(size*size);
    for (let i=0;i<size;i++) M[idx(i,i)] = 0.1;
  } else if (e.data.type === 'inject') {
    const token = e.data.token.toLowerCase().trim();
    if (!token) return;
    let id = vocab.indexOf(token);
    if (id < 0) {
      if (vocab.length >= 32) { self.postMessage({type:'full'}); return; }
      id = vocab.length;
      vocab.push(token);
      // resize matrix (simple: pad)
      const newSize = vocab.length;
      const newM = new Float32Array(newSize*newSize);
      for (let i=0;i<size;i++) for (let j=0;j<size;j++) newM[i*newSize+j] = M[i*size+j];
      M = newM; size = newSize;
    }
    // strengthen self and random walk expansion
    M[idx(id,id)] = Math.min(1, M[idx(id,id)] + 0.3);
    const proposals = [];
    for (let walk=0; walk<3; walk++) {
      let cur = id;
      for (let step=0; step<3; step++) {
        // pick related or random
        let best = -1, bestW = -1;
        for (let j=0;j<size;j++) {
          const w = M[idx(cur,j)];
          if (w > bestW && Math.random() < 0.6) { bestW=w; best=j; }
        }
        if (best < 0 || Math.random() < 0.4) best = Math.floor(Math.random()*size);
        if (best !== cur) {
          M[idx(cur,best)] = Math.min(1, M[idx(cur,best)] + 0.15);
          M[idx(best,cur)] = M[idx(cur,best)];
          proposals.push({from:cur, to:best, w:M[idx(cur,best)]});
        }
        cur = best;
      }
    }
    const energy = Array.from(M).reduce((s,v)=>s+v,0) / (size*size);
    self.postMessage({type:'delta', vocab, proposals, energy, tokenId:id});
  } else if (e.data.type === 'load') {
    vocab = e.data.vocab;
    size = vocab.length;
    M = new Float32Array(e.data.M);
  } else if (e.data.type === 'reset') {
    vocab = e.data.vocab || [];
    size = vocab.length;
    M = new Float32Array(size*size);
  }
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
worker = new Worker(URL.createObjectURL(blob));
worker.postMessage({type:'init', vocab: seedVocab});
worker.onmessage = e => {
  if (e.data.type === 'delta') {
    vocab = e.data.vocab;
    energy = Math.min(1, e.data.energy * 4);
    energyEl.textContent = 'energy: ' + energy.toFixed(3);
    // apply proposals: ensure nodes exist
    e.data.proposals.forEach(p => {
      while (nodes.length <= Math.max(p.from, p.to)) {
        const label = vocab[nodes.length] || 'node'+nodes.length;
        nodes.push({
          id: nodes.length, label,
          x: w/2 + (Math.random()-0.5)*100, y: h/2 + (Math.random()-0.5)*100,
          vx:0, vy:0, degree:0
        });
      }
      const exists = edges.some(ed => (ed.a===p.from && ed.b===p.to) || (ed.a===p.to && ed.b===p.from));
      if (!exists) edges.push({a:p.from, b:p.to, w:p.w});
      else {
        const ed = edges.find(ed => (ed.a===p.from && ed.b===p.to) || (ed.a===p.to && ed.b===p.from));
        if (ed) ed.w = Math.min(1, ed.w + 0.1);
      }
    });
    // prune if too many
    if (nodes.length > MAX_NODES) {
      nodes = nodes.slice(0, MAX_NODES);
      edges = edges.filter(ed => ed.a < MAX_NODES && ed.b < MAX_NODES);
    }
    updateDegrees();
    syncCards();
    matrix = e.data; // for seal later if needed
  }
};

// Inject
function injectToken(token) {
  if (!token) return;
  worker.postMessage({type:'inject', token});
  document.getElementById('status').textContent = 'Injected: ' + token;
}
document.getElementById('add').onclick = () => {
  const v = document.getElementById('inject').value;
  injectToken(v);
  document.getElementById('inject').value = '';
};
document.getElementById('inject').onkeydown = e => { if (e.key==='Enter') document.getElementById('add').click(); };

// Pointer seeds nearby concept
let lastInject = 0;
addEventListener('pointermove', e => {
  const now = performance.now();
  if (now - lastInject > 1800) {
    // seed a random or nearby label occasionally
    if (Math.random() < 0.3 && nodes.length) {
      const n = nodes[Math.floor(Math.random()*nodes.length)];
      injectToken(n.label);
      lastInject = now;
    }
  }
});

// Orientation gravity
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.b = ((e.beta||0)/90);
    orient.g = ((e.gamma||0)/90);
  });
}

// Force-directed step
function stepGraph() {
  const rep = 1200, spring = 0.012, damp = 0.93, grav = 0.35;
  // repulsion
  for (let i=0;i<nodes.length;i++) {
    for (let j=i+1;j<nodes.length;j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx*dx + dy*dy + 40;
      const f = rep / d2;
      const inv = 1 / Math.sqrt(d2);
      dx *= inv; dy *= inv;
      a.vx -= dx * f; a.vy -= dy * f;
      b.vx += dx * f; b.vy += dy * f;
    }
  }
  // springs
  edges.forEach(e => {
    const a = nodes[e.a], b = nodes[e.b];
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx,dy) || 1;
    const rest = 80 + (1-e.w)*40;
    const f = (dist - rest) * spring * e.w;
    dx /= dist; dy /= dist;
    a.vx += dx * f; a.vy += dy * f;
    b.vx -= dx * f; b.vy -= dy * f;
  });
  // gravity from orientation + center
  const gx = orient.g * grav * 40;
  const gy = orient.b * grav * 40;
  nodes.forEach(n => {
    n.vx += (w/2 - n.x)*0.0008 + gx*0.02;
    n.vy += (h/2 - n.y)*0.0008 + gy*0.02;
    n.vx *= damp; n.vy *= damp;
    n.x += n.vx; n.y += n.vy;
    // soft bounds
    if (n.x < 40) n.vx += 0.5; if (n.x > w-40) n.vx -= 0.5;
    if (n.y < 40) n.vy += 0.5; if (n.y > h-40) n.vy -= 0.5;
  });
}

// Cards
function syncCards() {
  // keep top 5 by degree
  const sorted = [...nodes].sort((a,b) => b.degree - a.degree).slice(0,5);
  const active = new Set(sorted.map(n => n.id));
  // remove old
  for (const [id, el] of cardMap) {
    if (!active.has(id)) { el.remove(); cardMap.delete(id); }
  }
  // add/update
  sorted.forEach(n => {
    let el = cardMap.get(n.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'card';
      el.textContent = n.label;
      let dragging=false, ox=0, oy=0;
      el.onpointerdown = e => { dragging=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); };
      el.onpointermove = e => {
        if (!dragging) return;
        const x = e.clientX - ox, y = e.clientY - oy;
        el.style.left = x+'px'; el.style.top = y+'px';
        // reseeds
        if (Math.random()<0.1) injectToken(n.label);
      };
      el.onpointerup = () => dragging=false;
      cardsEl.appendChild(el);
      cardMap.set(n.id, el);
    }
    // position near node
    const tx = n.x + 20, ty = n.y - 30;
    const curL = parseFloat(el.style.left)||tx, curT = parseFloat(el.style.top)||ty;
    el.style.left = (curL*0.7 + tx*0.3) + 'px';
    el.style.top = (curT*0.7 + ty*0.3) + 'px';
    const sc = 0.85 + energy * 0.4 + n.degree*0.05;
    el.style.transform = `scale(${sc})`;
    el.style.boxShadow = `0 0 ${6+energy*14}px hsl(${(n.id*47)%360},70%,60%)`;
    el.style.borderColor = `hsl(${(n.id*47)%360},70%,60%)`;
    el.textContent = n.label + (n.degree? ` ·${n.degree}` : '');
  });
}

// Render
function render() {
  ctx.fillStyle = 'rgba(12,12,20,0.35)';
  ctx.fillRect(0,0,w,h);
  // edges
  ctx.strokeStyle = 'rgba(100,160,255,0.35)';
  ctx.lineWidth = 1;
  edges.forEach(e => {
    const a = nodes[e.a], b = nodes[e.b];
    if (!a||!b) return;
    ctx.globalAlpha = 0.3 + e.w*0.5;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // nodes
  nodes.forEach(n => {
    const r = 3 + n.degree*0.8 + energy*2;
    ctx.fillStyle = `hsla(${(n.id*47)%360},65%,55%,0.85)`;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI*2); ctx.fill();
  });
}

function loop() {
  stepGraph();
  syncCards();
  render();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB
const DB = 'f276';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('g');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('g','readwrite');
  // note: matrix not fully exposed; seal vocab + simple state
  tx.objectStore('g').put({vocab, nodeCount: nodes.length, energy}, 'state');
  document.getElementById('status').textContent = 'Sealed concept state to IndexedDB';
};
document.getElementById('load').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('g');
  const req = tx.objectStore('g').get('state');
  req.onsuccess = () => {
    if (req.result) {
      document.getElementById('status').textContent = 'Loaded sealed state (vocab restored conceptually)';
      // full matrix load would require worker exposure; prototype notes it
    }
  };
};
document.getElementById('reset').onclick = () => {
  initGraph();
  worker.postMessage({type:'reset', vocab: seedVocab});
  cardsEl.innerHTML = ''; cardMap.clear();
  energy = 0.3;
  document.getElementById('status').textContent = 'Reset graph';
};

// WebGPU note: particle/force step can be moved to compute shader with node buffer + edge list; current Canvas2D ensures immediate runnability across devices.

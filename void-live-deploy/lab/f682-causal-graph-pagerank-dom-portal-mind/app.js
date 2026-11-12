const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let nodes = [];
let edges = [];
let nextId = 1;
const MAX_NODES = 120;
let portals = [];
let lastPointer = {x: W/2, y: H/2, t: 0, vx: 0, vy: 0};
let ori = {beta: 0, gamma: 0, lastBeta: 0, lastGamma: 0};
let frame = 0;
const channel = new BroadcastChannel('verse-f682');

function residual(px, py, t) {
  const dt = Math.max(1, t - lastPointer.t);
  const predX = lastPointer.x + lastPointer.vx * dt;
  const predY = lastPointer.y + lastPointer.vy * dt;
  const rx = px - predX, ry = py - predY;
  const mag = Math.hypot(rx, ry);
  lastPointer.vx = (px - lastPointer.x) / dt;
  lastPointer.vy = (py - lastPointer.y) / dt;
  lastPointer.x = px; lastPointer.y = py; lastPointer.t = t;
  return {rx, ry, mag};
}

function spawnNode(x, y, strength) {
  if (nodes.length >= MAX_NODES) {
    const oldest = nodes.shift();
    edges = edges.filter(e => e.a !== oldest.id && e.b !== oldest.id);
  }
  const n = {id: nextId++, x, y, strength, rank: 0.1, boost: 0, born: performance.now()};
  nodes.push(n);
  const recent = nodes.slice(-6, -1);
  recent.forEach(prev => {
    const dist = Math.hypot(n.x - prev.x, n.y - prev.y);
    const dt = (n.born - prev.born) / 1000;
    const w = Math.exp(-dt / 2.5) / (1 + dist / 80);
    if (w > 0.05) edges.push({a: prev.id, b: n.id, w});
  });
  return n;
}

function pageRank() {
  const N = nodes.length;
  if (N === 0) return;
  const damping = 0.85;
  const out = new Map();
  edges.forEach(e => {
    out.set(e.a, (out.get(e.a) || 0) + e.w);
  });
  let ranks = nodes.map(n => 1 / N);
  for (let iter = 0; iter < 6; iter++) {
    const next = new Array(N).fill((1 - damping) / N);
    edges.forEach(e => {
      const ia = nodes.findIndex(n => n.id === e.a);
      const ib = nodes.findIndex(n => n.id === e.b);
      if (ia < 0 || ib < 0) return;
      const ow = out.get(e.a) || 1;
      next[ib] += damping * ranks[ia] * (e.w / ow);
    });
    ranks = next;
  }
  nodes.forEach((n, i) => { n.rank = ranks[i] + n.boost; });
}

function updatePortals() {
  const sorted = [...nodes].sort((a, b) => b.rank - a.rank).slice(0, 6);
  while (portals.length > sorted.length) {
    const p = portals.pop();
    p.el.remove();
  }
  sorted.forEach((node, i) => {
    if (!portals[i]) {
      const el = document.createElement('div');
      el.className = 'portal';
      el.innerHTML = `<b>Node ${node.id}</b><br>rank: <span class="r">0</span><br>boost: <span class="b">0</span>`;
      document.body.appendChild(el);
      portals[i] = {el, node, x: node.x, y: node.y};
      makeDraggable(portals[i]);
    }
    const p = portals[i];
    p.node = node;
    p.x += (node.x - p.x) * 0.12;
    p.y += (node.y - p.y) * 0.12;
    p.el.style.left = (p.x - 70) + 'px';
    p.el.style.top = (p.y - 30) + 'px';
    p.el.querySelector('.r').textContent = node.rank.toFixed(3);
    p.el.querySelector('.b').textContent = node.boost.toFixed(2);
  });
}

function makeDraggable(p) {
  let dragging = false, ox = 0, oy = 0;
  p.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - p.x; oy = e.clientY - p.y;
    p.el.setPointerCapture(e.pointerId);
  });
  p.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.x = e.clientX - ox; p.y = e.clientY - oy;
    p.node.x = p.x; p.node.y = p.y;
  });
  p.el.addEventListener('pointerup', () => { dragging = false; });
  p.el.addEventListener('click', () => { p.node.boost += 0.25; });
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,140,255,0.25)';
  ctx.lineWidth = 1;
  edges.forEach(e => {
    const a = nodes.find(n => n.id === e.a);
    const b = nodes.find(n => n.id === e.b);
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  nodes.forEach(n => {
    const r = 4 + n.rank * 40;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${200 + n.rank * 200}, 80%, 60%, 0.85)`;
    ctx.fill();
  });
}

function loop(t) {
  frame++;
  if (frame % 8 === 0) pageRank();
  updatePortals();
  draw();
  statusEl.textContent = `nodes: ${nodes.length} | portals: ${portals.length}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener('pointermove', e => {
  const t = performance.now();
  const res = residual(e.clientX, e.clientY, t);
  if (res.mag > 28 && t - (lastPointer.lastSpawn || 0) > 120) {
    spawnNode(e.clientX, e.clientY, res.mag);
    lastPointer.lastSpawn = t;
  }
});

document.getElementById('ori').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') addEventListener('deviceorientation', onOri);
    }).catch(() => addEventListener('deviceorientation', onOri));
  } else {
    addEventListener('deviceorientation', onOri);
  }
};
function onOri(e) {
  const db = Math.abs(e.beta - ori.lastBeta);
  const dg = Math.abs(e.gamma - ori.lastGamma);
  if (db + dg > 8) {
    spawnNode(W/2 + (e.gamma||0)*2, H/2 + (e.beta||0)*2, db + dg);
    ori.lastBeta = e.beta; ori.lastGamma = e.gamma;
  }
  ori.beta = e.beta || 0; ori.gamma = e.gamma || 0;
}

document.getElementById('clear').onclick = () => {
  nodes = []; edges = [];
  portals.forEach(p => p.el.remove());
  portals = [];
};

document.getElementById('seal').onclick = async () => {
  const data = {
    nodes: nodes.map(n => ({id: n.id, x: n.x, y: n.y, rank: n.rank, boost: n.boost, strength: n.strength})),
    edges: edges.slice(-80),
    t: Date.now()
  };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f682', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('graph');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('graph', 'readwrite');
    tx.objectStore('graph').put(data, 'current');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) { console.warn(e); }
  channel.postMessage({type: 'seal', data});
  statusEl.textContent = 'sealed ' + nodes.length + ' nodes';
};

channel.onmessage = e => {
  if (e.data?.type === 'seal' && e.data.data) {
    const remote = e.data.data;
    if (remote.nodes && remote.nodes.length > nodes.length) {
      nodes = remote.nodes.map(n => ({...n, born: performance.now()}));
      edges = remote.edges || [];
      nextId = Math.max(...nodes.map(n => n.id), 0) + 1;
    }
  }
};

(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f682', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('graph', 'readonly');
    const req = tx.objectStore('graph').get('current');
    req.onsuccess = () => {
      if (req.result?.nodes) {
        nodes = req.result.nodes.map(n => ({...n, born: performance.now()}));
        edges = req.result.edges || [];
        nextId = Math.max(...nodes.map(n => n.id || 0), 0) + 1;
      }
    };
  } catch (e) { console.debug("lab f682-causal-graph-pagerank-dom-portal-mind:", e); }
})();

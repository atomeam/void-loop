const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_PORTALS = 4;
const portals = [];
for (let i = 0; i < N_PORTALS; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `Portal ${i}\nplan...`;
  el.style.left = (100 + i*160) + 'px';
  el.style.top = (100 + (i%2)*120) + 'px';
  portalsEl.appendChild(el);
  portals.push({ el, x: 100 + i*160, y: 100 + (i%2)*120, vx:0, vy:0, id:i });
}

// Reward field (simple grid)
const GRID = 32;
const reward = new Float32Array(GRID * GRID);
function addReward(px, py, v = 1) {
  const gx = Math.floor(px / W * GRID), gy = Math.floor(py / H * GRID);
  if (gx>=0 && gx<GRID && gy>=0 && gy<GRID) reward[gy*GRID + gx] += v;
}
canvas.addEventListener('pointerdown', e => addReward(e.clientX, e.clientY, 2));
canvas.addEventListener('pointermove', e => { if (e.buttons) addReward(e.clientX, e.clientY, 0.2); });

// Orientation bias
let tiltX = 0, tiltY = 0;
window.addEventListener('deviceorientation', e => {
  tiltX = (e.gamma || 0) / 45;
  tiltY = (e.beta || 0) / 45;
});

// Simple MCTS node
class Node {
  constructor(state, parent = null, action = null) {
    this.state = state; // [x,y] of focused portal
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.value = 0;
  }
  ucb(c = 1.4) {
    if (!this.visits) return Infinity;
    return this.value / this.visits + c * Math.sqrt(Math.log(this.parent.visits) / this.visits);
  }
}

let root = new Node([portals[0].x, portals[0].y]);
let bestPlan = [];
let totalReward = 0;

function sampleReward(x, y) {
  const gx = Math.max(0, Math.min(GRID-1, Math.floor(x / W * GRID)));
  const gy = Math.max(0, Math.min(GRID-1, Math.floor(y / H * GRID)));
  let r = reward[gy*GRID + gx];
  // orientation bias: prefer lower tilt regions or something simple
  r += (1 - Math.abs(tiltX)) * 0.1 + (1 - Math.abs(tiltY)) * 0.1;
  return r;
}

function mctsStep() {
  // Limited iterations
  for (let iter = 0; iter < 32; iter++) {
    let node = root;
    // Selection
    while (node.children.length && node.visits > 0) {
      node = node.children.reduce((a,b) => a.ucb() > b.ucb() ? a : b);
    }
    // Expansion
    if (node.visits > 0 && node.children.length === 0) {
      const dirs = [[20,0],[-20,0],[0,20],[0,-20],[14,14],[-14,14],[14,-14],[-14,-14]];
      for (const d of dirs) {
        const ns = [node.state[0] + d[0], node.state[1] + d[1]];
        if (ns[0]>0 && ns[0]<W && ns[1]>0 && ns[1]<H)
          node.children.push(new Node(ns, node, d));
      }
    }
    // Simulation (rollout)
    let sim = node.state.slice();
    let simVal = 0;
    for (let d = 0; d < 3; d++) {
      sim[0] += (Math.random()-0.5)*40;
      sim[1] += (Math.random()-0.5)*40;
      simVal += sampleReward(sim[0], sim[1]);
    }
    // Backprop
    while (node) {
      node.visits++;
      node.value += simVal;
      node = node.parent;
    }
  }
  // Extract best path
  bestPlan = [];
  let n = root;
  while (n.children.length) {
    n = n.children.reduce((a,b) => (a.visits > b.visits ? a : b));
    bestPlan.push(n.state);
  }
  totalReward = root.value / (root.visits || 1);
}

// Drag portals
let drag = null;
portals.forEach(p => {
  p.el.addEventListener('pointerdown', e => {
    drag = { p, ox: e.clientX - p.x, oy: e.clientY - p.y };
    p.el.setPointerCapture(e.pointerId);
  });
});
addEventListener('pointermove', e => {
  if (!drag) return;
  drag.p.x = e.clientX - drag.ox;
  drag.p.y = e.clientY - drag.oy;
  drag.p.el.style.left = drag.p.x + 'px';
  drag.p.el.style.top = drag.p.y + 'px';
  addReward(drag.p.x, drag.p.y, 0.5);
});
addEventListener('pointerup', () => drag = null);

// Seal
const DB_NAME = 'f843-mcts';
document.getElementById('seal').onclick = async () => {
  const data = { bestPlan, totalReward, timestamp: Date.now() };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('plans');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('plans', 'readwrite');
    tx.objectStore('plans').put(data, 'best');
    const bc = new BroadcastChannel('f843-plan');
    bc.postMessage(data);
    document.getElementById('stats').textContent = 'Sealed! R=' + totalReward.toFixed(2);
  } catch(e) { console.warn(e); }
};

document.getElementById('reset').onclick = () => {
  reward.fill(0);
  root = new Node([portals[0].x, portals[0].y]);
  bestPlan = [];
};

// Listen for sealed plans
try {
  const bc = new BroadcastChannel('f843-plan');
  bc.onmessage = e => {
    if (e.data.totalReward > totalReward) {
      bestPlan = e.data.bestPlan || [];
      totalReward = e.data.totalReward;
    }
  };
} catch (e) { console.debug("lab f843-webgpu-mcts-spatial-planning-portal-mind:", e); }

function loop() {
  mctsStep();
  // Move portals toward plan
  portals.forEach((p, i) => {
    if (bestPlan.length) {
      const target = bestPlan[Math.min(i, bestPlan.length-1)];
      p.x += (target[0] - p.x) * 0.05;
      p.y += (target[1] - p.y) * 0.05;
      p.el.style.left = p.x + 'px';
      p.el.style.top = p.y + 'px';
      p.el.textContent = `Portal ${i}\nR:${totalReward.toFixed(1)}`;
    }
  });
  // Draw
  ctx.clearRect(0,0,W,H);
  // Reward heatmap
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    const v = reward[y*GRID+x];
    if (v > 0.1) {
      ctx.fillStyle = `rgba(100,200,255,${Math.min(0.4, v*0.1)})`;
      ctx.fillRect(x/GRID*W, y/GRID*H, W/GRID, H/GRID);
    }
  }
  // Tree rays
  ctx.strokeStyle = 'rgba(136,136,255,0.4)';
  ctx.lineWidth = 1;
  function drawNode(node, px, py) {
    if (!node) return;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(node.state[0], node.state[1]);
    ctx.stroke();
    node.children.forEach(c => drawNode(c, node.state[0], node.state[1]));
  }
  if (root.children.length) drawNode(root, root.state[0], root.state[1]);
  // Best plan
  if (bestPlan.length) {
    ctx.strokeStyle = '#8f8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(portals[0].x, portals[0].y);
    bestPlan.forEach(s => ctx.lineTo(s[0], s[1]));
    ctx.stroke();
  }
  document.getElementById('stats').textContent = `visits:${root.visits} R:${totalReward.toFixed(2)} tilt:${tiltX.toFixed(1)},${tiltY.toFixed(1)}`;
  requestAnimationFrame(loop);
}
loop();

// WebGPU probe (optional acceleration stub)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => a && a.requestDevice()).then(d => {
    if (d) document.getElementById('stats').textContent += ' · WebGPU ready';
  }).catch(()=>{});
}

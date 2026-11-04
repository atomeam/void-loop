const stage = document.getElementById('stage');
const status = document.getElementById('status');
const N = 6;
let agents = [];
let tilt = {x:0, y:0};
let pointer = {x:0, y:0, dx:0, dy:0, prevX:0, prevY:0};
let channel;
let db;

function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

class DecisionTree {
  constructor() {
    this.nodes = [
      {type:'split', feat:0, thresh:rand(-0.5,0.5), left:1, right:2},
      {type:'split', feat:1, thresh:rand(-0.5,0.5), left:3, right:4},
      {type:'split', feat:2, thresh:rand(-0.3,0.3), left:5, right:6},
      {type:'leaf', out:[rand(-1,1), rand(-1,1), rand(0,1), rand(0.8,1.2)]},
      {type:'leaf', out:[rand(-1,1), rand(-1,1), rand(0,1), rand(0.8,1.2)]},
      {type:'leaf', out:[rand(-1,1), rand(-1,1), rand(0,1), rand(0.8,1.2)]},
      {type:'leaf', out:[rand(-1,1), rand(-1,1), rand(0,1), rand(0.8,1.2)]}
    ];
  }
  evaluate(feats) {
    let i = 0;
    while (this.nodes[i].type === 'split') {
      const n = this.nodes[i];
      i = feats[n.feat] < n.thresh ? n.left : n.right;
    }
    return this.nodes[i].out;
  }
  serialize() { return JSON.parse(JSON.stringify(this.nodes)); }
  static from(nodes) { const t = new DecisionTree(); t.nodes = nodes; return t; }
  mutate() {
    if (Math.random() < 0.5) {
      const splits = this.nodes.filter(n => n.type==='split');
      if (splits.length) {
        const s = splits[Math.floor(Math.random()*splits.length)];
        s.thresh += rand(-0.2,0.2);
      }
    } else {
      const leaves = this.nodes.filter(n => n.type==='leaf');
      const l = leaves[Math.floor(Math.random()*leaves.length)];
      l.out = l.out.map(v => v + rand(-0.3,0.3));
    }
  }
}

async function hashTree(tree, fitness) {
  const data = JSON.stringify({nodes: tree.serialize(), fitness: +fitness.toFixed(4)});
  const buf = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + i;
  stage.appendChild(el);
  return {
    el, tree: new DecisionTree(),
    x: rand(80, window.innerWidth-80), y: rand(80, window.innerHeight-80),
    vx:0, vy:0, fitness:0, id:i
  };
}

function init() {
  agents = [];
  for (let i=0; i<N; i++) agents.push(createAgent(i));
  channel = new BroadcastChannel('f528-trees');
  channel.onmessage = async e => {
    if (e.data.type === 'genome') {
      const {hash, nodes, fitness} = e.data;
      const tmp = DecisionTree.from(nodes);
      const computed = await hashTree(tmp, fitness);
      if (computed === hash) {
        const worst = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
        if (fitness > worst.fitness + 0.05) {
          worst.tree = DecisionTree.from(JSON.parse(JSON.stringify(nodes)));
          worst.tree.mutate();
          status.textContent = `Adopted sealed tree (fit ${fitness.toFixed(2)})`;
        }
      }
    }
  };
  openDB();
  loop();
}

function openDB() {
  const req = indexedDB.open('verse-f528', 1);
  req.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains('seals')) d.createObjectStore('seals');
  };
  req.onsuccess = e => { db = e.target.result; };
}

async function sealBest() {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const h = await hashTree(best.tree, best.fitness);
  if (db) {
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({hash:h, nodes:best.tree.serialize(), fitness:best.fitness}, 'best');
  }
  channel.postMessage({type:'genome', hash:h, nodes:best.tree.serialize(), fitness:best.fitness});
  status.textContent = `Sealed best tree ${h.slice(0,8)}… fit ${best.fitness.toFixed(2)}`;
}

function updateFeatures(a) {
  let density = 0;
  agents.forEach(o => {
    if (o === a) return;
    const dx = o.x - a.x, dy = o.y - a.y;
    const d = Math.hypot(dx,dy);
    if (d < 120) density += (120-d)/120;
  });
  return [
    tilt.x, tilt.y,
    pointer.dx * 0.05, pointer.dy * 0.05,
    density / N
  ];
}

function step() {
  agents.forEach(a => {
    const feats = updateFeatures(a);
    const out = a.tree.evaluate(feats);
    a.vx += out[0] * 0.4 + tilt.x * 0.15;
    a.vy += out[1] * 0.4 + tilt.y * 0.15;
    agents.forEach(o => {
      if (o === a) return;
      const dx = a.x - o.x, dy = a.y - o.y;
      const d = Math.hypot(dx,dy) || 1;
      if (d < 90) {
        const f = (90-d)/90 * 0.8;
        a.vx += (dx/d)*f;
        a.vy += (dy/d)*f;
        if (Math.random() < 0.02 && a.fitness > o.fitness) {
          hashTree(a.tree, a.fitness).then(h => {
            channel.postMessage({type:'genome', hash:h, nodes:a.tree.serialize(), fitness:a.fitness});
          });
        }
      }
    });
    a.vx *= 0.92; a.vy *= 0.92;
    a.vx = clamp(a.vx, -6, 6); a.vy = clamp(a.vy, -6, 6);
    a.x = clamp(a.x + a.vx, 40, window.innerWidth-40);
    a.y = clamp(a.y + a.vy, 40, window.innerHeight-40);
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const dist = Math.hypot(a.x-cx, a.y-cy);
    a.fitness = (1 - dist / (Math.hypot(cx,cy))) * 0.6 + (1 - Math.hypot(a.vx,a.vy)/8) * 0.3 + (1 - feats[4]) * 0.1;
    a.fitness = clamp(a.fitness, 0, 1);
    const hue = (out[2]*360) | 0;
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.el.style.background = `hsla(${hue},70%,40%,0.75)`;
    a.el.style.transform = `scale(${out[3]})`;
    a.el.classList.toggle('high', a.fitness > 0.6);
    a.el.textContent = 'A'+a.id + '\n' + a.fitness.toFixed(2);
  });
  pointer.dx *= 0.9; pointer.dy *= 0.9;
}

function loop() {
  step();
  requestAnimationFrame(loop);
}

document.getElementById('perm').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') startOrient();
      else status.textContent = 'Orientation denied; using pointer.';
    });
  } else {
    startOrient();
  }
};
function startOrient() {
  window.addEventListener('deviceorientation', e => {
    tilt.x = clamp((e.gamma || 0)/45, -1, 1);
    tilt.y = clamp((e.beta || 0)/45, -1, 1);
  });
  status.textContent = 'Orientation active. Tilt to drive trees.';
}
window.addEventListener('pointermove', e => {
  pointer.dx = e.clientX - pointer.prevX;
  pointer.dy = e.clientY - pointer.prevY;
  pointer.prevX = e.clientX; pointer.prevY = e.clientY;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
document.getElementById('seal').onclick = sealBest;
document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.tree = new DecisionTree());
  status.textContent = 'Trees reset.';
};

init();

const N = 10;
const stage = document.getElementById('stage');
const info = document.getElementById('info');
const statusEl = document.getElementById('status');
let agents = [];
let bestFitness = -Infinity;
let bestTree = null;
let ori = { beta: 0, gamma: 0 };
let ptr = { x: 0, y: 0, vx: 0, vy: 0 };
let lastPtr = { x: 0, y: 0 };
let t = 0;
const channel = new BroadcastChannel('verse-f712-genome');
const DB_NAME = 'verse-f712';
const STORE = 'genomes';

function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function randomTree(depth=0) {
  if (depth > 3 || Math.random() < 0.35) {
    const leaves = ['beta','gamma','vx','vy','t','fit','c'];
    const name = leaves[Math.floor(Math.random()*leaves.length)];
    return name === 'c' ? {op:'c', val: rand(-1.2,1.2)} : {op:'v', name};
  }
  const ops = ['+','*','-','sin','abs','tanh'];
  const op = ops[Math.floor(Math.random()*ops.length)];
  if (op === 'sin' || op === 'abs' || op === 'tanh') return {op, a: randomTree(depth+1)};
  return {op, a: randomTree(depth+1), b: randomTree(depth+1)};
}
function evalTree(node, ctx) {
  if (!node) return 0;
  switch(node.op) {
    case 'c': return node.val;
    case 'v': return ctx[node.name] ?? 0;
    case '+': return evalTree(node.a,ctx) + evalTree(node.b,ctx);
    case '*': return evalTree(node.a,ctx) * evalTree(node.b,ctx);
    case '-': return evalTree(node.a,ctx) - evalTree(node.b,ctx);
    case 'sin': return Math.sin(evalTree(node.a,ctx) * 2);
    case 'abs': return Math.abs(evalTree(node.a,ctx));
    case 'tanh': return Math.tanh(evalTree(node.a,ctx));
    default: return 0;
  }
}
function mutate(tree, rate=0.25) {
  if (Math.random() > rate) {
    if (tree.a) tree.a = mutate(tree.a, rate*0.7);
    if (tree.b) tree.b = mutate(tree.b, rate*0.7);
    return tree;
  }
  if (Math.random() < 0.4) return randomTree(0);
  if (tree.op === 'c') tree.val += rand(-0.3,0.3);
  else if (Math.random() < 0.5 && tree.a) tree.a = randomTree(1);
  return tree;
}
function clone(t) { return JSON.parse(JSON.stringify(t)); }

function makeAgent(i, tree) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + i;
  stage.appendChild(el);
  return {
    i, el, tree: tree || randomTree(),
    x: rand(80, window.innerWidth-80),
    y: rand(80, window.innerHeight-80),
    vx: 0, vy: 0,
    fitness: 0,
    hue: rand(160,200),
    scale: 1,
    radius: 18
  };
}

function applyStyle(a) {
  a.el.style.left = (a.x - 45) + 'px';
  a.el.style.top = (a.y - 45) + 'px';
  a.el.style.transform = `translateZ(${(a.fitness-50)*0.4}px) scale(${clamp(a.scale,0.6,1.6)})`;
  a.el.style.filter = `hue-rotate(${a.hue}deg) brightness(${0.8 + a.fitness*0.004})`;
  a.el.style.borderRadius = clamp(a.radius, 6, 40) + 'px';
  a.el.style.opacity = 0.7 + Math.min(0.3, a.fitness*0.003);
}

function step() {
  t += 0.016;
  const w = window.innerWidth, h = window.innerHeight;
  for (const a of agents) {
    const ctx = {
      beta: ori.beta * 0.02,
      gamma: ori.gamma * 0.02,
      vx: ptr.vx * 0.01,
      vy: ptr.vy * 0.01,
      t: t * 0.3,
      fit: a.fitness * 0.01,
      c: 0
    };
    const dx = evalTree(a.tree, ctx) * 8;
    const dy = evalTree(a.tree, {...ctx, t: t*0.31}) * 8;
    const sc = 1 + evalTree(a.tree, {...ctx, t: t*0.2}) * 0.15;
    const hu = evalTree(a.tree, {...ctx, beta: ctx.gamma}) * 30;
    const rad = 18 + evalTree(a.tree, {...ctx, fit: ctx.beta}) * 8;

    a.vx = a.vx * 0.92 + dx * 0.08;
    a.vy = a.vy * 0.92 + dy * 0.08;
    a.x = clamp(a.x + a.vx, 40, w-40);
    a.y = clamp(a.y + a.vy, 40, h-40);
    a.scale = sc;
    a.hue = (a.hue + hu * 0.1) % 360;
    a.radius = rad;
    a.fitness *= 0.995;
    applyStyle(a);
  }
  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx,dy);
      if (d < 70 && d > 0) {
        const push = (70-d)*0.04;
        a.x += dx/d * push; b.x -= dx/d * push;
        a.y += dy/d * push; b.y -= dy/d * push;
        if (a.fitness > b.fitness + 5) {
          b.tree = mutate(clone(a.tree), 0.35);
          b.fitness = a.fitness * 0.6;
          a.fitness += 2;
        } else if (b.fitness > a.fitness + 5) {
          a.tree = mutate(clone(b.tree), 0.35);
          a.fitness = b.fitness * 0.6;
          b.fitness += 2;
        }
      }
    }
  }
  const maxF = Math.max(...agents.map(a=>a.fitness), 0);
  if (maxF > bestFitness) { bestFitness = maxF; bestTree = clone(agents.find(a=>a.fitness===maxF).tree); }
  info.textContent = `agents: ${agents.length} · best: ${bestFitness.toFixed(1)}`;
  requestAnimationFrame(step);
}

function reward(a) {
  a.fitness += 25;
  a.el.style.boxShadow = '0 0 40px #0ff';
  setTimeout(()=>a.el.style.boxShadow='', 300);
}

async function openDB() {
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveBest() {
  if (!bestTree) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ tree: bestTree, fitness: bestFitness, t: Date.now() }, 'best');
    await new Promise(r => tx.oncomplete = r);
    channel.postMessage({ type:'genome', tree: bestTree, fitness: bestFitness });
    statusEl.textContent = 'Sealed best genome · fitness ' + bestFitness.toFixed(1);
  } catch(e) { statusEl.textContent = 'Seal failed (IDB)'; }
}
async function loadBest() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('best');
    await new Promise(r => req.onsuccess = r);
    if (req.result && req.result.tree) {
      bestTree = req.result.tree;
      bestFitness = req.result.fitness || 0;
      agents.forEach(a => { a.tree = mutate(clone(bestTree), 0.15); });
      statusEl.textContent = 'Loaded sealed genome';
    }
  } catch (e) { console.debug("lab f712-expression-tree-dom-swarm-mind:", e); }
}

document.getElementById('seal').onclick = saveBest;
document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.el.remove());
  agents = [];
  for (let i=0; i<N; i++) agents.push(makeAgent(i));
  bestFitness = -Infinity;
  statusEl.textContent = 'Reset · fresh random trees';
};
document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try { await DeviceOrientationEvent.requestPermission(); } catch (e) { console.debug("lab f712-expression-tree-dom-swarm-mind:", e); }
  }
  statusEl.textContent = 'Orientation requested';
};

window.addEventListener('deviceorientation', e => {
  ori.beta = e.beta || 0;
  ori.gamma = e.gamma || 0;
});
window.addEventListener('pointermove', e => {
  ptr.vx = e.clientX - lastPtr.x;
  ptr.vy = e.clientY - lastPtr.y;
  lastPtr.x = e.clientX; lastPtr.y = e.clientY;
  ptr.x = e.clientX; ptr.y = e.clientY;
});
stage.addEventListener('click', e => {
  const el = e.target.closest('.agent');
  if (!el) return;
  const a = agents.find(x => x.el === el);
  if (a) reward(a);
});

channel.onmessage = ev => {
  if (ev.data?.type === 'genome' && ev.data.fitness > bestFitness) {
    bestFitness = ev.data.fitness;
    bestTree = ev.data.tree;
    agents.forEach(a => a.tree = mutate(clone(bestTree), 0.2));
    statusEl.textContent = 'Adopted peer genome · ' + bestFitness.toFixed(1);
  }
};

for (let i=0; i<N; i++) agents.push(makeAgent(i));
loadBest();
requestAnimationFrame(step);
statusEl.textContent = 'F712 Expression-Tree DOM Swarm · tilt or move pointer';

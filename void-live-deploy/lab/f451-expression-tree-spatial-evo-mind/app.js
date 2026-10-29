const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const ops = ['+', '*', 'sin', 'cos', 'abs', 'x', 'y', 't'];
function randOp() { return ops[Math.floor(Math.random()*ops.length)]; }
function makeTree(depth=0) {
  if (depth > 4 || Math.random() < 0.3) return { type:'leaf', val: randOp() };
  return { type:'op', op: randOp(), left: makeTree(depth+1), right: makeTree(depth+1) };
}
function evalTree(node, x, y, t) {
  if (!node) return 0;
  if (node.type === 'leaf') {
    if (node.val === 'x') return x;
    if (node.val === 'y') return y;
    if (node.val === 't') return t;
    return 0;
  }
  const L = evalTree(node.left, x, y, t);
  const R = evalTree(node.right, x, y, t);
  switch (node.op) {
    case '+': return L + R;
    case '*': return L * R;
    case 'sin': return Math.sin(L);
    case 'cos': return Math.cos(L);
    case 'abs': return Math.abs(L);
    default: return L;
  }
}
function serialize(node) { return JSON.stringify(node); }
function clone(node) { return JSON.parse(serialize(node)); }
function mutate(node, p=0.15) {
  if (Math.random() < p) {
    if (node.type === 'leaf') node.val = randOp();
    else node.op = randOp();
  }
  if (node.left) mutate(node.left, p);
  if (node.right) mutate(node.right, p);
  return node;
}

let champ = makeTree();
let fitness = 0;
let t = 0;
const nodes = [];

function updateNodes() {
  nodes.forEach(n => n.el.remove());
  nodes.length = 0;
  function walk(n, depth=0) {
    if (!n || nodes.length > 12) return;
    const el = document.createElement('div');
    el.className = 'node';
    el.textContent = n.type === 'leaf' ? n.val : n.op;
    el.style.left = (20 + nodes.length * 70) + 'px';
    el.style.top = (80 + depth * 30) + 'px';
    document.body.appendChild(el);
    nodes.push({ el, node: n });
    if (n.left) walk(n.left, depth+1);
    if (n.right) walk(n.right, depth+1);
  }
  walk(champ);
}
updateNodes();

function render() {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      const nx = (x / W) * 4 - 2, ny = (y / H) * 4 - 2;
      const v = Math.tanh(evalTree(champ, nx, ny, t * 0.01));
      const r = Math.floor(128 + 127 * v);
      const g = Math.floor(80 + 100 * Math.abs(v));
      const b = Math.floor(180 + 75 * (1 - v));
      for (let dy = 0; dy < 4 && y+dy < H; dy++)
        for (let dx = 0; dx < 4 && x+dx < W; dx++) {
          const ii = ((y+dy)*W + (x+dx)) * 4;
          d[ii] = r; d[ii+1] = g; d[ii+2] = b; d[ii+3] = 255;
        }
    }
  }
  ctx.putImageData(img, 0, 0);
  document.getElementById('status').textContent = `fitness: ${fitness.toFixed(1)} | depth: ~4 | nodes: ${nodes.length}`;
}

canvas.addEventListener('click', e => {
  const nx = (e.clientX / W) * 4 - 2, ny = (e.clientY / H) * 4 - 2;
  const v = Math.abs(evalTree(champ, nx, ny, t * 0.01));
  fitness += v * 2 + 0.5;
  champ = mutate(clone(champ), 0.25);
  updateNodes();
});

document.getElementById('evolve').onclick = () => {
  champ = mutate(clone(champ), 0.2);
  fitness *= 0.95;
  updateNodes();
};
document.getElementById('seal').onclick = async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('F451', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('champ');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('champ', 'readwrite');
  tx.objectStore('champ').put({ tree: champ, fitness }, 'current');
  alert('Sealed');
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('F451', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('champ', 'readonly');
    const req = tx.objectStore('champ').get('current');
    req.onsuccess = () => {
      if (req.result) { champ = req.result.tree; fitness = req.result.fitness || 0; updateNodes(); }
    };
  } catch (e) { console.warn(e); }
};

function loop() {
  t++;
  render();
  requestAnimationFrame(loop);
}
loop();

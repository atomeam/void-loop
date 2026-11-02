const N = 12;
const stage = document.getElementById('stage');
const logEl = document.getElementById('log');
let agents = [];
let sealed = null;
let db;
const channel = new BroadcastChannel('verse-genome-f491');

function log(msg) {
  logEl.innerHTML = `<div>${new Date().toLocaleTimeString()}: ${msg}</div>` + logEl.innerHTML.slice(0, 800);
}

class TinyMLP {
  constructor(weights) {
    this.w = weights || Array.from({length: 8}, () => (Math.random()-0.5)*2);
  }
  forward(inputs) { // inputs: [res, dens, t, sin]
    let h = 0;
    for (let i=0; i<4; i++) h += inputs[i] * this.w[i];
    h = Math.tanh(h);
    return [Math.tanh(h * this.w[4] + this.w[5]), Math.tanh(h * this.w[6] + this.w[7])];
  }
  clone() { return new TinyMLP([...this.w]); }
  hash() { return this.w.map(x => x.toFixed(3)).join(','); }
}

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f491', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('pop', {keyPath: 'id'});
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
}

async function loadPop() {
  const tx = db.transaction('pop', 'readonly');
  const store = tx.objectStore('pop');
  return new Promise(res => {
    const r = store.getAll();
    r.onsuccess = () => res(r.result || []);
  });
}

async function savePop() {
  const tx = db.transaction('pop', 'readwrite');
  const store = tx.objectStore('pop');
  agents.forEach((a,i) => store.put({id: i, w: a.mlp.w, fitness: a.fitness}));
  log('Saved to IndexedDB');
}

function createAgent(i, weights) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = i;
  el.dataset.i = i;
  stage.appendChild(el);
  const mlp = new TinyMLP(weights);
  return { el, mlp, x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, fitness: 0, sealed: false };
}

async function init() {
  db = await openDB();
  const saved = await loadPop();
  agents = [];
  stage.innerHTML = '';
  for (let i=0; i<N; i++) {
    const w = saved[i] ? saved[i].w : null;
    const a = createAgent(i, w);
    if (saved[i]) a.fitness = saved[i].fitness;
    agents.push(a);
  }
  log(saved.length ? 'Restored from IndexedDB' : 'New population');
  requestAnimationFrame(loop);
}

function loop(t) {
  const time = t * 0.001;
  agents.forEach((a, i) => {
    const dens = agents.filter(b => b !== a && Math.hypot(b.x-a.x, b.y-a.y) < 100).length / N;
    const res = Math.sin(a.x*0.01 + time) * 0.5 + 0.5;
    const out = a.mlp.forward([res, dens, Math.sin(time), Math.cos(time*0.7)]);
    a.x = Math.max(20, Math.min(window.innerWidth-20, a.x + out[0]*3));
    a.y = Math.max(20, Math.min(window.innerHeight-20, a.y + out[1]*3));
    a.fitness += res * 0.01 - dens * 0.005;
    a.el.style.transform = `translate(${a.x}px, ${a.y}px) rotateX(${out[0]*30}deg) rotateY(${out[1]*30}deg)`;
    a.el.classList.toggle('weak', a.fitness < 0.5);
    a.el.classList.toggle('sealed', a.sealed);
  });
  requestAnimationFrame(loop);
}

stage.addEventListener('click', e => {
  const el = e.target.closest('.agent');
  if (!el) return;
  const i = +el.dataset.i;
  const a = agents[i];
  if (!sealed) {
    sealed = { hash: a.mlp.hash(), w: [...a.mlp.w], from: i };
    a.sealed = true;
    log(`Sealed genome from agent ${i}: ${sealed.hash.slice(0,20)}...`);
    channel.postMessage({type: 'seal', ...sealed});
  } else if (a.fitness < 1) {
    a.mlp = new TinyMLP(sealed.w);
    a.sealed = true;
    log(`Transferred sealed genome to agent ${i}`);
    channel.postMessage({type: 'transfer', to: i, w: sealed.w});
    sealed = null;
    agents.forEach(ag => ag.sealed = false);
    savePop();
  }
});

channel.onmessage = e => {
  const m = e.data;
  if (m.type === 'seal') {
    log(`Remote seal from tab: agent ${m.from}`);
  } else if (m.type === 'transfer' && agents[m.to]) {
    agents[m.to].mlp = new TinyMLP(m.w);
    log(`Remote transfer to agent ${m.to}`);
    savePop();
  }
};

document.getElementById('reset').onclick = () => {
  indexedDB.deleteDatabase('verse-f491');
  location.reload();
};
document.getElementById('save').onclick = savePop;

init();

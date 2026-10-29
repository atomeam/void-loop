const field = document.getElementById('field');
const status = document.getElementById('status');
let agents = [];
let selected = null;
let orientation = { beta: 0, gamma: 0 }; // tilt
let mouse = { x: 0.5, y: 0.5 };
let db;

// Tiny MLP: input 4 (orient + mouse + bias), hidden 6, output 2 (dx, dy)
class MLP {
  constructor(weights = null) {
    this.sizes = [4, 6, 2];
    if (weights) {
      this.w = weights;
    } else {
      this.w = [
        Array(6).fill(0).map(() => Array(4).fill(0).map(() => (Math.random()-0.5)*0.8)),
        Array(2).fill(0).map(() => Array(6).fill(0).map(() => (Math.random()-0.5)*0.8))
      ];
    }
  }
  forward(input) {
    let a = input;
    for (let l = 0; l < this.w.length; l++) {
      const next = [];
      for (let j = 0; j < this.w[l].length; j++) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += a[i] * this.w[l][j][i];
        next.push(Math.tanh(s));
      }
      a = next;
    }
    return a;
  }
  mutate(rate = 0.15) {
    const nw = JSON.parse(JSON.stringify(this.w));
    for (let l = 0; l < nw.length; l++)
      for (let j = 0; j < nw[l].length; j++)
        for (let i = 0; i < nw[l][j].length; i++)
          if (Math.random() < rate) nw[l][j][i] += (Math.random()-0.5)*0.4;
    return new MLP(nw);
  }
  serialize() { return this.w; }
}

function hashGenome(w) {
  // simple sealed hash (not crypto, demo)
  const s = JSON.stringify(w);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0');
}

function createAgent(x, y, mlp = null) {
  const el = document.createElement('div');
  el.className = 'agent';
  const m = mlp || new MLP();
  const agent = { el, mlp: m, x, y, fitness: 0, id: Math.random().toString(36).slice(2,8), hash: hashGenome(m.serialize()) };
  el.innerHTML = `<div>${agent.id}</div><div class="fitness">0</div><div style="font-size:8px">${agent.hash.slice(0,6)}</div>`;
  el.onclick = () => select(agent);
  field.appendChild(el);
  agents.push(agent);
  updatePos(agent);
  return agent;
}

function updatePos(a) {
  a.el.style.left = (a.x * 100) + '%';
  a.el.style.top = (a.y * 100) + '%';
  a.el.style.transform = `translate(-50%, -50%)`;
}

function select(a) {
  if (selected) selected.el.classList.remove('selected');
  selected = a;
  a.el.classList.add('selected');
}

function step() {
  const inp = [orientation.beta/45, orientation.gamma/45, mouse.x*2-1, mouse.y*2-1];
  agents.forEach(a => {
    const out = a.mlp.forward(inp);
    a.x = Math.max(0.05, Math.min(0.95, a.x + out[0] * 0.012));
    a.y = Math.max(0.05, Math.min(0.95, a.y + out[1] * 0.012));
    // fitness: stay near center or respond to tilt
    const dist = Math.hypot(a.x-0.5, a.y-0.5);
    a.fitness = Math.max(0, a.fitness * 0.99 + (1 - dist) * 0.5);
    a.el.querySelector('.fitness').textContent = a.fitness.toFixed(1);
    updatePos(a);
  });
  requestAnimationFrame(step);
}

// Persistence
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('void-f189', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('field')) d.createObjectStore('field');
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function seal() {
  if (!db) db = await openDB();
  const data = agents.map(a => ({
    x: a.x, y: a.y, fitness: a.fitness, id: a.id,
    w: a.mlp.serialize(), hash: a.hash
  }));
  const tx = db.transaction('field', 'readwrite');
  tx.objectStore('field').put(data, 'agents');
  status.textContent = `Sealed ${agents.length} agents to IndexedDB · ${new Date().toLocaleTimeString()}`;
}

async function load() {
  try {
    db = await openDB();
    const tx = db.transaction('field', 'readonly');
    const req = tx.objectStore('field').get('agents');
    req.onsuccess = () => {
      if (req.result && req.result.length) {
        field.innerHTML = '';
        agents = [];
        req.result.forEach(d => {
          const m = new MLP(d.w);
          const a = createAgent(d.x, d.y, m);
          a.fitness = d.fitness;
          a.id = d.id;
          a.hash = d.hash;
          a.el.innerHTML = `<div>${a.id}</div><div class="fitness">${a.fitness.toFixed(1)}</div><div style="font-size:8px">${a.hash.slice(0,6)}</div>`;
        });
        status.textContent = `Restored ${agents.length} sealed agents`;
      } else {
        for (let i = 0; i < 4; i++) createAgent(0.3 + Math.random()*0.4, 0.3 + Math.random()*0.4);
      }
    };
  } catch (e) {
    status.textContent = 'IndexedDB unavailable — session only';
    for (let i = 0; i < 4; i++) createAgent(0.3 + Math.random()*0.4, 0.3 + Math.random()*0.4);
  }
}

// WebRTC stub for sealed genome transfer (signaling via paste for demo)
function exportGenome() {
  if (!selected) return alert('Select an agent first');
  const payload = { hash: selected.hash, w: selected.mlp.serialize(), id: selected.id };
  const text = btoa(JSON.stringify(payload));
  navigator.clipboard?.writeText(text).then(() => {
    status.textContent = `Exported sealed genome ${selected.hash} (copied)`;
  }).catch(() => {
    prompt('Copy this sealed genome:', text);
  });
}

function importGenome() {
  const raw = document.getElementById('paste').value.trim();
  if (!raw) return;
  try {
    const payload = JSON.parse(atob(raw));
    if (payload.hash !== hashGenome(payload.w)) {
      status.textContent = 'Hash mismatch — rejected';
      return;
    }
    const m = new MLP(payload.w);
    createAgent(0.5, 0.5, m);
    status.textContent = `Imported sealed genome ${payload.hash}`;
    document.getElementById('paste').value = '';
  } catch (e) {
    status.textContent = 'Invalid genome payload';
  }
}

// Events
document.getElementById('add').onclick = () => createAgent(Math.random()*0.8+0.1, Math.random()*0.8+0.1);
document.getElementById('breed').onclick = () => {
  if (!selected) return;
  const child = selected.mlp.mutate();
  createAgent(selected.x + 0.05, selected.y + 0.05, child);
  status.textContent = 'Bred mutated child from selected';
};
document.getElementById('seal').onclick = seal;
document.getElementById('share').onclick = exportGenome;
document.getElementById('import').onclick = importGenome;
document.getElementById('clear').onclick = async () => {
  if (db) {
    const tx = db.transaction('field', 'readwrite');
    tx.objectStore('field').clear();
    status.textContent = 'Cleared IndexedDB';
  }
};

window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orientation = { beta: e.beta, gamma: e.gamma };
});
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX / innerWidth;
  mouse.y = e.clientY / innerHeight;
});

// Simple multi-tab via BroadcastChannel as WebRTC proxy when no peer
const bc = new BroadcastChannel('void-f189');
bc.onmessage = e => {
  if (e.data.type === 'genome') {
    status.textContent = `Received sealed genome from peer: ${e.data.hash}`;
    // auto-import option could go here
  }
};

load();
requestAnimationFrame(step);

status.textContent += ' · Offline-capable · Sealed genomes via hash';

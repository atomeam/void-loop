const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const conceptInput = document.getElementById('concept');
let nodes = [];
let edges = [];
let genome = null;
let audioCtx = null;
let masterGain = null;
let worker = null;
let opfsRoot = null;
let dragging = null;
let offset = {x:0,y:0};
let eventSeq = [];
const MAX_NODES = 20;

function log(msg) {
  const d = document.createElement('div');
  d.textContent = new Date().toLocaleTimeString() + ' ' + msg;
  logEl.prepend(d);
  if (logEl.children.length > 8) logEl.lastChild.remove();
}

async function initOPFS() {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('f553-mind', { create: true });
    opfsRoot = dir;
    statusEl.textContent = 'OPFS ready';
    log('OPFS mounted');
    return true;
  } catch (e) {
    statusEl.textContent = 'OPFS unavailable – session only';
    log('OPFS fail: ' + e.message);
    return false;
  }
}

async function loadFromOPFS() {
  if (!opfsRoot) return;
  try {
    const fh = await opfsRoot.getFileHandle('graph.json');
    const file = await fh.getFile();
    const data = JSON.parse(await file.text());
    nodes = data.nodes || [];
    edges = data.edges || [];
    genome = data.genome || null;
    log('Restored ' + nodes.length + ' nodes');
  } catch { log('No prior seal'); }
}

async function seal() {
  if (!opfsRoot) { log('No OPFS – cannot seal'); return; }
  const data = { nodes: nodes.map(n => ({id:n.id, label:n.label, x:n.el.offsetLeft, y:n.el.offsetTop})), edges, genome, ts: Date.now() };
  const fh = await opfsRoot.getFileHandle('graph.json', { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(data));
  await w.close();
  log('Sealed to OPFS');
  statusEl.textContent = 'Sealed';
}

function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.08;
  masterGain.connect(audioCtx.destination);
  log('AudioContext started');
}

function createNode(label, x, y) {
  if (nodes.length >= MAX_NODES) { log('Node cap'); return; }
  startAudio();
  const id = 'n' + Date.now() + Math.random().toString(36).slice(2,5);
  const el = document.createElement('div');
  el.className = 'node';
  el.textContent = label;
  el.style.left = (x || 100 + Math.random()*400) + 'px';
  el.style.top = (y || 100 + Math.random()*300) + 'px';
  stage.appendChild(el);
  const osc = audioCtx.createOscillator();
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  osc.frequency.value = 120 + nodes.length * 30;
  osc.type = 'sine';
  const g = audioCtx.createGain();
  g.gain.value = 0.4;
  osc.connect(g);
  g.connect(panner);
  panner.connect(masterGain);
  osc.start();
  const node = { id, label, el, osc, panner, g, vx:0, vy:0 };
  nodes.push(node);
  el.addEventListener('pointerdown', e => {
    dragging = node;
    offset.x = e.clientX - el.offsetLeft;
    offset.y = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
    eventSeq.push({t:Date.now(), type:'drag', id});
  });
  log('Node: ' + label);
  return node;
}

function updatePanners() {
  if (!audioCtx) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  nodes.forEach(n => {
    const x = (n.el.offsetLeft / w - 0.5) * 4;
    const y = (0.5 - n.el.offsetTop / h) * 3;
    n.panner.positionX.value = x;
    n.panner.positionY.value = y;
    n.panner.positionZ.value = -1;
  });
}

function forceTick() {
  const k = 0.02;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    let fx = 0, fy = 0;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const b = nodes[j];
      const dx = b.el.offsetLeft - a.el.offsetLeft;
      const dy = b.el.offsetTop - a.el.offsetTop;
      const dist = Math.hypot(dx, dy) || 1;
      fx -= (dx / dist) * 800 / (dist * dist);
      fy -= (dy / dist) * 800 / (dist * dist);
      const e = edges.find(ed => (ed.a===a.id && ed.b===b.id) || (ed.a===b.id && ed.b===a.id));
      if (e) {
        const wgt = e.w || 0.3;
        fx += (dx / dist) * wgt * 40;
        fy += (dy / dist) * wgt * 40;
      }
    }
    a.vx = (a.vx + fx * k) * 0.85;
    a.vy = (a.vy + fy * k) * 0.85;
    let nx = a.el.offsetLeft + a.vx;
    let ny = a.el.offsetTop + a.vy;
    nx = Math.max(20, Math.min(stage.clientWidth-80, nx));
    ny = Math.max(20, Math.min(stage.clientHeight-40, ny));
    a.el.style.left = nx + 'px';
    a.el.style.top = ny + 'px';
  }
  updatePanners();
}

function connectNodes(a, b, w=0.5) {
  if (!edges.find(e => (e.a===a && e.b===b) || (e.a===b && e.b===a))) {
    edges.push({a, b, w});
  }
}

const workerCode = `\nlet pop = [];\nconst POP = 8;\nonmessage = e => {\n  if (e.data.cmd === 'init') {\n    pop = Array.from({length:POP}, () => ({ genes: Array(6).fill(0).map(()=>Math.random()), fit:0 }));\n  }\n  if (e.data.cmd === 'step') {\n    const events = e.data.events || [];\n    pop.forEach(ind => {\n      ind.fit = Math.random() * 0.5 + (events.length % 5) * 0.1 + ind.genes.reduce((s,g)=>s+g,0)*0.05;\n    });\n    pop.sort((a,b)=>b.fit-a.fit);\n    const elite = pop[0];\n    for (let i=1;i<POP;i++) {\n      pop[i].genes = elite.genes.map(g => g + (Math.random()-0.5)*0.2);\n    }\n    postMessage({ elite: pop[0] });\n  }\n};\n`;
const blob = new Blob([workerCode], {type:'application/javascript'});
worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  if (e.data.elite) {
    genome = e.data.elite;
    edges.forEach((ed,i) => { ed.w = Math.max(0.1, Math.min(1, (genome.genes[i % genome.genes.length] + 1)/2 )); });
    nodes.forEach(n => n.el.classList.toggle('high', genome.fit > 0.6));
    log('Evo elite fit ' + genome.fit.toFixed(2));
  }
};
worker.postMessage({cmd:'init'});

setInterval(() => {
  forceTick();
  if (eventSeq.length > 2) {
    worker.postMessage({cmd:'step', events: eventSeq.slice(-10)});
  }
}, 80);

conceptInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && conceptInput.value.trim()) {
    const label = conceptInput.value.trim();
    const n = createNode(label);
    if (nodes.length > 1) connectNodes(nodes[nodes.length-2].id, n.id, 0.4 + Math.random()*0.4);
    eventSeq.push({t:Date.now(), type:'concept', label});
    conceptInput.value = '';
  }
});

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { location.reload(); };

document.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.el.style.left = (e.clientX - offset.x) + 'px';
    dragging.el.style.top = (e.clientY - offset.y) + 'px';
  }
});
document.addEventListener('pointerup', () => { dragging = null; });

(async () => {
  await initOPFS();
  await loadFromOPFS();
  if (nodes.length === 0) {
    createNode('Verse', 200, 200);
    createNode('Mind', 400, 250);
    connectNodes(nodes[0].id, nodes[1].id, 0.6);
  } else {
    const saved = [...nodes];
    nodes = [];
    saved.forEach(s => createNode(s.label, s.x, s.y));
  }
  statusEl.textContent = 'Ready – type concepts, drag nodes, Seal';
  log('Mind online');
})();

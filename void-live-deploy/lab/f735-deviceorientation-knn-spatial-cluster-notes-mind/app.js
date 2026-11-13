const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const notesEl = document.getElementById('notes');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let notes = []; // {id, text, x, y, cluster, el}
let examples = []; // training examples {features: [x,y,len,hash], label: cluster}
let nextId = 1;
let clusters = 4;
let orientation = {alpha:0, beta:0, gamma:0};
const channel = new BroadcastChannel('f735-genome');

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000 / 1000;
}

function features(n) {
  return [n.x / W, n.y / H, n.text.length / 100, hash(n.text)];
}

function knnPredict(feat, k=5) {
  if (examples.length === 0) return Math.floor(Math.random() * clusters);
  const dists = examples.map(ex => ({
    d: Math.hypot(ex.features[0]-feat[0], ex.features[1]-feat[1], ex.features[2]-feat[2], ex.features[3]-feat[3]),
    label: ex.label
  })).sort((a,b) => a.d - b.d).slice(0, Math.min(k, examples.length));
  const votes = {};
  dists.forEach(d => votes[d.label] = (votes[d.label]||0) + 1);
  return +Object.keys(votes).reduce((a,b) => votes[a] > votes[b] ? a : b);
}

function addNote(text) {
  if (!text.trim()) return;
  const n = {id: nextId++, text: text.trim(), x: Math.random()*W*0.8+W*0.1, y: Math.random()*H*0.6+H*0.2, cluster: 0};
  n.cluster = knnPredict(features(n));
  notes.push(n);
  renderNote(n);
}

function renderNote(n) {
  const el = document.createElement('div');
  el.className = 'note';
  el.textContent = n.text;
  el.style.left = n.x + 'px';
  el.style.top = n.y + 'px';
  el.style.borderColor = `hsl(${n.cluster * 90}, 70%, 50%)`;
  el.dataset.id = n.id;
  notesEl.appendChild(el);
  n.el = el;
  makeDraggable(el, n);
}

function makeDraggable(el, n) {
  let ox, oy, dragging = false;
  el.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - n.x; oy = e.clientY - n.y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; n.x = e.clientX - ox; n.y = e.clientY - oy; el.style.left = n.x+'px'; el.style.top = n.y+'px'; });
  el.addEventListener('pointerup', e => { dragging = false; el.releasePointerCapture(e.pointerId); /* teach */ examples.push({features: features(n), label: n.cluster}); if (examples.length > 200) examples.shift(); });
}

function recluster() {
  notes.forEach(n => {
    // bias by orientation
    const biasX = (orientation.gamma || 0) / 90 * 0.15;
    const biasY = (orientation.beta || 0) / 90 * 0.15;
    const f = features(n);
    f[0] += biasX; f[1] += biasY;
    n.cluster = knnPredict(f);
    if (n.el) n.el.style.borderColor = `hsl(${n.cluster * 90}, 70%, 50%)`;
  });
}

function drawClusters() {
  ctx.clearRect(0,0,W,H);
  // simple Voronoi-like by sampling or just draw note positions
  notes.forEach(n => {
    ctx.fillStyle = `hsla(${n.cluster * 90}, 70%, 50%, 0.15)`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 80, 0, Math.PI*2);
    ctx.fill();
  });
}

function seal() {
  const genome = {examples, nextId};
  localStorage.setItem('verse-f735', JSON.stringify(genome));
  channel.postMessage({type: 'genome', data: genome});
  status.textContent = `Sealed ${examples.length} examples. Multi-tab transfer active.`;
}

function loadSeal() {
  const raw = localStorage.getItem('verse-f735');
  if (raw) {
    try {
      const g = JSON.parse(raw);
      examples = g.examples || [];
      nextId = g.nextId || 1;
    } catch (e) { console.debug("lab f735-deviceorientation-knn-spatial-cluster-notes-mind:", e); }
  }
}

channel.onmessage = e => {
  if (e.data.type === 'genome') {
    examples = e.data.data.examples || examples;
    status.textContent = 'Received genome from another tab.';
  }
};

window.addEventListener('deviceorientation', e => {
  orientation.alpha = e.alpha || 0;
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
});

document.getElementById('addBtn').onclick = () => {
  addNote(document.getElementById('newNote').value);
  document.getElementById('newNote').value = '';
};
document.getElementById('sealBtn').onclick = seal;
document.getElementById('clearBtn').onclick = () => { notes.forEach(n => n.el?.remove()); notes = []; examples = []; localStorage.removeItem('verse-f735'); };

loadSeal();
setInterval(recluster, 2500);
function loop() {
  drawClusters();
  requestAnimationFrame(loop);
}
loop();

status.textContent = 'Add notes. Drag to teach clusters. Tilt for bias. Seal to persist & share across tabs.';

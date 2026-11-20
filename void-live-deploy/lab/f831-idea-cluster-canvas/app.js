const stage = document.getElementById('stage');
const input = document.getElementById('input');
const kInput = document.getElementById('k');
let docs = [];
let vectors = [];
let assignments = [];
let centroids = [];
let cards = [];
const colors = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#ff7b72','#79c0ff','#56d364','#e3b341','#ff9bce','#a5d6ff','#7ee787'];

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

function buildTFIDF(documents) {
  const vocab = new Map();
  const dfs = new Map();
  const tfs = documents.map(doc => {
    const tokens = tokenize(doc);
    const tf = new Map();
    tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
    new Set(tokens).forEach(t => dfs.set(t, (dfs.get(t) || 0) + 1));
    tokens.forEach(t => { if (!vocab.has(t)) vocab.set(t, vocab.size); });
    return tf;
  });
  const N = documents.length;
  const idf = new Map();
  dfs.forEach((df, t) => idf.set(t, Math.log((N + 1) / (df + 1)) + 1));
  return documents.map((_, i) => {
    const vec = new Float32Array(vocab.size);
    const tf = tfs[i];
    let norm = 0;
    tf.forEach((count, t) => {
      const idx = vocab.get(t);
      const val = (count / (tokenize(documents[i]).length || 1)) * (idf.get(t) || 1);
      vec[idx] = val;
      norm += val * val;
    });
    norm = Math.sqrt(norm) || 1;
    for (let j = 0; j < vec.length; j++) vec[j] /= norm;
    return vec;
  });
}

function kmeans(vecs, k, iters = 20) {
  const n = vecs.length;
  const dim = vecs[0].length;
  // k-means++
  const cents = [];
  cents.push(vecs[Math.floor(Math.random() * n)].slice());
  while (cents.length < k) {
    const dists = vecs.map(v => Math.min(...cents.map(c => dist2(v, c))));
    const sum = dists.reduce((a,b)=>a+b,0);
    let r = Math.random() * sum;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { cents.push(vecs[i].slice()); break; }
    }
  }
  let assign = new Array(n).fill(0);
  for (let it = 0; it < iters; it++) {
    // assign
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(vecs[i], cents[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assign[i] = best;
    }
    // update
    const counts = new Array(k).fill(0);
    const sums = cents.map(() => new Float32Array(dim));
    for (let i = 0; i < n; i++) {
      const c = assign[i];
      counts[c]++;
      for (let d = 0; d < dim; d++) sums[c][d] += vecs[i][d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      for (let d = 0; d < dim; d++) cents[c][d] = sums[c][d] / counts[c];
    }
  }
  return { assign, cents };
}

function dist2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d*d; }
  return s;
}

function layout() {
  stage.innerHTML = '';
  cards = [];
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const k = centroids.length;
  const centers = [];
  for (let c = 0; c < k; c++) {
    const angle = (c / k) * Math.PI * 2;
    const cx = w/2 + Math.cos(angle) * Math.min(w,h)*0.28;
    const cy = h/2 + Math.sin(angle) * Math.min(w,h)*0.28;
    centers.push({x: cx, y: cy});
    const label = document.createElement('div');
    label.className = 'cluster-label';
    label.textContent = 'Cluster ' + (c+1);
    label.style.left = (cx - 30) + 'px';
    label.style.top = (cy - 40) + 'px';
    stage.appendChild(label);
  }
  docs.forEach((doc, i) => {
    const c = assignments[i];
    const center = centers[c];
    const jitterX = (Math.random()-0.5)*160;
    const jitterY = (Math.random()-0.5)*100;
    const card = document.createElement('div');
    card.className = 'card';
    card.contentEditable = true;
    card.textContent = doc;
    card.style.left = Math.max(10, Math.min(w-160, center.x + jitterX - 70)) + 'px';
    card.style.top = Math.max(10, Math.min(h-80, center.y + jitterY - 30)) + 'px';
    card.style.borderColor = colors[c % colors.length];
    card.dataset.idx = i;
    card.dataset.cluster = c;
    makeDraggable(card, centers);
    stage.appendChild(card);
    cards.push(card);
  });
}

function makeDraggable(el, centers) {
  let ox, oy, sx, sy;
  el.addEventListener('pointerdown', e => {
    if (e.target !== el && el.contentEditable) return;
    ox = e.clientX; oy = e.clientY;
    sx = parseFloat(el.style.left); sy = parseFloat(el.style.top);
    el.setPointerCapture(e.pointerId);
    el.style.zIndex = 20;
  });
  el.addEventListener('pointermove', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    el.style.left = (sx + e.clientX - ox) + 'px';
    el.style.top = (sy + e.clientY - oy) + 'px';
  });
  el.addEventListener('pointerup', e => {
    el.releasePointerCapture(e.pointerId);
    el.style.zIndex = '';
    // reassign to nearest center
    const x = parseFloat(el.style.left) + 70;
    const y = parseFloat(el.style.top) + 30;
    let best = 0, bestD = Infinity;
    centers.forEach((c, i) => {
      const d = (c.x - x)**2 + (c.y - y)**2;
      if (d < bestD) { bestD = d; best = i; }
    });
    const idx = +el.dataset.idx;
    assignments[idx] = best;
    el.dataset.cluster = best;
    el.style.borderColor = colors[best % colors.length];
  });
}

document.getElementById('clusterBtn').onclick = () => {
  const lines = input.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) { alert('Paste at least 2 ideas'); return; }
  docs = lines;
  const k = Math.min(Math.max(2, +kInput.value || 4), Math.min(12, docs.length));
  vectors = buildTFIDF(docs);
  const result = kmeans(vectors, k);
  assignments = result.assign;
  centroids = result.cents;
  layout();
  localStorage.setItem('f831-input', input.value);
  localStorage.setItem('f831-k', k);
};

document.getElementById('copyBtn').onclick = () => {
  if (!docs.length) return;
  const groups = {};
  docs.forEach((d, i) => {
    const c = assignments[i];
    if (!groups[c]) groups[c] = [];
    groups[c].push(d);
  });
  let md = '';
  Object.keys(groups).sort((a,b)=>a-b).forEach(c => {
    md += `## Cluster ${+c+1}\n`;
    groups[c].forEach(note => md += `- ${note}\n`);
    md += '\n';
  });
  navigator.clipboard.writeText(md).then(() => alert('Copied Markdown')).catch(() => prompt('Copy:', md));
};

document.getElementById('downloadBtn').onclick = () => {
  if (!docs.length) return;
  const data = { docs, assignments, k: centroids.length, timestamp: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'idea-clusters.json';
  a.click();
};

// restore
const saved = localStorage.getItem('f831-input');
if (saved) input.value = saved;
const savedK = localStorage.getItem('f831-k');
if (savedK) kInput.value = savedK;

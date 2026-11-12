const notesEl = document.getElementById('notes');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const labelsDiv = document.getElementById('labels');
const status = document.getElementById('status');
const thresh = document.getElementById('thresh');
let nodes = [];
let clusters = [];
const KEY = 'verse-f704-notes';

// Simple char 3-gram embedding
function embed(text) {
  const ngrams = {};
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  for (let i = 0; i < t.length - 2; i++) {
    const ng = t.slice(i, i + 3);
    ngrams[ng] = (ngrams[ng] || 0) + 1;
  }
  const keys = Object.keys(ngrams);
  if (!keys.length) return [1];
  const vec = keys.map(k => ngrams[k]);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

function cosine(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += (a[i] || 0) * (b[i] || 0);
  return Math.max(0, Math.min(1, dot));
}

function clusterNotes(texts, threshold) {
  const embs = texts.map(embed);
  const assigned = new Array(texts.length).fill(-1);
  let cid = 0;
  const clus = [];
  for (let i = 0; i < texts.length; i++) {
    if (assigned[i] >= 0) continue;
    const group = [i];
    assigned[i] = cid;
    for (let j = i + 1; j < texts.length; j++) {
      if (assigned[j] < 0 && cosine(embs[i], embs[j]) >= threshold) {
        assigned[j] = cid;
        group.push(j);
      }
    }
    clus.push(group);
    cid++;
  }
  return { assigned, clusters: clus, embs };
}

function layout(nodes) {
  // Simple force: repel all, attract same cluster
  for (let step = 0; step < 40; step++) {
    for (let i = 0; i < nodes.length; i++) {
      let fx = 0, fy = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d2 = dx*dx + dy*dy + 10;
        const d = Math.sqrt(d2);
        const repel = 800 / d2;
        fx += (dx / d) * repel;
        fy += (dy / d) * repel;
        if (nodes[i].cid === nodes[j].cid) {
          const attract = 0.02 * d;
          fx -= (dx / d) * attract;
          fy -= (dy / d) * attract;
        }
      }
      nodes[i].x += fx * 0.05;
      nodes[i].y += fy * 0.05;
      nodes[i].x = Math.max(20, Math.min(canvas.width - 20, nodes[i].x));
      nodes[i].y = Math.max(20, Math.min(canvas.height - 20, nodes[i].y));
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#fff176'];
  nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = colors[n.cid % colors.length];
    ctx.fill();
  });
  // Update labels
  labelsDiv.innerHTML = '';
  nodes.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'label cluster-' + (n.cid % 5);
    el.style.left = (n.x + 12) + 'px';
    el.style.top = (n.y - 10) + 'px';
    el.textContent = n.text.slice(0, 40);
    el.dataset.i = i;
    labelsDiv.appendChild(el);
  });
}

function doCluster() {
  const lines = notesEl.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) { status.textContent = 'Need at least 2 notes'; return; }
  const thr = parseFloat(thresh.value);
  const { assigned, clusters: cl } = clusterNotes(lines, thr);
  clusters = cl;
  nodes = lines.map((text, i) => ({
    text, cid: assigned[i],
    x: 100 + Math.random() * (canvas.width - 200),
    y: 100 + Math.random() * (canvas.height - 200)
  }));
  layout(nodes);
  render();
  status.textContent = `${lines.length} notes → ${cl.length} clusters (threshold ${thr})`;
  localStorage.setItem(KEY, JSON.stringify({ notes: notesEl.value, thresh: thr }));
}

document.getElementById('clusterBtn').onclick = doCluster;
thresh.oninput = () => status.textContent = 'Threshold: ' + thresh.value;

document.getElementById('dlMd').onclick = () => {
  if (!clusters.length) return;
  let md = '# Clustered Notes\n\n';
  clusters.forEach((group, ci) => {
    md += `## Cluster ${ci + 1}\n\n`;
    group.forEach(idx => md += `- ${nodes[idx].text}\n`);
    md += '\n';
  });
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clustered-notes.md';
  a.click();
};

document.getElementById('dlJson').onclick = () => {
  if (!clusters.length) return;
  const data = clusters.map((group, ci) => ({
    cluster: ci + 1,
    notes: group.map(idx => nodes[idx].text)
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clustered-notes.json';
  a.click();
};

// Restore
const saved = localStorage.getItem(KEY);
if (saved) {
  try {
    const o = JSON.parse(saved);
    notesEl.value = o.notes || '';
    if (o.thresh) thresh.value = o.thresh;
  } catch (e) { console.debug("lab f704-local-semantic-note-clusterer:", e); }
}

// Resize canvas
function resize() {
  canvas.width = Math.min(window.innerWidth, 1000);
  canvas.height = Math.min(window.innerHeight - 200, 600);
  if (nodes.length) render();
}
window.onresize = resize;
resize();

// Simple drag for labels
let dragging = null;
labelsDiv.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('label')) {
    dragging = parseInt(e.target.dataset.i);
    e.target.setPointerCapture(e.pointerId);
  }
});
labelsDiv.addEventListener('pointermove', e => {
  if (dragging != null) {
    const rect = canvas.getBoundingClientRect();
    nodes[dragging].x = e.clientX - rect.left;
    nodes[dragging].y = e.clientY - rect.top;
    render();
  }
});
labelsDiv.addEventListener('pointerup', () => dragging = null);

const $ = s => document.querySelector(s);
const input = $('#input');
const svg = $('#svg');
const toast = $('#toast');
const STORAGE = 'verse-f645-flowchart';
let nodes = new Map();
let edges = [];
let drag = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function parse(text) {
  nodes.clear();
  edges = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/\s*->\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      const a = parts[i], b = parts[i+1];
      if (!nodes.has(a)) nodes.set(a, {label:a, x:0, y:0, level:0});
      if (!nodes.has(b)) nodes.set(b, {label:b, x:0, y:0, level:0});
      edges.push({from:a, to:b});
    }
  }
  const incoming = new Map();
  for (const n of nodes.keys()) incoming.set(n, 0);
  for (const e of edges) incoming.set(e.to, (incoming.get(e.to)||0) + 1);
  const sources = [...nodes.keys()].filter(n => !incoming.get(n));
  const level = new Map();
  const q = sources.map(s => [s, 0]);
  const seen = new Set();
  while (q.length) {
    const [n, l] = q.shift();
    if (seen.has(n) && level.get(n) >= l) continue;
    seen.add(n);
    level.set(n, Math.max(level.get(n)||0, l));
    for (const e of edges) if (e.from === n) q.push([e.to, l+1]);
  }
  for (const [id, node] of nodes) node.level = level.get(id) || 0;
  const byLevel = {};
  for (const [id, node] of nodes) {
    (byLevel[node.level] = byLevel[node.level] || []).push(id);
  }
  const maxLevel = Math.max(0, ...Object.keys(byLevel).map(Number));
  const width = 800, height = 500;
  for (let l = 0; l <= maxLevel; l++) {
    const list = byLevel[l] || [];
    list.forEach((id, i) => {
      const node = nodes.get(id);
      node.x = 80 + (width - 160) * (list.length <= 1 ? 0.5 : i / (list.length - 1));
      node.y = 60 + (height - 100) * (maxLevel === 0 ? 0.5 : l / maxLevel);
    });
  }
}

function render() {
  const w = 900, h = 600;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#888"/></marker></defs>`;
  for (const e of edges) {
    const a = nodes.get(e.from), b = nodes.get(e.to);
    if (!a || !b) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${a.x} ${a.y} C${a.x} ${(a.y+b.y)/2}, ${b.x} ${(a.y+b.y)/2}, ${b.x} ${b.y}`);
    path.setAttribute('stroke', '#666');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(path);
  }
  for (const [id, node] of nodes) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.dataset.id = id;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const tw = Math.max(80, node.label.length * 8);
    rect.setAttribute('x', node.x - tw/2);
    rect.setAttribute('y', node.y - 18);
    rect.setAttribute('width', tw);
    rect.setAttribute('height', 36);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', '#2a9d8f');
    rect.setAttribute('stroke', '#4cc9f0');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x);
    text.setAttribute('y', node.y + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#fff');
    text.setAttribute('font-size', '13');
    text.textContent = node.label;
    g.appendChild(rect);
    g.appendChild(text);
    svg.appendChild(g);
  }
}

function update() {
  parse(input.value);
  render();
  localStorage.setItem(STORAGE, input.value);
  const hash = '#' + encodeURIComponent(input.value);
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

input.addEventListener('input', update);

svg.addEventListener('pointerdown', e => {
  const g = e.target.closest('.node');
  if (!g) return;
  drag = {id: g.dataset.id, sx: e.clientX, sy: e.clientY, ox: nodes.get(g.dataset.id).x, oy: nodes.get(g.dataset.id).y};
  svg.setPointerCapture(e.pointerId);
});
svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = (e.clientX - drag.sx) * (900 / svg.getBoundingClientRect().width);
  const dy = (e.clientY - drag.sy) * (600 / svg.getBoundingClientRect().height);
  const node = nodes.get(drag.id);
  node.x = drag.ox + dx;
  node.y = drag.oy + dy;
  render();
});
svg.addEventListener('pointerup', () => { drag = null; });

$('#example').onclick = () => {
  input.value = `Start -> Check input
Check input -> Valid?
Valid? -> Yes -> Process
Valid? -> No -> Error
Process -> Done
Error -> Done`;
  update();
};

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('#dl-svg').onclick = () => {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  download(new Blob([source], {type:'image/svg+xml'}), 'flowchart.svg');
  showToast('SVG downloaded');
};

$('#dl-png').onclick = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 600;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const svgData = new XMLSerializer().serializeToString(svg);
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  img.onload = () => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0,0,900,600);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(b => {
      download(b, 'flowchart.png');
      showToast('PNG downloaded');
    });
  };
  img.src = url;
};

$('#copy-text').onclick = async () => {
  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Text copied');
  } catch {
    showToast('Copy failed');
  }
};

const fromHash = location.hash.slice(1);
if (fromHash) input.value = decodeURIComponent(fromHash);
else if (localStorage.getItem(STORAGE)) input.value = localStorage.getItem(STORAGE);
else input.value = `Start -> Check input
Check input -> Valid?
Valid? -> Yes -> Process
Valid? -> No -> Error`;
update();

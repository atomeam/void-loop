const board = document.getElementById('board');
const svg = document.getElementById('svg');
const status = document.getElementById('status');
let boxes = [];
let edges = [];
let nextId = 1;
let connectMode = false;
let connectFrom = null;
let drag = null;

function save() {
  localStorage.setItem('verse-f820-flowchart', JSON.stringify({ boxes, edges, nextId }));
  status.textContent = 'Saved';
}
function load() {
  try {
    const raw = localStorage.getItem('verse-f820-flowchart');
    if (!raw) return;
    const data = JSON.parse(raw);
    boxes = data.boxes || [];
    edges = data.edges || [];
    nextId = data.nextId || 1;
    render();
    status.textContent = 'Restored';
  } catch (e) { console.debug("lab f820-flowchart-maker:", e); }
}

function render() {
  [...board.querySelectorAll('.box')].forEach(el => el.remove());
  [...svg.querySelectorAll('path')].forEach(el => el.remove());

  boxes.forEach(b => {
    const el = document.createElement('div');
    el.className = 'box';
    el.dataset.id = b.id;
    el.style.left = b.x + 'px';
    el.style.top = b.y + 'px';
    const inp = document.createElement('input');
    inp.value = b.text;
    inp.addEventListener('input', () => { b.text = inp.value; save(); });
    inp.addEventListener('pointerdown', e => e.stopPropagation());
    el.appendChild(inp);
    el.addEventListener('pointerdown', startDrag);
    board.appendChild(el);
  });

  edges.forEach(e => {
    const a = boxes.find(b => b.id === e.from);
    const b = boxes.find(bx => bx.id === e.to);
    if (!a || !b) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const ax = a.x + 60, ay = a.y + 24;
    const bx = b.x + 60, by = b.y + 24;
    path.setAttribute('d', `M ${ax} ${ay} L ${bx} ${by}`);
    path.setAttribute('stroke', '#8b949e');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(path);
  });
}

function startDrag(e) {
  if (connectMode) {
    const id = +e.currentTarget.dataset.id;
    if (!connectFrom) {
      connectFrom = id;
      e.currentTarget.classList.add('selected');
      status.textContent = 'Now click the target box';
    } else if (connectFrom !== id) {
      edges.push({ from: connectFrom, to: id });
      connectFrom = null;
      connectMode = false;
      document.getElementById('connect').textContent = 'Connect mode';
      [...board.querySelectorAll('.selected')].forEach(el => el.classList.remove('selected'));
      render();
      save();
      status.textContent = 'Connected';
    }
    return;
  }
  const id = +e.currentTarget.dataset.id;
  const box = boxes.find(b => b.id === id);
  drag = { id, dx: e.clientX - box.x, dy: e.clientY - box.y, el: e.currentTarget };
  e.currentTarget.setPointerCapture(e.pointerId);
}

board.addEventListener('pointermove', e => {
  if (!drag) return;
  const box = boxes.find(b => b.id === drag.id);
  box.x = Math.max(0, e.clientX - drag.dx);
  box.y = Math.max(0, e.clientY - drag.dy);
  drag.el.style.left = box.x + 'px';
  drag.el.style.top = box.y + 'px';
  renderLinesOnly();
});
board.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });

function renderLinesOnly() {
  [...svg.querySelectorAll('path')].forEach(el => el.remove());
  edges.forEach(e => {
    const a = boxes.find(b => b.id === e.from);
    const b = boxes.find(bx => bx.id === e.to);
    if (!a || !b) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${a.x+60} ${a.y+24} L ${b.x+60} ${b.y+24}`);
    path.setAttribute('stroke', '#8b949e');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(path);
  });
}

document.getElementById('add').onclick = () => {
  boxes.push({ id: nextId++, x: 100 + Math.random()*200, y: 100 + Math.random()*150, text: 'Step ' + nextId });
  render();
  save();
};
document.getElementById('connect').onclick = () => {
  connectMode = !connectMode;
  connectFrom = null;
  document.getElementById('connect').textContent = connectMode ? 'Cancel connect' : 'Connect mode';
  status.textContent = connectMode ? 'Click first box, then second' : 'Ready';
  [...board.querySelectorAll('.selected')].forEach(el => el.classList.remove('selected'));
};
document.getElementById('clear').onclick = () => {
  if (confirm('Clear the whole flowchart?')) {
    boxes = []; edges = []; nextId = 1;
    render(); save();
  }
};
document.getElementById('export-json').onclick = () => {
  const blob = new Blob([JSON.stringify({ boxes, edges }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flowchart.json';
  a.click();
};
document.getElementById('import-json').onclick = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = () => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        boxes = data.boxes || [];
        edges = data.edges || [];
        nextId = Math.max(0, ...boxes.map(b => b.id)) + 1;
        render(); save();
        status.textContent = 'Imported';
      } catch(e) { status.textContent = 'Bad JSON'; }
    };
    reader.readAsText(inp.files[0]);
  };
  inp.click();
};

document.getElementById('export-png').onclick = () => {
  const canvas = document.createElement('canvas');
  const w = 800, h = 600;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);
  const xs = boxes.map(b => b.x), ys = boxes.map(b => b.y);
  const minX = Math.min(0, ...xs) - 20, minY = Math.min(0, ...ys) - 20;
  const maxX = Math.max(400, ...xs.map((x,i) => x + 140)) + 20;
  const maxY = Math.max(300, ...ys.map((y,i) => y + 60)) + 20;
  const scale = Math.min(w / (maxX - minX), h / (maxY - minY), 1);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);
  ctx.strokeStyle = '#8b949e';
  ctx.lineWidth = 2;
  edges.forEach(e => {
    const a = boxes.find(b => b.id === e.from);
    const b = boxes.find(bx => bx.id === e.to);
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x + 60, a.y + 24);
    ctx.lineTo(b.x + 60, b.y + 24);
    ctx.stroke();
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath();
    ctx.moveTo(b.x + 60, b.y + 24);
    ctx.lineTo(b.x + 60 - 12*Math.cos(ang - 0.4), b.y + 24 - 12*Math.sin(ang - 0.4));
    ctx.lineTo(b.x + 60 - 12*Math.cos(ang + 0.4), b.y + 24 - 12*Math.sin(ang + 0.4));
    ctx.fillStyle = '#8b949e';
    ctx.fill();
  });
  boxes.forEach(b => {
    ctx.fillStyle = '#1a2332';
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, 120, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e6edf3';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text.slice(0, 16), b.x + 60, b.y + 24);
  });
  ctx.restore();
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'flowchart.png';
  a.click();
  status.textContent = 'PNG downloaded';
};
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

load();
if (boxes.length === 0) {
  boxes.push({ id: nextId++, x: 150, y: 120, text: 'Start' });
  boxes.push({ id: nextId++, x: 150, y: 220, text: 'Step' });
  edges.push({ from: 1, to: 2 });
  render();
}

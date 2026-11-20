const board = document.getElementById('board');
const svg = document.getElementById('svg');
const status = document.getElementById('status');
const logEl = document.getElementById('log');
const voiceBtn = document.getElementById('voiceBtn');
const typed = document.getElementById('typed');

let boxes = [];
let edges = [];
let nextId = 1;
let recognition = null;
let listening = false;
let connectMode = false;
let selected = null;
let drag = null;

// Tiny local model: simple keyword -> preferred target bias (Hebbian-ish)
let model = { keywords: {}, weights: new Float32Array(16).fill(0.1) };

function log(msg) {
  logEl.textContent = msg;
  console.log(msg);
}

function save() {
  localStorage.setItem('verse-f821-flowchart', JSON.stringify({ boxes, edges, nextId, model: Array.from(model.weights) }));
}
function load() {
  try {
    const raw = localStorage.getItem('verse-f821-flowchart');
    if (!raw) return;
    const data = JSON.parse(raw);
    boxes = data.boxes || [];
    edges = data.edges || [];
    nextId = data.nextId || 1;
    if (data.model) model.weights = new Float32Array(data.model);
    renderAll();
  } catch (e) { console.debug("lab f821-speech-driven-spatial-flowchart:", e); }
}

function hashKeyword(text) {
  let h = 0;
  for (let c of text.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return h % 16;
}

function suggestTarget(label) {
  const idx = hashKeyword(label);
  // simple: bias toward boxes whose id mod matches weight
  let best = null, bestScore = -1;
  boxes.forEach(b => {
    const score = model.weights[idx] * (1 - Math.abs((b.id % 16) - idx) / 16);
    if (score > bestScore) { bestScore = score; best = b; }
  });
  return best;
}

function updateModel(fromLabel, toId, positive = true) {
  const idx = hashKeyword(fromLabel);
  const target = boxes.find(b => b.id === toId);
  if (!target) return;
  const delta = positive ? 0.05 : -0.02;
  model.weights[idx] += delta * ((target.id % 16) / 16);
  model.weights[idx] = Math.max(0, Math.min(1, model.weights[idx]));
}

function createBox(label, x, y) {
  const id = nextId++;
  const box = { id, label: label || 'Step ' + id, x: x || 100 + Math.random()*300, y: y || 100 + Math.random()*200, w: 140, h: 56 };
  boxes.push(box);
  renderAll();
  save();
  log('Added: ' + box.label);
  return box;
}

function addEdge(fromId, toId) {
  if (fromId === toId || edges.some(e => e.from === fromId && e.to === toId)) return;
  edges.push({ from: fromId, to: toId });
  renderAll();
  save();
  const from = boxes.find(b => b.id === fromId);
  if (from) updateModel(from.label, toId, true);
  log('Connected ' + fromId + ' → ' + toId);
}

function renderAll() {
  // clear previous
  board.querySelectorAll('.box').forEach(el => el.remove());
  svg.innerHTML = '<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#4cc9f0"/></marker></defs>';
  const ns = 'http://www.w3.org/2000/svg';

  boxes.forEach(b => {
    const el = document.createElement('div');
    el.className = 'box';
    el.dataset.id = b.id;
    el.contentEditable = true;
    el.textContent = b.label;
    el.style.left = b.x + 'px';
    el.style.top = b.y + 'px';
    el.style.width = b.w + 'px';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('input', () => { b.label = el.textContent; save(); });
    el.addEventListener('click', onBoxClick);
    board.appendChild(el);
  });

  edges.forEach(e => {
    const a = boxes.find(b => b.id === e.from);
    const b = boxes.find(bx => bx.id === e.to);
    if (!a || !b) return;
    const path = document.createElementNS(ns, 'path');
    const x1 = a.x + a.w/2, y1 = a.y + a.h/2;
    const x2 = b.x + b.w/2, y2 = b.y + b.h/2;
    path.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
    path.setAttribute('stroke', '#4cc9f0');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('marker-end', 'url(#arrow)');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  });
}

function onPointerDown(ev) {
  const el = ev.currentTarget;
  const id = +el.dataset.id;
  const box = boxes.find(b => b.id === id);
  if (!box) return;
  drag = { box, el, startX: ev.clientX - box.x, startY: ev.clientY - box.y };
  el.setPointerCapture(ev.pointerId);
  ev.preventDefault();
}
document.addEventListener('pointermove', ev => {
  if (!drag) return;
  drag.box.x = ev.clientX - drag.startX;
  drag.box.y = ev.clientY - drag.startY;
  drag.el.style.left = drag.box.x + 'px';
  drag.el.style.top = drag.box.y + 'px';
  // update edges live
  renderEdgesOnly();
});
document.addEventListener('pointerup', () => { if (drag) { save(); drag = null; } });

function renderEdgesOnly() {
  const paths = svg.querySelectorAll('path');
  paths.forEach((p, i) => {
    const e = edges[i];
    if (!e) return;
    const a = boxes.find(b => b.id === e.from);
    const b = boxes.find(bx => bx.id === e.to);
    if (!a || !b) return;
    const x1 = a.x + a.w/2, y1 = a.y + a.h/2;
    const x2 = b.x + b.w/2, y2 = b.y + b.h/2;
    p.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
  });
}

function onBoxClick(ev) {
  const id = +ev.currentTarget.dataset.id;
  if (connectMode) {
    if (!selected) {
      selected = id;
      document.querySelectorAll('.box').forEach(el => el.classList.toggle('selected', +el.dataset.id === id));
      log('Selected ' + id + ' — click another to connect');
    } else {
      addEdge(selected, id);
      selected = null;
      connectMode = false;
      document.querySelectorAll('.box').forEach(el => el.classList.remove('selected'));
      document.getElementById('connectBtn').textContent = 'Connect mode';
    }
  }
}

function parseCommand(text) {
  text = text.toLowerCase().trim();
  log('Heard: ' + text);
  if (text.startsWith('add ') || text.startsWith('create ')) {
    const label = text.replace(/^(add|create)\s+/, '');
    const sug = suggestTarget(label);
    const x = sug ? sug.x + 160 : undefined;
    const y = sug ? sug.y : undefined;
    createBox(label, x, y);
  } else if (text.includes('connect') && text.includes('to')) {
    const m = text.match(/connect\s+(.+?)\s+to\s+(.+)/);
    if (m) {
      const fromLabel = m[1], toLabel = m[2];
      const from = boxes.find(b => b.label.toLowerCase().includes(fromLabel));
      const to = boxes.find(b => b.label.toLowerCase().includes(toLabel));
      if (from && to) addEdge(from.id, to.id);
      else log('Could not find both boxes');
    }
  } else if (text.startsWith('delete') || text.startsWith('remove')) {
    if (boxes.length) {
      const last = boxes.pop();
      edges = edges.filter(e => e.from !== last.id && e.to !== last.id);
      renderAll(); save();
      log('Removed last box');
    }
  } else if (text === 'export' || text === 'download') {
    exportJson();
  } else if (text) {
    // treat as new box label
    createBox(text);
  }
}

// Speech
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRec();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onresult = ev => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) parseCommand(ev.results[i][0].transcript);
    }
  };
  recognition.onerror = e => { log('Speech error: ' + e.error); status.textContent = 'Speech error — use typed'; };
  recognition.onend = () => { if (listening) recognition.start(); };
}

voiceBtn.onclick = () => {
  if (!recognition) { alert('Speech not supported — use the text box'); return; }
  listening = !listening;
  if (listening) {
    recognition.start();
    voiceBtn.textContent = '⏹️ Stop Voice';
    status.textContent = 'Listening…';
  } else {
    recognition.stop();
    voiceBtn.textContent = '🎤 Start Voice';
    status.textContent = 'Stopped';
  }
};

typed.onkeydown = e => {
  if (e.key === 'Enter') {
    parseCommand(typed.value);
    typed.value = '';
  }
};

document.getElementById('addBtn').onclick = () => createBox();
document.getElementById('connectBtn').onclick = () => {
  connectMode = !connectMode;
  document.getElementById('connectBtn').textContent = connectMode ? 'Cancel connect' : 'Connect mode';
  if (!connectMode) { selected = null; document.querySelectorAll('.box').forEach(el => el.classList.remove('selected')); }
};
document.getElementById('exportJson').onclick = exportJson;
document.getElementById('exportPng').onclick = exportPng;
document.getElementById('clearBtn').onclick = () => {
  if (confirm('Clear all?')) { boxes = []; edges = []; nextId = 1; renderAll(); save(); }
};

function exportJson() {
  const data = { boxes, edges, version: 'F821' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flowchart-f821.json';
  a.click();
  log('Exported JSON');
}

function exportPng() {
  const canvas = document.createElement('canvas');
  const rect = board.getBoundingClientRect();
  canvas.width = Math.max(800, rect.width);
  canvas.height = Math.max(600, rect.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c0e12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // simple render
  edges.forEach(e => {
    const a = boxes.find(b => b.id === e.from);
    const b = boxes.find(bx => bx.id === e.to);
    if (!a || !b) return;
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x + a.w/2, a.y + a.h/2);
    ctx.lineTo(b.x + b.w/2, b.y + b.h/2);
    ctx.stroke();
  });
  boxes.forEach(b => {
    ctx.fillStyle = '#1a1d24';
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 2;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '14px system-ui';
    ctx.fillText(b.label.slice(0, 20), b.x + 8, b.y + 30);
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'flowchart-f821.png';
  a.click();
  log('Exported PNG');
}

// init
load();
if (boxes.length === 0) {
  createBox('Start', 80, 80);
  createBox('Process', 280, 80);
  addEdge(1, 2);
}
status.textContent = 'Ready · speak or type · offline after load';

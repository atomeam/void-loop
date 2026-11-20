const notesEl = document.getElementById('notes');
const stage = document.getElementById('stage');
const bg = document.getElementById('bg');
const ctx = bg.getContext('2d');
const status = document.getElementById('status');
let cards = [];
let model = initModel();
let orient = { beta: 0, gamma: 0 };
let dragging = null;
let dragOff = {x:0,y:0};

function initModel() {
  // Simple MLP: input 10 (8 features + 2 orient) -> hidden 8 -> 2 (x,y)
  const nIn = 10, nH = 8, nOut = 2;
  return {
    w1: new Float32Array(nIn * nH).map(() => (Math.random()-0.5)*0.2),
    b1: new Float32Array(nH).fill(0),
    w2: new Float32Array(nH * nOut).map(() => (Math.random()-0.5)*0.2),
    b2: new Float32Array(nOut).fill(0),
    lr: 0.01
  };
}

function featurize(text) {
  const v = new Float32Array(8);
  const s = text.toLowerCase().replace(/[^a-z0-9 ]/g,'');
  for (let i = 0; i < s.length - 2; i++) {
    const h = (s.charCodeAt(i) + s.charCodeAt(i+1)*31 + s.charCodeAt(i+2)*17) % 8;
    v[h] += 1;
  }
  const norm = Math.sqrt(v.reduce((a,b)=>a+b*b,0)) || 1;
  for (let i=0;i<8;i++) v[i]/=norm;
  return v;
}

function forward(feat, or) {
  const inp = new Float32Array(10);
  inp.set(feat);
  inp[8] = or.beta / 90;
  inp[9] = or.gamma / 90;
  const h = new Float32Array(8);
  for (let j=0;j<8;j++) {
    let s = model.b1[j];
    for (let i=0;i<10;i++) s += inp[i] * model.w1[i*8 + j];
    h[j] = Math.tanh(s);
  }
  const out = new Float32Array(2);
  for (let k=0;k<2;k++) {
    let s = model.b2[k];
    for (let j=0;j<8;j++) s += h[j] * model.w2[j*2 + k];
    out[k] = s; // linear
  }
  return {out, h, inp};
}

function updateModel(feat, or, target) {
  const {out, h, inp} = forward(feat, or);
  const err = [target[0] - out[0], target[1] - out[1]];
  // simple backprop
  const dOut = err;
  for (let k=0;k<2;k++) {
    model.b2[k] += model.lr * dOut[k];
    for (let j=0;j<8;j++) model.w2[j*2 + k] += model.lr * dOut[k] * h[j];
  }
  const dH = new Float32Array(8);
  for (let j=0;j<8;j++) {
    let s = 0;
    for (let k=0;k<2;k++) s += dOut[k] * model.w2[j*2 + k];
    dH[j] = s * (1 - h[j]*h[j]);
  }
  for (let j=0;j<8;j++) {
    model.b1[j] += model.lr * dH[j];
    for (let i=0;i<10;i++) model.w1[i*8 + j] += model.lr * dH[j] * inp[i];
  }
}

function placeNotes() {
  const lines = notesEl.value.split('\n').map(s=>s.trim()).filter(Boolean);
  stage.innerHTML = '';
  cards = [];
  const w = window.innerWidth, h = window.innerHeight;
  lines.forEach((text, idx) => {
    const feat = featurize(text);
    const {out} = forward(feat, orient);
    const x = (out[0] * 0.4 + 0.5) * w * 0.8 + 40;
    const y = (out[1] * 0.4 + 0.5) * h * 0.7 + 80;
    const card = document.createElement('div');
    card.className = 'card';
    card.textContent = text;
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    card.dataset.idx = idx;
    card.dataset.feat = Array.from(feat).join(',');
    stage.appendChild(card);
    cards.push({el: card, text, feat});
    makeDraggable(card);
  });
  status.textContent = `Placed ${lines.length} notes. Drag to teach the model.`;
  saveState();
}

function makeDraggable(el) {
  el.addEventListener('pointerdown', e => {
    dragging = el;
    const r = el.getBoundingClientRect();
    dragOff.x = e.clientX - r.left;
    dragOff.y = e.clientY - r.top;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (dragging !== el) return;
    el.style.left = (e.clientX - dragOff.x) + 'px';
    el.style.top = (e.clientY - dragOff.y) + 'px';
  });
  el.addEventListener('pointerup', e => {
    if (dragging !== el) return;
    const w = window.innerWidth, h = window.innerHeight;
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const tx = (x - 40) / (w * 0.8) * 2 - 1;
    const ty = (y - 80) / (h * 0.7) * 2 - 1;
    const feat = el.dataset.feat.split(',').map(Number);
    updateModel(feat, orient, [tx, ty]);
    status.textContent = 'Learned from drag.';
    dragging = null;
    saveState();
  });
}

function drawBG() {
  bg.width = window.innerWidth;
  bg.height = window.innerHeight;
  ctx.clearRect(0,0,bg.width,bg.height);
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  const cx = bg.width/2, cy = bg.height/2;
  const dx = orient.gamma * 2, dy = orient.beta * 2;
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + dx, cy + dy);
  ctx.stroke();
  requestAnimationFrame(drawBG);
}
drawBG();

window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

document.getElementById('place').onclick = placeNotes;
document.getElementById('export').onclick = () => {
  const data = { notes: cards.map(c => ({text: c.text, x: c.el.style.left, y: c.el.style.top})), weights: {w1: Array.from(model.w1), b1: Array.from(model.b1), w2: Array.from(model.w2), b2: Array.from(model.b2)} };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'spatial-notes.json';
  a.click();
};
document.getElementById('copy').onclick = () => {
  const md = cards.map(c => `- ${c.text} @ ${c.el.style.left},${c.el.style.top}`).join('\n');
  navigator.clipboard.writeText(md).then(() => status.textContent = 'Markdown copied');
};
document.getElementById('reset').onclick = () => { model = initModel(); status.textContent = 'Model reset'; placeNotes(); };

function saveState() {
  const state = { notes: notesEl.value, weights: {w1: Array.from(model.w1), b1: Array.from(model.b1), w2: Array.from(model.w2), b2: Array.from(model.b2)} };
  const req = indexedDB.open('f832-spatial-notes', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('state');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(state, 'latest');
  };
}

// Load on start
const req = indexedDB.open('f832-spatial-notes', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('state');
req.onsuccess = e => {
  const db = e.target.result;
  const tx = db.transaction('state', 'readonly');
  const g = tx.objectStore('state').get('latest');
  g.onsuccess = () => {
    if (g.result) {
      notesEl.value = g.result.notes || '';
      const w = g.result.weights;
      if (w) {
        model.w1.set(w.w1);
        model.b1.set(w.b1);
        model.w2.set(w.w2);
        model.b2.set(w.b2);
      }
      if (notesEl.value) placeNotes();
    }
  };
};

window.addEventListener('resize', () => { if (cards.length) placeNotes(); });

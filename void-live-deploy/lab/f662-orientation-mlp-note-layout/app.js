const $ = s => document.querySelector(s);
const field = $('#field');
const notesEl = $('#notes');
const status = $('#status');
let notes = [];
let cards = [];
let weights = null;
let orient = {x:0, y:0};
let pointerV = {x:0, y:0};
let lastPtr = null;
let running = false;
let anim = null;

function initWeights() {
  const rand = () => (Math.random()-0.5)*0.8;
  weights = {
    W1: Array.from({length:4}, () => Array.from({length:4}, rand)),
    b1: Array.from({length:4}, rand),
    W2: Array.from({length:2}, () => Array.from({length:4}, rand)),
    b2: Array.from({length:2}, rand)
  };
}

function mlp(inp) {
  const h = weights.b1.map((b,i) => Math.tanh(weights.W1[i].reduce((s,w,j)=>s+w*inp[j], b)));
  return weights.b2.map((b,i) => Math.tanh(weights.W2[i].reduce((s,w,j)=>s+w*h[j], b)));
}

function wordSet(s) { return new Set(s.toLowerCase().match(/\w+/g) || []); }
function overlap(a,b) {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(w => { if (B.has(w)) inter++; });
  return inter / Math.max(A.size, B.size);
}

function parseNotes() {
  notes = notesEl.value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,40);
  field.innerHTML = '';
  cards = notes.map((text,i) => {
    const el = document.createElement('div');
    el.className = 'note';
    el.textContent = text;
    el.style.left = (20 + Math.random()*60) + '%';
    el.style.top = (10 + Math.random()*70) + '%';
    el.dataset.i = i;
    el.addEventListener('pointerdown', onDragStart);
    field.appendChild(el);
    return { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, pinned:false, text };
  });
}

let drag = null;
function onDragStart(e) {
  const card = cards.find(c => c.el === e.currentTarget);
  if (!card) return;
  drag = { card, dx: e.clientX - card.el.offsetLeft, dy: e.clientY - card.el.offsetTop };
  card.pinned = true;
  card.el.classList.add('pinned');
  e.currentTarget.setPointerCapture(e.pointerId);
  e.currentTarget.addEventListener('pointermove', onDragMove);
  e.currentTarget.addEventListener('pointerup', onDragEnd);
}
function onDragMove(e) {
  if (!drag) return;
  const rect = field.getBoundingClientRect();
  let x = ((e.clientX - rect.left - drag.dx) / rect.width) * 100;
  let y = ((e.clientY - rect.top - drag.dy) / rect.height) * 100;
  x = Math.max(2, Math.min(92, x));
  y = Math.max(2, Math.min(88, y));
  drag.card.x = x; drag.card.y = y;
  drag.card.el.style.left = x + '%';
  drag.card.el.style.top = y + '%';
}
function onDragEnd(e) {
  if (drag) {
    const scales = mlp([orient.x, orient.y, 0.5, 0]);
    const lr = 0.01;
    weights.b2[0] += lr * (0.5 - scales[0]);
    weights.b2[1] += lr * (0.5 - scales[1]);
  }
  drag = null;
}

function step() {
  if (!running || cards.length < 2) return;
  const t = performance.now() / 1000;
  const inp = [orient.x, orient.y, 0.4, Math.sin(t*0.5)];
  const scales = mlp(inp);
  const attr = 0.3 + scales[0] * 0.7;
  const rep = 0.4 + scales[1] * 0.6;
  const speed = parseFloat($('#speed').value);
  const W = field.clientWidth, H = field.clientHeight;

  for (let i=0; i<cards.length; i++) {
    if (cards[i].pinned) continue;
    let fx=0, fy=0;
    for (let j=0; j<cards.length; j++) {
      if (i===j) continue;
      const dx = (cards[j].x - cards[i].x) / 100 * W;
      const dy = (cards[j].y - cards[i].y) / 100 * H;
      const dist = Math.hypot(dx,dy) || 1;
      const ov = overlap(cards[i].text, cards[j].text);
      const repF = rep * 800 / (dist*dist + 40);
      const attrF = attr * ov * 40;
      const f = attrF - repF;
      fx += (dx/dist) * f;
      fy += (dy/dist) * f;
    }
    cards[i].vx = cards[i].vx*0.85 + fx*0.002*speed;
    cards[i].vy = cards[i].vy*0.85 + fy*0.002*speed;
    cards[i].x += cards[i].vx * 0.4;
    cards[i].y += cards[i].vy * 0.4;
    cards[i].x = Math.max(2, Math.min(92, cards[i].x));
    cards[i].y = Math.max(2, Math.min(88, cards[i].y));
    cards[i].el.style.left = cards[i].x + '%';
    cards[i].el.style.top = cards[i].y + '%';
  }
  anim = requestAnimationFrame(step);
}

$('#run').onclick = () => {
  parseNotes();
  if (!weights) initWeights();
  running = true;
  if (anim) cancelAnimationFrame(anim);
  step();
  status.textContent = notes.length + ' notes · MLP active';
  save();
};

$('#orient').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try { await DeviceOrientationEvent.requestPermission(); } catch (e) { console.debug("lab f662-orientation-mlp-note-layout:", e); }
  }
  window.addEventListener('deviceorientation', e => {
    orient.x = (e.gamma || 0) / 45;
    orient.y = (e.beta || 0) / 45;
    orient.x = Math.max(-1, Math.min(1, orient.x));
    orient.y = Math.max(-1, Math.min(1, orient.y));
  });
  status.textContent = 'tilt enabled';
};

field.addEventListener('pointermove', e => {
  if (lastPtr) {
    pointerV.x = (e.clientX - lastPtr.x) * 0.02;
    pointerV.y = (e.clientY - lastPtr.y) * 0.02;
    if (Math.abs(orient.x) < 0.05) { orient.x = pointerV.x; orient.y = pointerV.y; }
  }
  lastPtr = {x:e.clientX, y:e.clientY};
});

function save() {
  try {
    localStorage.setItem('verse-f662-note-layout', JSON.stringify({
      notes: notesEl.value,
      weights,
      cards: cards.map(c => ({text:c.text, x:c.x, y:c.y, pinned:c.pinned}))
    }));
  } catch (e) { console.debug("lab f662-orientation-mlp-note-layout:", e); }
}
function load() {
  try {
    const raw = localStorage.getItem('verse-f662-note-layout');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.notes) notesEl.value = d.notes;
    if (d.weights) weights = d.weights;
    if (d.cards && d.cards.length) {
      setTimeout(() => {
        parseNotes();
        d.cards.forEach((sc,i) => {
          if (cards[i]) {
            cards[i].x = sc.x; cards[i].y = sc.y; cards[i].pinned = sc.pinned;
            cards[i].el.style.left = sc.x + '%';
            cards[i].el.style.top = sc.y + '%';
            if (sc.pinned) cards[i].el.classList.add('pinned');
          }
        });
        running = true; step();
      }, 50);
    }
  } catch (e) { console.debug("lab f662-orientation-mlp-note-layout:", e); }
}

$('#png').onclick = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1115'; ctx.fillRect(0,0,1200,800);
  cards.forEach(c => {
    const x = c.x/100*1200, y = c.y/100*800;
    ctx.fillStyle = '#1a1d24';
    ctx.strokeStyle = c.pinned ? '#7ee787' : '#30363d';
    ctx.lineWidth = 2;
    roundRect(ctx, x-90, y-30, 180, 60, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e6edf3';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    const lines = wrap(c.text, 20);
    lines.forEach((ln,i) => ctx.fillText(ln, x, y-8 + i*16));
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'note-layout.png';
  a.click();
};
function roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function wrap(s, n) { const w=s.split(' '); const lines=[]; let cur=''; w.forEach(word=>{ if ((cur+word).length>n){ lines.push(cur); cur=word+' '; } else cur+=word+' '; }); if(cur) lines.push(cur); return lines.slice(0,3); }

$('#copy').onclick = () => {
  const txt = cards.map(c => `${c.text} @ ${c.x.toFixed(0)},${c.y.toFixed(0)}${c.pinned?' pinned':''}`).join('\n');
  navigator.clipboard.writeText(txt).then(()=> status.textContent='copied', ()=>status.textContent='copy failed');
};

$('#seal').onclick = () => {
  const blob = new Blob([JSON.stringify({weights, notes:notesEl.value, positions:cards.map(c=>({text:c.text,x:c.x,y:c.y,pinned:c.pinned}))}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'note-layout-seal.json';
  a.click();
  status.textContent = 'sealed';
};

if (location.hash.length > 2) {
  try {
    const d = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    if (d.notes) notesEl.value = d.notes;
    if (d.weights) weights = d.weights;
  } catch (e) { console.debug("lab f662-orientation-mlp-note-layout:", e); }
}
load();
if (!weights) initWeights();

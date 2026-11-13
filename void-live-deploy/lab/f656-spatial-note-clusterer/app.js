const notesEl = document.getElementById('notes');
const canvas = document.getElementById('canvas');
const thresh = document.getElementById('thresh');
let notes = [];
let positions = [];
let cards = [];
let dragging = null;
let offset = {x:0,y:0};

function load() {
  const hash = location.hash.slice(1);
  if (hash) {
    try { notesEl.value = decodeURIComponent(atob(hash)); } catch (e) { console.debug("lab f656-spatial-note-clusterer:", e); }
  } else {
    const saved = localStorage.getItem('verse-f656-notes');
    if (saved) notesEl.value = saved;
  }
}
load();

function tokenize(s) {
  return new Set(s.toLowerCase().match(/\b[a-z]{3,}\b/g) || []);
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function cluster() {
  notes = notesEl.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (notes.length < 2) { alert('Add at least 2 notes'); return; }
  const sets = notes.map(tokenize);
  const n = notes.length;
  const sim = Array.from({length:n}, () => Array(n).fill(0));
  for (let i=0; i<n; i++) for (let j=i+1; j<n; j++) {
    sim[i][j] = sim[j][i] = jaccard(sets[i], sets[j]);
  }
  // Force-directed init
  positions = notes.map((_,i) => ({
    x: 100 + Math.random()* (canvas.clientWidth-200),
    y: 40 + Math.random()* (canvas.clientHeight-80),
    vx:0, vy:0
  }));
  const pull = thresh.value / 100;
  for (let step=0; step<180; step++) {
    for (let i=0; i<n; i++) {
      let fx=0, fy=0;
      for (let j=0; j<n; j++) if (i!==j) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.hypot(dx,dy) || 1;
        const s = sim[i][j];
        // attraction
        const att = s * pull * 0.8;
        fx += (dx/dist) * att * 40;
        fy += (dy/dist) * att * 40;
        // repulsion
        const rep = 80 / (dist*dist);
        fx -= (dx/dist) * rep;
        fy -= (dy/dist) * rep;
      }
      positions[i].vx = (positions[i].vx + fx) * 0.85;
      positions[i].vy = (positions[i].vy + fy) * 0.85;
      positions[i].x += positions[i].vx;
      positions[i].y += positions[i].vy;
      // bounds
      positions[i].x = Math.max(20, Math.min(canvas.clientWidth-40, positions[i].x));
      positions[i].y = Math.max(20, Math.min(canvas.clientHeight-40, positions[i].y));
    }
  }
  render();
  localStorage.setItem('verse-f656-notes', notesEl.value);
}

function render() {
  canvas.innerHTML = '';
  cards = [];
  notes.forEach((text, i) => {
    const el = document.createElement('div');
    el.className = 'note-card';
    el.textContent = text;
    el.style.left = positions[i].x + 'px';
    el.style.top = positions[i].y + 'px';
    el.dataset.i = i;
    el.addEventListener('pointerdown', startDrag);
    canvas.appendChild(el);
    cards.push(el);
  });
}

function startDrag(e) {
  dragging = e.target;
  const rect = dragging.getBoundingClientRect();
  const crect = canvas.getBoundingClientRect();
  offset.x = e.clientX - rect.left;
  offset.y = e.clientY - rect.top;
  dragging.setPointerCapture(e.pointerId);
  e.preventDefault();
}
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const crect = canvas.getBoundingClientRect();
  let x = e.clientX - crect.left - offset.x;
  let y = e.clientY - crect.top - offset.y;
  x = Math.max(0, Math.min(canvas.clientWidth-40, x));
  y = Math.max(0, Math.min(canvas.clientHeight-40, y));
  dragging.style.left = x + 'px';
  dragging.style.top = y + 'px';
  const i = +dragging.dataset.i;
  positions[i].x = x;
  positions[i].y = y;
});
window.addEventListener('pointerup', () => { dragging = null; });

document.getElementById('cluster').onclick = cluster;
document.getElementById('clear').onclick = () => { notesEl.value=''; canvas.innerHTML=''; localStorage.removeItem('verse-f656-notes'); };

document.getElementById('dl-json').onclick = () => {
  const data = { notes, positions, threshold: thresh.value, ts: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'note-clusters.json';
  a.click();
};

document.getElementById('dl-svg').onclick = () => {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.clientWidth}" height="${canvas.clientHeight}">`;
  svg += `<rect width="100%" height="100%" fill="#0a0a10"/>`;
  notes.forEach((t,i) => {
    const p = positions[i];
    svg += `<rect x="${p.x}" y="${p.y}" width="160" height="40" fill="#1e2a3a" stroke="#4a6a8a" rx="6"/>`;
    svg += `<text x="${p.x+8}" y="${p.y+24}" fill="#eee" font-size="12">${t.slice(0,30).replace(/&/g,'&amp;')}</text>`;
  });
  svg += '</svg>';
  const blob = new Blob([svg], {type:'image/svg+xml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'note-map.svg';
  a.click();
};

document.getElementById('copy').onclick = () => {
  // simple groups by proximity
  const groups = [];
  const used = new Set();
  for (let i=0; i<notes.length; i++) {
    if (used.has(i)) continue;
    const g = [notes[i]];
    used.add(i);
    for (let j=i+1; j<notes.length; j++) {
      if (used.has(j)) continue;
      const d = Math.hypot(positions[i].x-positions[j].x, positions[i].y-positions[j].y);
      if (d < 120) { g.push(notes[j]); used.add(j); }
    }
    groups.push(g);
  }
  const text = groups.map((g,i) => `Group ${i+1}:\n${g.join('\n')}`).join('\n\n');
  navigator.clipboard.writeText(text).then(() => alert('Groups copied'));
};

// share hash on change
notesEl.addEventListener('input', () => {
  const h = btoa(encodeURIComponent(notesEl.value));
  history.replaceState(null, '', '#' + h);
  localStorage.setItem('verse-f656-notes', notesEl.value);
});

const STORAGE_KEY = 'verse-f666-kanban';
let board = { columns: [
  { name: 'To Do', cards: [] },
  { name: 'Doing', cards: [] },
  { name: 'Done', cards: [] }
]};
let dragSrc = null;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function load() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(escape(atob(hash))));
      if (data && data.columns) board = data;
    } else {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) board = JSON.parse(saved);
    }
  } catch (e) { console.debug("lab f666-spatial-kanban-board:", e); }
  render();
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch (e) { console.debug("lab f666-spatial-kanban-board:", e); }
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(board))));
  history.replaceState(null, '', '#' + b64);
}

function render() {
  const el = document.getElementById('board');
  el.innerHTML = '';
  board.columns.forEach((col, ci) => {
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.ci = ci;
    colEl.innerHTML = `<h3>${escapeHtml(col.name)} <span style="font-size:0.8rem;opacity:0.7">${col.cards.length}</span></h3>`;
    const cardsEl = document.createElement('div');
    cardsEl.className = 'cards';
    cardsEl.dataset.ci = ci;
    col.cards.forEach((card, ki) => {
      const c = document.createElement('div');
      c.className = 'card';
      c.draggable = true;
      c.dataset.ci = ci;
      c.dataset.ki = ki;
      c.innerHTML = `<p class="text">${escapeHtml(card.text)}</p>`;
      c.addEventListener('dragstart', onDragStart);
      c.addEventListener('dragend', onDragEnd);
      cardsEl.appendChild(c);
    });
    cardsEl.addEventListener('dragover', e => e.preventDefault());
    cardsEl.addEventListener('drop', onDrop);
    colEl.appendChild(cardsEl);
    const add = document.createElement('div');
    add.className = 'add-row';
    add.innerHTML = `<input placeholder="New card..." data-ci="${ci}"><button data-ci="${ci}">Add</button>`;
    add.querySelector('button').onclick = () => addCard(ci, add.querySelector('input').value);
    add.querySelector('input').onkeydown = e => { if (e.key === 'Enter') addCard(ci, e.target.value); };
    colEl.appendChild(add);
    el.appendChild(colEl);
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function addCard(ci, text) {
  text = (text || '').trim();
  if (!text) return;
  board.columns[ci].cards.push({ id: uid(), text });
  save(); render();
}

function onDragStart(e) {
  dragSrc = { ci: +this.dataset.ci, ki: +this.dataset.ki };
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) { this.classList.remove('dragging'); dragSrc = null; }

function onDrop(e) {
  e.preventDefault();
  if (!dragSrc) return;
  const targetCi = +this.dataset.ci;
  const card = board.columns[dragSrc.ci].cards.splice(dragSrc.ki, 1)[0];
  // insert at end or compute position; simple: append
  board.columns[targetCi].cards.push(card);
  save(); render();
}

document.getElementById('addCol').onclick = () => {
  const name = prompt('Column name', 'New');
  if (name && name.trim()) {
    board.columns.push({ name: name.trim(), cards: [] });
    save(); render();
  }
};

document.getElementById('clear').onclick = () => {
  if (confirm('Clear the whole board?')) {
    board = { columns: [{name:'To Do',cards:[]},{name:'Doing',cards:[]},{name:'Done',cards:[]}] };
    save(); render();
  }
};

document.getElementById('copyList').onclick = () => {
  let text = '';
  board.columns.forEach(col => {
    text += `# ${col.name}\n`;
    col.cards.forEach(c => text += `- ${c.text}\n`);
    text += '\n';
  });
  navigator.clipboard.writeText(text).then(() => toast('Copied list'));
};

document.getElementById('share').onclick = () => {
  const url = location.href;
  navigator.clipboard.writeText(url).then(() => toast('Share link copied'));
};

document.getElementById('exportPng').onclick = exportPng;

function exportPng() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const cols = board.columns.length;
  const colW = 280, gap = 20, pad = 40;
  const maxCards = Math.max(1, ...board.columns.map(c => c.cards.length));
  const cardH = 40, colH = 60 + maxCards * (cardH + 8);
  canvas.width = pad * 2 + cols * colW + (cols-1)*gap;
  canvas.height = pad * 2 + colH;
  ctx.fillStyle = '#0f1115';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  board.columns.forEach((col, i) => {
    const x = pad + i * (colW + gap);
    ctx.fillStyle = '#252830';
    roundRect(ctx, x, pad, colW, colH, 8);
    ctx.fill();
    ctx.fillStyle = '#e6e6e6';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(col.name + ' (' + col.cards.length + ')', x + 12, pad + 28);
    ctx.font = '14px system-ui';
    col.cards.forEach((card, j) => {
      const cy = pad + 50 + j * (cardH + 8);
      ctx.fillStyle = '#1a1d24';
      roundRect(ctx, x + 10, cy, colW - 20, cardH, 4);
      ctx.fill();
      ctx.fillStyle = '#e6e6e6';
      const text = card.text.length > 36 ? card.text.slice(0,33) + '…' : card.text;
      ctx.fillText(text, x + 18, cy + 26);
    });
  });
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kanban-board.png';
    a.click();
    toast('PNG downloaded');
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2000);
}

load();

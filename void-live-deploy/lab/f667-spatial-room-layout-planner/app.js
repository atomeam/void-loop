const SCALE = 40; // px per metre
let room = { w: 4, l: 5 };
let items = [];
let idCounter = 1;
const floor = document.getElementById('floor');
const stats = document.getElementById('stats');

function updateFloor() {
  floor.style.width = (room.w * SCALE) + 'px';
  floor.style.height = (room.l * SCALE) + 'px';
  renderItems();
  updateStats();
}

function renderItems() {
  floor.innerHTML = '';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'item';
    el.style.left = (it.x * SCALE) + 'px';
    el.style.top = (it.y * SCALE) + 'px';
    el.style.width = (it.w * SCALE) + 'px';
    el.style.height = (it.l * SCALE) + 'px';
    el.dataset.id = it.id;
    el.innerHTML = `<span class="label">${it.type}<br>${it.w.toFixed(1)}×${it.l.toFixed(1)}</span><div class="resize"></div>`;
    floor.appendChild(el);
    makeDraggable(el, it);
  });
}

function makeDraggable(el, it) {
  let dragging = false, resizing = false;
  let startX, startY, startLeft, startTop, startW, startH;
  el.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('resize')) {
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = it.w; startH = it.l;
    } else {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startLeft = it.x; startTop = it.y;
    }
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!dragging && !resizing) return;
    const dx = (e.clientX - startX) / SCALE;
    const dy = (e.clientY - startY) / SCALE;
    if (dragging) {
      it.x = Math.max(0, Math.min(room.w - it.w, Math.round((startLeft + dx) * 10) / 10));
      it.y = Math.max(0, Math.min(room.l - it.l, Math.round((startTop + dy) * 10) / 10));
    } else if (resizing) {
      it.w = Math.max(0.3, Math.min(room.w - it.x, Math.round((startW + dx) * 10) / 10));
      it.l = Math.max(0.3, Math.min(room.l - it.y, Math.round((startH + dy) * 10) / 10));
    }
    el.style.left = (it.x * SCALE) + 'px';
    el.style.top = (it.y * SCALE) + 'px';
    el.style.width = (it.w * SCALE) + 'px';
    el.style.height = (it.l * SCALE) + 'px';
    el.querySelector('.label').innerHTML = `${it.type}<br>${it.w.toFixed(1)}×${it.l.toFixed(1)}`;
    updateStats();
  });
  el.addEventListener('pointerup', () => { dragging = resizing = false; persist(); });
}

function updateStats() {
  const used = items.reduce((s, it) => s + it.w * it.l, 0);
  const total = room.w * room.l;
  stats.textContent = `Room: ${room.w}×${room.l} m (${total.toFixed(1)} m²) · Items: ${items.length} · Used: ${used.toFixed(1)} m² · Free: ${(total - used).toFixed(1)} m²`;
}

function addItem(type, w, l) {
  items.push({ id: idCounter++, type, x: 0.5, y: 0.5, w, l });
  renderItems();
  persist();
}

document.getElementById('setRoom').onclick = () => {
  room.w = parseFloat(document.getElementById('roomW').value) || 4;
  room.l = parseFloat(document.getElementById('roomL').value) || 5;
  // clamp items
  items.forEach(it => {
    it.x = Math.min(it.x, room.w - it.w);
    it.y = Math.min(it.y, room.l - it.l);
  });
  updateFloor();
  persist();
};

document.getElementById('addBed').onclick = () => addItem('Bed', 2.0, 1.5);
document.getElementById('addTable').onclick = () => addItem('Table', 1.2, 0.8);
document.getElementById('addChair').onclick = () => addItem('Chair', 0.5, 0.5);
document.getElementById('addSofa').onclick = () => addItem('Sofa', 2.2, 0.9);
document.getElementById('clear').onclick = () => { items = []; renderItems(); persist(); };

document.getElementById('download').onclick = () => {
  const canvas = document.createElement('canvas');
  const pad = 40;
  canvas.width = room.w * SCALE + pad * 2;
  canvas.height = room.l * SCALE + pad * 2 + 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, room.w * SCALE, room.l * SCALE);
  ctx.fillStyle = '#e8f0e8';
  ctx.fillRect(pad + 1, pad + 1, room.w * SCALE - 2, room.l * SCALE - 2);
  items.forEach(it => {
    ctx.fillStyle = 'rgba(100,150,255,0.7)';
    ctx.fillRect(pad + it.x * SCALE, pad + it.y * SCALE, it.w * SCALE, it.l * SCALE);
    ctx.strokeStyle = '#336';
    ctx.strokeRect(pad + it.x * SCALE, pad + it.y * SCALE, it.w * SCALE, it.l * SCALE);
    ctx.fillStyle = '#000';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(it.type, pad + (it.x + it.w / 2) * SCALE, pad + (it.y + it.l / 2) * SCALE);
  });
  ctx.fillStyle = '#000';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(`Room ${room.w}×${room.l} m`, pad, canvas.height - 20);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'room-layout.png';
  a.click();
};

document.getElementById('copyList').onclick = () => {
  const text = items.map(it => `${it.type}: ${it.w.toFixed(1)}m × ${it.l.toFixed(1)}m at (${it.x.toFixed(1)}, ${it.y.toFixed(1)})`).join('\n') || 'No items';
  navigator.clipboard.writeText(text).then(() => alert('List copied'));
};

function persist() {
  const data = { room, items };
  localStorage.setItem('verse-f667-layout', JSON.stringify(data));
  const hash = btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_');
  history.replaceState(null, '', '#' + hash);
}

function load() {
  let data;
  const hash = location.hash.slice(1);
  if (hash) {
    try { data = JSON.parse(atob(hash.replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { console.debug("lab f667-spatial-room-layout-planner:", e); }
  }
  if (!data) {
    try { data = JSON.parse(localStorage.getItem('verse-f667-layout') || '{}'); } catch (e) { console.debug("lab f667-spatial-room-layout-planner:", e); }
  }
  if (data && data.room) {
    room = data.room;
    items = data.items || [];
    idCounter = Math.max(1, ...items.map(i => i.id || 0)) + 1;
    document.getElementById('roomW').value = room.w;
    document.getElementById('roomL').value = room.l;
  }
  updateFloor();
}

document.getElementById('save').onclick = persist;
window.onload = load;

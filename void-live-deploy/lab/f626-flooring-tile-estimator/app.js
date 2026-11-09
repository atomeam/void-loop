const KEY = 'verse-f626-floor';
const unitsEl = document.getElementById('units');
const tileLEl = document.getElementById('tileL');
const tileWEl = document.getElementById('tileW');
const perBoxEl = document.getElementById('perBox');
const wasteEl = document.getElementById('waste');
const roomsEl = document.getElementById('rooms');
const grandEl = document.getElementById('grand');
const listEl = document.getElementById('list');
const tileLLabel = document.getElementById('tileLLabel');
const tileWLabel = document.getElementById('tileWLabel');

let rooms = [];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const d = JSON.parse(s);
      if (d.units) unitsEl.value = d.units;
      if (d.tileL) tileLEl.value = d.tileL;
      if (d.tileW) tileWEl.value = d.tileW;
      if (d.perBox) perBoxEl.value = d.perBox;
      if (d.waste != null) wasteEl.value = d.waste;
      if (Array.isArray(d.rooms) && d.rooms.length) rooms = d.rooms;
    }
  } catch (e) { console.debug("lab f626-flooring-tile-estimator:", e); }
  if (!rooms.length) rooms = [{id:uid(), name:'Room 1', L:10, W:12}];
  // hash override
  if (location.hash.length > 1) {
    try {
      const h = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (h.tileL) tileLEl.value = h.tileL;
      if (h.rooms) rooms = h.rooms;
    } catch (e) { console.debug("lab f626-flooring-tile-estimator:", e); }
  }
  renderRooms();
  calc();
}

function save() {
  const d = {
    units: unitsEl.value,
    tileL: +tileLEl.value,
    tileW: +tileWEl.value,
    perBox: +perBoxEl.value,
    waste: +wasteEl.value,
    rooms
  };
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.debug("lab f626-flooring-tile-estimator:", e); }
  history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify({
    tileL: d.tileL, tileW: d.tileW, perBox: d.perBox, waste: d.waste, rooms
  })));
}

function updateLabels() {
  const imp = unitsEl.value === 'imp';
  tileLLabel.textContent = imp ? 'Tile length (in)' : 'Tile length (cm)';
  tileWLabel.textContent = imp ? 'Tile width (in)' : 'Tile width (cm)';
}

function roomArea(r) {
  const imp = unitsEl.value === 'imp';
  const L = +r.L || 0, W = +r.W || 0;
  return imp ? L * W : L * W; // already in ft² or m²
}

function tileArea() {
  const imp = unitsEl.value === 'imp';
  let tl = +tileLEl.value || 1, tw = +tileWEl.value || 1;
  if (imp) { tl /= 12; tw /= 12; } else { tl /= 100; tw /= 100; }
  return tl * tw;
}

function calc() {
  updateLabels();
  const ta = tileArea();
  const waste = (+wasteEl.value || 0) / 100;
  const perBox = Math.max(1, +perBoxEl.value || 1);
  let totalTiles = 0;
  let lines = [];
  rooms.forEach((r, i) => {
    const a = roomArea(r);
    const needed = ta > 0 ? Math.ceil(a / ta * (1 + waste)) : 0;
    totalTiles += needed;
    const boxes = Math.ceil(needed / perBox);
    lines.push(`${r.name || 'Room'}: ${a.toFixed(1)} ${unitsEl.value==='imp'?'ft²':'m²'} → ${needed} tiles (${boxes} boxes)`);
    // draw
    const c = document.getElementById('c'+r.id);
    if (c) drawRoom(c, r, needed);
  });
  const totalBoxes = Math.ceil(totalTiles / perBox);
  grandEl.textContent = `Total: ${totalTiles} tiles · ${totalBoxes} boxes`;
  listEl.textContent = lines.join('\n') + `\n\nTile: ${tileLEl.value}×${tileWEl.value} ${unitsEl.value==='imp'?'in':'cm'} · ${perBox}/box · ${wasteEl.value}% waste`;
  save();
}

function drawRoom(canvas, r, needed) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,w,h);
  const L = +r.L || 1, W = +r.W || 1;
  const scale = Math.min((w-20)/L, (h-20)/W);
  const rw = L * scale, rh = W * scale;
  const ox = (w - rw)/2, oy = (h - rh)/2;
  ctx.strokeStyle = '#4a9eff';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, rw, rh);
  // simple grid
  const imp = unitsEl.value === 'imp';
  let tl = +tileLEl.value || 12, tw = +tileWEl.value || 12;
  if (imp) { tl /= 12; tw /= 12; } else { tl /= 100; tw /= 100; }
  const nx = Math.max(1, Math.round(L / tl));
  const ny = Math.max(1, Math.round(W / tw));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let i=1; i<nx; i++) {
    const x = ox + (i/nx)*rw;
    ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy+rh); ctx.stroke();
  }
  for (let j=1; j<ny; j++) {
    const y = oy + (j/ny)*rh;
    ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox+rw, y); ctx.stroke();
  }
  ctx.fillStyle = '#e8eaed';
  ctx.font = '12px system-ui';
  ctx.fillText(`${r.name || ''}  ${L}×${W}`, ox+4, oy+14);
}

function renderRooms() {
  roomsEl.innerHTML = '';
  rooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div class="room-header">
        <input type="text" value="${r.name||''}" data-id="${r.id}" data-f="name" placeholder="Room name" style="flex:1;margin-right:0.5rem">
        <button class="secondary" data-del="${r.id}">Remove</button>
      </div>
      <div class="row">
        <div><label>Length</label><input type="number" value="${r.L}" data-id="${r.id}" data-f="L" min="0.1" step="0.1"></div>
        <div><label>Width</label><input type="number" value="${r.W}" data-id="${r.id}" data-f="W" min="0.1" step="0.1"></div>
      </div>
      <canvas id="c${r.id}"></canvas>
    `;
    roomsEl.appendChild(div);
  });
  roomsEl.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const f = e.target.dataset.f;
      const room = rooms.find(x => x.id === id);
      if (room) {
        room[f] = f === 'name' ? e.target.value : +e.target.value;
        calc();
      }
    });
  });
  roomsEl.querySelectorAll('button[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      rooms = rooms.filter(x => x.id !== b.dataset.del);
      if (!rooms.length) rooms = [{id:uid(), name:'Room 1', L:10, W:12}];
      renderRooms();
      calc();
    });
  });
}

document.getElementById('addRoom').onclick = () => {
  rooms.push({id:uid(), name:'Room '+(rooms.length+1), L:8, W:10});
  renderRooms();
  calc();
};
[unitsEl, tileLEl, tileWEl, perBoxEl, wasteEl].forEach(el => el.addEventListener('input', calc));

document.getElementById('copy').onclick = () => {
  navigator.clipboard.writeText(listEl.textContent).then(() => {
    const b = document.getElementById('copy');
    const t = b.textContent; b.textContent = 'Copied';
    setTimeout(() => b.textContent = t, 1200);
  }).catch(()=>{});
};

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/plain'}));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('csv').onclick = () => {
  let csv = 'Room,Length,Width,Area,Tiles,Boxes\n';
  const ta = tileArea();
  const waste = (+wasteEl.value||0)/100;
  const perBox = Math.max(1,+perBoxEl.value||1);
  rooms.forEach(r => {
    const a = roomArea(r);
    const needed = ta>0 ? Math.ceil(a/ta*(1+waste)) : 0;
    csv += `"${r.name}",${r.L},${r.W},${a.toFixed(2)},${needed},${Math.ceil(needed/perBox)}\n`;
  });
  download('flooring-estimate.csv', csv);
};

document.getElementById('txt').onclick = () => download('flooring-estimate.txt', listEl.textContent);

window.addEventListener('resize', calc);
load();

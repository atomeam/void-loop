const KEY = 'verse-f627-paint';
let rooms = [];
let unit = 'imp';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

function defaultRoom() {
  return {
    id: uid(),
    name: 'Room',
    L: 12, W: 10, H: 8,
    doors: 1, doorW: 3, doorH: 7,
    windows: 1, winW: 3, winH: 4,
    coats: 2,
    coverage: 350 // sq ft per gallon default
  };
}

function areaOf(r, u) {
  // Wall area = 2*(L+W)*H minus openings
  const wall = 2 * (r.L + r.W) * r.H;
  const doorA = r.doors * r.doorW * r.doorH;
  const winA = r.windows * r.winW * r.winH;
  const net = Math.max(0, wall - doorA - winA);
  return { wall, net, doorA, winA };
}

function paintNeeded(r) {
  const a = areaOf(r);
  const cov = Math.max(1, r.coverage);
  const volume = (a.net * r.coats) / cov;
  return { ...a, volume };
}

function render() {
  const container = document.getElementById('rooms');
  container.innerHTML = '';
  let totalVol = 0;
  rooms.forEach((r, i) => {
    const p = paintNeeded(r);
    totalVol += p.volume;
    const div = document.createElement('div');
    div.className = 'room';
    div.innerHTML = `
      <div class="room-header">
        <input type="text" value="${r.name}" data-id="${r.id}" data-k="name" style="flex:1; margin-right:8px">
        <button class="danger secondary" data-del="${r.id}">Remove</button>
      </div>
      <div class="grid">
        <div><label>Length</label><input type="number" step="0.1" min="0" value="${r.L}" data-id="${r.id}" data-k="L"></div>
        <div><label>Width</label><input type="number" step="0.1" min="0" value="${r.W}" data-id="${r.id}" data-k="W"></div>
        <div><label>Height</label><input type="number" step="0.1" min="0" value="${r.H}" data-id="${r.id}" data-k="H"></div>
        <div><label>Doors</label><input type="number" step="1" min="0" value="${r.doors}" data-id="${r.id}" data-k="doors"></div>
        <div><label>Door W</label><input type="number" step="0.1" min="0" value="${r.doorW}" data-id="${r.id}" data-k="doorW"></div>
        <div><label>Door H</label><input type="number" step="0.1" min="0" value="${r.doorH}" data-id="${r.id}" data-k="doorH"></div>
        <div><label>Windows</label><input type="number" step="1" min="0" value="${r.windows}" data-id="${r.id}" data-k="windows"></div>
        <div><label>Win W</label><input type="number" step="0.1" min="0" value="${r.winW}" data-id="${r.id}" data-k="winW"></div>
        <div><label>Win H</label><input type="number" step="0.1" min="0" value="${r.winH}" data-id="${r.id}" data-k="winH"></div>
        <div><label>Coats</label><input type="number" step="1" min="1" value="${r.coats}" data-id="${r.id}" data-k="coats"></div>
        <div><label>Coverage / unit</label><input type="number" step="1" min="1" value="${r.coverage}" data-id="${r.id}" data-k="coverage"></div>
      </div>
      <div>Wall area: ${p.wall.toFixed(1)} | Net: ${p.net.toFixed(1)} | Paint: ${p.volume.toFixed(2)} ${unit==='imp'?'gal':'L'}</div>
      <canvas id="c${r.id}" width="400" height="120"></canvas>
    `;
    container.appendChild(div);
    drawWall(r, document.getElementById('c'+r.id));
  });
  document.getElementById('summary').textContent = `Total paint needed: ${totalVol.toFixed(2)} ${unit==='imp'?'gallons':'litres'} (add ~10% waste recommended).`;
  bind();
  save();
}

function drawWall(r, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#222';
  ctx.fillRect(0,0,w,h);
  // Simple unfolded: two long walls + two short, side by side scaled
  const totalLen = 2*(r.L + r.W);
  if (totalLen <= 0 || r.H <= 0) return;
  const scaleX = (w-20) / totalLen;
  const scaleY = (h-20) / r.H;
  const scale = Math.min(scaleX, scaleY);
  ctx.strokeStyle = '#4dabf7';
  ctx.fillStyle = 'rgba(77,171,247,0.3)';
  let x = 10;
  const y = 10;
  // Draw four walls
  const walls = [r.L, r.W, r.L, r.W];
  walls.forEach(len => {
    const ww = len * scale;
    const hh = r.H * scale;
    ctx.fillRect(x, y, ww, hh);
    ctx.strokeRect(x, y, ww, hh);
    x += ww;
  });
  // Rough openings as red rects on first walls
  ctx.fillStyle = 'rgba(255,100,100,0.5)';
  if (r.doors > 0) {
    const dw = r.doorW * scale;
    const dh = r.doorH * scale;
    ctx.fillRect(15, y + (r.H*scale - dh), dw, dh);
  }
  if (r.windows > 0) {
    const ww = r.winW * scale;
    const wh = r.winH * scale;
    ctx.fillRect(15 + r.doorW*scale + 5, y + 10, ww, wh);
  }
}

function bind() {
  document.querySelectorAll('input[data-id]').forEach(inp => {
    inp.oninput = () => {
      const id = inp.dataset.id;
      const k = inp.dataset.k;
      const r = rooms.find(rr => rr.id === id);
      if (!r) return;
      r[k] = k === 'name' ? inp.value : parseFloat(inp.value) || 0;
      render();
    };
  });
  document.querySelectorAll('button[data-del]').forEach(btn => {
    btn.onclick = () => {
      rooms = rooms.filter(rr => rr.id !== btn.dataset.del);
      if (!rooms.length) rooms = [defaultRoom()];
      render();
    };
  });
}

document.getElementById('addRoom').onclick = () => {
  rooms.push(defaultRoom());
  render();
};

document.querySelectorAll('input[name=units]').forEach(rad => {
  rad.onchange = () => {
    unit = rad.value;
    // rough conversion of coverage defaults
    rooms.forEach(r => {
      if (unit === 'met' && r.coverage > 100) r.coverage = Math.round(r.coverage / 10.764); // ft2 to m2 approx
      if (unit === 'imp' && r.coverage < 50) r.coverage = Math.round(r.coverage * 10.764);
    });
    render();
  };
});

function listText() {
  let t = 'Paint shopping list\n';
  let total = 0;
  rooms.forEach(r => {
    const p = paintNeeded(r);
    total += p.volume;
    t += `\n${r.name}: ${p.net.toFixed(1)} net area, ${r.coats} coats → ${p.volume.toFixed(2)} ${unit==='imp'?'gal':'L'}`;
  });
  t += `\n\nTotal: ${total.toFixed(2)} ${unit==='imp'?'gallons':'litres'}\n(Add 10% for waste.)`;
  return t;
}

document.getElementById('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(listText()); document.getElementById('status').textContent = 'List copied.'; }
  catch (e) { document.getElementById('status').textContent = 'Copy failed.'; }
};
document.getElementById('dlTxt').onclick = () => {
  const blob = new Blob([listText()], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'paint-list.txt';
  a.click();
};
document.getElementById('dlCsv').onclick = () => {
  let csv = 'Room,Length,Width,Height,NetArea,Coats,Paint\n';
  rooms.forEach(r => {
    const p = paintNeeded(r);
    csv += `"${r.name}",${r.L},${r.W},${r.H},${p.net.toFixed(1)},${r.coats},${p.volume.toFixed(2)}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'paint-list.csv';
  a.click();
};
document.getElementById('share').onclick = async () => {
  const data = { unit, rooms };
  const hash = '#' + encodeURIComponent(JSON.stringify(data));
  const url = location.origin + location.pathname + hash;
  try { await navigator.clipboard.writeText(url); document.getElementById('status').textContent = 'Share link copied.'; }
  catch (e) { location.hash = hash.slice(1); document.getElementById('status').textContent = 'Link updated.'; }
};
document.getElementById('clear').onclick = () => {
  rooms = [defaultRoom()];
  localStorage.removeItem(KEY);
  history.replaceState(null, '', location.pathname);
  render();
  document.getElementById('status').textContent = 'Cleared.';
};

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ unit, rooms })); } catch (e) { console.debug("lab f627-paint-estimator:", e); }
}
function load() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.rooms) rooms = data.rooms;
      if (data.unit) unit = data.unit;
      document.querySelector(`input[value="${unit}"]`).checked = true;
      document.getElementById('status').textContent = 'Loaded from share link.';
      render();
      return;
    }
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const data = JSON.parse(saved);
      rooms = data.rooms || [defaultRoom()];
      unit = data.unit || 'imp';
      document.querySelector(`input[value="${unit}"]`).checked = true;
      document.getElementById('status').textContent = 'Restored from this device.';
    } else {
      rooms = [defaultRoom()];
    }
  } catch(e) { rooms = [defaultRoom()]; }
  render();
}
load();

const board = document.getElementById('board');
const status = document.getElementById('status');
let items = [];
let gpuDevice = null;
let gpuAvailable = false;

async function initGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available — JS fallback'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    gpuDevice = await adapter.requestDevice();
    gpuAvailable = true;
    status.textContent = 'WebGPU ready';
  } catch (e) { status.textContent = 'WebGPU failed — JS fallback'; }
}
initGPU();

function load() {
  try {
    const saved = localStorage.getItem('verse-f673-packer');
    if (saved) items = JSON.parse(saved);
  } catch (e) { console.debug("lab f673-webgpu-spatial-bin-packer:", e); }
  render();
}
function save() {
  try { localStorage.setItem('verse-f673-packer', JSON.stringify(items)); } catch (e) { console.debug("lab f673-webgpu-spatial-bin-packer:", e); }
}

function render() {
  board.innerHTML = '';
  items.forEach((it, i) => {
    const el = document.createElement('div');
    el.className = `card bin${it.bin % 4}${it.pinned ? ' pinned' : ''}`;
    el.style.left = (it.x || 20) + 'px';
    el.style.top = (it.y || 20) + 'px';
    el.style.width = (40 + it.size * 12) + 'px';
    el.textContent = `${it.name} (${it.size})`;
    el.dataset.i = i;
    makeDraggable(el, i);
    board.appendChild(el);
  });
}

function makeDraggable(el, i) {
  let ox, oy, dragging = false;
  el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
    items[i].pinned = true;
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const r = board.getBoundingClientRect();
    items[i].x = Math.max(0, Math.min(r.width - el.offsetWidth, e.clientX - r.left - ox));
    items[i].y = Math.max(0, Math.min(r.height - el.offsetHeight, e.clientY - r.top - oy));
    el.style.left = items[i].x + 'px';
    el.style.top = items[i].y + 'px';
  });
  el.addEventListener('pointerup', () => { dragging = false; save(); });
}

document.getElementById('add').onclick = () => {
  const name = document.getElementById('name').value.trim() || 'Item';
  const size = +document.getElementById('size').value;
  items.push({ name, size, x: Math.random()*400, y: Math.random()*300, bin: Math.floor(Math.random()*4), pinned: false });
  document.getElementById('name').value = '';
  render(); save();
};

function jsPack() {
  const nb = +document.getElementById('bins').value;
  const centers = Array.from({length: nb}, (_, b) => ({ x: 80 + (b%2)*300, y: 60 + Math.floor(b/2)*200 }));
  for (let step = 0; step < 40; step++) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].pinned) continue;
      let fx = 0, fy = 0;
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const dx = items[i].x - items[j].x;
        const dy = items[i].y - items[j].y;
        const d2 = dx*dx + dy*dy + 100;
        const f = 800 / d2;
        fx += dx * f; fy += dy * f;
      }
      const c = centers[items[i].bin % nb];
      fx += (c.x - items[i].x) * 0.05;
      fy += (c.y - items[i].y) * 0.05;
      items[i].x += fx * 0.1;
      items[i].y += fy * 0.1;
      items[i].x = Math.max(10, Math.min(700, items[i].x));
      items[i].y = Math.max(10, Math.min(500, items[i].y));
    }
  }
  items.forEach(it => {
    if (it.pinned) return;
    let best = 0, bd = 1e9;
    centers.forEach((c, b) => {
      const d = (it.x-c.x)**2 + (it.y-c.y)**2;
      if (d < bd) { bd = d; best = b; }
    });
    it.bin = best;
  });
  render(); save();
  status.textContent = 'Packed with JS';
}

async function gpuPack() {
  if (!gpuAvailable || !gpuDevice) { jsPack(); return; }
  status.textContent = 'WebGPU device present — running JS forces (shader stub)';
  jsPack();
}

document.getElementById('pack').onclick = gpuPack;

document.getElementById('png').onclick = () => {
  const c = document.createElement('canvas');
  c.width = board.clientWidth; c.height = board.clientHeight;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,c.width,c.height);
  items.forEach(it => {
    ctx.fillStyle = ['#2a3a4a','#3a2a4a','#4a3a2a','#2a4a3a'][it.bin%4];
    ctx.fillRect(it.x, it.y, 40+it.size*12, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui';
    ctx.fillText(it.name, it.x+4, it.y+20);
  });
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'verse-packer.png';
  a.click();
};

document.getElementById('csv').onclick = () => {
  const rows = ['name,size,bin,x,y', ...items.map(it => `"${it.name}",${it.size},${it.bin},${Math.round(it.x)},${Math.round(it.y)}`)];
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'verse-packer.csv';
  a.click();
};

load();

const $ = s => document.querySelector(s);
const itemsEl = $('#items');
const totalEl = $('#total');
const statusEl = $('#status');
let items = [];
let idSeq = 1;

const BAGS = {
  conc60: { label: 'Concrete 60 lb', yieldImp: 0.45, yieldMet: 0.0127, unit: 'bag' },
  conc80: { label: 'Concrete 80 lb', yieldImp: 0.60, yieldMet: 0.0170, unit: 'bag' },
  mulch2: { label: 'Mulch 2 cu ft', yieldImp: 2, yieldMet: 0.0566, unit: 'bag' },
  mulch3: { label: 'Mulch 3 cu ft', yieldImp: 3, yieldMet: 0.08495, unit: 'bag' }
};

function defaultItem() {
  return {
    id: idSeq++,
    name: '',
    shape: 'slab',
    L: 10, W: 10, T: 0.333,
    D: 1, H: 4,
    waste: 10,
    bag: 'conc60'
  };
}

function load() {
  try {
    const raw = localStorage.getItem('verse-f628-volume');
    if (raw) {
      const data = JSON.parse(raw);
      items = data.items || [];
      if (data.units) $('#units').value = data.units;
      idSeq = Math.max(...items.map(i => i.id), 0) + 1;
    }
  } catch (e) { console.debug("lab f628-concrete-mulch-volume:", e); }
  if (!items.length) items.push(defaultItem());
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.items) { items = data.items; idSeq = Math.max(...items.map(i => i.id || 0), 0) + 1; }
      if (data.units) $('#units').value = data.units;
    } catch (e) { console.debug("lab f628-concrete-mulch-volume:", e); }
  }
  render();
}

function save() {
  try {
    localStorage.setItem('verse-f628-volume', JSON.stringify({ items, units: $('#units').value }));
  } catch (e) { statusEl.textContent = 'storage blocked'; }
  const payload = { items, units: $('#units').value };
  history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(payload)));
}

function volume(item, units) {
  let vol = 0;
  if (item.shape === 'slab' || item.shape === 'bed' || item.shape === 'footing') {
    vol = item.L * item.W * item.T;
  } else if (item.shape === 'cylinder') {
    const r = item.D / 2;
    vol = Math.PI * r * r * item.H;
  } else if (item.shape === 'circlebed') {
    const r = item.D / 2;
    vol = Math.PI * r * r * item.T;
  }
  if (vol < 0 || !isFinite(vol)) vol = 0;
  return vol * (1 + item.waste / 100);
}

function bags(item, vol, units) {
  const b = BAGS[item.bag] || BAGS.conc60;
  const y = units === 'met' ? b.yieldMet : b.yieldImp;
  if (y <= 0) return 0;
  return Math.ceil(vol / y);
}

function draw(canvas, item, units) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = '#4a9eff';
  ctx.lineWidth = 2;
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#e8eaed';

  const maxDim = Math.max(item.L || 1, item.W || 1, item.D || 1, item.H || 1, item.T || 0.1, 1);
  const scale = Math.min(cw, ch) * 0.7 / maxDim;
  const cx = cw / 2, cy = ch / 2;

  ctx.save();
  ctx.translate(cx, cy);
  if (item.shape === 'slab' || item.shape === 'footing' || item.shape === 'bed') {
    const lw = (item.L || 1) * scale, wh = (item.W || 1) * scale;
    ctx.fillStyle = 'rgba(74,158,255,0.3)';
    ctx.fillRect(-lw/2, -wh/2, lw, wh);
    ctx.strokeRect(-lw/2, -wh/2, lw, wh);
    ctx.fillStyle = '#e8eaed';
    ctx.fillText(`${item.L.toFixed(1)} × ${item.W.toFixed(1)}`, -30, 0);
  } else {
    const r = ((item.D || 1) / 2) * scale;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74,158,255,0.3)';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8eaed';
    ctx.fillText(`⌀ ${item.D.toFixed(1)}`, -20, 4);
  }
  ctx.restore();
}

function render() {
  itemsEl.innerHTML = '';
  const units = $('#units').value;
  let totalVol = 0, totalBags = 0;
  const unitVol = units === 'met' ? 'm³' : 'cu ft';

  items.forEach((item, idx) => {
    const vol = volume(item, units);
    const bagCount = bags(item, vol, units);
    totalVol += vol;
    totalBags += bagCount;
    const card = document.createElement('div');
    card.className = 'item';
    card.innerHTML = `
      <div class="fields">
        <label>Name <input data-k="name" value="${item.name || ''}" placeholder="Patio slab"></label>
        <label>Shape
          <select data-k="shape">
            <option value="slab"${item.shape==='slab'?' selected':''}>Slab / pad</option>
            <option value="footing"${item.shape==='footing'?' selected':''}>Footing / trench</option>
            <option value="cylinder"${item.shape==='cylinder'?' selected':''}>Cylinder / column</option>
            <option value="bed"${item.shape==='bed'?' selected':''}>Rect mulch bed</option>
            <option value="circlebed"${item.shape==='circlebed'?' selected':''}>Circular mulch</option>
          </select>
        </label>
        <label>Length / L <input type="number" step="0.1" min="0" data-k="L" value="${item.L}"></label>
        <label>Width / W <input type="number" step="0.1" min="0" data-k="W" value="${item.W}"></label>
        <label>Thickness / depth <input type="number" step="0.01" min="0" data-k="T" value="${item.T}"></label>
        <label>Diameter <input type="number" step="0.1" min="0" data-k="D" value="${item.D}"></label>
        <label>Height <input type="number" step="0.1" min="0" data-k="H" value="${item.H}"></label>
        <label>Waste % <input type="number" step="1" min="0" max="50" data-k="waste" value="${item.waste}"></label>
        <label>Bag
          <select data-k="bag">
            <option value="conc60"${item.bag==='conc60'?' selected':''}>Concrete 60 lb</option>
            <option value="conc80"${item.bag==='conc80'?' selected':''}>Concrete 80 lb</option>
            <option value="mulch2"${item.bag==='mulch2'?' selected':''}>Mulch 2 cu ft</option>
            <option value="mulch3"${item.bag==='mulch3'?' selected':''}>Mulch 3 cu ft</option>
          </select>
        </label>
        <button class="secondary" data-del="${item.id}">Remove</button>
      </div>
      <div>
        <canvas id="c${item.id}"></canvas>
        <div class="summary">${vol.toFixed(2)} ${unitVol}${units==='imp' ? ' (' + (vol/27).toFixed(2) + ' yd³)' : ''} · ${bagCount} bags</div>
      </div>
    `;
    itemsEl.appendChild(card);
    const canvas = card.querySelector('canvas');
    draw(canvas, item, units);
    card.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', e => {
        const k = e.target.dataset.k;
        let v = e.target.value;
        if (e.target.type === 'number') v = parseFloat(v) || 0;
        item[k] = v;
        save();
        render();
      });
    });
    card.querySelector('[data-del]').addEventListener('click', () => {
      items = items.filter(i => i.id !== item.id);
      if (!items.length) items.push(defaultItem());
      save();
      render();
    });
  });

  const yd = units === 'imp' ? ` (${(totalVol/27).toFixed(2)} yd³)` : '';
  totalEl.textContent = `Total volume: ${totalVol.toFixed(2)} ${unitVol}${yd} · approx. ${totalBags} bags`;
  statusEl.textContent = items.length + ' item' + (items.length>1?'s':'');
}

$('#add').addEventListener('click', () => {
  items.push(defaultItem());
  save();
  render();
});

$('#units').addEventListener('change', () => { save(); render(); });

function listText() {
  const units = $('#units').value;
  const unitVol = units === 'met' ? 'm³' : 'cu ft';
  let lines = ['Concrete and mulch volume list', ''];
  items.forEach(item => {
    const vol = volume(item, units);
    const bagCount = bags(item, vol, units);
    const b = BAGS[item.bag] || BAGS.conc60;
    lines.push(`${item.name || 'Item'} (${item.shape}): ${vol.toFixed(2)} ${unitVol} +${item.waste}% waste → ${bagCount} × ${b.label}`);
  });
  const totalVol = items.reduce((s,i) => s + volume(i, units), 0);
  const totalBags = items.reduce((s,i) => s + bags(i, volume(i, units), units), 0);
  lines.push('', `Total: ${totalVol.toFixed(2)} ${unitVol} · ${totalBags} bags`);
  return lines.join('\n');
}

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(listText());
    statusEl.textContent = 'copied';
  } catch (e) { statusEl.textContent = 'copy failed'; }
});

function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('#csv').addEventListener('click', () => {
  const units = $('#units').value;
  let csv = 'Name,Shape,Volume,Unit,Bags,Bag type\n';
  items.forEach(item => {
    const vol = volume(item, units);
    const bagCount = bags(item, vol, units);
    const b = BAGS[item.bag] || BAGS.conc60;
    csv += `"${(item.name||'').replace(/"/g,'""')}",${item.shape},${vol.toFixed(3)},${units==='met'?'m3':'cuft'},${bagCount},"${b.label}"\n`;
  });
  download('volume-list.csv', csv);
});

$('#txt').addEventListener('click', () => download('volume-list.txt', listText()));

load();

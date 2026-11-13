const $ = id => document.getElementById(id);
const DPI = 96; // CSS px per inch for preview
const PRINT_DPI = 150;

const paperSizes = {
  letter: { w: 8.5, h: 11 },
  a4: { w: 210/25.4, h: 297/25.4 } // inches
};

let names = [];
let order = [];
let dragIdx = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem('verse-f661') || '{}');
    if (s.names) $('names').value = s.names;
    if (s.paper) $('paper').value = s.paper;
    if (s.unit) $('unit').value = s.unit;
    if (s.lw) $('lw').value = s.lw;
    if (s.lh) $('lh').value = s.lh;
    if (s.fs) $('fs').value = s.fs;
  } catch (e) { console.debug("lab f661-label-name-tag-sheet:", e); }
  apply();
}
function save() {
  localStorage.setItem('verse-f661', JSON.stringify({
    names: $('names').value,
    paper: $('paper').value,
    unit: $('unit').value,
    lw: +$('lw').value,
    lh: +$('lh').value,
    fs: +$('fs').value
  }));
}

function getDims() {
  const unit = $('unit').value;
  let lw = +$('lw').value, lh = +$('lh').value;
  if (unit === 'mm') { lw /= 25.4; lh /= 25.4; }
  const p = paperSizes[$('paper').value];
  return { lw, lh, pw: p.w, ph: p.h };
}

function apply() {
  names = $('names').value.split('\n').map(s => s.trim()).filter(Boolean);
  order = names.map((_,i) => i);
  render();
  save();
}

function render() {
  const { lw, lh, pw, ph } = getDims();
  const margin = 0.25; // inches
  const usableW = pw - 2*margin;
  const usableH = ph - 2*margin;
  const cols = Math.max(1, Math.floor(usableW / lw));
  const rows = Math.max(1, Math.floor(usableH / lh));
  const capacity = cols * rows;
  const scale = Math.min(700 / (pw * DPI), 900 / (ph * DPI));
  const sheet = $('sheet');
  sheet.style.width = (pw * DPI * scale) + 'px';
  sheet.style.height = (ph * DPI * scale) + 'px';
  sheet.innerHTML = '';
  const placed = Math.min(names.length, capacity);
  for (let i = 0; i < placed; i++) {
    const idx = order[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const card = document.createElement('div');
    card.className = 'label-card';
    card.textContent = names[idx];
    card.style.left = ((margin + c * lw) * DPI * scale) + 'px';
    card.style.top = ((margin + r * lh) * DPI * scale) + 'px';
    card.style.width = (lw * DPI * scale - 2) + 'px';
    card.style.height = (lh * DPI * scale - 2) + 'px';
    card.style.fontSize = (+$('fs').value * scale * 0.7) + 'px';
    card.dataset.pos = i;
    card.addEventListener('pointerdown', onDown);
    sheet.appendChild(card);
  }
  const overflow = Math.max(0, names.length - capacity);
  $('stats').textContent = `${placed} of ${names.length} names · ${cols}×${rows} grid · ${overflow} overflow · paper ${pw.toFixed(1)}×${ph.toFixed(1)} in`;
}

function onDown(e) {
  dragIdx = +e.currentTarget.dataset.pos;
  e.currentTarget.classList.add('dragging');
  e.currentTarget.setPointerCapture(e.pointerId);
  const move = ev => {
    const cards = [...document.querySelectorAll('.label-card')];
    cards.forEach(c => c.style.outline = '');
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (el && el.classList.contains('label-card') && el !== e.currentTarget) {
      el.style.outline = '2px solid #4da3ff';
    }
  };
  const up = ev => {
    e.currentTarget.classList.remove('dragging');
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (el && el.classList.contains('label-card')) {
      const target = +el.dataset.pos;
      if (target !== dragIdx) {
        const tmp = order[dragIdx];
        order[dragIdx] = order[target];
        order[target] = tmp;
        render();
      }
    }
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

async function downloadPNG() {
  const { lw, lh, pw, ph } = getDims();
  const margin = 0.25;
  const usableW = pw - 2*margin;
  const usableH = ph - 2*margin;
  const cols = Math.max(1, Math.floor(usableW / lw));
  const rows = Math.max(1, Math.floor(usableH / lh));
  const canvas = document.createElement('canvas');
  canvas.width = pw * PRINT_DPI;
  canvas.height = ph * PRINT_DPI;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontPx = +$('fs').value * PRINT_DPI / 72;
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  const placed = Math.min(names.length, cols*rows);
  for (let i = 0; i < placed; i++) {
    const idx = order[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = (margin + c * lw + lw/2) * PRINT_DPI;
    const y = (margin + r * lh + lh/2) * PRINT_DPI;
    // light border
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect((margin + c*lw)*PRINT_DPI, (margin + r*lh)*PRINT_DPI, lw*PRINT_DPI, lh*PRINT_DPI);
    ctx.fillText(names[idx], x, y);
  }
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'name-tags.png';
    a.click();
  }, 'image/png');
}

$('apply').onclick = apply;
$('download').onclick = downloadPNG;
$('copy').onclick = () => navigator.clipboard.writeText(names.join('\n'));
['names','paper','unit','lw','lh','fs'].forEach(id => $(id).addEventListener('change', apply));
$('names').addEventListener('input', () => setTimeout(apply, 300));

load();

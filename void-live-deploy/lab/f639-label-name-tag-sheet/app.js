const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const namesEl = document.getElementById('names');
const sizeEl = document.getElementById('size');
const fontSizeEl = document.getElementById('fontSize');
const bgEl = document.getElementById('bg');
const fgEl = document.getElementById('fg');
const genBtn = document.getElementById('gen');
const dlBtn = document.getElementById('dl');

const SIZES = {
  '2x1': { w: 2, h: 1, cols: 4, rows: 8, margin: 0.25 },
  '3.5x2': { w: 3.5, h: 2, cols: 2, rows: 5, margin: 0.25 },
  '1x0.5': { w: 1, h: 0.5, cols: 8, rows: 10, margin: 0.125 },
  '4x2': { w: 4, h: 2, cols: 2, rows: 4, margin: 0.25 }
};

function generate() {
  const names = namesEl.value.split(/\n/).map(s => s.trim()).filter(Boolean);
  if (!names.length) { alert('Add at least one name'); return; }
  const spec = SIZES[sizeEl.value];
  const dpi = 96;
  const pageW = 8.5 * dpi;
  const pageH = 11 * dpi;
  canvas.width = pageW;
  canvas.height = pageH;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);

  const lw = spec.w * dpi;
  const lh = spec.h * dpi;
  const m = spec.margin * dpi;
  const startX = (pageW - (spec.cols * lw + (spec.cols - 1) * m)) / 2;
  const startY = (pageH - (spec.rows * lh + (spec.rows - 1) * m)) / 2;

  const fs = parseInt(fontSizeEl.value, 10) || 24;
  const bg = bgEl.value;
  const fg = fgEl.value;

  let i = 0;
  for (let r = 0; r < spec.rows && i < names.length; r++) {
    for (let c = 0; c < spec.cols && i < names.length; c++) {
      const x = startX + c * (lw + m);
      const y = startY + r * (lh + m);
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, lw, lh);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, lw, lh);
      ctx.fillStyle = fg;
      ctx.font = `${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = names[i];
      const maxW = lw - 8;
      let display = text;
      if (ctx.measureText(text).width > maxW) {
        while (ctx.measureText(display + '…').width > maxW && display.length > 1) display = display.slice(0, -1);
        display += '…';
      }
      ctx.fillText(display, x + lw / 2, y + lh / 2);
      i++;
    }
  }
  dlBtn.disabled = false;
}

genBtn.onclick = generate;
dlBtn.onclick = () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'labels.png';
  a.click();
};

namesEl.value = 'Alice Smith\nBob Jones\nCarol Lee\nDave Kim\nEve Patel';
generate();

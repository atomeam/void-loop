const view = document.getElementById('view');
const ctx = view.getContext('2d');
const fileInput = document.getElementById('file');
const fgPick = document.getElementById('fgPick');
const bgPick = document.getElementById('bgPick');
const fgSwatch = document.getElementById('fgSwatch');
const bgSwatch = document.getElementById('bgSwatch');
const fgHex = document.getElementById('fgHex');
const bgHex = document.getElementById('bgHex');
const sample = document.getElementById('sample');
const ratioEl = document.getElementById('ratio');
const aaNormal = document.getElementById('aaNormal');
const aaLarge = document.getElementById('aaLarge');
const aaaNormal = document.getElementById('aaaNormal');

let img = null;
let clickCount = 0;
let fg = '#ffffff', bg = '#000000';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
function relLum({ r, g, b }) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(c1, c2) {
  const l1 = relLum(hexToRgb(c1));
  const l2 = relLum(hexToRgb(c2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function update() {
  fgSwatch.style.background = fg;
  bgSwatch.style.background = bg;
  fgPick.value = fg;
  bgPick.value = bg;
  fgHex.textContent = fg;
  bgHex.textContent = bg;
  sample.style.color = fg;
  sample.style.background = bg;
  const r = contrast(fg, bg);
  ratioEl.textContent = r.toFixed(1) + ' : 1';
  const passAA = r >= 4.5, passAAl = r >= 3, passAAA = r >= 7;
  aaNormal.textContent = 'AA normal: ' + (passAA ? 'pass' : 'fail');
  aaNormal.className = passAA ? 'pass' : 'fail';
  aaLarge.textContent = 'AA large: ' + (passAAl ? 'pass' : 'fail');
  aaLarge.className = passAAl ? 'pass' : 'fail';
  aaaNormal.textContent = 'AAA normal: ' + (passAAA ? 'pass' : 'fail');
  aaaNormal.className = passAAA ? 'pass' : 'fail';
  try { localStorage.setItem('verse-f650-contrast', JSON.stringify({ fg, bg })); } catch (e) { console.debug("lab f650-image-contrast-checker:", e); }
}

fileInput.onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  img = new Image();
  img.onload = () => {
    const scale = Math.min(640 / img.width, 400 / img.height, 1);
    view.width = img.width * scale;
    view.height = img.height * scale;
    ctx.drawImage(img, 0, 0, view.width, view.height);
    clickCount = 0;
  };
  img.src = url;
};

view.onclick = e => {
  if (!img) return;
  const rect = view.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (view.width / rect.width);
  const y = (e.clientY - rect.top) * (view.height / rect.height);
  const p = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex = rgbToHex(p[0], p[1], p[2]);
  if (clickCount % 2 === 0) fg = hex; else bg = hex;
  clickCount++;
  update();
};

fgPick.oninput = () => { fg = fgPick.value; update(); };
bgPick.oninput = () => { bg = bgPick.value; update(); };

document.getElementById('copy').onclick = () => {
  const r = contrast(fg, bg).toFixed(1);
  const text = `Foreground: ${fg}\nBackground: ${bg}\nContrast: ${r}:1\nAA normal: ${r >= 4.5 ? 'pass' : 'fail'}\nAA large: ${r >= 3 ? 'pass' : 'fail'}\nAAA normal: ${r >= 7 ? 'pass' : 'fail'}`;
  navigator.clipboard.writeText(text).then(() => alert('Copied'));
};

document.getElementById('download').onclick = () => {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#1a2332'; g.fillRect(0, 0, 400, 200);
  g.fillStyle = fg; g.fillRect(20, 40, 80, 80);
  g.fillStyle = bg; g.fillRect(120, 40, 80, 80);
  g.fillStyle = '#e7e9ea'; g.font = '16px system-ui';
  g.fillText('FG ' + fg, 20, 140);
  g.fillText('BG ' + bg, 120, 140);
  g.font = 'bold 24px system-ui';
  g.fillText(contrast(fg, bg).toFixed(1) + ':1', 220, 90);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'contrast-report.png';
  a.click();
};

try {
  const saved = JSON.parse(localStorage.getItem('verse-f650-contrast') || '{}');
  if (saved.fg) { fg = saved.fg; bg = saved.bg; }
} catch (e) { console.debug("lab f650-image-contrast-checker:", e); }
update();

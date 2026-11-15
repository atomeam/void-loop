const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const paletteEl = document.getElementById('palette');
const results = document.getElementById('results');
const status = document.getElementById('status');
const fallback = document.getElementById('fallback');
let stream = null;
let samples = JSON.parse(localStorage.getItem('f754-palette') || '[]');
let selected = [];

function relLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
function contrast(c1, c2) {
  const l1 = relLuminance(...c1);
  const l2 = relLuminance(...c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [0,0,0];
}
function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function renderPalette() {
  paletteEl.innerHTML = '';
  samples.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'swatch' + (selected.includes(i) ? ' selected' : '');
    div.innerHTML = `<div class="color" style="background:${s.hex}"></div><div class="meta">${s.hex}</div>`;
    div.onclick = () => toggleSelect(i);
    paletteEl.appendChild(div);
  });
  updateResults();
}
function toggleSelect(i) {
  const idx = selected.indexOf(i);
  if (idx >= 0) selected.splice(idx, 1);
  else if (selected.length < 2) selected.push(i);
  else { selected.shift(); selected.push(i); }
  renderPalette();
}
function updateResults() {
  if (selected.length === 0) {
    results.innerHTML = '<div class="status">Select 1–2 swatches for contrast.</div>';
    return;
  }
  const c1 = hexToRgb(samples[selected[0]].hex);
  let html = '';
  if (selected.length === 1) {
    const vsBlack = contrast(c1, [0,0,0]);
    const vsWhite = contrast(c1, [255,255,255]);
    const best = vsBlack > vsWhite ? 'black' : 'white';
    const ratio = Math.max(vsBlack, vsWhite);
    const pass = ratio >= 4.5 ? 'aa' : 'fail';
    html = `<div>Vs black: ${vsBlack.toFixed(2)}:1</div><div>Vs white: ${vsWhite.toFixed(2)}:1</div>
            <div class="ratio">${ratio.toFixed(2)}:1 <span class="badge ${pass}">${ratio>=7?'AAA':ratio>=4.5?'AA':'Fail'}</span></div>
            <div>Best text: ${best}</div>`;
  } else {
    const c2 = hexToRgb(samples[selected[1]].hex);
    const ratio = contrast(c1, c2);
    const pass = ratio >= 4.5 ? 'aa' : 'fail';
    html = `<div class="ratio">${ratio.toFixed(2)}:1 <span class="badge ${pass}">${ratio>=7?'AAA':ratio>=4.5?'AA':'Fail'}</span></div>
            <div>${samples[selected[0]].hex} on ${samples[selected[1]].hex}</div>`;
  }
  results.innerHTML = html;
}

async function startCam() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    const facing = document.getElementById('facing').value;
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
    video.srcObject = stream;
    document.getElementById('sample').disabled = false;
    fallback.classList.remove('show');
    status.textContent = 'Camera live. Tap sample or click video.';
    video.onloadedmetadata = () => {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    };
  } catch (e) {
    status.textContent = 'Camera denied or unavailable. Using pickers.';
    fallback.classList.add('show');
  }
}
function sampleColor() {
  if (!video.videoWidth) return;
  ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
  const x = overlay.width / 2, y = overlay.height / 2;
  const data = ctx.getImageData(x-5, y-5, 10, 10).data;
  let r=0,g=0,b=0,n=0;
  for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
  r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
  const hex = rgbToHex(r,g,b);
  samples.push({ hex, rgb: [r,g,b], t: Date.now() });
  if (samples.length > 12) samples.shift();
  renderPalette();
  status.textContent = `Sampled ${hex}`;
}
document.getElementById('startCam').onclick = startCam;
document.getElementById('sample').onclick = sampleColor;
document.getElementById('facing').onchange = startCam;
document.getElementById('clear').onclick = () => { samples = []; selected = []; renderPalette(); };
document.getElementById('addPicker').onclick = () => {
  const h1 = document.getElementById('picker1').value;
  const h2 = document.getElementById('picker2').value;
  samples.push({ hex: h1, rgb: hexToRgb(h1) }, { hex: h2, rgb: hexToRgb(h2) });
  renderPalette();
};
document.getElementById('downloadCss').onclick = () => {
  const css = samples.map((s,i) => `--color-${i+1}: ${s.hex};`).join('\n');
  download(`:root {\n${css}\n}`, 'palette.css', 'text/css');
};
document.getElementById('downloadJson').onclick = () => {
  download(JSON.stringify(samples.map(s => s.hex), null, 2), 'palette.json', 'application/json');
};
document.getElementById('copy').onclick = () => {
  navigator.clipboard.writeText(samples.map(s => s.hex).join('\n')).then(() => status.textContent = 'Copied!');
};
document.getElementById('seal').onclick = () => {
  localStorage.setItem('f754-palette', JSON.stringify(samples));
  status.textContent = 'Palette saved on device.';
};
function download(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}
video.onclick = sampleColor;
renderPalette();
status.textContent = samples.length ? 'Loaded saved palette.' : 'Ready.';

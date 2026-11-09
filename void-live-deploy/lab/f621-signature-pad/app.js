const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const widthInput = document.getElementById('width');
const status = document.getElementById('status');
const thumbs = document.getElementById('thumbs');

let drawing = false;
let strokes = [];          // array of {points: [{x,y,p}], color, width}
let current = null;
const KEY = 'verse-f621-signatures';
const MAX_GALLERY = 12;

function resizeCanvas() {
  // keep internal resolution fixed; CSS handles display size
  const wrap = canvas.parentElement;
  const maxW = Math.min(640, wrap.clientWidth - 16);
  canvas.style.width = maxW + 'px';
  canvas.style.height = (maxW * 280 / 640) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
  const p = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
    p
  };
}

function startStroke(e) {
  e.preventDefault();
  drawing = true;
  const pos = getPos(e);
  current = {
    points: [pos],
    color: colorInput.value,
    baseWidth: parseFloat(widthInput.value)
  };
  strokes.push(current);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function continueStroke(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPos(e);
  current.points.push(pos);
  const w = current.baseWidth * (0.4 + pos.p * 1.2);
  ctx.strokeStyle = current.color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const prev = current.points[current.points.length - 2];
  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function endStroke(e) {
  if (!drawing) return;
  e.preventDefault();
  drawing = false;
  current = null;
  status.textContent = strokes.length + ' stroke' + (strokes.length === 1 ? '' : 's');
}

canvas.addEventListener('pointerdown', startStroke);
canvas.addEventListener('pointermove', continueStroke);
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointerleave', endStroke);
canvas.addEventListener('pointercancel', endStroke);

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1];
      const b = s.points[i];
      const w = s.baseWidth * (0.4 + b.p * 1.2);
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

document.getElementById('clear').onclick = () => {
  strokes = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  status.textContent = 'Cleared';
};

document.getElementById('undo').onclick = () => {
  if (strokes.length) {
    strokes.pop();
    redraw();
    status.textContent = 'Undone';
  }
};

function downloadPNG() {
  // Ensure transparent bg: canvas is already transparent
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  const d = new Date();
  const stamp = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  a.href = url;
  a.download = 'signature-' + stamp + '.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  status.textContent = 'Downloaded transparent PNG';
}

document.getElementById('download').onclick = downloadPNG;

function loadGallery() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveGallery(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
  } catch {
    status.textContent = 'Could not save gallery (storage full)';
  }
}

function renderGallery() {
  const list = loadGallery();
  thumbs.innerHTML = '';
  list.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML = `<img src="${item.url}" alt=""><div class="name">${item.name || 'Untitled'}</div>`;
    div.onclick = () => {
      const img = new Image();
      img.onload = () => {
        strokes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        status.textContent = 'Loaded from gallery';
      };
      img.src = item.url;
    };
    thumbs.appendChild(div);
  });
}

document.getElementById('save').onclick = () => {
  const name = prompt('Name for this signature (optional):') || ('Signature ' + new Date().toLocaleDateString());
  const url = canvas.toDataURL('image/png');
  const list = loadGallery();
  list.unshift({ name, url, t: Date.now() });
  saveGallery(list);
  renderGallery();
  status.textContent = 'Saved to gallery';
};

renderGallery();
status.textContent = 'Ready. Draw your signature.';

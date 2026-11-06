const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
let W, H, gridW = 160, gridH = 90;
let time = 0;
const sources = [];
const NUM = 7;
let pointer = { x: -999, y: -999, amp: 0 };
let dragging = null;
let offset = { x: 0, y: 0 };

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

function randomSource(i) {
  return {
    id: i,
    x: 0.15 + Math.random() * 0.7,
    y: 0.2 + Math.random() * 0.6,
    freq: 0.4 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    amp: 0.6 + Math.random() * 0.8,
    el: null
  };
}

function createDOM() {
  stage.innerHTML = '';
  sources.forEach(s => {
    const el = document.createElement('div');
    el.className = 'resonator';
    el.textContent = `f=${s.freq.toFixed(2)}\nφ=${(s.phase % (Math.PI*2)).toFixed(1)}`;
    el.style.left = (s.x * 100) + '%';
    el.style.top = (s.y * 100) + '%';
    el.style.transform = 'translate(-50%, -50%)';
    el.dataset.id = s.id;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('click', onClick);
    stage.appendChild(el);
    s.el = el;
  });
}

function onDown(e) {
  const id = +e.currentTarget.dataset.id;
  dragging = sources.find(s => s.id === id);
  const rect = e.currentTarget.getBoundingClientRect();
  offset.x = e.clientX - rect.left - rect.width/2;
  offset.y = e.clientY - rect.top - rect.height/2;
  e.currentTarget.setPointerCapture(e.pointerId);
}
function onClick(e) {
  if (dragging) return;
  const id = +e.currentTarget.dataset.id;
  const s = sources.find(s => s.id === id);
  s.freq = (s.freq + 0.3) % 2.5;
  if (s.freq < 0.3) s.freq = 0.3;
  updateLabel(s);
}
addEventListener('pointermove', e => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
  pointer.amp = 1.2;
  if (dragging) {
    dragging.x = Math.max(0.05, Math.min(0.95, e.clientX / W));
    dragging.y = Math.max(0.08, Math.min(0.92, e.clientY / H));
    dragging.el.style.left = (dragging.x * 100) + '%';
    dragging.el.style.top = (dragging.y * 100) + '%';
  }
});
addEventListener('pointerup', () => { dragging = null; });
addEventListener('pointerleave', () => { pointer.amp *= 0.9; });

function updateLabel(s) {
  if (s.el) s.el.textContent = `f=${s.freq.toFixed(2)}\nφ=${(s.phase % (Math.PI*2)).toFixed(1)}`;
}

function waveAt(nx, ny, t) {
  let sum = 0;
  const px = nx, py = ny;
  sources.forEach(s => {
    const dx = px - s.x, dy = py - s.y;
    const r = Math.sqrt(dx*dx + dy*dy) + 0.001;
    const k = s.freq * 8;
    const phase = s.phase + t * s.freq * 4;
    sum += (s.amp / Math.sqrt(r)) * Math.sin(k * r * 12 - phase);
  });
  // pointer source
  if (pointer.amp > 0.05) {
    const dx = px - pointer.x, dy = py - pointer.y;
    const r = Math.sqrt(dx*dx + dy*dy) + 0.001;
    sum += (pointer.amp / Math.sqrt(r)) * Math.sin(10 * r * 10 - t * 6);
  }
  return sum;
}

function render() {
  time += 0.016;
  pointer.amp *= 0.97;

  // draw field
  const img = ctx.createImageData(gridW, gridH);
  const data = img.data;
  let maxA = 0.1;
  const samples = new Float32Array(gridW * gridH);
  for (let j = 0; j < gridH; j++) {
    for (let i = 0; i < gridW; i++) {
      const nx = i / (gridW - 1);
      const ny = j / (gridH - 1);
      const v = waveAt(nx, ny, time);
      samples[j * gridW + i] = v;
      maxA = Math.max(maxA, Math.abs(v));
    }
  }
  for (let j = 0; j < gridH; j++) {
    for (let i = 0; i < gridW; i++) {
      const v = samples[j * gridW + i] / maxA;
      const idx = (j * gridW + i) * 4;
      const hue = ((v + 1) * 0.5) * 240; // blue to red-ish
      const [r, g, b] = hslToRgb(hue / 360, 0.7, 0.15 + Math.abs(v) * 0.4);
      data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
    }
  }
  // scale up
  const tmp = document.createElement('canvas');
  tmp.width = gridW; tmp.height = gridH;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);

  // sample and morph cards
  sources.forEach(s => {
    const v = waveAt(s.x, s.y, time);
    const norm = v / (maxA || 1);
    const phaseHue = ((norm + 1) * 180) % 360;
    const scale = 0.85 + Math.abs(norm) * 0.45;
    const opacity = 0.55 + Math.abs(norm) * 0.4;
    s.el.style.filter = `hue-rotate(${phaseHue}deg)`;
    s.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
    s.el.style.opacity = opacity;
  });

  requestAnimationFrame(render);
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r*255|0, g*255|0, b*255|0];
}

// IndexedDB
const DB = 'f542-wave';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genome');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveGenome() {
  const db = await openDB();
  const data = sources.map(s => ({ x: s.x, y: s.y, freq: s.freq, phase: s.phase, amp: s.amp }));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data))).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('').slice(0,16));
  const tx = db.transaction('genome', 'readwrite');
  tx.objectStore('genome').put({ data, hash, t: Date.now() }, 'current');
  await new Promise(r => tx.oncomplete = r);
  statusEl.textContent = `Sealed ${hash}`;
}
async function loadGenome() {
  try {
    const db = await openDB();
    const tx = db.transaction('genome', 'readonly');
    const req = tx.objectStore('genome').get('current');
    const rec = await new Promise(r => { req.onsuccess = () => r(req.result); req.onerror = () => r(null); });
    if (rec && rec.data) {
      rec.data.forEach((d, i) => {
        if (sources[i]) Object.assign(sources[i], d);
      });
      statusEl.textContent = `Loaded ${rec.hash || 'genome'}`;
      return true;
    }
  } catch (e) { console.warn('f542-webgpu-wave-interference-phase-dom-mind:', e); }
  return false;
}

document.getElementById('seal').onclick = saveGenome;
document.getElementById('reset').onclick = () => {
  sources.forEach((s, i) => Object.assign(s, randomSource(i)));
  createDOM();
  statusEl.textContent = 'Reset';
};

async function init() {
  for (let i = 0; i < NUM; i++) sources.push(randomSource(i));
  const loaded = await loadGenome();
  createDOM();
  statusEl.textContent = loaded ? statusEl.textContent : 'Ready - drag cards, click to tune freq';
  render();
}
init();

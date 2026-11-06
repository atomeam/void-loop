const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const status = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 2800;
const particles = new Float32Array(N * 4); // x,y,vx,vy
const colors = new Uint8Array(N * 3);

// Tiny MLP: 72 in → 16 → 8 → 4 out
const inSize = 72, h1 = 16, h2 = 8, outSize = 4;
let w1 = new Float32Array(inSize * h1);
let b1 = new Float32Array(h1);
let w2 = new Float32Array(h1 * h2);
let b2 = new Float32Array(h2);
let w3 = new Float32Array(h2 * outSize);
let b3 = new Float32Array(outSize);

function randn() { return (Math.random() * 2 - 1) * 0.15; }
function initWeights() {
  for (let i = 0; i < w1.length; i++) w1[i] = randn();
  for (let i = 0; i < w2.length; i++) w2[i] = randn();
  for (let i = 0; i < w3.length; i++) w3[i] = randn();
  b1.fill(0); b2.fill(0); b3.fill(0);
}
function tanh(x) { return Math.tanh(x); }
function relu(x) { return x > 0 ? x : 0; }

function mlp(input) {
  const h1a = new Float32Array(h1);
  for (let i = 0; i < h1; i++) {
    let s = b1[i];
    for (let j = 0; j < inSize; j++) s += input[j] * w1[j * h1 + i];
    h1a[i] = tanh(s);
  }
  const h2a = new Float32Array(h2);
  for (let i = 0; i < h2; i++) {
    let s = b2[i];
    for (let j = 0; j < h1; j++) s += h1a[j] * w2[j * h2 + i];
    h2a[i] = tanh(s);
  }
  const out = new Float32Array(outSize);
  for (let i = 0; i < outSize; i++) {
    let s = b3[i];
    for (let j = 0; j < h2; j++) s += h2a[j] * w3[j * outSize + i];
    out[i] = Math.tanh(s);
  }
  return out;
}

function spawn() {
  for (let i = 0; i < N; i++) {
    particles[i*4] = Math.random() * W;
    particles[i*4+1] = Math.random() * H;
    particles[i*4+2] = (Math.random()-0.5)*1.2;
    particles[i*4+3] = (Math.random()-0.5)*1.2;
    colors[i*3] = 80 + Math.random()*120;
    colors[i*3+1] = 100 + Math.random()*100;
    colors[i*3+2] = 180 + Math.random()*75;
  }
}
spawn();
initWeights();

let attractor = { x: W/2, y: H/2, strength: 0 };
let hueShift = 0;
let trailDecay = 0.18;

canvas.addEventListener('pointermove', e => {
  attractor.x = e.clientX;
  attractor.y = e.clientY;
  attractor.strength = Math.min(1.8, attractor.strength + 0.4);
});
canvas.addEventListener('pointerdown', e => { attractor.strength = 2.2; });

const dbName = 'f546-self-vision';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('mind', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('mind', 'readwrite');
    tx.objectStore('mind').put({
      id: 'weights',
      w1: Array.from(w1), b1: Array.from(b1),
      w2: Array.from(w2), b2: Array.from(b2),
      w3: Array.from(w3), b3: Array.from(b3),
      hash: lastHash,
      t: Date.now()
    });
    status.textContent = 'Sealed to IndexedDB · ' + new Date().toLocaleTimeString();
  } catch (e) { status.textContent = 'Seal failed (in-memory only)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initWeights(); spawn(); status.textContent = 'Mind reset'; };

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('mind', 'readonly');
    const req = tx.objectStore('mind').get('weights');
    req.onsuccess = () => {
      const d = req.result;
      if (d && d.w1) {
        w1 = new Float32Array(d.w1); b1 = new Float32Array(d.b1);
        w2 = new Float32Array(d.w2); b2 = new Float32Array(d.b2);
        w3 = new Float32Array(d.w3); b3 = new Float32Array(d.b3);
        status.textContent = 'Restored sealed mind';
      } else status.textContent = 'Fresh mind · observing itself';
    };
  } catch (e) { status.textContent = 'Fresh mind · observing itself'; }
}
load();

let lastHash = 0;
let retina = new Float32Array(64);
let frame = 0;

function sampleRetina() {
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const stepX = W / 8, stepY = H / 8;
  let h = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let sum = 0, cnt = 0;
      const x0 = Math.floor(x * stepX), y0 = Math.floor(y * stepY);
      const x1 = Math.min(W, x0 + stepX), y1 = Math.min(H, y0 + stepY);
      for (let py = y0; py < y1; py += 4) {
        for (let px = x0; px < x1; px += 4) {
          const i = (py * W + px) * 4;
          sum += (d[i] + d[i+1] + d[i+2]) / 3;
          cnt++;
        }
      }
      const v = cnt ? (sum / cnt) / 255 : 0.5;
      retina[y*8 + x] = v;
      h = (h * 31 + Math.floor(v * 255)) | 0;
    }
  }
  lastHash = h >>> 0;
  return retina;
}

function loop() {
  frame++;
  // fade trail
  ctx.fillStyle = `rgba(10,10,18,${trailDecay})`;
  ctx.fillRect(0, 0, W, H);

  // sample vision of previous (current after fade)
  const vision = sampleRetina();

  // summary stats
  let cx = 0, cy = 0, speed = 0;
  for (let i = 0; i < N; i++) {
    cx += particles[i*4]; cy += particles[i*4+1];
    speed += Math.hypot(particles[i*4+2], particles[i*4+3]);
  }
  cx /= N; cy /= N; speed /= N;
  const input = new Float32Array(72);
  input.set(vision);
  input[64] = cx / W;
  input[65] = cy / H;
  input[66] = speed / 4;
  input[67] = attractor.strength;
  input[68] = attractor.x / W;
  input[69] = attractor.y / H;
  input[70] = (frame % 360) / 360;
  input[71] = Math.sin(frame * 0.02);

  const out = mlp(input);
  const biasX = out[0] * 0.35;
  const biasY = out[1] * 0.35;
  const attrMul = 0.4 + out[2] * 0.6;
  hueShift = out[3] * 40;
  trailDecay = 0.12 + (out[2] + 1) * 0.08;

  attractor.strength *= 0.985;

  for (let i = 0; i < N; i++) {
    let x = particles[i*4], y = particles[i*4+1];
    let vx = particles[i*4+2], vy = particles[i*4+3];
    // attractor
    const dx = attractor.x - x, dy = attractor.y - y;
    const d = Math.hypot(dx, dy) + 1;
    const f = (attractor.strength * attrMul) / d * 18;
    vx += (dx / d) * f + biasX;
    vy += (dy / d) * f + biasY;
    // mild noise + damping
    vx = vx * 0.96 + (Math.random()-0.5)*0.15;
    vy = vy * 0.96 + (Math.random()-0.5)*0.15;
    x += vx; y += vy;
    if (x < 0 || x > W) vx *= -0.7;
    if (y < 0 || y > H) vy *= -0.7;
    x = Math.max(0, Math.min(W, x));
    y = Math.max(0, Math.min(H, y));
    particles[i*4] = x; particles[i*4+1] = y;
    particles[i*4+2] = vx; particles[i*4+3] = vy;

    // color shift from hue
    const r = Math.min(255, colors[i*3] + hueShift);
    const g = colors[i*3+1];
    const b = Math.max(0, colors[i*3+2] - hueShift * 0.5);
    ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }

  if (frame % 30 === 0) {
    status.textContent = `Observing · hash ${lastHash.toString(16).slice(0,6)} · attr ${attractor.strength.toFixed(2)}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

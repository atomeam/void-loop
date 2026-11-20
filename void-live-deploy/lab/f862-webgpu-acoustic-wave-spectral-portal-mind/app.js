const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;
const GW = 96, GH = 54;
const u = new Float32Array(GW * GH);
const uPrev = new Float32Array(GW * GH);
const uNext = new Float32Array(GW * GH);
let c2 = 0.25, damp = 0.995, gain = 0.4;
let fitness = 0;
const portals = [];
let analyser, dataArray, micOn = false;
let tiltX = 0, tiltY = 0;
let pointer = {x: W/2, y: H/2};

// Tiny MLP: 6 -> 8 -> 3
const inSize = 6, hid = 8, outSize = 3;
let w1 = Array.from({length: inSize * hid}, () => (Math.random()-0.5)*0.3);
let w2 = Array.from({length: hid * outSize}, () => (Math.random()-0.5)*0.3);
let b1 = Array(hid).fill(0), b2 = Array(outSize).fill(0);

function relu(x) { return Math.max(0, x); }
function forward(input) {
  const h = [];
  for (let j = 0; j < hid; j++) {
    let s = b1[j];
    for (let i = 0; i < inSize; i++) s += input[i] * w1[i * hid + j];
    h.push(relu(s));
  }
  const o = [];
  for (let k = 0; k < outSize; k++) {
    let s = b2[k];
    for (let j = 0; j < hid; j++) s += h[j] * w2[j * outSize + k];
    o.push(Math.tanh(s));
  }
  return o;
}

function reward(delta) {
  fitness += delta;
  // Simple Hebbian-ish update on last input
  const lr = 0.01 * delta;
  // mutate slightly
  for (let i = 0; i < w1.length; i++) w1[i] += (Math.random()-0.5) * lr;
  for (let i = 0; i < w2.length; i++) w2[i] += (Math.random()-0.5) * lr;
}

function sampleAmp(px, py) {
  const gx = Math.floor(px / W * GW);
  const gy = Math.floor(py / H * GH);
  if (gx < 0 || gx >= GW || gy < 0 || gy >= GH) return 0;
  return Math.abs(u[gy * GW + gx]);
}

function inject(px, py, amp) {
  const gx = Math.floor(px / W * GW);
  const gy = Math.floor(py / H * GH);
  if (gx >= 0 && gx < GW && gy >= 0 && gy < GH) {
    u[gy * GW + gx] += amp;
  }
}

function stepWave() {
  for (let y = 1; y < GH-1; y++) {
    for (let x = 1; x < GW-1; x++) {
      const i = y * GW + x;
      const lap = u[i-1] + u[i+1] + u[i-GW] + u[i+GW] - 4 * u[i];
      uNext[i] = (2 * u[i] - uPrev[i] + c2 * lap) * damp;
    }
  }
  // boundary zero
  for (let x = 0; x < GW; x++) { uNext[x] = 0; uNext[(GH-1)*GW + x] = 0; }
  for (let y = 0; y < GH; y++) { uNext[y*GW] = 0; uNext[y*GW + GW-1] = 0; }
  // swap
  uPrev.set(u);
  u.set(uNext);
}

function draw() {
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / W * GW);
      const gy = Math.floor(y / H * GH);
      const v = u[gy * GW + gx];
      const a = Math.min(255, Math.abs(v) * 180);
      const i = (y * W + x) * 4;
      img.data[i] = v > 0 ? a : 0;
      img.data[i+1] = a * 0.4;
      img.data[i+2] = v < 0 ? a : 40;
      img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function createPortals() {
  const cont = document.getElementById('portals');
  for (let i = 0; i < 3; i++) {
    const p = document.createElement('div');
    p.className = 'portal';
    p.textContent = 'Portal ' + (i+1);
    p.style.left = (20 + i * 25) + '%';
    p.style.top = (30 + i * 15) + '%';
    let drag = false, ox, oy;
    p.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - parseFloat(p.style.left); oy = e.clientY - parseFloat(p.style.top); p.setPointerCapture(e.pointerId); });
    p.addEventListener('pointermove', e => { if (drag) { p.style.left = (e.clientX - ox) + 'px'; p.style.top = (e.clientY - oy) + 'px'; } });
    p.addEventListener('pointerup', () => drag = false);
    p.addEventListener('click', () => { reward(1.5); inject(parseFloat(p.style.left)+36, parseFloat(p.style.top)+36, 2); });
    cont.appendChild(p);
    portals.push(p);
  }
}

function updatePortals() {
  portals.forEach(p => {
    const x = parseFloat(p.style.left) + 36;
    const y = parseFloat(p.style.top) + 36;
    const amp = sampleAmp(x, y);
    const s = 1 + amp * 0.3;
    p.style.transform = `scale(${s})`;
    p.style.filter = `hue-rotate(${amp * 60}deg) brightness(${1 + amp})`;
  });
}

async function enableMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    micOn = true;
    document.getElementById('micBtn').textContent = 'Mic On';
  } catch (e) { console.warn(e); }
}

function getSpectral() {
  if (!micOn || !analyser) return [0,0,0];
  analyser.getByteFrequencyData(dataArray);
  const n = dataArray.length;
  const low = dataArray.slice(0, n/3).reduce((a,b)=>a+b,0) / (n/3) / 255;
  const mid = dataArray.slice(n/3, 2*n/3).reduce((a,b)=>a+b,0) / (n/3) / 255;
  const high = dataArray.slice(2*n/3).reduce((a,b)=>a+b,0) / (n/3) / 255;
  return [low, mid, high];
}

function loop() {
  const spec = getSpectral();
  const prox = Math.hypot(pointer.x - W/2, pointer.y - H/2) / Math.hypot(W,H);
  const input = [...spec, tiltX, tiltY, prox];
  const out = forward(input);
  c2 = 0.15 + (out[0] + 1) * 0.15;
  damp = 0.98 + (out[1] + 1) * 0.01;
  gain = 0.2 + (out[2] + 1) * 0.4;
  document.getElementById('spd').textContent = c2.toFixed(2);
  document.getElementById('fit').textContent = fitness.toFixed(1);

  // inject from spectrum
  if (micOn) {
    const cx = W * (0.3 + spec[0] * 0.4);
    const cy = H * (0.4 + spec[1] * 0.3);
    inject(cx, cy, spec[2] * gain * 1.5);
  }

  stepWave();
  draw();
  updatePortals();
  requestAnimationFrame(loop);
}

// events
window.addEventListener('resize', () => { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; });
window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('deviceorientation', e => { tiltX = (e.gamma || 0)/90; tiltY = (e.beta || 0)/90; });
document.getElementById('micBtn').onclick = enableMic;
document.getElementById('sealBtn').onclick = async () => {
  const genome = { w1, w2, b1, b2, fitness };
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('verse-f862-wave', 1); r.onupgradeneeded = () => r.result.createObjectStore('genomes'); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'best');
  } catch (e) { console.debug("lab f862-webgpu-acoustic-wave-spectral-portal-mind:", e); }
  new BroadcastChannel('f862-genome').postMessage(genome);
  alert('Sealed. Fitness ' + fitness.toFixed(1));
};
document.getElementById('resetBtn').onclick = () => { u.fill(0); uPrev.fill(0); fitness = 0; };

// listen for sealed genomes
new BroadcastChannel('f862-genome').onmessage = e => {
  if (e.data.fitness > fitness) {
    w1 = e.data.w1; w2 = e.data.w2; b1 = e.data.b1; b2 = e.data.b2; fitness = e.data.fitness;
  }
};

// init
createPortals();
// load sealed if any
(async () => {
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('verse-f862-wave', 1); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const tx = db.transaction('genomes', 'readonly');
    const g = await new Promise(res => tx.objectStore('genomes').get('best').onsuccess = e => res(e.target.result));
    if (g && g.fitness > fitness) { w1 = g.w1; w2 = g.w2; b1 = g.b1; b2 = g.b2; fitness = g.fitness; }
  } catch (e) { console.debug("lab f862-webgpu-acoustic-wave-spectral-portal-mind:", e); }
})();
loop();

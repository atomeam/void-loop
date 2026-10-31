const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const labelsDiv = document.getElementById('labels');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// RNN: Elman, input 8, hidden 16, output 12 (for 6 shapes: x,y,r,blend each? simplified to pos/rad)
const IN = 8, HID = 16, OUT = 12;
let Wih = new Float32Array(HID * IN);
let Whh = new Float32Array(HID * HID);
let Who = new Float32Array(OUT * HID);
let h = new Float32Array(HID);
function randInit(arr, scale=0.3) { for(let i=0;i<arr.length;i++) arr[i] = (Math.random()*2-1)*scale; }
randInit(Wih); randInit(Whh, 0.2); randInit(Who, 0.1);

function tanh(x) { return Math.tanh(x); }
function forward(input) {
  // h' = tanh(Wih*input + Whh*h)
  const nh = new Float32Array(HID);
  for(let i=0;i<HID;i++) {
    let s = 0;
    for(let j=0;j<IN;j++) s += Wih[i*IN + j] * input[j];
    for(let j=0;j<HID;j++) s += Whh[i*HID + j] * h[j];
    nh[i] = tanh(s);
  }
  h = nh;
  // out = Who*h
  const out = new Float32Array(OUT);
  for(let i=0;i<OUT;i++) {
    let s = 0;
    for(let j=0;j<HID;j++) s += Who[i*HID + j] * h[j];
    out[i] = tanh(s);
  }
  return out;
}

function hebbianUpdate(input, residualScale) {
  const lr = 0.01 * residualScale;
  // simple residual Hebbian on Wih and Whh
  for(let i=0;i<HID;i++) {
    for(let j=0;j<IN;j++) Wih[i*IN + j] += lr * h[i] * input[j];
    for(let j=0;j<HID;j++) Whh[i*HID + j] += lr * h[i] * h[j] * 0.5;
  }
  // clip
  for(let i=0;i<Wih.length;i++) Wih[i] = Math.max(-2, Math.min(2, Wih[i]));
  for(let i=0;i<Whh.length;i++) Whh[i] = Math.max(-2, Math.min(2, Whh[i]));
}

// Shapes: 6 metaballs
const N = 6;
let shapes = Array.from({length:N}, (_,i) => ({
  x: 0.3 + (i%3)*0.2, y: 0.3 + Math.floor(i/3)*0.3, r: 0.08 + Math.random()*0.04, blend: 0.6, id: i
}));
let selected = -1;
let pointer = {x:0.5, y:0.5, vx:0, vy:0, down:false};
let lastPred = new Float32Array(OUT);
let residual = 0;
let entropy = 0;
let keywordNorm = 0;

function updateInput() {
  const input = new Float32Array(IN);
  input[0] = pointer.x; input[1] = pointer.y;
  input[2] = Math.hypot(pointer.vx, pointer.vy);
  input[3] = selected >=0 ? (selected+1)/N : 0;
  input[4] = keywordNorm;
  input[5] = residual;
  input[6] = entropy;
  input[7] = pointer.down ? 1 : 0;
  return input;
}

function applyOutput(out) {
  for(let i=0;i<N;i++) {
    const ox = (out[i*2] + 1)/2;
    const oy = (out[i*2+1] + 1)/2;
    shapes[i].x = shapes[i].x * 0.85 + ox * 0.15;
    shapes[i].y = shapes[i].y * 0.85 + oy * 0.15;
    shapes[i].r = 0.05 + Math.abs(out[i]) * 0.06;
  }
}

function computeEntropy() {
  let e = 0, m = 0;
  for(let i=0;i<HID;i++) m += Math.abs(h[i]);
  m /= HID || 1;
  for(let i=0;i<HID;i++) {
    const p = Math.abs(h[i]) / (m*HID + 1e-6);
    if(p>0) e -= p * Math.log(p+1e-9);
  }
  return Math.min(1, e / 3);
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,20,0.15)';
  ctx.fillRect(0,0,W,H);
  // metaball field approx via many soft circles
  for(let y=0; y<H; y+=4) {
    for(let x=0; x<W; x+=4) {
      let f = 0;
      for(const s of shapes) {
        const dx = (x/W - s.x)*W, dy = (y/H - s.y)*H;
        const d2 = dx*dx + dy*dy;
        const rr = s.r * Math.min(W,H);
        f += rr*rr / (d2 + 1);
      }
      if(f > 1.2) {
        const a = Math.min(0.8, (f-1.2)*0.3);
        ctx.fillStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 70%, 55%, ${a})`;
        ctx.fillRect(x,y,4,4);
      }
    }
  }
  // draw centers
  shapes.forEach((s,i) => {
    ctx.beginPath();
    ctx.arc(s.x*W, s.y*H, 6, 0, Math.PI*2);
    ctx.fillStyle = selected===i ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.fill();
  });
}

function updateLabels() {
  labelsDiv.innerHTML = '';
  shapes.forEach((s,i) => {
    if(Math.abs(h[i % HID]) > 0.4) {
      const el = document.createElement('div');
      el.className = 'label';
      el.style.left = (s.x*100)+'%';
      el.style.top = (s.y*100)+'%';
      const token = ['pulse','drift','bind','echo','flux','core','edge','void'][Math.floor(Math.abs(h[i%HID])*8) % 8];
      el.textContent = token + (selected===i ? ' ★' : '');
      el.contentEditable = true;
      el.oninput = () => { keywordNorm = (el.textContent.length % 20)/20; };
      labelsDiv.appendChild(el);
    }
  });
}

function step() {
  const input = updateInput();
  const out = forward(input);
  // residual: compare to last predicted next
  residual = 0;
  for(let i=0;i<OUT;i++) residual += Math.abs(out[i] - lastPred[i]);
  residual = Math.min(1, residual / OUT);
  lastPred = out.slice();
  applyOutput(out);
  if(pointer.down && selected>=0) hebbianUpdate(input, residual + 0.2);
  entropy = computeEntropy();
  // morph chrome
  document.documentElement.style.setProperty('--hue', 180 + entropy*140 + residual*40);
  document.documentElement.style.setProperty('--blur', (entropy*8)+'px');
  document.documentElement.style.setProperty('--scale', 1 + residual*0.05);
  draw();
  if(Math.random()<0.1) updateLabels();
  document.getElementById('status').textContent = `res ${residual.toFixed(2)} ent ${entropy.toFixed(2)} hid[0] ${h[0].toFixed(2)} sel ${selected}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Pointer
canvas.addEventListener('pointerdown', e => {
  pointer.down = true;
  const nx = e.clientX / W, ny = e.clientY / H;
  selected = -1;
  let best = 0.1;
  shapes.forEach((s,i) => {
    const d = Math.hypot(nx-s.x, ny-s.y);
    if(d < best) { best=d; selected=i; }
  });
});
canvas.addEventListener('pointermove', e => {
  const nx = e.clientX / W, ny = e.clientY / H;
  pointer.vx = nx - pointer.x; pointer.vy = ny - pointer.y;
  pointer.x = nx; pointer.y = ny;
  if(pointer.down && selected>=0) {
    shapes[selected].x = nx; shapes[selected].y = ny;
  }
});
addEventListener('pointerup', () => { pointer.down=false; });

// Controls
document.getElementById('inject').onclick = () => {
  const kw = document.getElementById('kw').value;
  keywordNorm = (kw.length % 30)/30;
  document.getElementById('kw').value = '';
};
document.getElementById('reset').onclick = () => {
  randInit(Wih); randInit(Whh,0.2); randInit(Who,0.1);
  h.fill(0); residual=0;
  shapes.forEach((s,i) => { s.x=0.3+(i%3)*0.2; s.y=0.3+Math.floor(i/3)*0.3; });
};
// IndexedDB seal
const DB = 'f474-sdf-rnn';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({
    Wih: Array.from(Wih), Whh: Array.from(Whh), Who: Array.from(Who),
    h: Array.from(h), shapes, residual, entropy
  }, 'living');
  document.getElementById('status').textContent = 'Sealed to IndexedDB';
};
document.getElementById('restore').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readonly');
  const req = tx.objectStore('seal').get('living');
  req.onsuccess = () => {
    const d = req.result;
    if(!d) return;
    Wih.set(d.Wih); Whh.set(d.Whh); Who.set(d.Who);
    h.set(d.h); shapes = d.shapes; residual = d.residual || 0;
    document.getElementById('status').textContent = 'Restored living state';
  };
};

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 80, H = 50, cell = 8;
function resize() {
  cv.width = W * cell; cv.height = H * cell;
  cv.style.width = '100vw'; cv.style.height = '100vh';
}
resize(); window.onresize = resize;

let spins = new Float32Array(W * H);
for (let i = 0; i < spins.length; i++) spins[i] = Math.random() < 0.5 ? 1 : -1;

// Tiny MLP: 6→8→3
let w1 = Array.from({length:6*8}, () => (Math.random()-0.5)*0.4);
let b1 = Array(8).fill(0);
let w2 = Array.from({length:8*3}, () => (Math.random()-0.5)*0.4);
let b2 = Array(3).fill(0);

function mlp(inp) {
  const h = b1.map((b,i) => {
    let s = b;
    for (let j=0; j<6; j++) s += inp[j] * w1[j*8 + i];
    return Math.tanh(s);
  });
  const o = b2.map((b,i) => {
    let s = b;
    for (let j=0; j<8; j++) s += h[j] * w2[j*3 + i];
    return Math.tanh(s);
  });
  return {o, h};
}

let beta = 1.2, field = 0, hue = 180;
let ox=0, oy=0, oz=0, px=0, py=0, pvx=0, pvy=0;
let lastOrient = {a:0,b:0,g:0};
window.addEventListener('deviceorientation', e => {
  if (e.alpha == null) return;
  ox = (e.alpha - lastOrient.a) * 0.05;
  oy = (e.beta - lastOrient.b) * 0.05;
  oz = (e.gamma - lastOrient.g) * 0.05;
  lastOrient = {a:e.alpha||0, b:e.beta||0, g:e.gamma||0};
});
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * W;
  const y = (e.clientY - r.top) / r.height * H;
  pvx = x - px; pvy = y - py; px = x; py = y;
});

// Domains
const domains = [];
for (let i=0; i<3; i++) {
  const d = document.createElement('div');
  d.className = 'domain';
  d.textContent = 'domain';
  d.style.left = (100 + i*120) + 'px';
  d.style.top = (80 + i*40) + 'px';
  document.body.appendChild(d);
  domains.push({el:d, x:0, y:0, field:0});
  let drag = false, ox0=0, oy0=0;
  d.onpointerdown = e => { drag=true; ox0=e.clientX-d.offsetLeft; oy0=e.clientY-d.offsetTop; d.setPointerCapture(e.pointerId); };
  d.onpointermove = e => { if (!drag) return; d.style.left = (e.clientX-ox0)+'px'; d.style.top = (e.clientY-oy0)+'px'; };
  d.onpointerup = () => drag=false;
}

function sampleDomain(d) {
  const r = cv.getBoundingClientRect();
  const lx = (d.el.offsetLeft + 36 - r.left) / r.width * W;
  const ly = (d.el.offsetTop + 24 - r.top) / r.height * H;
  let m = 0, n = 0;
  for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
    const ix = Math.floor(lx+dx), iy = Math.floor(ly+dy);
    if (ix>=0 && ix<W && iy>=0 && iy<H) { m += spins[iy*W+ix]; n++; }
  }
  return n ? m/n : 0;
}

function stepIsing() {
  const steps = 200;
  for (let s=0; s<steps; s++) {
    const i = Math.floor(Math.random()*W*H);
    const x = i % W, y = Math.floor(i / W);
    let neigh = 0;
    if (x>0) neigh += spins[i-1];
    if (x<W-1) neigh += spins[i+1];
    if (y>0) neigh += spins[i-W];
    if (y<H-1) neigh += spins[i+W];
    let localField = field;
    domains.forEach(d => {
      const r = cv.getBoundingClientRect();
      const lx = (d.el.offsetLeft + 36 - r.left) / r.width * W;
      const ly = (d.el.offsetTop + 24 - r.top) / r.height * H;
      if (Math.abs(x-lx)<4 && Math.abs(y-ly)<3) localField += 0.8;
    });
    const dE = 2 * spins[i] * (neigh + localField);
    if (dE < 0 || Math.random() < Math.exp(-beta * dE)) spins[i] = -spins[i];
  }
}

function render() {
  const img = ctx.createImageData(cv.width, cv.height);
  const data = img.data;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const s = spins[y*W+x];
    const c = s > 0 ? [40,80,180] : [180,40,40];
    for (let py=0; py<cell; py++) for (let px=0; px<cell; px++) {
      const idx = ((y*cell+py)*cv.width + (x*cell+px)) * 4;
      data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2]; data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

let mag = 0;
function loop() {
  const inp = [ox, oy, oz, pvx*0.1, pvy*0.1, mag];
  const {o} = mlp(inp);
  beta = 0.8 + o[0]*1.5;
  field = o[1] * 1.2;
  hue = 180 + o[2]*60;
  document.body.style.filter = `hue-rotate(${hue}deg)`;
  stepIsing();
  let msum = 0;
  for (let v of spins) msum += v;
  mag = Math.abs(msum / spins.length);
  document.getElementById('mag').textContent = `|m|=${mag.toFixed(2)}`;
  domains.forEach(d => {
    const lm = sampleDomain(d);
    d.el.style.background = lm > 0 ? '#2848a0' : '#a02828';
    d.el.textContent = lm.toFixed(2);
  });
  render();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('reset').onclick = () => {
  for (let i=0; i<spins.length; i++) spins[i] = Math.random()<0.5?1:-1;
};
document.getElementById('seal').onclick = async () => {
  if (mag < 0.15) { alert('Need higher |m| to seal'); return; }
  const genome = {w1,b1,w2,b2, mag};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f0489',1);
      r.onupgradeneeded = () => r.result.createObjectStore('g');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put(genome, 'own');
    const bc = new BroadcastChannel('f0489-genome');
    bc.postMessage(genome);
    document.getElementById('status').textContent = 'Sealed & broadcast';
  } catch(e) { console.warn(e); }
};

const bc = new BroadcastChannel('f0489-genome');
bc.onmessage = e => {
  if (e.data.mag > mag + 0.05) {
    w1 = e.data.w1; b1 = e.data.b1; w2 = e.data.w2; b2 = e.data.b2;
    document.getElementById('status').textContent = 'Adopted foreign genome';
  }
};

const cv = document.getElementById('cv');
const status = document.getElementById('status');
const N = 128;
let fieldA, fieldB;
let posterior = new Float32Array(16);
posterior.fill(1/16);
let mapFK = [0.04, 0.06];

function initField() {
  fieldA = new Float32Array(N*N);
  fieldB = new Float32Array(N*N);
  fieldA.fill(1);
  for (let i = N*N/2 - N*4; i < N*N/2 + N*4; i++) fieldB[i] = 0.8 + Math.random()*0.2;
}

function grayScottStep(F, K, dt=1) {
  const nextA = new Float32Array(N*N);
  const nextB = new Float32Array(N*N);
  const Da = 0.16, Db = 0.08;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const i = y*N + x;
    const a = fieldA[i], b = fieldB[i];
    let lapA=0, lapB=0;
    const neigh = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dy,dx] of neigh) {
      const nx = (x+dx+N)%N, ny = (y+dy+N)%N;
      const ni = ny*N + nx;
      lapA += fieldA[ni]; lapB += fieldB[ni];
    }
    lapA = lapA - 4*a; lapB = lapB - 4*b;
    const abb = a*b*b;
    nextA[i] = a + (Da*lapA - abb + F*(1-a)) * dt;
    nextB[i] = b + (Db*lapB + abb - (K+F)*b) * dt;
  }
  fieldA = nextA; fieldB = nextB;
}

function updatePosterior(complexity) {
  const [F,K] = mapFK;
  const idx = Math.min(15, Math.floor(F*20) * 4 + Math.floor(K*20));
  posterior[idx] += complexity * 0.1;
  let s = posterior.reduce((a,b)=>a+b,0);
  if (s>0) for (let i=0; i<16; i++) posterior[i] /= s;
  let max=0, mi=0;
  for (let i=0; i<16; i++) if (posterior[i]>max) { max=posterior[i]; mi=i; }
  mapFK = [ (mi>>2)/20 + 0.02, (mi&3)/20 + 0.04 ];
}

function sampleComplexity(px, py) {
  const cx = Math.floor(px * N), cy = Math.floor(py * N);
  let sum=0, sum2=0, c=0;
  for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
    const x=(cx+dx+N)%N, y=(cy+dy+N)%N;
    const v = fieldB[y*N+x];
    sum += v; sum2 += v*v; c++;
  }
  const mean = sum/c;
  return Math.sqrt(Math.max(0, sum2/c - mean*mean)) * 10;
}

function render() {
  const ctx = cv.getContext('2d');
  cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  const img = ctx.createImageData(N, N);
  for (let i=0; i<N*N; i++) {
    const v = Math.min(1, Math.max(0, fieldB[i]*1.5));
    img.data[i*4] = v*50;
    img.data[i*4+1] = v*180;
    img.data[i*4+2] = v*255;
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0, N, N, 0, 0, cv.width, cv.height);
}

document.querySelectorAll('.portal').forEach(p => {
  let ox, oy;
  p.onmousedown = e => { ox = e.clientX - p.offsetLeft; oy = e.clientY - p.offsetTop; 
    const move = e2 => { p.style.left = (e2.clientX - ox) + 'px'; p.style.top = (e2.clientY - oy) + 'px'; };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  };
});

let bias = [0,0];
window.addEventListener('deviceorientation', e => { bias = [e.beta/90, e.gamma/90]; });
window.addEventListener('pointermove', e => { bias = [(e.clientX/window.innerWidth - 0.5)*2, (e.clientY/window.innerHeight - 0.5)*2]; });

const dbName = 'f825-bayes';
async function seal() {
  const data = { posterior: Array.from(posterior), mapFK, ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => { const r = indexedDB.open(dbName,1); r.onupgradeneeded = () => r.result.createObjectStore('post'); r.onsuccess = () => res(r.result); });
    const tx = db.transaction('post','readwrite');
    tx.objectStore('post').put(data, 'current');
    const bc = new BroadcastChannel('f825-genome');
    bc.postMessage(data);
    status.textContent = 'Sealed posterior';
  } catch(e) { status.textContent = 'Seal failed (memory only)'; }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = initField;

(async () => {
  try {
    const db = await new Promise((res,rej) => { const r = indexedDB.open(dbName,1); r.onupgradeneeded = () => r.result.createObjectStore('post'); r.onsuccess = () => res(r.result); });
    const tx = db.transaction('post');
    const req = tx.objectStore('post').get('current');
    req.onsuccess = () => { if (req.result) { posterior = new Float32Array(req.result.posterior); mapFK = req.result.mapFK; } };
  } catch (e) { console.debug("lab f825-webgpu-grayscott-bayesian-portal-mind:", e); }
  new BroadcastChannel('f825-genome').onmessage = e => { if (e.data.posterior) { posterior = new Float32Array(e.data.posterior); mapFK = e.data.mapFK; status.textContent = 'Adopted sealed posterior'; } };
})();

initField();
status.textContent = 'Running Gray-Scott (JS). Drag portals to seed & measure.';

function loop() {
  mapFK[0] = Math.max(0.01, Math.min(0.1, mapFK[0] + bias[0]*0.001));
  mapFK[1] = Math.max(0.03, Math.min(0.1, mapFK[1] + bias[1]*0.001));
  grayScottStep(mapFK[0], mapFK[1], 0.8);
  document.querySelectorAll('.portal').forEach(p => {
    const rect = p.getBoundingClientRect();
    const cx = (rect.left + rect.width/2) / window.innerWidth;
    const cy = (rect.top + rect.height/2) / window.innerHeight;
    const ix = Math.floor(cx * N), iy = Math.floor(cy * N);
    for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
      const x=(ix+dx+N)%N, y=(iy+dy+N)%N;
      fieldB[y*N + x] = Math.min(1, fieldB[y*N + x] + 0.3);
    }
    const comp = sampleComplexity(cx, cy);
    updatePosterior(comp);
  });
  render();
  status.textContent = `MAP F=${mapFK[0].toFixed(3)} K=${mapFK[1].toFixed(3)} | Peak ${(Math.max(...posterior)*100).toFixed(1)}%`;
  requestAnimationFrame(loop);
}
loop();

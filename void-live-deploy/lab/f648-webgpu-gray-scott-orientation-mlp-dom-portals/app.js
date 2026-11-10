const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

const N = 64;
let U = new Float32Array(N*N), V = new Float32Array(N*N);
for (let i=0; i<N*N; i++) { U[i]=1; V[i]=0; }
// seed
for (let y=28; y<36; y++) for (let x=28; x<36; x++) { V[y*N+x]=1; U[y*N+x]=0.5; }

let mlpW = Array(3*8 + 8*4).fill(0).map(() => (Math.random()-0.5)*0.5);
let fitness = 0, clicks = 0;
const portals = [];
for (let i=0; i<5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'P'+(i+1);
  el.style.left = (20+i*15)+'%';
  el.style.top = (30+i*10)+'%';
  document.getElementById('portals').appendChild(el);
  portals.push({el, x:0.2+i*0.15, y:0.3+i*0.1, reward:0});
  el.onclick = () => { clicks++; fitness += 10; el.style.transform = 'scale(1.3)'; setTimeout(()=>el.style.transform='',200); updateMLP(1); };
  let drag=false, ox=0, oy=0;
  el.onpointerdown = e => { drag=true; ox=e.clientX-parseFloat(el.style.left||0); oy=e.clientY-parseFloat(el.style.top||0); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if(!drag) return; const nx = (e.clientX-ox)/W, ny=(e.clientY-oy)/H; portals[i].x=Math.max(0,Math.min(1,nx)); portals[i].y=Math.max(0,Math.min(1,ny)); inject(nx,ny,0.5); };
  el.onpointerup = () => drag=false;
}

let beta=0, gamma=0, t=0;
function onOrient(e) { beta = (e.beta||0)/90; gamma = (e.gamma||0)/90; }
if (window.DeviceOrientationEvent) {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(p => p==='granted' && window.addEventListener('deviceorientation', onOrient)), {once:true});
  } else window.addEventListener('deviceorientation', onOrient);
}
// pointer fallback
let px=0, py=0;
cv.onpointermove = e => { px = e.clientX/W - 0.5; py = e.clientY/H - 0.5; beta = py; gamma = px; inject(e.clientX/W, e.clientY/H, 0.2); };

function mlp(inp) {
  const h = new Array(8).fill(0);
  for (let i=0; i<8; i++) for (let j=0; j<3; j++) h[i] += inp[j] * mlpW[j*8 + i];
  for (let i=0; i<8; i++) h[i] = Math.tanh(h[i]);
  const out = new Array(4).fill(0);
  for (let i=0; i<4; i++) for (let j=0; j<8; j++) out[i] += h[j] * mlpW[24 + j*4 + i];
  return out.map(v => Math.tanh(v));
}
function updateMLP(r) {
  // simple reward Hebbian
  for (let i=0; i<mlpW.length; i++) mlpW[i] += r * 0.01 * (Math.random()-0.5);
  for (let i=0; i<mlpW.length; i++) mlpW[i] = Math.max(-2, Math.min(2, mlpW[i]));
}

function stepRD(F, K, Du, Dv) {
  const Nu = new Float32Array(N*N), Nv = new Float32Array(N*N);
  for (let y=1; y<N-1; y++) for (let x=1; x<N-1; x++) {
    const i = y*N + x;
    const lapU = U[i-1]+U[i+1]+U[i-N]+U[i+N] - 4*U[i];
    const lapV = V[i-1]+V[i+1]+V[i-N]+V[i+N] - 4*V[i];
    const uvv = U[i]*V[i]*V[i];
    Nu[i] = U[i] + Du*lapU - uvv + F*(1-U[i]);
    Nv[i] = V[i] + Dv*lapV + uvv - (F+K)*V[i];
    Nu[i] = Math.max(0, Math.min(1, Nu[i]));
    Nv[i] = Math.max(0, Math.min(1, Nv[i]));
  }
  U = Nu; V = Nv;
}
function inject(nx, ny, amt) {
  const x = Math.floor(nx*(N-1)), y = Math.floor(ny*(N-1));
  for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
    const xx=x+dx, yy=y+dy;
    if (xx>0 && xx<N-1 && yy>0 && yy<N-1) { V[yy*N+xx] = Math.min(1, V[yy*N+xx]+amt); U[yy*N+xx] = Math.max(0, U[yy*N+xx]-amt*0.5); }
  }
}

function findPeak() {
  let mx=0, my=0, mv=0;
  for (let y=0; y<N; y+=2) for (let x=0; x<N; x+=2) {
    if (V[y*N+x] > mv) { mv=V[y*N+x]; mx=x/N; my=y/N; }
  }
  return {x:mx, y:my, v:mv};
}

function draw() {
  const id = ctx.createImageData(W, H);
  for (let py=0; py<H; py++) for (let px=0; px<W; px++) {
    const gx = Math.floor(px/W * N), gy = Math.floor(py/H * N);
    const v = V[gy*N + gx];
    const idx = (py*W + px)*4;
    id.data[idx] = v*255; id.data[idx+1] = (1-v)*100; id.data[idx+2] = 50; id.data[idx+3]=255;
  }
  ctx.putImageData(id,0,0);
}

const bc = new BroadcastChannel('f648-gs-genome');
bc.onmessage = e => {
  if (e.data.fitness > fitness) { mlpW = e.data.weights; fitness = e.data.fitness; document.getElementById('status').textContent = 'Adopted better genome'; }
};

function loop() {
  t += 0.016;
  const out = mlp([beta, gamma, Math.sin(t)]);
  const F = 0.035 + out[0]*0.01, K = 0.06 + out[1]*0.01, Du = 0.16 + out[2]*0.05, Dv = 0.08 + out[3]*0.03;
  stepRD(F, K, Du, Dv);
  const peak = findPeak();
  portals.forEach((p,i) => {
    p.x += (peak.x - p.x)*0.02;
    p.y += (peak.y - p.y)*0.02;
    p.el.style.left = (p.x*100)+'%';
    p.el.style.top = (p.y*100)+'%';
    p.el.style.background = `hsla(${120 + peak.v*120},80%,${40+peak.v*40}%,0.7)`;
    fitness += peak.v * 0.1;
  });
  if (fitness > 50 && Math.random()<0.01) {
    bc.postMessage({weights: mlpW.slice(), fitness, hash: mlpW.reduce((a,b)=>a+b,0).toFixed(3)});
    document.getElementById('status').textContent = 'Sealed genome posted';
  }
  draw();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = () => {
  const data = {weights: mlpW, fitness, clicks, timestamp: Date.now(), field: Array.from(V).filter((_,i)=>i%16===0)};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='f648-genome.json'; a.click();
  try { localStorage.setItem('verse-f648', JSON.stringify(data)); } catch (e) { console.debug("lab f648-webgpu-gray-scott-orientation-mlp-dom-portals:", e); }
  document.getElementById('status').textContent = 'Sealed & downloaded';
};
document.getElementById('reset').onclick = () => { location.reload(); };

try {
  const saved = localStorage.getItem('verse-f648');
  if (saved) { const d = JSON.parse(saved); mlpW = d.weights; fitness = d.fitness || 0; document.getElementById('status').textContent = 'Restored sealed genome'; }
} catch (e) { console.debug("lab f648-webgpu-gray-scott-orientation-mlp-dom-portals:", e); }

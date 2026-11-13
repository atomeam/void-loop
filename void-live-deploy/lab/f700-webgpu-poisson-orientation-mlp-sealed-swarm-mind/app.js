const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
let W=128, H=128, scale=4;
function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  scale = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height)/W));
}
resize(); addEventListener('resize', resize);

const N_AGENTS = 4;
const agents = [];
let orientation = {x:0, y:0};
let pointer = {x:0.5, y:0.5, active:false};
let fitness = new Float32Array(N_AGENTS);
let lastTransfer = 0;

function randn() { return (Math.random()*2-1)*0.3; }
function makeMLP() {
  const w1 = new Float32Array(4*6), b1 = new Float32Array(6);
  const w2 = new Float32Array(6*2), b2 = new Float32Array(2);
  for (let i=0;i<w1.length;i++) w1[i]=randn();
  for (let i=0;i<w2.length;i++) w2[i]=randn();
  return {w1,b1,w2,b2};
}
function mlpForward(m, inp) {
  const h = new Float32Array(6);
  for (let j=0;j<6;j++) {
    let s = m.b1[j];
    for (let i=0;i<4;i++) s += inp[i]*m.w1[i*6+j];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(2);
  for (let j=0;j<2;j++) {
    let s = m.b2[j];
    for (let i=0;i<6;i++) s += h[i]*m.w2[i*2+j];
    o[j] = Math.tanh(s);
  }
  return o;
}
function mutateMLP(m, rate=0.15) {
  const n = makeMLP();
  n.w1 = m.w1.map(v => v + randn()*rate);
  n.b1 = m.b1.map(v => v + randn()*rate);
  n.w2 = m.w2.map(v => v + randn()*rate);
  n.b2 = m.b2.map(v => v + randn()*rate);
  return n;
}

for (let i=0;i<N_AGENTS;i++) agents.push(makeMLP());

let rho = new Float32Array(W*H);
let phi = new Float32Array(W*H);
let phiPrev = new Float32Array(W*H);

function injectCharges() {
  rho.fill(0);
  for (let a=0;a<N_AGENTS;a++) {
    const inp = [orientation.x, orientation.y, pointer.x*2-1, pointer.y*2-1];
    const out = mlpForward(agents[a], inp);
    const cx = (out[0]*0.4 + 0.5) * W;
    const cy = (out[1]*0.4 + 0.5) * H;
    const strength = 0.8 + Math.abs(out[0])*0.5;
    for (let dy=-6;dy<=6;dy++) for (let dx=-6;dx<=6;dx++) {
      const x = Math.floor(cx+dx), y = Math.floor(cy+dy);
      if (x>=0 && x<W && y>=0 && y<H) {
        const d2 = dx*dx+dy*dy;
        rho[y*W+x] += strength * Math.exp(-d2/12);
      }
    }
  }
  if (pointer.active) {
    const px = Math.floor(pointer.x*W), py = Math.floor(pointer.y*H);
    for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++) {
      const x=px+dx, y=py+dy;
      if (x>=0&&x<W&&y>=0&&y<H) rho[y*W+x] += 1.2 * Math.exp(-(dx*dx+dy*dy)/8);
    }
  }
}

function jacobiCPU(iters=16) {
  const h2 = 1.0;
  for (let it=0;it<iters;it++) {
    phiPrev.set(phi);
    for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) {
      const i = y*W+x;
      phi[i] = (phiPrev[i-1] + phiPrev[i+1] + phiPrev[i-W] + phiPrev[i+W] - h2*rho[i]) * 0.25;
    }
  }
}

let useGPU = false;
async function initWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    // Simplified: GPU path is stubbed for reliability; CPU is primary for this prototype
    useGPU = false;
    return false;
  } catch(e) { return false; }
}
initWebGPU().then(ok => { statusEl.textContent = 'CPU Jacobi active (WebGPU optional)'; });

function render() {
  const img = ctx.createImageData(W, H);
  let min=Infinity, max=-Infinity;
  for (let i=0;i<phi.length;i++) { if(phi[i]<min)min=phi[i]; if(phi[i]>max)max=phi[i]; }
  const range = max-min || 1;
  for (let i=0;i<phi.length;i++) {
    const n = (phi[i]-min)/range;
    const r = Math.floor(n*255);
    const g = Math.floor((1-n)*180);
    const b = Math.floor(80+n*100);
    img.data[i*4] = r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
  }
  // Scale to canvas
  const temp = document.createElement('canvas');
  temp.width = W; temp.height = H;
  temp.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(temp, 0, 0, canvas.width, canvas.height);
  // agents markers
  ctx.strokeStyle = '#0ff';
  ctx.lineWidth = 2;
  for (let a=0;a<N_AGENTS;a++) {
    const inp = [orientation.x, orientation.y, pointer.x*2-1, pointer.y*2-1];
    const out = mlpForward(agents[a], inp);
    const x = (out[0]*0.4+0.5)*canvas.width;
    const y = (out[1]*0.4+0.5)*canvas.height;
    ctx.beginPath(); ctx.arc(x,y, 8+fitness[a]*0.3, 0, 6.28); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='12px system-ui'; ctx.fillText(a, x+10, y);
  }
}

function log(msg) {
  const d = document.createElement('div');
  d.textContent = new Date().toLocaleTimeString().slice(0,8)+' '+msg;
  logEl.prepend(d);
  while (logEl.children.length>6) logEl.lastChild.remove();
}

function transfer() {
  const scores = Array.from({length:N_AGENTS}, (_,i)=>i).sort((a,b)=>fitness[b]-fitness[a]);
  const top = scores[0], bot = scores[N_AGENTS-1];
  if (fitness[top] > fitness[bot] + 0.5) {
    agents[bot] = mutateMLP(agents[top], 0.2);
    fitness[bot] = fitness[top]*0.4;
    log('Transfer '+top+'→'+bot+' (fit '+fitness[top].toFixed(1)+')');
  }
  for (let i=0;i<N_AGENTS;i++) fitness[i] *= 0.98;
}

function loop() {
  injectCharges();
  jacobiCPU(14);
  if (pointer.active) {
    for (let a=0;a<N_AGENTS;a++) fitness[a] += 0.08;
  }
  const now = performance.now();
  if (now - lastTransfer > 10000) { transfer(); lastTransfer = now; }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Inputs
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orientation.x = Math.max(-1, Math.min(1, (e.gamma||0)/90));
    orientation.y = Math.max(-1, Math.min(1, (e.beta||0)/90));
  });
}
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / canvas.width;
  pointer.y = e.clientY / canvas.height;
});
canvas.addEventListener('pointerdown', e => { pointer.active=true; });
canvas.addEventListener('pointerup', e => { pointer.active=false; });
canvas.addEventListener('pointerleave', e => { pointer.active=false; });

// IndexedDB
const DB = 'f700-poisson-genomes';
async function seal() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open(DB,1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('g');
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put({agents: agents.map(a=>({w1:[...a.w1],b1:[...a.b1],w2:[...a.w2],b2:[...a.b2]})), fitness:[...fitness]}, 'state');
    await new Promise(r=>tx.oncomplete=r);
    log('Genomes sealed to IndexedDB');
  } catch(e) { log('Seal failed: '+e.message); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { for(let i=0;i<N_AGENTS;i++) agents[i]=makeMLP(); fitness.fill(0); log('Reset'); };

// restore
(async () => {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open(DB,1);
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej();
    });
    const tx = db.transaction('g');
    const req = tx.objectStore('g').get('state');
    req.onsuccess = () => {
      if (req.result) {
        const s = req.result;
        for (let i=0;i<N_AGENTS;i++) {
          agents[i] = {w1:Float32Array.from(s.agents[i].w1), b1:Float32Array.from(s.agents[i].b1), w2:Float32Array.from(s.agents[i].w2), b2:Float32Array.from(s.agents[i].b2)};
        }
        fitness.set(s.fitness);
        log('Restored sealed genomes');
      }
    };
  } catch (e) { console.debug("lab f700-webgpu-poisson-orientation-mlp-sealed-swarm-mind:", e); }
})();

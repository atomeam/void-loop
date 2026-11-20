const N = 192;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const stats = document.getElementById('stats');
let W = innerWidth, H = innerHeight;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// MLP 4-8-2
let weights = new Float32Array(4*8 + 8*2);
for (let i=0;i<weights.length;i++) weights[i] = (Math.random()-0.5)*0.4;
function mlp(inp) {
  const h = new Float32Array(8);
  for (let j=0;j<8;j++) {
    let s = 0;
    for (let i=0;i<4;i++) s += inp[i]*weights[j*4+i];
    h[j] = Math.tanh(s);
  }
  const o = [0,0];
  const off = 32;
  for (let k=0;k<2;k++) {
    let s = 0;
    for (let j=0;j<8;j++) s += h[j]*weights[off+k*8+j];
    o[k] = 0.5 + 0.5*Math.tanh(s); // [0,1]
  }
  return o;
}
function updateMLP(inp, target) {
  // simple delta on output layer only for demo
  const h = new Float32Array(8);
  for (let j=0;j<8;j++) {
    let s=0; for(let i=0;i<4;i++) s+=inp[i]*weights[j*4+i];
    h[j]=Math.tanh(s);
  }
  const off=32;
  const lr=0.08;
  for (let k=0;k<2;k++) {
    let s=0; for(let j=0;j<8;j++) s+=h[j]*weights[off+k*8+j];
    const pred = 0.5+0.5*Math.tanh(s);
    const err = target[k]-pred;
    const d = err * 0.5 * (1-Math.tanh(s)**2);
    for (let j=0;j<8;j++) weights[off+k*8+j] += lr * d * h[j];
  }
}

// particles
let pos = new Float32Array(N*2);
let ang = new Float32Array(N);
let vel = new Float32Array(N*2);
for (let i=0;i<N;i++) {
  pos[i*2]=Math.random()*W; pos[i*2+1]=Math.random()*H;
  ang[i]=Math.random()*Math.PI*2;
}
const speed = 1.8;

// orientation + pointer
let ori = [0,0], ptr = [0.5,0.5];
window.addEventListener('deviceorientation', e => {
  ori[0] = Math.max(-1,Math.min(1,(e.beta||0)/45));
  ori[1] = Math.max(-1,Math.min(1,(e.gamma||0)/45));
});
cv.addEventListener('pointermove', e => {
  ptr[0]=e.clientX/W; ptr[1]=e.clientY/H;
});

// portals
const portals = [];
for (let i=0;i<4;i++) {
  const d = document.createElement('div');
  d.className='portal';
  d.textContent = 'F'+i;
  d.onclick = () => reward();
  portalsEl.appendChild(d);
  portals.push(d);
}

let fitness = 0.5;
function reward() {
  const inp = [ori[0],ori[1],ptr[0]*2-1,ptr[1]*2-1];
  updateMLP(inp, [0.7, 0.3]); // prefer moderate radius, low noise
  fitness = Math.min(1, fitness+0.05);
}

function step() {
  const inp = [ori[0],ori[1],ptr[0]*2-1,ptr[1]*2-1];
  const [rS, nS] = mlp(inp);
  const radius = 40 + rS*120;
  const noise = nS * 0.8;

  // Vicsek
  const newAng = new Float32Array(N);
  for (let i=0;i<N;i++) {
    let sx=0, sy=0, cnt=0;
    const x=pos[i*2], y=pos[i*2+1];
    for (let j=0;j<N;j++) {
      const dx=pos[j*2]-x, dy=pos[j*2+1]-y;
      if (dx*dx+dy*dy < radius*radius) {
        sx += Math.cos(ang[j]); sy += Math.sin(ang[j]); cnt++;
      }
    }
    let a = cnt ? Math.atan2(sy,sx) : ang[i];
    a += (Math.random()-0.5)*noise;
    newAng[i]=a;
  }
  for (let i=0;i<N;i++) {
    ang[i]=newAng[i];
    pos[i*2] += Math.cos(ang[i])*speed;
    pos[i*2+1] += Math.sin(ang[i])*speed;
    // wrap
    if (pos[i*2]<0) pos[i*2]+=W; if (pos[i*2]>W) pos[i*2]-=W;
    if (pos[i*2+1]<0) pos[i*2+1]+=H; if (pos[i*2+1]>H) pos[i*2+1]-=H;
  }

  // simple cluster centers: sample every N/4
  for (let p=0;p<4;p++) {
    const i = (p * (N/4) |0);
    portals[p].style.left = pos[i*2]+'px';
    portals[p].style.top = pos[i*2+1]+'px';
    portals[p].style.background = `hsla(${200+rS*80},70%,50%,0.35)`;
  }

  // render
  ctx.fillStyle='rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#88aaff';
  for (let i=0;i<N;i++) {
    ctx.fillRect(pos[i*2], pos[i*2+1], 2, 2);
  }
  stats.textContent = ` r=${radius.toFixed(0)} n=${noise.toFixed(2)} fit=${fitness.toFixed(2)}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// seal
const bc = new BroadcastChannel('f847-genome');
async function seal() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('f847',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('g');
      r.onsuccess = ()=>res(r.result);
    });
    const tx = db.transaction('g','readwrite');
    tx.objectStore('g').put({w:Array.from(weights), f:fitness, t:Date.now()}, 'latest');
    bc.postMessage({w:Array.from(weights), f:fitness});
  } catch (e) { console.debug("lab f847-webgpu-vicsek-flock-policy-mind:", e); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  for (let i=0;i<weights.length;i++) weights[i]=(Math.random()-0.5)*0.4;
  fitness=0.5;
};
bc.onmessage = e => {
  if (e.data.f > fitness) {
    weights.set(e.data.w);
    fitness = e.data.f;
  }
};
// load
(async ()=>{
  try {
    const db = await new Promise(res=>{
      const r=indexedDB.open('f847',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('g');
      r.onsuccess=()=>res(r.result);
    });
    const tx=db.transaction('g');
    const req=tx.objectStore('g').get('latest');
    req.onsuccess=()=>{ if(req.result){ weights.set(req.result.w); fitness=req.result.f; } };
  } catch (e) { console.debug("lab f847-webgpu-vicsek-flock-policy-mind:", e); }
})();

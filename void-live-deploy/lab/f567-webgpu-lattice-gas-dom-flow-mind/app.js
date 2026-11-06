const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// --- LGA (simplified 4-direction + rest, density/velocity) ---
const GW = 80, GH = 50;
let density = new Float32Array(GW * GH);
let vx = new Float32Array(GW * GH);
let vy = new Float32Array(GW * GH);
function idx(x,y){ return ((y+GH)%GH)*GW + ((x+GW)%GW); }

function initLattice(){
  density.fill(0.1); vx.fill(0); vy.fill(0);
  for(let i=0;i<400;i++){ density[Math.random()*GW*GH|0] += 0.8; }
}

function stepLGA(){
  const nd = new Float32Array(density);
  const nvx = new Float32Array(vx);
  const nvy = new Float32Array(vy);
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    const i = idx(x,y);
    const d = density[i];
    if(d < 0.05) continue;
    // simple advection + diffusion
    const nx = x + Math.round(vx[i]*0.8), ny = y + Math.round(vy[i]*0.8);
    const j = idx(nx, ny);
    nd[j] += d * 0.7;
    nvx[j] = (nvx[j] + vx[i]) * 0.5;
    nvy[j] = (nvy[j] + vy[i]) * 0.5;
    nd[i] *= 0.3;
    // slight random walk
    if(Math.random()<0.1){ nvx[j] += (Math.random()-0.5)*0.2; nvy[j] += (Math.random()-0.5)*0.2; }
  }
  // decay
  for(let i=0;i<nd.length;i++){ nd[i]*=0.98; nvx[i]*=0.97; nvy[i]*=0.97; }
  density = nd; vx = nvx; vy = nvy;
}

// --- Tiny MLP (6→8→3) ---
function rand(n){ return new Float32Array(n).map(()=> (Math.random()-0.5)*0.4); }
let w1 = rand(6*8), b1 = rand(8), w2 = rand(8*3), b2 = rand(3);
const regimes = ['laminar','vortex','turbulent'];
let lastPred = 0, crystals = 0;

function mlp(features){
  const h = new Float32Array(8);
  for(let i=0;i<8;i++){ let s=b1[i]; for(let j=0;j<6;j++) s += features[j]*w1[j*8+i]; h[i] = Math.tanh(s); }
  const o = new Float32Array(3);
  for(let i=0;i<3;i++){ let s=b2[i]; for(let j=0;j<8;j++) s += h[j]*w2[j*3+i]; o[i] = s; }
  // softmax-ish
  const m = Math.max(...o); const e = o.map(v=>Math.exp(v-m)); const sum = e.reduce((a,b)=>a+b,0);
  return e.map(v=>v/sum);
}
function hebbianUpdate(features, target){
  // simple reward: nudge toward target class
  const pred = mlp(features);
  const lr = 0.08;
  for(let i=0;i<8;i++){
    for(let j=0;j<6;j++) w1[j*8+i] += lr * features[j] * (target===i%3 ? 0.1 : -0.05);
  }
  // lightweight
}

// --- Features ---
function sampleFeatures(){
  let speed=0, vort=0, dens=0, n=0;
  for(let i=0;i<density.length;i+=4){ speed += Math.hypot(vx[i],vy[i]); dens += density[i]; n++; }
  speed/=n; dens/=n;
  // crude vorticity proxy
  for(let y=1;y<GH-1;y+=2) for(let x=1;x<GW-1;x+=2){
    const i=idx(x,y);
    vort += (vy[idx(x+1,y)] - vy[idx(x-1,y)] - (vx[idx(x,y+1)] - vx[idx(x,y-1)]));
  }
  return [speed, dens, Math.abs(vort)*0.01, pointerEnergy, lastPred, crystals*0.1];
}
let pointerEnergy = 0;

// --- Atoms ---
const atoms = [];
function spawnAtoms(){
  for(let i=0;i<8;i++){
    const el = document.createElement('div');
    el.className = 'atom';
    el.textContent = `Portal ${i+1}\nclick to absorb`;
    el.style.left = (Math.random()*0.7+0.1)*W + 'px';
    el.style.top = (Math.random()*0.7+0.1)*H + 'px';
    el.onclick = () => absorb(el);
    document.body.appendChild(el);
    atoms.push({el, gx: Math.random()*GW|0, gy: Math.random()*GH|0});
  }
}
function absorb(el){
  if(crystals>0){
    el.classList.add('sealed');
    el.style.background = `hsla(${Math.random()*60+20},70%,40%,0.9)`;
    crystals--;
    el.textContent += '\n[crystal]';
  }
}

// --- Interaction ---
let dragging = false, lastX=0, lastY=0;
canvas.addEventListener('pointerdown', e=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; });
window.addEventListener('pointerup', ()=> dragging=false);
window.addEventListener('pointermove', e=>{
  if(!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  const gx = (e.clientX / W * GW)|0, gy = (e.clientY / H * GH)|0;
  const i = idx(gx, gy);
  vx[i] += dx * 0.05; vy[i] += dy * 0.05;
  density[i] += 0.5;
  pointerEnergy = Math.min(2, pointerEnergy + 0.3);
  lastX = e.clientX; lastY = e.clientY;
});

// --- Seal ---
async function seal(){
  const db = await new Promise((res,rej)=>{
    const r = indexedDB.open('f567-lga-flow-mind',1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('seal');
    r.onsuccess = ()=> res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({w1:Array.from(w1),b1:Array.from(b1),w2:Array.from(w2),b2:Array.from(b2),crystals}, 'weights');
  statusEl.textContent += ' | sealed';
}
async function loadSeal(){
  try{
    const db = await new Promise(res=>{ const r=indexedDB.open('f567-lga-flow-mind',1); r.onsuccess=()=>res(r.result); });
    const tx = db.transaction('seal');
    const data = await new Promise(res=> tx.objectStore('seal').get('weights').onsuccess=e=>res(e.target.result));
    if(data){ w1.set(data.w1); b1.set(data.b1); w2.set(data.w2); b2.set(data.b2); crystals = data.crystals||0; }
  }catch (e) { console.debug("lab f567-webgpu-lattice-gas-dom-flow-mind:", e); }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = ()=>{ initLattice(); pointerEnergy=0; };
document.getElementById('clear').onclick = ()=>{ atoms.forEach(a=>a.el.remove()); atoms.length=0; spawnAtoms(); };

// --- Loop ---
let frame=0;
function loop(){
  stepLGA();
  pointerEnergy *= 0.95;
  const feats = sampleFeatures();
  const probs = mlp(feats);
  const pred = probs.indexOf(Math.max(...probs));
  // crude true regime
  const trueR = feats[0] > 0.4 ? 2 : feats[2] > 0.3 ? 1 : 0;
  if(pred === trueR && frame%30===0){ crystals++; hebbianUpdate(feats, trueR); }
  lastPred = pred;

  // render lattice
  ctx.clearRect(0,0,W,H);
  const cellW = W/GW, cellH = H/GH;
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    const d = density[idx(x,y)];
    if(d>0.15){
      ctx.fillStyle = `rgba(40,120,200,${Math.min(0.6,d*0.4)})`;
      ctx.fillRect(x*cellW, y*cellH, cellW, cellH);
    }
  }
  // move atoms
  atoms.forEach(a=>{
    const i = idx(a.gx|0, a.gy|0);
    a.gx += vx[i]*0.6; a.gy += vy[i]*0.6;
    a.gx = (a.gx+GW)%GW; a.gy = (a.gy+GH)%GH;
    a.el.style.left = (a.gx/GW*W - 60) + 'px';
    a.el.style.top = (a.gy/GH*H - 40) + 'px';
    const hue = regimes[pred]==='turbulent'? 10 : regimes[pred]==='vortex'? 200 : 160;
    a.el.style.borderColor = `hsl(${hue},80%,60%)`;
  });

  statusEl.textContent = `Regime: ${regimes[trueR]} | Pred: ${regimes[pred]} (${(probs[pred]*100)|0}%) | Crystals: ${crystals} | Energy: ${pointerEnergy.toFixed(2)}`;
  frame++;
  requestAnimationFrame(loop);
}

initLattice();
spawnAtoms();
loadSeal().then(()=> loop());

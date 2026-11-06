const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const fitEl = document.getElementById('fit');
const buoysEl = document.getElementById('buoys');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 1024;
const H_SPH = 0.045;
const MASS = 0.8;
const REST_DENS = 1.0;
const GAS_K = 40.0;
const VISC = 0.15;
const DT = 0.016;
const GRAV = 0.0008;

let device, context, pipeline, bindGroup, bufA, bufB, uniformBuf, readBuf;
let particles = new Float32Array(N * 8); // x,y,vx,vy,dens,press,fx,fy
let mlpW = new Float32Array(6*8 + 8*3 + 8 + 3); // in-hidden + hidden-out + biases
let lastBeta = 0, lastGamma = 0, px = 0, py = 0, pvx = 0, pvy = 0;
let fitness = 0;
let db, bc;

function rand(a,b){ return a + Math.random()*(b-a); }
function initParticles(){
  for(let i=0;i<N;i++){
    const o = i*8;
    particles[o] = rand(0.1,0.9); particles[o+1] = rand(0.2,0.9);
    particles[o+2] = rand(-0.02,0.02); particles[o+3] = rand(-0.02,0.02);
    particles[o+4] = REST_DENS; particles[o+5] = 0;
  }
}
function initMLP(){
  for(let i=0;i<mlpW.length;i++) mlpW[i] = (Math.random()-0.5)*0.4;
}

function forwardMLP(inputs){
  const hidden = new Float32Array(8);
  for(let h=0;h<8;h++){
    let s = mlpW[6*8 + h];
    for(let i=0;i<6;i++) s += inputs[i] * mlpW[i*8 + h];
    hidden[h] = Math.tanh(s);
  }
  const out = new Float32Array(3);
  const base = 6*8 + 8;
  for(let o=0;o<3;o++){
    let s = mlpW[base + 8*3 + o];
    for(let h=0;h<8;h++) s += hidden[h] * mlpW[base + h*3 + o];
    out[o] = Math.tanh(s);
  }
  return out;
}

function poly6(r2, h){ const h2 = h*h; if(r2 >= h2) return 0; const x = h2 - r2; return 315/(64*Math.PI*Math.pow(h,9)) * x*x*x; }
function spikyGrad(r, h){ if(r >= h || r < 1e-6) return 0; return -45/(Math.PI*Math.pow(h,6)) * Math.pow(h-r,2) / r; }
function viscLap(r, h){ if(r >= h) return 0; return 45/(Math.PI*Math.pow(h,6)) * (h-r); }

function stepSPH(forceScale, viscMul, densBias){
  // density
  for(let i=0;i<N;i++){
    let dens = 0;
    const ix = particles[i*8], iy = particles[i*8+1];
    for(let j=0;j<N;j++){
      const dx = ix - particles[j*8], dy = iy - particles[j*8+1];
      const r2 = dx*dx + dy*dy;
      dens += MASS * poly6(r2, H_SPH);
    }
    particles[i*8+4] = dens;
    particles[i*8+5] = GAS_K * (dens - (REST_DENS + densBias*0.3));
  }
  // forces
  for(let i=0;i<N;i++){
    let fx = 0, fy = GRAV * 40;
    const ix = particles[i*8], iy = particles[i*8+1];
    const dens_i = particles[i*8+4], press_i = particles[i*8+5];
    for(let j=0;j<N;j++){
      if(i===j) continue;
      const dx = particles[j*8] - ix, dy = particles[j*8+1] - iy;
      const r = Math.sqrt(dx*dx + dy*dy) + 1e-6;
      const dens_j = particles[j*8+4], press_j = particles[j*8+5];
      const grad = spikyGrad(r, H_SPH);
      const fpress = -MASS * (press_i + press_j) / (2 * dens_j) * grad;
      fx += fpress * dx / r;
      fy += fpress * dy / r;
      const lap = viscLap(r, H_SPH);
      const fvisc = VISC * viscMul * MASS * (particles[j*8+2] - particles[i*8+2]) / dens_j * lap;
      fx += fvisc;
      const fviscY = VISC * viscMul * MASS * (particles[j*8+3] - particles[i*8+3]) / dens_j * lap;
      fy += fviscY;
    }
    // MLP force injection near pointer
    const dxp = ix - (px / W), dyp = iy - (py / H);
    const dist = Math.sqrt(dxp*dxp + dyp*dyp);
    if(dist < 0.15){
      fx += forceScale * 0.8 * Math.cos(performance.now()*0.001) * (1 - dist/0.15);
      fy += forceScale * 0.4 * Math.sin(performance.now()*0.0015);
    }
    particles[i*8+6] = fx; particles[i*8+7] = fy;
  }
  // integrate
  for(let i=0;i<N;i++){
    const o = i*8;
    particles[o+2] += particles[o+6] * DT / particles[o+4];
    particles[o+3] += particles[o+7] * DT / particles[o+4];
    particles[o+2] *= 0.995; particles[o+3] *= 0.995;
    particles[o] += particles[o+2] * DT * 8;
    particles[o+1] += particles[o+3] * DT * 8;
    if(particles[o] < 0.02 || particles[o] > 0.98) particles[o+2] *= -0.6;
    if(particles[o+1] < 0.02 || particles[o+1] > 0.98) particles[o+3] *= -0.6;
    particles[o] = Math.max(0.01, Math.min(0.99, particles[o]));
    particles[o+1] = Math.max(0.01, Math.min(0.99, particles[o+1]));
  }
}

const buoys = [];
function makeBuoys(){
  buoysEl.innerHTML = '';
  buoys.length = 0;
  for(let i=0;i<5;i++){
    const el = document.createElement('div');
    el.className = 'buoy';
    el.textContent = 'buoy '+(i+1);
    el.style.left = (20 + i*18) + '%';
    el.style.top = (30 + (i%2)*20) + '%';
    buoysEl.appendChild(el);
    buoys.push({ el, x: parseFloat(el.style.left)/100 * W, y: parseFloat(el.style.top)/100 * H, vx:0, vy:0 });
  }
}
function sampleDensity(nx, ny){
  let d = 0, vx=0, vy=0, c=0;
  for(let i=0;i<N;i+=4){
    const dx = particles[i*8] - nx, dy = particles[i*8+1] - ny;
    if(dx*dx + dy*dy < 0.04){
      d += particles[i*8+4]; vx += particles[i*8+2]; vy += particles[i*8+3]; c++;
    }
  }
  return c ? [d/c, vx/c, vy/c] : [0,0,0];
}
function updateBuoys(){
  let stab = 0;
  buoys.forEach(b => {
    const nx = b.x / W, ny = b.y / H;
    const [dens, fvx, fvy] = sampleDensity(nx, ny);
    const buoyForce = (dens - 0.6) * 0.12;
    b.vy += (buoyForce - 0.008) + fvy * 0.4;
    b.vx += fvx * 0.4;
    b.vx *= 0.92; b.vy *= 0.92;
    b.x += b.vx * 2; b.y += b.vy * 2;
    b.x = Math.max(10, Math.min(W-100, b.x));
    b.y = Math.max(10, Math.min(H-70, b.y));
    b.el.style.left = b.x + 'px';
    b.el.style.top = b.y + 'px';
    stab += Math.max(0, 1 - Math.abs(b.vy)*8);
  });
  fitness = fitness * 0.96 + (stab / buoys.length) * 0.04;
  fitEl.textContent = 'fitness: ' + fitness.toFixed(3);
}

function render(){
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0,0,W,H);
  for(let i=0;i<N;i++){
    const o = i*8;
    const dens = particles[o+4];
    const a = Math.min(0.85, dens * 0.4);
    ctx.fillStyle = `hsla(${200 + dens*40}, 70%, ${50 + dens*20}%, ${a})`;
    ctx.fillRect(particles[o]*W - 1.5, particles[o+1]*H - 1.5, 3, 3);
  }
}

async function setupDB(){
  return new Promise(res => {
    const req = indexedDB.open('f539-sph-mlp', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
    req.onsuccess = e => { db = e.target.result; res(); };
    req.onerror = () => res();
  });
}
function hashWeights(w){
  let h = 2166136261;
  for(let i=0;i<Math.min(32,w.length);i++) h = Math.imul(h ^ (w[i]*1000|0), 16777619);
  return (h >>> 0).toString(16);
}
async function seal(){
  if(!db) return;
  const rec = { id:'best', weights: Array.from(mlpW), fitness, hash: hashWeights(mlpW), t: Date.now() };
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(rec);
  if(bc) bc.postMessage(rec);
  statusEl.textContent = 'sealed ' + rec.hash.slice(0,6) + ' fit=' + fitness.toFixed(2);
}
async function loadGenome(){
  if(!db) return;
  return new Promise(res => {
    const tx = db.transaction('genomes','readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if(req.result && req.result.weights){
        mlpW.set(req.result.weights);
        fitness = req.result.fitness || 0;
        statusEl.textContent = 'loaded genome fit=' + fitness.toFixed(2);
      }
      res();
    };
    req.onerror = () => res();
  });
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initParticles(); initMLP(); fitness = 0; };

addEventListener('pointermove', e => {
  pvx = (e.clientX - px) * 0.01; pvy = (e.clientY - py) * 0.01;
  px = e.clientX; py = e.clientY;
});
addEventListener('deviceorientation', e => {
  const b = e.beta || 0, g = e.gamma || 0;
  lastBeta = b; lastGamma = g;
});

async function loop(){
  const inputs = [
    (lastBeta - 0) * 0.02,
    (lastGamma - 0) * 0.02,
    pvx, pvy,
    particles[4],
    fitness
  ];
  const out = forwardMLP(inputs);
  const forceScale = 0.5 + out[0] * 0.8;
  const viscMul = 0.6 + out[1] * 0.7;
  const densBias = out[2] * 0.4;
  stepSPH(forceScale, viscMul, densBias);
  updateBuoys();
  render();
  requestAnimationFrame(loop);
}

(async function main(){
  initParticles();
  initMLP();
  makeBuoys();
  await setupDB();
  await loadGenome();
  try { bc = new BroadcastChannel('f539-genome');
    bc.onmessage = e => {
      const rec = e.data;
      if(rec && rec.hash === hashWeights(new Float32Array(rec.weights)) && rec.fitness > fitness + 0.02){
        mlpW.set(rec.weights);
        fitness = rec.fitness;
        statusEl.textContent = 'adopted peer genome fit=' + fitness.toFixed(2);
      }
    };
  } catch (e) { console.debug("lab f539-webgpu-sph-orientation-mlp-buoyant-dom-mind:", e); }
  statusEl.textContent = 'running · tilt or move pointer · Seal to share';
  requestAnimationFrame(loop);
})();

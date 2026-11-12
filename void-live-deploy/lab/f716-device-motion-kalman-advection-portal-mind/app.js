const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

// Density grid (CPU advection-diffusion)
const GW = 96, GH = 54;
let dens = new Float32Array(GW * GH);
let dens2 = new Float32Array(GW * GH);
function idx(x,y){ return ((y+GH)%GH)*GW + ((x+GW)%GW); }

// Kalman filter: state [vx, vy]
let x = [0,0]; // state
let P = [[1,0],[0,1]]; // covariance
let Q = 0.01; // process noise
let R = 0.1;  // measurement noise
let conf = 0.5;
let paused = false;
let motionEnabled = false;
let lastAx=0, lastAy=0;

// Portals
const portals = [];
function addPortal(px=W/2, py=H/2, isSource=true){
  const el = document.createElement('div');
  el.className = 'portal' + (isSource?'':' sink');
  el.textContent = isSource?'+':'-';
  el.style.left = px+'px'; el.style.top = py+'px';
  el.draggable = false;
  let ox=0,oy=0,dragging=false;
  el.onpointerdown = e => { dragging=true; ox=e.clientX-parseFloat(el.style.left); oy=e.clientY-parseFloat(el.style.top); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if(!dragging) return; el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; };
  el.onpointerup = () => dragging=false;
  el.onclick = () => { el.classList.toggle('sink'); el.textContent = el.classList.contains('sink')?'-':'+'; };
  document.body.appendChild(el);
  portals.push({el, source: isSource});
}
for(let i=0;i<4;i++) addPortal(200+i*120, 200+ (i%2)*100, i%2===0);

// Kalman step
function kalmanUpdate(measVx, measVy){
  // Predict
  P[0][0] += Q; P[1][1] += Q;
  // Update
  const y0 = measVx - x[0], y1 = measVy - x[1];
  const S0 = P[0][0] + R, S1 = P[1][1] + R;
  const K0 = P[0][0] / S0, K1 = P[1][1] / S1;
  x[0] += K0 * y0; x[1] += K1 * y1;
  P[0][0] *= (1-K0); P[1][1] *= (1-K1);
  conf = Math.max(0, Math.min(1, 1 - (P[0][0]+P[1][1])/2 ));
}

// Advection-diffusion step (simple semi-Lagrangian + diffusion)
function stepField(){
  const vx = x[0]*2, vy = x[1]*2;
  const diff = 0.15 + conf*0.1;
  for(let y=0;y<GH;y++) for(let xg=0;xg<GW;xg++){
    let sx = xg - vx, sy = y - vy;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const fx = sx-ix, fy = sy-iy;
    const d00 = dens[idx(ix,iy)], d10=dens[idx(ix+1,iy)], d01=dens[idx(ix,iy+1)], d11=dens[idx(ix+1,iy+1)];
    dens2[idx(xg,y)] = (1-fx)*(1-fy)*d00 + fx*(1-fy)*d10 + (1-fx)*fy*d01 + fx*fy*d11;
  }
  for(let y=0;y<GH;y++) for(let xg=0;xg<GW;xg++){
    const c = dens2[idx(xg,y)];
    const n = (dens2[idx(xg+1,y)] + dens2[idx(xg-1,y)] + dens2[idx(xg,y+1)] + dens2[idx(xg,y-1)])*0.25;
    dens[idx(xg,y)] = c*(1-diff) + n*diff * 0.98;
  }
  portals.forEach(p => {
    const rect = p.el.getBoundingClientRect();
    const gx = Math.floor((rect.left + 24)/W * GW);
    const gy = Math.floor((rect.top + 24)/H * GH);
    const sign = p.el.classList.contains('sink') ? -0.8 : 1.2;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
      dens[idx(gx+dx, gy+dy)] += sign * (1 - (dx*dx+dy*dy)/8) * 0.3 * conf;
    }
  });
  for(let i=0;i<dens.length;i++) dens[i] = Math.max(0, Math.min(1, dens[i]));
}

function render(){
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(GW, GH);
  for(let i=0;i<dens.length;i++){
    const v = dens[i];
    img.data[i*4] = Math.floor(v*80);
    img.data[i*4+1] = Math.floor(v*180 + conf*50);
    img.data[i*4+2] = Math.floor(200 + v*55);
    img.data[i*4+3] = 255;
  }
  const tmp = document.createElement('canvas'); tmp.width=GW; tmp.height=GH;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0,0, W, H);
  ctx.strokeStyle = '#adf'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(W/2,H/2); ctx.lineTo(W/2 + x[0]*40, H/2 + x[1]*40); ctx.stroke();
}

let last = 0;
function loop(t){
  if(!paused && t-last>30){
    let mvx = lastAx*0.5, mvy = lastAy*0.5;
    if(!motionEnabled){
      mvx += (Math.random()-0.5)*0.02;
    }
    kalmanUpdate(mvx, mvy);
    stepField();
    last = t;
  }
  render();
  document.getElementById('vx').textContent = x[0].toFixed(2);
  document.getElementById('vy').textContent = x[1].toFixed(2);
  document.getElementById('conf').textContent = conf.toFixed(2);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.getElementById('btnMotion').onclick = async () => {
  if(typeof DeviceMotionEvent.requestPermission === 'function'){
    const perm = await DeviceMotionEvent.requestPermission();
    if(perm !== 'granted') { alert('Motion denied'); return; }
  }
  motionEnabled = true;
  window.addEventListener('devicemotion', e => {
    if(e.accelerationIncludingGravity){
      lastAx = (e.accelerationIncludingGravity.x || 0)/10;
      lastAy = (e.accelerationIncludingGravity.y || 0)/10;
    }
  });
  document.getElementById('status').textContent = 'Motion active';
};

const DB_NAME = 'verse-f716';
const KEY = 'kalman';
async function seal(){
  const data = {x, P, Q, R, conf, ts: Date.now()};
  try{
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put(data, KEY);
    };
    const bc = new BroadcastChannel('verse-f716');
    bc.postMessage({type:'seal', data});
    document.getElementById('status').textContent = 'Sealed to IDB + BC';
  }catch(err){ console.warn(err); }
}
document.getElementById('btnSeal').onclick = seal;

(async function load(){
  try{
    const req = indexedDB.open(DB_NAME,1);
    req.onsuccess = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains('genomes')) return;
      const tx = db.transaction('genomes','readonly');
      const get = tx.objectStore('genomes').get(KEY);
      get.onsuccess = () => {
        if(get.result){
          x = get.result.x || x;
          P = get.result.P || P;
          Q = get.result.Q || Q;
          R = get.result.R || R;
          conf = get.result.conf || conf;
          document.getElementById('status').textContent = 'Loaded sealed genome';
        }
      };
    };
  }catch (e) { console.debug("lab f716-device-motion-kalman-advection-portal-mind:", e); }
  const bc = new BroadcastChannel('verse-f716');
  bc.onmessage = e => {
    if(e.data.type==='seal'){
      x = e.data.data.x; P = e.data.data.P; conf = e.data.data.conf;
      document.getElementById('status').textContent = 'Adopted peer genome';
    }
  };
})();

document.getElementById('btnReset').onclick = () => { x=[0,0]; P=[[1,0],[0,1]]; conf=0.5; dens.fill(0); document.getElementById('status').textContent='Reset'; };
document.getElementById('btnAdd').onclick = () => addPortal(Math.random()*W, Math.random()*H, Math.random()>0.5);
document.getElementById('btnPause').onclick = () => { paused=!paused; document.getElementById('btnPause').textContent = paused?'Resume':'Pause'; };

for(let i=0;i<20;i++) dens[idx(40+i%10, 20+(i/10)|0)] = 0.6;

document.getElementById('status').textContent = 'Ready · Enable Motion or interact';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const tilesEl = document.getElementById('tiles');
const statusEl = document.getElementById('status');
let W=0, H=0, cols=0, rows=0;
const GRID=80; // coarse
let u=[], prev=[], next=[];
let hebb = Array(40).fill(0).map(()=>Array(40).fill(0.1)); // 8x5 regions
let energy=0, residual=0, entropy=0.5;
let predEnergy=0, lastEnergy=0;
let micOn=false, analyser=null, micStream=null;
let tiltX=0, tiltY=0;
const tileData = [];

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cols = GRID;
  rows = Math.floor(GRID * H / W);
  const n = cols * rows;
  if (u.length !== n) {
    u = new Float32Array(n);
    prev = new Float32Array(n);
    next = new Float32Array(n);
  }
}
window.addEventListener('resize', resize);
resize();

function idx(x,y){ return y*cols + x; }
function region(x,y){ return Math.floor(y/rows*5)*8 + Math.floor(x/cols*8); }

function stepWave() {
  const c2 = 0.18, damp = 0.96 - (micOn ? 0.02 : 0);
  for (let y=1; y<rows-1; y++) {
    for (let x=1; x<cols-1; x++) {
      const i = idx(x,y);
      const lap = u[idx(x-1,y)] + u[idx(x+1,y)] + u[idx(x,y-1)] + u[idx(x,y+1)] - 4*u[i];
      const r = region(x,y);
      const bias = hebb[r] ? hebb[r].reduce((a,b)=>a+b,0)/40 : 1;
      next[i] = (2*u[i] - prev[i] + c2 * bias * lap) * damp;
      // tilt potential
      next[i] += tiltX * 0.0005 * (x/cols - 0.5) + tiltY * 0.0005 * (y/rows - 0.5);
    }
  }
  // boundary zero
  for (let x=0; x<cols; x++) { next[idx(x,0)]=0; next[idx(x,rows-1)]=0; }
  for (let y=0; y<rows; y++) { next[idx(0,y)]=0; next[idx(cols-1,y)]=0; }
  [prev, u, next] = [u, next, prev];
  // residual predictor
  residual = energy - predEnergy;
  predEnergy = energy * 0.85 + residual * 0.1;
  // inject residual turbulence
  if (Math.abs(residual) > 0.01) {
    const rx = Math.floor(Math.random()*cols), ry = Math.floor(Math.random()*rows);
    u[idx(rx,ry)] += residual * 0.3;
  }
}

function updateHebb() {
  const active = [];
  for (let r=0; r<40; r++) {
    let sum=0, cnt=0;
    const rx = (r%8) * (cols/8), ry = Math.floor(r/8) * (rows/5);
    for (let dy=0; dy<rows/5; dy++) for (let dx=0; dx<cols/8; dx++) {
      const i = idx(Math.floor(rx+dx), Math.floor(ry+dy));
      if (i>=0 && i<u.length) { sum += Math.abs(u[i]); cnt++; }
    }
    if (cnt && sum/cnt > 0.05) active.push(r);
  }
  for (let a of active) for (let b of active) if (a!==b) {
    hebb[a][b] = Math.min(2, hebb[a][b] * 1.002 + 0.001);
  }
  // decay
  for (let a=0; a<40; a++) for (let b=0; b<40; b++) hebb[a][b] *= 0.9995;
  entropy = active.length / 40;
}

function computeEnergy() {
  let e=0;
  for (let i=0; i<u.length; i++) e += u[i]*u[i];
  energy = Math.sqrt(e / u.length);
  document.documentElement.style.setProperty('--energy', Math.min(1, energy*8));
  document.documentElement.style.setProperty('--entropy', entropy);
  document.documentElement.style.setProperty('--hue', 180 + energy*120 + residual*40);
  statusEl.textContent = `energy:${energy.toFixed(3)} residual:${residual.toFixed(3)} hebb:${entropy.toFixed(2)}`;
}

function render() {
  const img = ctx.createImageData(cols, rows);
  for (let i=0; i<u.length; i++) {
    const v = Math.max(-1, Math.min(1, u[i]*4));
    const r = v>0 ? 255*v : 0;
    const b = v<0 ? -255*v : 0;
    const g = 40 + Math.abs(v)*60;
    img.data[i*4] = r; img.data[i*4+1] = g; img.data[i*4+2] = b; img.data[i*4+3] = 255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width = cols; tmp.height = rows;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);
  // warp tiles by local amplitude
  tileData.forEach(t => {
    const gx = Math.floor(t.x / W * cols), gy = Math.floor(t.y / H * rows);
    const amp = Math.abs(u[idx(Math.max(0,Math.min(cols-1,gx)), Math.max(0,Math.min(rows-1,gy)))] || 0);
    t.el.style.transform = `translate(${amp*12}px, ${amp*8}px) scale(${1+amp*0.15})`;
    t.el.style.borderColor = `hsla(${200+amp*100},70%,60%,0.6)`;
  });
}

function inject(x,y,strength=0.8) {
  const gx = Math.floor(x / W * cols), gy = Math.floor(y / H * rows);
  for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
    const i = idx(gx+dx, gy+dy);
    if (i>=0 && i<u.length) u[i] += strength * Math.exp(-(dx*dx+dy*dy)/2);
  }
}

// tiles
function makeTile(x,y,text) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.contentEditable = true;
  el.textContent = text;
  el.style.left = x+'px';
  el.style.top = y+'px';
  tilesEl.appendChild(el);
  const td = {el, x, y, edits:0, text};
  el.addEventListener('input', ()=>{ td.edits++; td.text = el.textContent; });
  let dragging=false, ox=0, oy=0;
  el.addEventListener('pointerdown', e=>{ dragging=true; ox=e.clientX-td.x; oy=e.clientY-td.y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e=>{
    if (!dragging) return;
    td.x = e.clientX - ox; td.y = e.clientY - oy;
    el.style.left = td.x+'px'; el.style.top = td.y+'px';
    inject(td.x + 90, td.y + 40, 0.4 + td.edits*0.01);
  });
  el.addEventListener('pointerup', ()=>dragging=false);
  tileData.push(td);
}
makeTile(80,120,'Resonator A — drag me');
makeTile(320,180,'Resonator B');
makeTile(180,340,'Resonator C — edit to strengthen');
makeTile(480,100,'Resonator D');
makeTile(400,400,'Resonator E');

canvas.addEventListener('pointerdown', e=>inject(e.clientX, e.clientY, 1.2));
canvas.addEventListener('pointermove', e=>{ if(e.buttons) inject(e.clientX, e.clientY, 0.3); });

// orientation
window.addEventListener('deviceorientation', e=>{
  tiltX = (e.gamma||0)/90;
  tiltY = (e.beta||0)/90;
});

// mic
document.getElementById('mic').onclick = async ()=>{
  if (micOn) { micStream?.getTracks().forEach(t=>t.stop()); micOn=false; return; }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ac = new AudioContext();
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    ac.createMediaStreamSource(micStream).connect(analyser);
    micOn = true;
  } catch(e) { statusEl.textContent += ' mic denied'; }
};

document.getElementById('clear').onclick = ()=>{ u.fill(0); prev.fill(0); };

// seal / restore
const DB = 'f468-cavity';
document.getElementById('seal').onclick = ()=>{
  const snap = {
    field: Array.from(u),
    hebb,
    tiles: tileData.map(t=>({x:t.x,y:t.y,text:t.text,edits:t.edits})),
    energy, residual
  };
  const req = indexedDB.open(DB,1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('seals');
  req.onsuccess = e => {
    const tx = e.target.result.transaction('seals','readwrite');
    tx.objectStore('seals').put(snap, 'latest');
    statusEl.textContent += ' sealed';
  };
};
document.getElementById('restore').onclick = ()=>{
  const req = indexedDB.open(DB,1);
  req.onsuccess = e => {
    const tx = e.target.result.transaction('seals');
    const g = tx.objectStore('seals').get('latest');
    g.onsuccess = ()=>{
      const s = g.result;
      if (!s) return;
      u.set(s.field);
      hebb = s.hebb;
      s.tiles.forEach((t,i)=>{
        if (tileData[i]) {
          tileData[i].x=t.x; tileData[i].y=t.y; tileData[i].text=t.text; tileData[i].edits=t.edits;
          tileData[i].el.style.left=t.x+'px'; tileData[i].el.style.top=t.y+'px';
          tileData[i].el.textContent=t.text;
        }
      });
      statusEl.textContent += ' restored';
    };
  };
};

function loop() {
  stepWave();
  updateHebb();
  computeEnergy();
  render();
  requestAnimationFrame(loop);
}
loop();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let particles = [];
const N = 280;
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2,
    isSource: i < 10
  });
}

let mlp = { w1: Array(6).fill(0).map(()=>Array(12).fill(0).map(()=>Math.random()*0.2-0.1)),
            w2: Array(12).fill(0).map(()=>Array(4).fill(0).map(()=>Math.random()*0.2-0.1)),
            b1: Array(12).fill(0), b2: Array(4).fill(0) };

function forward(inp) {
  const h = mlp.b1.map((b,i) => Math.tanh(b + inp.reduce((s,x,j)=>s+x*mlp.w1[j][i],0)));
  return mlp.b2.map((b,i) => b + h.reduce((s,hh,j)=>s+hh*mlp.w2[j][i],0));
}

let pointer = {x:W/2, y:H/2, hist:[]};
let tilt = {beta:0, gamma:0};
addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; pointer.hist.push({x:e.clientX,y:e.clientY}); if(pointer.hist.length>8) pointer.hist.shift(); });
if (DeviceOrientationEvent) addEventListener('deviceorientation', e => { tilt.beta=e.beta||0; tilt.gamma=e.gamma||0; });

let audioCtx, oscillators=[], panners=[], gains=[];
document.getElementById('audioBtn').onclick = async () => {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  await audioCtx.resume();
  for (let i=0; i<10; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const pan = audioCtx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 100;
    osc.type = 'sine';
    osc.frequency.value = 120 + i*40;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(pan).connect(audioCtx.destination);
    osc.start();
    oscillators.push(osc); gains.push(gain); panners.push(pan);
  }
  document.getElementById('status').textContent = 'Audio on. Spatial tones following particles.';
};

function residual() {
  if (pointer.hist.length < 3) return [0,0,0];
  const a = pointer.hist[pointer.hist.length-3], b = pointer.hist[pointer.hist.length-1];
  const predX = a.x + (b.x-a.x)*0.5, predY = a.y + (b.y-a.y)*0.5;
  const rx = (pointer.x - predX)/W, ry = (pointer.y - predY)/H;
  return [rx, ry, Math.hypot(rx,ry)];
}

function update() {
  const res = residual();
  const dens = particles.filter(p => Math.hypot(p.x-pointer.x, p.y-pointer.y)<80).length / 40;
  const inp = [res[0], res[1], res[2], tilt.beta/90, tilt.gamma/90, dens];
  const out = forward(inp);
  const fMul = 1 + out[0]*0.4, gMul = Math.max(0.01, 0.08 + out[1]*0.06);
  const fx = out[2]*2, fy = out[3]*2;

  particles.forEach((p,i) => {
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    const d = Math.hypot(dx,dy)+1;
    p.vx += (dx/d)*0.04 + fx*0.01 + (tilt.gamma||0)*0.002;
    p.vy += (dy/d)*0.04 + fy*0.01 + (tilt.beta||0)*0.002;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-1; if (p.y<0||p.y>H) p.vy*=-1;
    p.x = Math.max(0,Math.min(W,p.x)); p.y = Math.max(0,Math.min(H,p.y));

    if (p.isSource && oscillators[i%10]) {
      const pan = panners[i%10];
      pan.positionX.value = (p.x - W/2)/4;
      pan.positionY.value = (H/2 - p.y)/4;
      pan.positionZ.value = 0;
      oscillators[i%10].frequency.value = (120 + (i%10)*40) * fMul;
      gains[i%10].gain.value = gMul;
    }
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    ctx.fillStyle = p.isSource ? '#88f' : '#44a';
    ctx.beginPath(); ctx.arc(p.x,p.y, p.isSource?4:2, 0, Math.PI*2); ctx.fill();
  });
  // simple density glow near pointer
  ctx.fillStyle = 'rgba(100,100,255,0.15)';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 60, 0, Math.PI*2); ctx.fill();
}

let portals = [];
function spawnPortals() {
  for (let i=0; i<5; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'Portal '+(i+1)+'\nclick reward';
    el.style.left = (80+i*140)+'px';
    el.style.top = (120+Math.random()*200)+'px';
    el.onclick = () => { /* simple reward: nudge weights */ for(let a of mlp.w2) for(let b of a) b += (Math.random()-0.4)*0.02; el.style.borderColor='#0f8'; };
    let drag=false, ox=0, oy=0;
    el.onpointerdown = e => { drag=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); };
    el.onpointermove = e => { if(drag){ el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; } };
    el.onpointerup = () => drag=false;
    document.body.appendChild(el);
    portals.push(el);
  }
}
spawnPortals();

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();

document.getElementById('sealBtn').onclick = async () => {
  const data = { weights: mlp, particleCount: particles.length, tilt, timestamp: Date.now() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='f680-genome.json'; a.click();
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f680',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('state'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('state','readwrite'); tx.objectStore('state').put(data,'last');
  } catch (e) { console.debug("lab f680-webgpu-spatial-audio-particle-mind:", e); }
  document.getElementById('status').textContent = 'Sealed genome downloaded + persisted.';
};
document.getElementById('resetBtn').onclick = () => location.reload();

// restore attempt
(async () => {
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f680',1); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('state','readonly');
    const req = tx.objectStore('state').get('last');
    req.onsuccess = () => { if(req.result) mlp = req.result.weights; };
  } catch (e) { console.debug("lab f680-webgpu-spatial-audio-particle-mind:", e); }
})();

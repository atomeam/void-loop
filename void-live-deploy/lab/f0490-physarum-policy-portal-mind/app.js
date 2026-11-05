const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

const N = 3000;
const agents = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  a: Math.random()*Math.PI*2
}));
const gridW = Math.floor(W/2), gridH = Math.floor(H/2);
let trail = new Float32Array(gridW * gridH);
let meanTrail = 0;

// Tiny MLP
let weights = new Float32Array(6*8 + 8*3).map(() => (Math.random()-0.5)*0.5);
function mlp(input) {
  const h = new Float32Array(8);
  for (let i=0; i<8; i++) {
    let s = 0;
    for (let j=0; j<6; j++) s += input[j] * weights[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const o = new Float32Array(3);
  const base = 6*8;
  for (let i=0; i<3; i++) {
    let s = 0;
    for (let j=0; j<8; j++) s += h[j] * weights[base + j*3 + i];
    o[i] = Math.tanh(s);
  }
  return o;
}

let oriHist = [0,0,0];
let ptrVel = [0,0];
let lastPtr = null;
window.addEventListener('deviceorientation', e => {
  oriHist = [(e.gamma||0)/90, (e.beta||0)/90, (e.alpha||0)/180];
});
window.addEventListener('pointermove', e => {
  if (lastPtr) {
    ptrVel = [(e.clientX - lastPtr.x)/W, (e.clientY - lastPtr.y)/H];
  }
  lastPtr = {x:e.clientX, y:e.clientY};
});

function step() {
  const input = [...oriHist, ...ptrVel, meanTrail];
  const out = mlp(input);
  const sensorAng = 0.3 + out[0]*0.4;
  const turnStr = 0.5 + out[1]*0.5;
  const deposit = 0.1 + Math.abs(out[2])*0.2;

  // Agents
  for (const ag of agents) {
    const sense = (off) => {
      const a = ag.a + off;
      const sx = ag.x + Math.cos(a)*20;
      const sy = ag.y + Math.sin(a)*20;
      const gx = Math.max(0, Math.min(gridW-1, Math.floor(sx / W * gridW)));
      const gy = Math.max(0, Math.min(gridH-1, Math.floor(sy / H * gridH)));
      return trail[gy*gridW + gx] || 0;
    };
    const left = sense(-sensorAng), right = sense(sensorAng), front = sense(0);
    if (left > front && left > right) ag.a -= turnStr;
    else if (right > front) ag.a += turnStr;
    ag.x += Math.cos(ag.a)*2;
    ag.y += Math.sin(ag.a)*2;
    if (ag.x<0) ag.x+=W; if (ag.x>W) ag.x-=W;
    if (ag.y<0) ag.y+=H; if (ag.y>H) ag.y-=H;
    const gx = Math.max(0, Math.min(gridW-1, Math.floor(ag.x / W * gridW)));
    const gy = Math.max(0, Math.min(gridH-1, Math.floor(ag.y / H * gridH)));
    trail[gy*gridW + gx] += deposit;
  }

  // Diffuse/decay simple
  const newTrail = new Float32Array(trail.length);
  let sum = 0;
  for (let y=0; y<gridH; y++) for (let x=0; x<gridW; x++) {
    let s = 0;
    for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
      const nx = (x+dx+gridW)%gridW, ny = (y+dy+gridH)%gridH;
      s += trail[ny*gridW + nx];
    }
    newTrail[y*gridW + x] = s/9 * 0.95;
    sum += newTrail[y*gridW + x];
  }
  trail = newTrail;
  meanTrail = sum / trail.length;

  // Render
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(gridW, gridH);
  for (let i=0; i<trail.length; i++) {
    const v = Math.min(255, trail[i]*50);
    img.data[i*4] = v*0.2; img.data[i*4+1] = v; img.data[i*4+2] = v*0.5; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // scale up roughly
  ctx.drawImage(cv, 0, 0, gridW, gridH, 0, 0, W, H);

  // Update portals
  document.querySelectorAll('.portal').forEach(p => {
    const rect = p.getBoundingClientRect();
    const gx = Math.floor((rect.left + 30) / W * gridW);
    const gy = Math.floor((rect.top + 30) / H * gridH);
    const dens = trail[Math.max(0,Math.min(trail.length-1, gy*gridW + gx))] || 0;
    p.style.transform = `scale(${1 + dens*2})`;
    p.style.background = `hsla(${120 + dens*100},80%,50%,.5)`;
    // inject
    if (gx>=0 && gy>=0 && gx<gridW && gy<gridH) trail[gy*gridW + gx] += 0.5;
  });

  document.getElementById('stats').textContent = `agents: ${N} | trail: ${meanTrail.toFixed(3)}`;
  requestAnimationFrame(step);
}
step();

// Portals
for (let i=0; i<4; i++) {
  const p = document.createElement('div');
  p.className = 'portal';
  p.textContent = 'nutrient';
  p.style.left = (100 + i*150) + 'px';
  p.style.top = (100 + (i%2)*200) + 'px';
  let drag = false, ox, oy;
  p.onpointerdown = e => { drag=true; ox=e.offsetX; oy=e.offsetY; p.setPointerCapture(e.pointerId); };
  p.onpointermove = e => { if (drag) { p.style.left = (e.clientX - ox) + 'px'; p.style.top = (e.clientY - oy) + 'px'; } };
  p.onpointerup = () => drag=false;
  document.body.appendChild(p);
}

// Seal / genome
const bc = new BroadcastChannel('f0490-genome');
bc.onmessage = e => {
  if (e.data.mean > meanTrail) {
    weights = new Float32Array(e.data.w);
    console.log('adopted better genome');
  }
};
document.getElementById('seal').onclick = async () => {
  const payload = { w: Array.from(weights), mean: meanTrail };
  bc.postMessage(payload);
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open('f0490',1);
    r.onupgradeneeded = () => r.result.createObjectStore('g');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('g','readwrite');
  tx.objectStore('g').put(payload, 'genome');
  alert('Sealed');
};
// load
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f0490',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('g','readonly');
    const req = tx.objectStore('g').get('genome');
    req.onsuccess = () => { if (req.result) weights = new Float32Array(req.result.w); };
  } catch(e) {}
})();

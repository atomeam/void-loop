const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

// Tiny MLP: 4 inputs (hand x,y,vx,vy) -> 2 outputs (force x,y) + 1 hue
const IN=4, HIDDEN=6, OUT=3;
let weights = new Float32Array(IN*HIDDEN + HIDDEN*OUT);
for(let i=0;i<weights.length;i++) weights[i] = (Math.random()-0.5)*0.5;

function mlp(x) {
  const h = new Float32Array(HIDDEN);
  for(let i=0;i<HIDDEN;i++) {
    let s = 0;
    for(let j=0;j<IN;j++) s += x[j] * weights[j*HIDDEN + i];
    h[i] = Math.tanh(s);
  }
  const o = new Float32Array(OUT);
  let off = IN*HIDDEN;
  for(let i=0;i<OUT;i++) {
    let s = 0;
    for(let j=0;j<HIDDEN;j++) s += h[j] * weights[off + j*OUT + i];
    o[i] = Math.tanh(s);
  }
  return o;
}

// Spatial memory grid 32x32
const GS = 32;
let mem = new Float32Array(GS*GS);
function inject(x, y, val) {
  const ix = Math.floor(x / W * GS), iy = Math.floor(y / H * GS);
  if(ix>=0&&ix<GS&&iy>=0&&iy<GS) mem[iy*GS+ix] = Math.min(1, mem[iy*GS+ix] + val);
}
function query(x, y) {
  const ix = Math.floor(x / W * GS), iy = Math.floor(y / H * GS);
  return (ix>=0&&ix<GS&&iy>=0&&iy<GS) ? mem[iy*GS+ix] : 0;
}

// Portals / agents
const portals = [];
for(let i=0;i<5;i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'A'+(i+1);
  el.style.left = (Math.random()*W*0.8)+'px';
  el.style.top = (Math.random()*H*0.8)+'px';
  document.getElementById('portals').appendChild(el);
  portals.push({el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, fitness:0});
}

// Hand / pointer proxy
let handX = W/2, handY = H/2, handVx=0, handVy=0;
let lastX=handX, lastY=handY;
document.onpointermove = e => {
  handVx = e.clientX - lastX; handVy = e.clientY - lastY;
  handX = lastX = e.clientX; handY = lastY = e.clientY;
  inject(handX, handY, 0.05);
};

// WebXR hand tracking stub (progressive)
let xrSession = null;
document.getElementById('xrbtn').onclick = async () => {
  if (!navigator.xr) { document.getElementById('status').textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    document.getElementById('status').textContent = 'WebXR active (hand tracking if supported)';
    // In full impl: session.requestAnimationFrame loop, get inputSources with hand joints
  } catch(e) { document.getElementById('status').textContent = 'WebXR failed: '+e.message; }
};

// Reward on click
document.onclick = e => {
  portals.forEach(p => {
    const dx = p.x - e.clientX, dy = p.y - e.clientY;
    if(dx*dx+dy*dy < 1000) p.fitness += 1;
  });
  // Simple Hebbian-ish update on weights based on current input
  const inp = [handX/W*2-1, handY/H*2-1, handVx/50, handVy/50];
  const out = mlp(inp);
  for(let i=0;i<weights.length;i++) weights[i] += 0.001 * (Math.random()-0.5); // diversity
};

// Seal
const bc = new BroadcastChannel('f878-genome');
bc.onmessage = e => {
  if(e.data && e.data.fitness > Math.max(...portals.map(p=>p.fitness))) {
    weights.set(e.data.weights);
    document.getElementById('status').textContent = 'Adopted higher fitness genome';
  }
};
document.getElementById('seal').onclick = () => {
  const best = Math.max(...portals.map(p=>p.fitness));
  bc.postMessage({weights: Array.from(weights), fitness: best});
  // Persist mem + weights to IDB
  const req = indexedDB.open('verse-f878', 1);
  req.onsuccess = ev => {
    const db = ev.target.result;
    const tx = db.transaction('store','readwrite');
    tx.objectStore('store').put({id:1, weights:Array.from(weights), mem:Array.from(mem)});
  };
  req.onupgradeneeded = ev => ev.target.result.createObjectStore('store', {keyPath:'id'});
  document.getElementById('status').textContent = 'Sealed genome + memory';
};

// Load
const req = indexedDB.open('verse-f878', 1);
req.onsuccess = ev => {
  const db = ev.target.result;
  if(db.objectStoreNames.contains('store')) {
    const tx = db.transaction('store');
    const g = tx.objectStore('store').get(1);
    g.onsuccess = () => {
      if(g.result) { weights.set(g.result.weights); mem.set(g.result.mem); }
    };
  }
};

// Loop
function loop() {
  ctx.fillStyle = '#111'; ctx.fillRect(0,0,W,H);
  // Draw memory
  for(let y=0;y<GS;y++) for(let x=0;x<GS;x++) {
    const v = mem[y*GS+x];
    if(v>0.01) {
      ctx.fillStyle = `rgba(50,100,255,${v})`;
      ctx.fillRect(x*W/GS, y*H/GS, W/GS, H/GS);
    }
    mem[y*GS+x] *= 0.995; // decay
  }
  // Update portals with MLP + memory query
  portals.forEach(p => {
    const inp = [handX/W*2-1, handY/H*2-1, handVx/50, handVy/50];
    const o = mlp(inp);
    const m = query(p.x, p.y);
    p.vx += o[0]*0.2 + (handX - p.x)*0.001 * m;
    p.vy += o[1]*0.2 + (handY - p.y)*0.001 * m;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(0, Math.min(W-60, p.x));
    p.y = Math.max(0, Math.min(H-40, p.y));
    p.el.style.left = p.x+'px';
    p.el.style.top = p.y+'px';
    p.el.style.background = `hsla(${180 + o[2]*60},70%,50%,0.8)`;
    p.el.textContent = 'A fitness:'+p.fitness.toFixed(0);
  });
  requestAnimationFrame(loop);
}
loop();

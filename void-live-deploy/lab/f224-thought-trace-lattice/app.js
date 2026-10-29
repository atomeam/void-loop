const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const oraclesDiv = document.getElementById('oracles');
const stats = document.getElementById('stats');
let W, H, grid, next, cell = 4, cols, rows;
let traces = [];
let latent = [0,0,0,0];
let entropy = 0;
let oracles = [];

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cols = Math.floor(W / cell);
  rows = Math.floor(H / cell);
  grid = new Float32Array(cols * rows);
  next = new Float32Array(cols * rows);
}
addEventListener('resize', resize);
resize();

// Simple Worker for latent compression + rule mutation
const workerCode = `
let genomes = Array.from({length:4}, () => ({w: Math.random()*2-1, bias: Math.random()*0.5, fitness:0}));
self.onmessage = (e) => {
  const {points, fieldEntropy} = e.data;
  if (!points || points.length < 3) return;
  // Compress trace to latent: mean dx, mean dy, variance, curvature proxy
  let sx=0,sy=0,vx=0,vy=0,curv=0;
  for (let i=1; i<points.length; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    sx += dx; sy += dy;
    vx += dx*dx; vy += dy*dy;
    if (i>1) {
      const pdx = points[i-1].x - points[i-2].x;
      const pdy = points[i-1].y - points[i-2].y;
      curv += Math.abs(dx*pdy - dy*pdx);
    }
  }
  const n = points.length-1;
  const latent = [sx/n, sy/n, Math.sqrt(vx/n), curv/n];
  // Mutate genomes toward higher field entropy (curiosity)
  genomes.forEach(g => {
    g.fitness = fieldEntropy + Math.random()*0.1;
    if (Math.random()<0.3) g.w += (Math.random()-0.5)*0.2;
    if (Math.random()<0.3) g.bias += (Math.random()-0.5)*0.1;
  });
  genomes.sort((a,b)=>b.fitness-a.fitness);
  const best = genomes[0];
  self.postMessage({latent, rule:{w:best.w, bias:best.bias}, entropy:fieldEntropy});
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
let rule = {w:0.1, bias:0.05};

worker.onmessage = (e) => {
  const d = e.data;
  latent = d.latent;
  rule = d.rule;
  entropy = d.entropy;
  stats.textContent = `latent: [${latent.map(v=>v.toFixed(2)).join(',')}]  e:${entropy.toFixed(2)}`;
  // Morph page
  document.body.style.filter = `hue-rotate(${(latent[2]*80 + entropy*20)|0}deg) saturate(${1+entropy*0.5})`;
  document.body.style.transform = `scale(${1 + Math.abs(latent[0])*0.02})`;
};

function step() {
  // CA step biased by rule from thought
  for (let y=1; y<rows-1; y++) {
    for (let x=1; x<cols-1; x++) {
      const i = y*cols + x;
      let sum = 0;
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) if (dx||dy) sum += grid[i + dy*cols + dx];
      const avg = sum / 8;
      let v = grid[i];
      // Logistic-like + diffusion, modulated by latent/rule
      v = v + rule.w * (avg - v) + rule.bias * Math.sin(latent[0]*x*0.1 + latent[1]*y*0.1);
      v = Math.max(0, Math.min(1, v * 0.98 + (Math.random()-0.5)*0.01));
      next[i] = v;
    }
  }
  [grid, next] = [next, grid];
  // Compute entropy proxy
  let e = 0;
  for (let i=0; i<grid.length; i+=16) e += -grid[i]*Math.log(grid[i]+1e-6);
  e /= (grid.length/16);
  // Send to worker occasionally
  if (traces.length > 5 && Math.random()<0.05) {
    worker.postMessage({points: traces.slice(-32), fieldEntropy: e});
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y=0; y<rows; y++) {
    for (let x=0; x<cols; x++) {
      const v = grid[y*cols + x];
      const c = Math.floor(v * 255);
      for (let py=0; py<cell; py++) for (let px=0; px<cell; px++) {
        const idx = ((y*cell+py)*W + (x*cell+px))*4;
        data[idx] = c * 0.4; data[idx+1] = c * 0.6 + 40; data[idx+2] = c + 60; data[idx+3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Draw recent traces
  ctx.strokeStyle = 'rgba(255,220,120,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  traces.slice(-20).forEach((p,i) => i? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
  ctx.stroke();
}

function updateOracles() {
  // Predict continuation: last velocity * latent scale
  if (traces.length < 2) return;
  const last = traces[traces.length-1];
  const prev = traces[traces.length-2];
  const vx = last.x - prev.x, vy = last.y - prev.y;
  oracles = [];
  for (let k=1; k<=3; k++) {
    const px = last.x + vx * k * (1 + latent[2]*0.5);
    const py = last.y + vy * k * (1 + Math.abs(latent[0])*0.3);
    oracles.push({x:px, y:py, conf: Math.max(0.2, 1 - k*0.25 + entropy*0.3)});
  }
  oraclesDiv.innerHTML = oracles.map((o,i) => 
    `<div class="oracle" style="left:${o.x}px;top:${o.y}px;opacity:${o.conf};transform:translate(-50%,-50%) scale(${0.6+o.conf})">O${i+1}</div>`
  ).join('');
}

let pointerDown = false;
canvas.addEventListener('pointerdown', e => { pointerDown=true; traces.push({x:e.clientX, y:e.clientY}); });
canvas.addEventListener('pointermove', e => {
  if (!pointerDown) return;
  traces.push({x:e.clientX, y:e.clientY});
  if (traces.length > 128) traces.shift();
  // Seed lattice at pointer
  const cx = Math.floor(e.clientX / cell), cy = Math.floor(e.clientY / cell);
  for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
    const i = (cy+dy)*cols + (cx+dx);
    if (i>=0 && i<grid.length) grid[i] = Math.min(1, grid[i] + 0.4);
  }
});
canvas.addEventListener('pointerup', () => pointerDown=false);
canvas.addEventListener('pointerleave', () => pointerDown=false);

// Optional orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.beta) rule.bias += e.beta * 0.0001;
    if (e.gamma) rule.w += e.gamma * 0.00005;
  });
}

document.getElementById('seal').onclick = async () => {
  const data = {latent, rule, entropy, ts:Date.now()};
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const db = await new Promise(r => {
    const req = indexedDB.open('f224-seals',1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals',{keyPath:'id'});
    req.onsuccess = () => r(req.result);
  });
  const tx = db.transaction('seals','readwrite');
  tx.objectStore('seals').put({id:hex, ...data});
  alert('Sealed: ' + hex);
};

function loop() {
  step();
  draw();
  updateOracles();
  requestAnimationFrame(loop);
}
loop();

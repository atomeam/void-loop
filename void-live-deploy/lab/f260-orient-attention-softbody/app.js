const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const cards = [document.getElementById('c1'), document.getElementById('c2'), document.getElementById('c3')];

let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 180;
const particles = Array.from({length: N}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
  mass: 0.8 + Math.random()*0.4
}));

let query = {x: 0, y: 0}; // orientation or mouse bias, normalized-ish
let attnWeights = new Float32Array(N); // from worker
let morph = {scale: 1, hue: 0, border: 0};

const workerBlob = new Blob([`
  let N = 0;
  let positions = null;
  let query = {x:0,y:0};
  onmessage = e => {
    if (e.data.type === 'init') { N = e.data.N; positions = new Float32Array(N*2); }
    if (e.data.type === 'step') {
      positions.set(e.data.pos);
      query = e.data.query;
      const weights = new Float32Array(N);
      // Tiny single-head attention: query vs position keys (centered)
      let cx=0, cy=0;
      for (let i=0;i<N;i++){ cx+=positions[i*2]; cy+=positions[i*2+1]; }
      cx/=N; cy/=N;
      let sum = 0;
      for (let i=0;i<N;i++){
        const dx = positions[i*2]-cx, dy = positions[i*2+1]-cy;
        const k = Math.hypot(dx,dy) || 1;
        // Dot with query direction (scaled)
        const qx = query.x * 80, qy = query.y * 80;
        const score = (dx*qx + dy*qy) / (k * 100 + 1);
        weights[i] = Math.exp(score * 2.5); // softmax-like
        sum += weights[i];
      }
      if (sum > 0) for (let i=0;i<N;i++) weights[i] /= sum;
      postMessage({type:'attn', weights});
    }
  };
`], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(workerBlob));
worker.onmessage = e => {
  if (e.data.type === 'attn') attnWeights = e.data.weights;
};

worker.postMessage({type:'init', N});

function stepPhysics() {
  // Soft-body: attraction to high-attention neighbors + damping + query bias
  const pos = new Float32Array(N*2);
  for (let i=0;i<N;i++){ pos[i*2]=particles[i].x; pos[i*2+1]=particles[i].y; }
  worker.postMessage({type:'step', pos, query});

  // Apply forces
  for (let i=0;i<N;i++){
    const p = particles[i];
    let fx=0, fy=0;
    // Attract toward weighted center of mass of high-attn particles
    let wcx=0, wcy=0, wsum=0;
    for (let j=0;j<N;j++){
      if (attnWeights[j] > 0.002){
        wcx += particles[j].x * attnWeights[j];
        wcy += particles[j].y * attnWeights[j];
        wsum += attnWeights[j];
      }
    }
    if (wsum > 0){
      wcx/=wsum; wcy/=wsum;
      const dx = wcx - p.x, dy = wcy - p.y;
      const dist = Math.hypot(dx,dy) || 1;
      const strength = attnWeights[i] * 0.8;
      fx += (dx/dist) * strength * 40;
      fy += (dy/dist) * strength * 40;
    }
    // Query bias as continuous force
    fx += query.x * 12;
    fy += query.y * 12;
    // Damping
    p.vx = (p.vx + fx / p.mass) * 0.96;
    p.vy = (p.vy + fy / p.mass) * 0.96;
    p.x += p.vx;
    p.y += p.vy;
    // Soft bounds
    if (p.x < 10) p.vx += 2;
    if (p.x > W-10) p.vx -= 2;
    if (p.y < 10) p.vy += 2;
    if (p.y > H-10) p.vy -= 2;
  }

  // Morph UI from attention entropy / concentration
  let ent = 0, maxw = 0;
  for (let i=0;i<N;i++){
    const w = attnWeights[i] || 1/N;
    ent -= w * Math.log(w + 1e-8);
    if (w > maxw) maxw = w;
  }
  morph.hue = (morph.hue + maxw * 8) % 360;
  morph.scale = 1 + maxw * 0.6;
  morph.border = Math.min(8, maxw * 20);
  document.body.style.filter = `hue-rotate(${morph.hue}deg)`;
  document.body.style.transform = `scale(${morph.scale})`;
  cards.forEach((c,i) => {
    const t = Math.sin(performance.now()*0.001 + i) * morph.border;
    c.style.transform = `translateY(${t}px) scale(${1 + maxw*0.15})`;
    c.style.borderColor = `hsl(${(morph.hue + i*40)%360}, 70%, 60%)`;
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for (let i=0;i<N;i++){
    const p = particles[i];
    const a = attnWeights[i] || 0;
    const r = 2 + a * 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${(morph.hue + a*120)%360}, 80%, ${50 + a*40}%, ${0.4 + a*0.6})`;
    ctx.fill();
    // faint trail
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx*3, p.y - p.vy*3);
    ctx.strokeStyle = `hsla(${morph.hue}, 60%, 60%, ${a*0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

let mouseX=0, mouseY=0;
canvas.addEventListener('pointermove', e => {
  mouseX = (e.clientX / W - 0.5) * 2;
  mouseY = (e.clientY / H - 0.5) * 2;
  query.x = mouseX; query.y = mouseY;
});
canvas.addEventListener('pointerdown', e => { /* seed */ });

// DeviceOrientation as primary query when available
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.gamma != null) {
      query.x = Math.max(-1, Math.min(1, e.gamma / 45));
      query.y = Math.max(-1, Math.min(1, (e.beta || 0) / 45));
    }
  });
}

document.getElementById('seal').onclick = async () => {
  const genome = {query: {...query}, morph: {...morph}, ts: Date.now(), weightsHash: Array.from(attnWeights.slice(0,8)).map(w=>w.toFixed(4)).join(',')};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f260', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(genome, 'latest');
    status.textContent = 'Sealed to IndexedDB';
  } catch(err) { status.textContent = 'Seal failed: ' + err.message; }
};

document.getElementById('reset').onclick = () => {
  particles.forEach(p => { p.x = Math.random()*W; p.y = Math.random()*H; p.vx=p.vy=0; });
  status.textContent = 'Reset';
};

function loop() {
  stepPhysics();
  draw();
  status.textContent = `Q(${query.x.toFixed(2)},${query.y.toFixed(2)}) · maxAttn ${(Math.max(...attnWeights)||0).toFixed(3)} · N=${N}`;
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'Running (Canvas2D + Worker attention). WebGPU path noted in SPEC.';

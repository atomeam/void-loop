const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

let tilt = {x:0, y:0};
addEventListener('deviceorientation', e => {
  tilt.x = (e.gamma || 0) / 45;
  tilt.y = (e.beta || 0) / 45;
});
addEventListener('mousemove', e => {
  tilt.x = (e.clientX / W - 0.5) * 2;
  tilt.y = (e.clientY / H - 0.5) * 2;
});

const N = 40;
const agents = [];
let resource = {x: W/2, y: H/2, r: 12};
let gen = 0;
let sealed = [];

function randomGenome() {
  const g = new Float32Array(6*8 + 8*2 + 8 + 2); // weights + biases
  for (let i=0; i<g.length; i++) g[i] = (Math.random()-0.5)*0.5;
  return g;
}
function mutate(g, rate=0.15) {
  const n = new Float32Array(g);
  for (let i=0; i<n.length; i++) if (Math.random()<rate) n[i] += (Math.random()-0.5)*0.3;
  return n;
}
function mlp(g, inp) {
  // 6 -> 8 -> 2
  const h = new Float32Array(8);
  let o=0;
  for (let i=0; i<8; i++) {
    let s = g[6*8 + i]; // bias
    for (let j=0; j<6; j++) s += inp[j] * g[j*8 + i];
    h[i] = Math.tanh(s);
  }
  const out = new Float32Array(2);
  for (let i=0; i<2; i++) {
    let s = g[6*8 + 8 + i];
    for (let j=0; j<8; j++) s += h[j] * g[6*8 + 8 + 2 + j*2 + i];
    out[i] = Math.tanh(s);
  }
  return out;
}
function hashGenome(g) {
  let h = 0;
  for (let i=0; i<g.length; i++) h = (h * 31 + Math.round(g[i]*1000)) | 0;
  return (h >>> 0).toString(16);
}

function spawnAgent(g) {
  return {
    x: Math.random()*W, y: Math.random()*H,
    vx:0, vy:0, genome: g || randomGenome(), fitness:0, id: Math.random()
  };
}
for (let i=0; i<N; i++) agents.push(spawnAgent());

function step() {
  // resource wander
  resource.x += (Math.random()-0.5)*4;
  resource.y += (Math.random()-0.5)*4;
  resource.x = Math.max(20, Math.min(W-20, resource.x));
  resource.y = Math.max(20, Math.min(H-20, resource.y));

  for (const a of agents) {
    const dx = (resource.x - a.x)/W;
    const dy = (resource.y - a.y)/H;
    const dist = Math.hypot(dx, dy);
    const inp = [dx, dy, a.vx/10, a.vy/10, tilt.x, tilt.y];
    const f = mlp(a.genome, inp);
    a.vx += f[0]*0.4 + tilt.x*0.15;
    a.vy += f[1]*0.4 + tilt.y*0.15;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    if (a.x<0||a.x>W) a.vx *= -0.5;
    if (a.y<0||a.y>H) a.vy *= -0.5;
    a.x = Math.max(0, Math.min(W, a.x));
    a.y = Math.max(0, Math.min(H, a.y));
    if (Math.hypot(a.x-resource.x, a.y-resource.y) < 20) {
      a.fitness += 1;
      resource.x = Math.random()*W;
      resource.y = Math.random()*H;
    }
  }
}

let lastEvo = performance.now();
function evolve() {
  agents.sort((a,b)=>b.fitness - a.fitness);
  const keep = Math.floor(N/2);
  for (let i=keep; i<N; i++) {
    const parent = agents[Math.floor(Math.random()*keep)];
    agents[i] = spawnAgent(mutate(parent.genome));
    agents[i].fitness = 0;
  }
  for (let i=0; i<keep; i++) agents[i].fitness *= 0.5;
  gen++;
  document.getElementById('status').textContent = `Gen ${gen} · best fitness ${agents[0].fitness.toFixed(0)} · tilt ${tilt.x.toFixed(2)},${tilt.y.toFixed(2)}`;
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,W,H);
  // resource
  ctx.fillStyle = '#0f0';
  ctx.beginPath(); ctx.arc(resource.x, resource.y, resource.r, 0, Math.PI*2); ctx.fill();
  // agents
  for (const a of agents) {
    const hue = (a.fitness * 20) % 360;
    ctx.fillStyle = `hsl(${hue},80%,60%)`;
    ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI*2); ctx.fill();
  }
}

function loop() {
  step();
  if (performance.now() - lastEvo > 8000) { evolve(); lastEvo = performance.now(); }
  draw();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB
let db;
const req = indexedDB.open('F324Genomes', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath: 'hash'});
req.onsuccess = e => db = e.target.result;

document.getElementById('seal').onclick = () => {
  if (!db) return;
  agents.sort((a,b)=>b.fitness-a.fitness);
  const top = agents.slice(0,3);
  const tx = db.transaction('genomes','readwrite');
  top.forEach(a => {
    const hash = hashGenome(a.genome);
    tx.objectStore('genomes').put({hash, genome: Array.from(a.genome), fitness: a.fitness, ts: Date.now()});
  });
  document.getElementById('status').textContent = 'Sealed top 3 genomes to IndexedDB';
};
document.getElementById('load').onclick = () => {
  if (!db) return;
  db.transaction('genomes').objectStore('genomes').getAll().onsuccess = e => {
    const stored = e.target.result;
    if (!stored.length) return;
    stored.sort((a,b)=>b.fitness-a.fitness);
    for (let i=0; i<Math.min(10, stored.length); i++) {
      agents[i].genome = new Float32Array(stored[i].genome);
      agents[i].fitness = 0;
    }
    document.getElementById('status').textContent = `Loaded ${Math.min(10,stored.length)} sealed genomes`;
  };
};
document.getElementById('reset').onclick = () => {
  agents.length = 0;
  for (let i=0; i<N; i++) agents.push(spawnAgent());
  gen = 0;
};

// Minimal WebRTC sealed transfer (manual signaling)
let pc, dc;
function setupRTC() {
  pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  dc = pc.createDataChannel('genome');
  dc.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.genome) {
        const g = new Float32Array(msg.genome);
        agents[0].genome = g;
        agents[0].fitness = 0;
        document.getElementById('status').textContent = 'Received sealed genome via WebRTC';
      }
    } catch {}
  };
  pc.onicecandidate = e => { if (e.candidate) console.log('ICE', e.candidate.candidate); };
}
document.getElementById('offer').onclick = async () => {
  setupRTC();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const txt = JSON.stringify(pc.localDescription);
  prompt('Copy offer and send to peer:', txt);
};
document.getElementById('answer').onclick = async () => {
  const ans = prompt('Paste peer answer:');
  if (!ans) return;
  if (!pc) setupRTC();
  await pc.setRemoteDescription(JSON.parse(ans));
  if (dc && dc.readyState === 'open') {
    agents.sort((a,b)=>b.fitness-a.fitness);
    dc.send(JSON.stringify({genome: Array.from(agents[0].genome), hash: hashGenome(agents[0].genome)}));
  }
};

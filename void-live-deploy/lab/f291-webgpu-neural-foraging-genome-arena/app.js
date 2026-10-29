const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 10;
const agents = [];
let resource = { x: W/2, y: H/2 };
let pointer = { x: W/2, y: H/2 };
let generation = 0;
let champion = null;

function hashGenome(g) {
  let h = 0;
  for (let v of g) h = (h * 31 + Math.round(v*1000)) | 0;
  return (h >>> 0).toString(16).slice(0,6);
}

function makeAgent(g) {
  const genome = g || Float32Array.from({length:4}, () => Math.random()*1.5 - 0.2);
  return {
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0,
    genome,
    fitness: 0,
    age: 0,
    size: 8 + genome[2]*6,
    color: `hsl(${(genome[0]*120 + 180)|0},70%,55%)`
  };
}

function initPop(seed) {
  agents.length = 0;
  for (let i = 0; i < N; i++) agents.push(makeAgent(seed ? seed.slice() : null));
  if (seed) champion = seed;
}
initPop();

// Pointer
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

// DOM probes
const probes = [];
for (let i = 0; i < 3; i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.textContent = 'probe';
  document.body.appendChild(el);
  probes.push({ el, target: null, dragging: false, ox:0, oy:0 });
  el.addEventListener('pointerdown', e => {
    probes[i].dragging = true;
    probes[i].ox = e.clientX - el.offsetLeft;
    probes[i].oy = e.clientY - el.offsetTop;
    e.preventDefault();
  });
}
addEventListener('pointerup', e => {
  probes.forEach(p => {
    if (p.dragging) {
      p.dragging = false;
      // reward nearest
      let best = agents[0], bd = 1e9;
      agents.forEach(a => {
        const d = Math.hypot(a.x - e.clientX, a.y - e.clientY);
        if (d < bd) { bd = d; best = a; }
      });
      if (bd < 80) best.fitness += 5;
    }
  });
});
addEventListener('pointermove', e => {
  probes.forEach(p => {
    if (p.dragging) {
      p.el.style.left = (e.clientX - p.ox) + 'px';
      p.el.style.top = (e.clientY - p.oy) + 'px';
    }
  });
});

// IndexedDB
let db;
const req = indexedDB.open('F291arena', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('champ', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; loadChamp(); };
function sealChamp() {
  if (!db || !champion) return;
  const tx = db.transaction('champ', 'readwrite');
  tx.objectStore('champ').put({ id:1, genome: Array.from(champion), gen: generation });
  document.getElementById('status').textContent = 'Sealed champion gen ' + generation;
}
function loadChamp() {
  if (!db) return;
  const tx = db.transaction('champ', 'readonly');
  const g = tx.objectStore('champ').get(1);
  g.onsuccess = () => {
    if (g.result) {
      champion = Float32Array.from(g.result.genome);
      generation = g.result.gen || 0;
      initPop(champion);
      document.getElementById('status').textContent = 'Loaded champion gen ' + generation;
    }
  };
}
document.getElementById('seal').onclick = () => {
  // pick best
  let best = agents[0];
  agents.forEach(a => { if (a.fitness > best.fitness) best = a; });
  champion = best.genome.slice();
  generation++;
  sealChamp();
};
document.getElementById('load').onclick = loadChamp;
document.getElementById('reset').onclick = () => { generation = 0; initPop(); };

// Optional WebGPU prepare
async function tryWebGPU() {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    // minimal compute module prepared (not dispatched every frame to keep simple)
    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3u) {
          let i = gid.x;
          if (i < arrayLength(&data)) { data[i] = data[i] * 0.99; }
        }`
    });
    console.log('WebGPU neural kernel path ready', module);
    document.getElementById('status').textContent += ' | WebGPU ready';
  } catch(e) {}
}
tryWebGPU();

function step() {
  // resource lag
  resource.x += (pointer.x - resource.x) * 0.15;
  resource.y += (pointer.y - resource.y) * 0.15;

  const meanX = agents.reduce((s,a)=>s+a.x,0)/N;
  const meanY = agents.reduce((s,a)=>s+a.y,0)/N;

  agents.forEach(a => {
    a.age++;
    const dx = resource.x - a.x, dy = resource.y - a.y;
    const dist = Math.hypot(dx,dy) || 1;
    const dirx = dx/dist, diry = dy/dist;
    // neural force kernel from genome
    const attract = a.genome[0];
    const noise = a.genome[1];
    const coh = a.genome[3] || 0.3;
    a.vx += dirx * attract * 0.4 + (Math.random()-0.5)*noise*0.3 + (meanX - a.x)*coh*0.01;
    a.vy += diry * attract * 0.4 + (Math.random()-0.5)*noise*0.3 + (meanY - a.y)*coh*0.01;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    // bounce
    if (a.x < 10 || a.x > W-10) a.vx *= -0.8;
    if (a.y < 10 || a.y > H-10) a.vy *= -0.8;
    a.x = Math.max(10, Math.min(W-10, a.x));
    a.y = Math.max(10, Math.min(H-10, a.y));
    // fitness from proximity
    a.fitness += Math.max(0, 80 - dist) * 0.002;
  });

  // competitive transfer
  for (let i = 0; i < N; i++) {
    for (let j = i+1; j < N; j++) {
      const a = agents[i], b = agents[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < 28) {
        const winner = a.fitness > b.fitness ? a : b;
        const loser = winner === a ? b : a;
        if (winner.fitness > loser.fitness + 1) {
          for (let k = 0; k < 4; k++) {
            loser.genome[k] = loser.genome[k]*0.6 + winner.genome[k]*0.4 + (Math.random()-0.5)*0.05;
          }
          loser.size = 8 + loser.genome[2]*6;
          loser.color = `hsl(${(loser.genome[0]*120 + 180)|0},70%,55%)`;
          loser.fitness *= 0.7;
        }
      }
    }
  }

  // draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  // resource
  ctx.beginPath(); ctx.arc(resource.x, resource.y, 12, 0, Math.PI*2);
  ctx.fillStyle = '#ffaa33'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.stroke();

  agents.forEach(a => {
    ctx.beginPath(); ctx.arc(a.x, a.y, a.size, 0, Math.PI*2);
    ctx.fillStyle = a.color; ctx.fill();
    ctx.strokeStyle = '#fff3'; ctx.stroke();
  });

  // probes track top by fitness
  const sorted = [...agents].sort((a,b)=>b.fitness - a.fitness);
  probes.forEach((p, i) => {
    if (!p.dragging && sorted[i]) {
      const t = sorted[i];
      p.el.style.left = (t.x + 12) + 'px';
      p.el.style.top = (t.y - 20) + 'px';
      p.el.textContent = hashGenome(t.genome) + '\nfit:' + t.fitness.toFixed(1);
      p.el.style.borderColor = t.color;
    }
  });

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

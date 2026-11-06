const canvas = document.getElementById('c');
const status = document.getElementById('status');
const cards = [...document.querySelectorAll('.card')];
let device, context, pipeline, bindGroup, uniformBuffer, genomeBuffer;
let pop = [], best = null, fitnessHist = [];
let carves = []; // {x,y,r,life}
let frame = 0;
const POP = 8;
const GENE_LEN = 18; // 3 ellipsoids * 6 (cx,cy,cz,rx,ry,rz)

function randGene() {
  const g = new Float32Array(GENE_LEN);
  for (let i = 0; i < GENE_LEN; i++) g[i] = (Math.random()-0.5)*1.6;
  return g;
}
function clone(g) { return new Float32Array(g); }
function mutate(g, rate=0.15) {
  const n = clone(g);
  for (let i = 0; i < n.length; i++) if (Math.random() < rate) n[i] += (Math.random()-0.5)*0.4;
  for (let i = 0; i < n.length; i++) n[i] = Math.max(-2, Math.min(2, n[i]));
  return n;
}

async function initGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU unavailable — fallback'; return fallback(); }
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const fullShader = `
struct Uniforms { resolution: vec2f, time: f32, carveCount: f32 };
struct Genome { genes: array<f32,18> };
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> genome: Genome;
@group(0) @binding(2) var<storage, read> carves: array<vec4f>;

fn sdEllipsoid(p: vec3f, r: vec3f) -> f32 {
  let k0 = length(p / r);
  let k1 = length(p / (r*r));
  return k0 * (k0 - 1.0) / k1;
}
fn scene(p: vec3f) -> f32 {
  var d = 10.0;
  for (var i = 0u; i < 3u; i++) {
    let o = vec3f(genome.genes[i*6], genome.genes[i*6+1], genome.genes[i*6+2]);
    let r = abs(vec3f(genome.genes[i*6+3], genome.genes[i*6+4], genome.genes[i*6+5])) + 0.3;
    d = min(d, sdEllipsoid(p - o, r));
  }
  let cc = u32(min(u.carveCount, 16.0));
  for (var j = 0u; j < cc; j++) {
    let c = carves[j];
    d = max(d, -(length(p.xy - c.xy) - c.z * c.w));
  }
  return d;
}
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let x = f32((i << 1u) & 2u) - 1.0;
  let y = f32(i & 2u) - 1.0;
  return vec4f(x * 2.0, y * 2.0, 0, 1);
}
@fragment
fn main(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let uv = (frag.xy / u.resolution) * 2.0 - 1.0;
  var ro = vec3f(0.0, 0.0, -3.5);
  var rd = normalize(vec3f(uv.x, uv.y, 1.2));
  var t = 0.0;
  var hit = false;
  for (var i = 0; i < 40; i++) {
    let p = ro + rd * t;
    let d = scene(p);
    if (d < 0.005) { hit = true; break; }
    t += d * 0.9;
    if (t > 6.0) break;
  }
  if (!hit) { return vec4f(0.04, 0.05, 0.12, 1.0); }
  let p = ro + rd * t;
  let e = 0.015;
  let n = normalize(vec3f(
    scene(p+vec3f(e,0,0))-scene(p-vec3f(e,0,0)),
    scene(p+vec3f(0,e,0))-scene(p-vec3f(0,e,0)),
    scene(p+vec3f(0,0,e))-scene(p-vec3f(0,0,e))
  ));
  let col = vec3f(0.35, 0.55, 1.0) * (0.35 + 0.65 * max(0.0, dot(n, normalize(vec3f(0.8,1.0,0.6)))));
  return vec4f(col, 1.0);
}
`;
  const mod2 = device.createShaderModule({ code: fullShader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: mod2, entryPoint: 'vs' },
    fragment: { module: mod2, entryPoint: 'main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  genomeBuffer = device.createBuffer({ size: GENE_LEN * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const carveBuffer = device.createBuffer({ size: 64 * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: genomeBuffer } },
      { binding: 2, resource: { buffer: carveBuffer } }
    ]
  });
  window._carveBuffer = carveBuffer;
  status.textContent = 'WebGPU ready';
  loop();
}

function coverageFitness(genome) {
  // Approximate: project ellipsoid centers to screen and score proximity to card centers
  let score = 0;
  const w = canvas.width, h = canvas.height;
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const cx = (r.left + r.width/2) / w * 2 - 1;
    const cy = -((r.top + r.height/2) / h * 2 - 1);
    for (let i = 0; i < 3; i++) {
      const gx = genome[i*6], gy = genome[i*6+1];
      const dist = Math.hypot(gx - cx*1.5, gy - cy*1.5);
      score += Math.max(0, 1.2 - dist);
    }
  }
  return score / (cards.length * 3);
}

function evolve() {
  if (!best) return;
  const fit = coverageFitness(best);
  fitnessHist.push(fit);
  // simple (1+λ)
  const candidates = [best];
  for (let i = 0; i < 4; i++) candidates.push(mutate(best, 0.2 + Math.random()*0.1));
  let winner = candidates[0], wf = -1;
  for (const c of candidates) {
    const f = coverageFitness(c);
    if (f > wf) { wf = f; winner = c; }
  }
  best = winner;
  status.textContent = `fit ${fit.toFixed(2)} · gen ${Math.floor(frame/30)}`;
}

function loop() {
  frame++;
  if (!device) return;
  const w = canvas.width = innerWidth, h = canvas.height = innerHeight;
  if (frame % 30 === 0) evolve();
  device.queue.writeBuffer(genomeBuffer, 0, best);
  const u = new Float32Array([w, h, performance.now()/1000, carves.length]);
  device.queue.writeBuffer(uniformBuffer, 0, u);
  const carveData = new Float32Array(64*4);
  carves.forEach((c,i) => {
    if (i>=64) return;
    carveData[i*4] = c.x; carveData[i*4+1] = c.y; carveData[i*4+2] = c.r; carveData[i*4+3] = c.life;
    c.life *= 0.98;
  });
  carves = carves.filter(c => c.life > 0.05);
  device.queue.writeBuffer(window._carveBuffer, 0, carveData);
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp:'clear', storeOp:'store', clearValue:[0.04,0.05,0.1,1] }] });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(3);
  pass.end();
  device.queue.submit([enc.finish()]);
  requestAnimationFrame(loop);
}

function fallback() {
  const ctx = canvas.getContext('2d');
  function floop() {
    canvas.width = innerWidth; canvas.height = innerHeight;
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(0,0,canvas.width,canvas.height);
    if (best) {
      for (let i=0;i<3;i++) {
        const x = (best[i*6]+1)*canvas.width/2, y = (1-best[i*6+1])*canvas.height/2;
        const r = (Math.abs(best[i*6+3])+0.5)*80;
        ctx.beginPath(); ctx.arc(x,y,r,0,6.28); ctx.fillStyle='rgba(80,140,255,0.4)'; ctx.fill();
      }
    }
    if (frame%30===0) evolve();
    requestAnimationFrame(floop);
  }
  floop();
}

canvas.addEventListener('pointerdown', e => {
  const x = (e.clientX / innerWidth)*2 - 1;
  const y = -((e.clientY / innerHeight)*2 - 1);
  carves.push({ x: x*1.5, y: y*1.5, r: 0.4, life: 1 });
});

document.getElementById('seal').onclick = () => {
  if (!best) return;
  const fit = coverageFitness(best);
  const hash = Array.from(best).reduce((a,v)=>a + Math.abs(v)*1000|0, 0);
  try {
    const req = indexedDB.open('f544',1);
    req.onsuccess = ev => {
      const db = ev.target.result;
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put({ id:1, genes: Array.from(best), fitness: fit, hash });
    };
    req.onupgradeneeded = ev => ev.target.result.createObjectStore('genomes',{keyPath:'id'});
  } catch (e) { console.debug("lab f544-webgpu-sdf-evo-dom-coverage-mind:", e); }
  const bc = new BroadcastChannel('f544-genome');
  bc.postMessage({ genes: Array.from(best), fitness: fit, hash });
  status.textContent = `sealed fit ${fit.toFixed(2)}`;
};
document.getElementById('reset').onclick = () => { best = randGene(); };

const bc = new BroadcastChannel('f544-genome');
bc.onmessage = ev => {
  const { genes, fitness, hash } = ev.data;
  if (!best || fitness > coverageFitness(best)) {
    best = new Float32Array(genes);
    status.textContent = 'adopted external genome';
  }
};

// init
best = randGene();
pop = Array.from({length:POP}, randGene);
initGPU();
// try load
try {
  const req = indexedDB.open('f544',1);
  req.onsuccess = ev => {
    const db = ev.target.result;
    if (!db.objectStoreNames.contains('genomes')) return;
    const tx = db.transaction('genomes');
    const g = tx.objectStore('genomes').get(1);
    g.onsuccess = () => { if (g.result) best = new Float32Array(g.result.genes); };
  };
} catch (e) { console.debug("lab f544-webgpu-sdf-evo-dom-coverage-mind:", e); }

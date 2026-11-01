const N = 64;
const AGENTS = 5;
const CARDS = 6;
let buffer = new Float32Array(N);
let idx = 0;
let agents = [];
let cards = [];
let energy = 0.3;
let gpu = null;
let db;

function makeMLP() {
  return {
    w1: Array.from({length:4*6}, () => Math.random()*0.4-0.2),
    b1: Array(6).fill(0),
    w2: Array.from({length:6*3}, () => Math.random()*0.4-0.2),
    b2: Array(3).fill(0),
    fitness: 0,
    x: Math.random()*0.8+0.1,
    y: Math.random()*0.8+0.1
  };
}

function forward(mlp, inp) {
  const h = [];
  for (let i=0;i<6;i++) {
    let s = mlp.b1[i];
    for (let j=0;j<4;j++) s += inp[j]*mlp.w1[i*4+j];
    h.push(Math.tanh(s));
  }
  const o = [];
  for (let i=0;i<3;i++) {
    let s = mlp.b2[i];
    for (let j=0;j<6;j++) s += h[j]*mlp.w2[i*6+j];
    o.push(Math.tanh(s));
  }
  return o;
}

function mutate(mlp) {
  const m = JSON.parse(JSON.stringify(mlp));
  const rate = 0.15;
  m.w1 = m.w1.map(v => v + (Math.random()-0.5)*rate);
  m.w2 = m.w2.map(v => v + (Math.random()-0.5)*rate);
  return m;
}

function haar(buf) {
  const n = buf.length;
  const out = new Float32Array(4);
  let sum = 0, detail = 0;
  for (let i=0;i<n;i+=2) {
    sum += (buf[i]+buf[i+1])/2;
    detail += (buf[i]-buf[i+1])/2;
  }
  out[0] = sum/n*2;
  out[1] = detail/n*2;
  out[2] = Math.max(...buf.slice(0,n/2)) - Math.min(...buf.slice(0,n/2));
  out[3] = Math.max(...buf.slice(n/2)) - Math.min(...buf.slice(n/2));
  return out;
}

async function initGPU() {
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read> input: array<f32>;
        @group(0) @binding(1) var<storage, read_write> output: array<f32>;
        @compute @workgroup_size(1)
        fn main() {
          var sum: f32 = 0.0;
          var detail: f32 = 0.0;
          for (var i: u32 = 0u; i < 64u; i += 2u) {
            sum += (input[i] + input[i+1]) * 0.5;
            detail += (input[i] - input[i+1]) * 0.5;
          }
          output[0] = sum / 32.0;
          output[1] = detail / 32.0;
          output[2] = 0.0; output[3] = 0.0;
        }
      `
    });
    const pipeline = device.createComputePipeline({ layout:'auto', compute:{ module, entryPoint:'main' } });
    const inBuf = device.createBuffer({ size:N*4, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST });
    const outBuf = device.createBuffer({ size:16, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC });
    const readBuf = device.createBuffer({ size:16, usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ });
    const bind = device.createBindGroup({ layout:pipeline.getBindGroupLayout(0), entries:[
      { binding:0, resource:{ buffer:inBuf } },
      { binding:1, resource:{ buffer:outBuf } }
    ]});
    return { device, pipeline, inBuf, outBuf, readBuf, bind };
  } catch(e) { return null; }
}

async function runWavelet() {
  if (!gpu) return haar(buffer);
  gpu.device.queue.writeBuffer(gpu.inBuf, 0, buffer);
  const enc = gpu.device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(gpu.pipeline);
  pass.setBindGroup(0, gpu.bind);
  pass.dispatchWorkgroups(1);
  pass.end();
  enc.copyBufferToBuffer(gpu.outBuf, 0, gpu.readBuf, 0, 16);
  gpu.device.queue.submit([enc.finish()]);
  await gpu.readBuf.mapAsync(GPUMapMode.READ);
  const res = new Float32Array(gpu.readBuf.getMappedRange().slice(0));
  gpu.readBuf.unmap();
  return res;
}

function initCards() {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  cards = [];
  const labels = ['Wavelet','MLP','Genome','DOM','Seal','Verse'];
  for (let i=0;i<CARDS;i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = labels[i];
    el.style.setProperty('--h', 180 + i*30);
    g.appendChild(el);
    cards.push({ el, agent: i % AGENTS, x: (i%3)/3 + 0.15, y: Math.floor(i/3)/2 + 0.25 });
  }
}

function update() {
  runWavelet().then(coeffs => {
    energy = Math.min(1, Math.abs(coeffs[0]) + Math.abs(coeffs[1])*2);
    document.documentElement.style.setProperty('--energy', energy.toFixed(3));
    document.documentElement.style.setProperty('--hue', (200 + energy*80).toFixed(0));

    agents.forEach((a, ai) => {
      const out = forward(a, coeffs);
      a.fitness = 0;
      cards.forEach(c => {
        if (c.agent === ai) {
          const dx = (c.x - 0.5)*out[0]*20;
          const dy = (c.y - 0.5)*out[0]*20;
          c.el.style.setProperty('--s', (1 + out[0]*0.3).toFixed(3));
          c.el.style.setProperty('--tx', dx.toFixed(1)+'px');
          c.el.style.setProperty('--ty', dy.toFixed(1)+'px');
          c.el.style.setProperty('--b', (Math.abs(out[1])*2).toFixed(1)+'px');
          c.el.style.setProperty('--h', (180 + out[2]*60 + ai*20).toFixed(0));
          const dist = Math.hypot(c.x - 0.5, c.y - 0.5);
          a.fitness += (1 - dist) * (1 + energy);
        }
      });
    });

    for (let i=0;i<agents.length;i++) {
      for (let j=i+1;j<agents.length;j++) {
        const d = Math.hypot(agents[i].x-agents[j].x, agents[i].y-agents[j].y);
        if (d < 0.15 && agents[i].fitness > agents[j].fitness * 1.3) {
          agents[j] = mutate(agents[i]);
          agents[j].x = Math.random()*0.8+0.1;
          agents[j].y = Math.random()*0.8+0.1;
        }
      }
    }
  });
  requestAnimationFrame(update);
}

function seal() {
  const state = { buffer: Array.from(buffer), agents: agents.map(a => ({...a, w1:[...a.w1], w2:[...a.w2]})) };
  const tx = db.transaction('s','readwrite');
  tx.objectStore('s').put(state, 'state');
  document.getElementById('status').textContent = 'sealed';
}

function restore() {
  const tx = db.transaction('s');
  const req = tx.objectStore('s').get('state');
  req.onsuccess = () => {
    if (req.result) {
      buffer.set(req.result.buffer);
      agents = req.result.agents;
      document.getElementById('status').textContent = 'restored';
    }
  };
}

window.addEventListener('pointermove', e => {
  const vx = (e.movementX||0)/10;
  const vy = (e.movementY||0)/10;
  buffer[idx] = Math.hypot(vx,vy);
  idx = (idx+1)%N;
});

document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('reset').onclick = () => { buffer.fill(0); agents = Array.from({length:AGENTS}, makeMLP); };

(async () => {
  gpu = await initGPU();
  agents = Array.from({length:AGENTS}, makeMLP);
  initCards();
  const req = indexedDB.open('f0483',1);
  req.onupgradeneeded = () => req.result.createObjectStore('s');
  req.onsuccess = () => { db = req.result; update(); };
})();

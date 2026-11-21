const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
let items = [];
let gravity = {x:0, y:1};
let device, queue, pipeline, bindGroupLayout;
let gpuReady = false;

// WebGPU setup for parallel fitness
async function initGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU unavailable – CPU mode'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    const shader = `
@group(0) @binding(0) var<storage, read> layouts: array<vec4f>; // x,y,w,h per item, flattened
@group(0) @binding(1) var<storage, read_write> fitness: array<f32>;
@group(0) @binding(2) var<uniform> params: vec4f; // nItems, popSize, gravX, gravY
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let pop = u32(params.y);
  let n = u32(params.x);
  let idx = gid.x;
  if (idx >= pop) { return; }
  var score = 0.0;
  let base = idx * n;
  // bounding box + gravity bias
  var minx=1e9; var maxx=-1e9; var miny=1e9; var maxy=-1e9;
  for (var i=0u; i<n; i=i+1u) {
    let p = layouts[base + i];
    minx = min(minx, p.x); maxx = max(maxx, p.x + p.z);
    miny = min(miny, p.y); maxy = max(maxy, p.y + p.w);
    score += (p.x * params.z + p.y * params.w) * 0.01; // gravity preference
  }
  let area = (maxx-minx) * (maxy-miny);
  score += area * 0.001;
  // pairwise overlaps
  for (var i=0u; i<n; i=i+1u) {
    let a = layouts[base + i];
    for (var j=i+1u; j<n; j=j+1u) {
      let b = layouts[base + j];
      let ox = max(0.0, min(a.x+a.z, b.x+b.z) - max(a.x, b.x));
      let oy = max(0.0, min(a.y+a.w, b.y+b.w) - max(a.y, b.y));
      score += ox * oy * 10.0; // heavy penalty
    }
  }
  fitness[idx] = score;
}
`;
    const module = device.createShaderModule({code: shader});
    bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {binding:0, visibility:GPUShaderStage.COMPUTE, buffer:{type:'read-only-storage'}},
        {binding:1, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'}},
        {binding:2, visibility:GPUShaderStage.COMPUTE, buffer:{type:'uniform'}}
      ]
    });
    pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({bindGroupLayouts:[bindGroupLayout]}),
      compute: {module, entryPoint:'main'}
    });
    gpuReady = true;
    status.textContent = 'WebGPU ready – parallel ES fitness';
  } catch(e) { status.textContent = 'WebGPU failed – CPU mode'; }
}
initGPU();

function addCard(text='Note') {
  const id = items.length;
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<input value="${text}"><br><small>drag me</small>`;
  el.style.left = (100 + Math.random()*200) + 'px';
  el.style.top = (100 + Math.random()*200) + 'px';
  el.style.width = '120px';
  canvas.appendChild(el);
  const item = {id, el, text, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w:120, h:60};
  items.push(item);
  makeDraggable(el, item);
  return item;
}

function makeDraggable(el, item) {
  let sx, sy, ox, oy;
  el.onpointerdown = e => {
    sx = e.clientX; sy = e.clientY;
    ox = item.x; oy = item.y;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    item.x = ox + (e.clientX - sx);
    item.y = oy + (e.clientY - sy);
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
  };
}

function currentLayout() {
  return items.map(it => [it.x, it.y, it.w, it.h]);
}

async function evaluatePopulation(popLayouts) { // array of flat arrays
  const n = items.length;
  const pop = popLayouts.length;
  if (!gpuReady || n === 0) return cpuFitness(popLayouts);
  // flatten
  const data = new Float32Array(pop * n * 4);
  popLayouts.forEach((lay, i) => {
    lay.forEach((v, j) => data[i*n*4 + j] = v);
  });
  const layoutBuf = device.createBuffer({size: data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(layoutBuf, 0, data);
  const fitBuf = device.createBuffer({size: pop*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
  const uniBuf = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uniBuf, 0, new Float32Array([n, pop, gravity.x, gravity.y]));
  const bg = device.createBindGroup({layout: bindGroupLayout, entries:[
    {binding:0, resource:{buffer:layoutBuf}},
    {binding:1, resource:{buffer:fitBuf}},
    {binding:2, resource:{buffer:uniBuf}}
  ]});
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(pop/64));
  pass.end();
  const readBuf = device.createBuffer({size: pop*4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
  encoder.copyBufferToBuffer(fitBuf, 0, readBuf, 0, pop*4);
  device.queue.submit([encoder.finish()]);
  await readBuf.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(readBuf.getMappedRange());
  readBuf.unmap();
  return Array.from(result);
}

function cpuFitness(popLayouts) {
  return popLayouts.map(lay => {
    let score = 0;
    const n = items.length;
    let minx=1e9, maxx=-1e9, miny=1e9, maxy=-1e9;
    for (let i=0; i<n; i++) {
      const x=lay[i*4], y=lay[i*4+1], w=lay[i*4+2], h=lay[i*4+3];
      minx=Math.min(minx,x); maxx=Math.max(maxx,x+w);
      miny=Math.min(miny,y); maxy=Math.max(maxy,y+h);
      score += (x*gravity.x + y*gravity.y)*0.01;
    }
    score += (maxx-minx)*(maxy-miny)*0.001;
    for (let i=0; i<n; i++) {
      const a = {x:lay[i*4], y:lay[i*4+1], w:lay[i*4+2], h:lay[i*4+3]};
      for (let j=i+1; j<n; j++) {
        const b = {x:lay[j*4], y:lay[j*4+1], w:lay[j*4+2], h:lay[j*4+3]};
        const ox = Math.max(0, Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y));
        score += ox*oy*10;
      }
    }
    return score;
  });
}

async function optimize() {
  if (items.length < 2) { status.textContent = 'Add at least 2 cards'; return; }
  const n = items.length;
  const popSize = 32;
  let population = [];
  const base = currentLayout().flat();
  for (let p=0; p<popSize; p++) {
    const mut = base.slice();
    for (let i=0; i<n*4; i+=4) {
      mut[i] += (Math.random()-0.5)*40;
      mut[i+1] += (Math.random()-0.5)*40;
    }
    population.push(mut);
  }
  const fits = await evaluatePopulation(population);
  let bestI = 0;
  for (let i=1; i<popSize; i++) if (fits[i] < fits[bestI]) bestI = i;
  const best = population[bestI];
  items.forEach((it, i) => {
    it.x = best[i*4]; it.y = best[i*4+1];
    it.el.style.left = it.x+'px';
    it.el.style.top = it.y+'px';
  });
  status.textContent = `Optimized. Best fitness: ${fits[bestI].toFixed(1)} (lower better)`;
}

function seal() {
  const genome = {layout: currentLayout(), gravity, ts: Date.now()};
  const key = 'verse-f875-layout';
  if (window.indexedDB) {
    const req = indexedDB.open('verse', 1);
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put(genome, key);
    };
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('genomes');
    };
  }
  try { new BroadcastChannel('f875-genome').postMessage(genome); } catch (e) { console.debug("lab f875-webgpu-es-spatial-layout-optimizer:", e); }
  status.textContent = 'Genome sealed';
}

document.getElementById('add').onclick = () => addCard('Task '+(items.length+1));
document.getElementById('opt').onclick = optimize;
document.getElementById('seal').onclick = seal;
document.getElementById('export').onclick = () => {
  const blob = new Blob([JSON.stringify({items: items.map(i=>({text:i.el.querySelector('input').value, x:i.x, y:i.y, w:i.w, h:i.h})), gravity}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'layout.json';
  a.click();
};
document.getElementById('png').onclick = () => {
  status.textContent = 'PNG: use browser screenshot (html2canvas not included to keep offline single-file)';
};

// Orientation bias
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) {
    gravity.x = Math.sin(e.gamma * Math.PI/180) * 0.5;
    gravity.y = Math.sin(e.beta * Math.PI/180) * 0.5;
  }
});

// Start with a few cards
addCard('Idea');
addCard('Task');
addCard('Note');
status.textContent += ' | Drag cards, then Optimize';

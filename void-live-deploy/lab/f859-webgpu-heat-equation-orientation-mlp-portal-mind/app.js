const W = 64, H = 64, N = 4;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let gpu = null, device, pipeline, bindGroup, tempBuffer, nextBuffer;
let mode = '2d';
const portals = [];
let orX = 0, orY = 0, ptrX = 0, ptrY = 0;
const bc = new BroadcastChannel('f859-genome');
const IDB_KEY = 'verse-f859-heat-mlp';

function resize() {
  cv.width = innerWidth; cv.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Simple MLP
function mlp(w, x) {
  const h = new Array(8).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) h[j] += x[i] * w[i*8 + j];
  for (let j = 0; j < 8; j++) h[j] = Math.tanh(h[j]);
  const o = [0,0];
  for (let j = 0; j < 8; j++) for (let k = 0; k < 2; k++) o[k] += h[j] * w[32 + j*2 + k];
  return o.map(v => Math.tanh(v));
}

function randWeights() {
  return Array.from({length: 4*8 + 8*2}, () => (Math.random()-0.5)*0.5);
}

async function initGPU() {
  if (!navigator.gpu) return false;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  device = await adapter.requestDevice();
  const shader = `
    @group(0) @binding(0) var<storage, read> temp: array<f32>;
    @group(0) @binding(1) var<storage, read_write> next: array<f32>;
    @compute @workgroup_size(8,8)
    fn main(@builtin(global_invocation_id) gid: vec3u) {
      let i = gid.x + gid.y * ${W};
      if (gid.x >= ${W} || gid.y >= ${H}) return;
      let t = temp[i];
      var n = 0.0;
      if (gid.x > 0) n += temp[i-1];
      if (gid.x < ${W}-1) n += temp[i+1];
      if (gid.y > 0) n += temp[i-${W}];
      if (gid.y < ${H}-1) n += temp[i+${W}];
      next[i] = t * 0.8 + n * 0.05;
    }
  `;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  tempBuffer = device.createBuffer({ size: W*H*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  nextBuffer = device.createBuffer({ size: W*H*4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
  mode = 'gpu';
  return true;
}

const temp = new Float32Array(W*H);
function inject(x, y, s) {
  const ix = Math.floor(x / cv.width * W), iy = Math.floor(y / cv.height * H);
  if (ix>=0 && ix<W && iy>=0 && iy<H) temp[iy*W + ix] += s;
}

function step2d() {
  const next = new Float32Array(W*H);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i = y*W + x;
    let n = 0, c = 0;
    if (x>0) { n += temp[i-1]; c++; }
    if (x<W-1) { n += temp[i+1]; c++; }
    if (y>0) { n += temp[i-W]; c++; }
    if (y<H-1) { n += temp[i+W]; c++; }
    next[i] = temp[i]*0.85 + (c? n/c : 0)*0.15;
  }
  temp.set(next);
  for (let i=0; i<temp.length; i++) temp[i] *= 0.98;
}

async function stepGPU() {
  if (!device) return step2d();
  device.queue.writeBuffer(tempBuffer, 0, temp);
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  // bind simple
  pass.dispatchWorkgroups(Math.ceil(W/8), Math.ceil(H/8));
  pass.end();
  encoder.copyBufferToBuffer(nextBuffer, 0, tempBuffer, 0, W*H*4);
  device.queue.submit([encoder.finish()]);
  // read back simplified (for demo we fall to 2d often)
  step2d();
}

function createPortals() {
  const cont = document.getElementById('portals');
  for (let i=0; i<N; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'H'+(i+1);
    el.style.left = (20+i*20)+'%';
    el.style.top = (30+i*10)+'%';
    cont.appendChild(el);
    const p = { el, x: parseFloat(el.style.left)/100*cv.width, y: parseFloat(el.style.top)/100*cv.height, w: randWeights(), fitness: 0, heat: 0.5 };
    el.onpointerdown = e => { p.drag = true; e.target.setPointerCapture(e.pointerId); };
    el.onpointermove = e => { if (p.drag) { p.x = e.clientX; p.y = e.clientY; el.style.left = p.x+'px'; el.style.top = p.y+'px'; } };
    el.onpointerup = () => p.drag = false;
    el.onclick = () => { p.fitness += 1; p.w = p.w.map(v => v + (Math.random()-0.5)*0.05); };
    portals.push(p);
  }
}

function update() {
  for (const p of portals) {
    const dx = (ptrX - p.x)/cv.width, dy = (ptrY - p.y)/cv.height;
    const inp = [orX, orY, dx, dy];
    const out = mlp(p.w, inp);
    p.heat = 0.5 + out[0]*0.5;
    p.x += out[1]*2 + orX*5;
    p.y += orY*5;
    p.x = Math.max(40, Math.min(cv.width-40, p.x));
    p.y = Math.max(40, Math.min(cv.height-40, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `scale(${0.8 + p.heat*0.4})`;
    p.el.style.background = `rgba(${100+p.heat*155}, ${80}, ${200-p.heat*100}, 0.3)`;
    inject(p.x, p.y, p.heat * 0.3);
  }
  if (mode === 'gpu') stepGPU(); else step2d();
  // render
  const img = ctx.createImageData(cv.width, cv.height);
  const scaleX = cv.width / W, scaleY = cv.height / H;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const t = Math.min(1, temp[y*W+x]*2);
    const r = Math.floor(t*255), g = Math.floor(t*80), b = Math.floor((1-t)*180);
    for (let dy=0; dy<scaleY; dy++) for (let dx=0; dx<scaleX; dx++) {
      const px = Math.floor(x*scaleX + dx), py = Math.floor(y*scaleY + dy);
      if (px<cv.width && py<cv.height) {
        const i = (py*cv.width + px)*4;
        img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(update);
}

async function seal() {
  const best = portals.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const data = { w: best.w, fitness: best.fitness, ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => { const r = indexedDB.open('verse',1); r.onsuccess = () => res(r.result); r.onerror = rej; r.onupgradeneeded = e => e.target.result.createObjectStore('minds'); });
    const tx = db.transaction('minds','readwrite');
    tx.objectStore('minds').put(data, IDB_KEY);
  } catch (e) { console.debug("lab f859-webgpu-heat-equation-orientation-mlp-portal-mind:", e); }
  bc.postMessage(data);
  document.getElementById('status').textContent = 'Sealed fitness ' + best.fitness.toFixed(1);
}

bc.onmessage = e => {
  if (e.data.fitness > Math.max(...portals.map(p=>p.fitness))) {
    portals.forEach(p => { p.w = e.data.w.slice(); p.fitness = e.data.fitness * 0.9; });
    document.getElementById('status').textContent = 'Adopted superior genome';
  }
};

document.getElementById('seal').onclick = seal;
addEventListener('pointermove', e => { ptrX = e.clientX; ptrY = e.clientY; });
addEventListener('deviceorientation', e => { orX = (e.gamma||0)/90; orY = (e.beta||0)/90; });

createPortals();
initGPU().then(() => update());

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const energySlider = document.getElementById('energy');
let gpu, device, context, computePipeline, renderPipeline, bindGroup, fieldTex, staging;
let fallback = false, gridW = 128, gridH = 128;
let field = new Float32Array(gridW * gridH);
let mlpW1 = Array.from({length: 3*8}, () => (Math.random()-0.5)*0.2);
let mlpB1 = new Array(8).fill(0);
let mlpW2 = Array.from({length: 8*2}, () => (Math.random()-0.5)*0.2);
let mlpB2 = new Array(2).fill(0);
let audioCtx, analyser, micStream, useMic = false;
const portals = [];

function makePortals() {
  const titles = ['Portal α', 'Portal β', 'Portal γ', 'Portal δ', 'Portal ε'];
  titles.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.innerHTML = `<h3>${t}</h3><p>local field</p>`;
    el.style.left = (80 + i * 160) + 'px';
    el.style.top = (120 + (i%2)*140) + 'px';
    document.body.appendChild(el);
    portals.push({el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0});
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el._drag = true; });
    el.addEventListener('pointermove', e => {
      if (!el._drag) return;
      const r = el.getBoundingClientRect();
      portals[i].x = e.clientX - r.width/2;
      portals[i].y = e.clientY - r.height/2;
      const gx = Math.floor(portals[i].x / window.innerWidth * gridW);
      const gy = Math.floor(portals[i].y / window.innerHeight * gridH);
      if (gx>=0 && gx<gridW && gy>=0 && gy<gridH) field[gy*gridW+gx] += 0.4;
    });
    el.addEventListener('pointerup', () => el._drag = false);
  });
}

async function initGPU() {
  if (!navigator.gpu) { fallback = true; return initFallback(); }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    fieldTex = device.createTexture({
      size: [gridW, gridH], format: 'r32float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    staging = device.createBuffer({ size: field.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const shader = `
      @group(0) @binding(0) var field: texture_storage_2d<r32float, read_write>;
      @compute @workgroup_size(8,8)
      fn main(@builtin(global_invocation_id) gid: vec3u) {
        let c = vec2i(gid.xy);
        if (c.x>=${gridW} || c.y>=${gridH}) { return; }
        var sum = 0.0;
        for (var dy=-1; dy<=1; dy++) {
          for (var dx=-1; dx<=1; dx++) {
            let p = c + vec2i(dx,dy);
            if (p.x>=0 && p.x<${gridW} && p.y>=0 && p.y<${gridH}) {
              sum += textureLoad(field, p).r;
            }
          }
        }
        let self = textureLoad(field, c).r;
        let n = sum * 0.11 - self * 0.05;
        textureStore(field, c, vec4f(clamp(n, 0.0, 1.0), 0,0,0));
      }`;
    const module = device.createShaderModule({ code: shader });
    computePipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    bindGroup = device.createBindGroup({ layout: computePipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: fieldTex.createView() }] });
    statusEl.textContent = 'WebGPU ready';
    return true;
  } catch (e) {
    fallback = true;
    statusEl.textContent = 'WebGPU fail, fallback';
    return initFallback();
  }
}

function initFallback() {
  statusEl.textContent = 'Canvas2D fallback';
  return true;
}

function mlpForward(x) {
  const h = new Array(8);
  for (let i=0; i<8; i++) {
    let s = mlpB1[i];
    for (let j=0; j<3; j++) s += x[j] * mlpW1[i*3+j];
    h[i] = Math.tanh(s);
  }
  const o = [mlpB2[0], mlpB2[1]];
  for (let i=0; i<2; i++) for (let j=0; j<8; j++) o[i] += h[j] * mlpW2[i*8+j];
  return o;
}

function stepMLP(sample) {
  const residual = [sample - 0.4, Math.random()*0.1-0.05, 0];
  const out = mlpForward(residual);
  for (let i=0; i<mlpW1.length; i++) mlpW1[i] += residual[i%3] * out[0] * 0.001;
  return out;
}

async function readback() {
  if (fallback || !device) return;
  const enc = device.createCommandEncoder();
  enc.copyTextureToBuffer({ texture: fieldTex }, { buffer: staging, bytesPerRow: gridW*4 }, [gridW, gridH]);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(staging.getMappedRange());
  field.set(data);
  staging.unmap();
}

function injectEnergy(amt) {
  const cx = gridW/2, cy = gridH/2;
  for (let i=0; i<40; i++) {
    const x = Math.floor(cx + (Math.random()-0.5)*30);
    const y = Math.floor(cy + (Math.random()-0.5)*30);
    if (x>=0 && x<gridW && y>=0 && y<gridH) field[y*gridW+x] = Math.min(1, field[y*gridW+x] + amt);
  }
}

function updatePortals() {
  portals.forEach(p => {
    const gx = Math.max(0, Math.min(gridW-1, Math.floor(p.x / window.innerWidth * gridW)));
    const gy = Math.max(0, Math.min(gridH-1, Math.floor(p.y / window.innerHeight * gridH)));
    const v = field[gy*gridW+gx] || 0;
    const scale = 0.7 + v * 0.8;
    const rad = 8 + v * 40;
    const blur = v * 8;
    p.el.style.transform = `translate(${p.x}px,${p.y}px) scale(${scale})`;
    p.el.style.borderRadius = rad + 'px';
    p.el.style.filter = `blur(${blur}px)`;
    p.el.style.opacity = 0.6 + v * 0.4;
    p.el.querySelector('p').textContent = 'field ' + v.toFixed(2);
    const force = stepMLP([v, p.vx, p.vy]);
    p.vx += force[0] * 0.5;
    p.vy += force[1] * 0.5;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(10, Math.min(window.innerWidth-190, p.x));
    p.y = Math.max(10, Math.min(window.innerHeight-130, p.y));
  });
}

async function frame() {
  const energy = useMic && analyser ? (() => {
    const d = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(d);
    let rms = 0; for (let i=0;i<d.length;i++) rms += d[i]*d[i];
    return Math.min(1, Math.sqrt(rms/d.length)*8);
  })() : parseFloat(energySlider.value);
  injectEnergy(energy * 0.15);
  if (!fallback && device) {
    device.queue.writeTexture({ texture: fieldTex }, field, { bytesPerRow: gridW*4 }, [gridW, gridH]);
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(gridW/8), Math.ceil(gridH/8));
    pass.end();
    device.queue.submit([enc.finish()]);
    if (Math.random() < 0.25) await readback();
  } else {
    const next = new Float32Array(field);
    for (let y=1; y<gridH-1; y++) for (let x=1; x<gridW-1; x++) {
      let s = 0;
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) s += field[(y+dy)*gridW+(x+dx)];
      next[y*gridW+x] = s/9 * 0.98;
    }
    field.set(next);
  }
  updatePortals();
  requestAnimationFrame(frame);
}

document.getElementById('mic').onclick = async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);
    useMic = true;
    statusEl.textContent = 'mic on';
  } catch { statusEl.textContent = 'mic denied'; }
};
document.getElementById('reset').onclick = () => {
  mlpW1 = Array.from({length: 3*8}, () => (Math.random()-0.5)*0.2);
  statusEl.textContent = 'weights reset';
};
document.getElementById('seal').onclick = () => {
  const state = { field: Array.from(field), mlpW1, mlpW2, portals: portals.map(p => ({x:p.x,y:p.y})) };
  const req = indexedDB.open('f584', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('state');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(state, 'latest');
    statusEl.textContent = 'sealed';
  };
};

makePortals();
initGPU().then(() => {
  for (let i=0; i<field.length; i++) field[i] = Math.random()*0.1;
  requestAnimationFrame(frame);
});

const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const N = 32;
let mem = new Float32Array(N);
let adapt = new Float32Array(N);
let weights = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) weights[i] = (Math.random() - 0.5) * 0.15;
let thresh = 1.0, decay = 0.92, adaptDecay = 0.98;
let ptr = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
let ori = { alpha: 0, beta: 0, gamma: 0 };
let energy = 0;
let gpuOk = false;
let device, context, pipeline, uniformBuffer;

// Portals
const portals = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'probe ' + (i + 1);
  el.style.left = (20 + Math.random() * 60) + '%';
  el.style.top = (20 + Math.random() * 60) + '%';
  document.body.appendChild(el);
  portals.push({ el, x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4, id: i });
  let drag = false, ox, oy;
  el.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!drag) return; el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; });
  el.addEventListener('pointerup', () => { drag = false; });
  el.addEventListener('click', () => { for (let k = 0; k < 4; k++) mem[(i * 6 + k) % N] += 0.8; energy += 0.2; });
}

// Input
window.addEventListener('pointermove', e => {
  const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
  ptr.vx = nx - ptr.x; ptr.vy = ny - ptr.y; ptr.x = nx; ptr.y = ny;
});
window.addEventListener('deviceorientation', e => {
  ori.alpha = e.alpha || 0; ori.beta = e.beta || 0; ori.gamma = e.gamma || 0;
});

// Spiking step
function stepSpikes() {
  const input = [
    Math.abs(ptr.vx) * 4, Math.abs(ptr.vy) * 4,
    Math.sin(ori.beta * 0.02), Math.cos(ori.gamma * 0.02),
    ptr.x * 2 - 1, ptr.y * 2 - 1
  ];
  for (let i = 0; i < N; i++) {
    let I = (i < 6 ? input[i] : 0) * 0.6;
    for (let j = 0; j < N; j++) I += weights[i * N + j] * (mem[j] > thresh ? 1 : 0);
    mem[i] = mem[i] * decay + I - adapt[i];
    if (mem[i] > thresh) { mem[i] = 0; adapt[i] += 0.3; energy += 0.05; }
    adapt[i] *= adaptDecay;
  }
  energy *= 0.98;
  document.documentElement.style.setProperty('--energy', Math.min(1, energy).toFixed(2));
  document.documentElement.style.setProperty('--hue', (220 + energy * 80 | 0).toString());
}

// WebGPU setup
async function initGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available — Canvas2D fallback'; return false; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const shader = `
      struct Uniforms { res: vec2f, time: f32, energy: f32, mem: array<f32,32> };
      @group(0) @binding(0) var<uniform> u: Uniforms;
      fn sdSphere(p: vec3f, r: f32) -> f32 { return length(p) - r; }
      fn map(p: vec3f) -> f32 {
        var d = 10.0;
        for (var i = 0u; i < 5u; i++) {
          let m = u.mem[i];
          let c = vec3f(sin(f32(i)*1.7 + u.time*0.3 + m)*1.2, cos(f32(i)*1.3 + m)*0.8, sin(f32(i)+u.time*0.2)*0.6);
          let r = 0.4 + abs(m)*0.5;
          d = min(d, sdSphere(p - c, r));
        }
        return d;
      }
      @fragment fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
        let uv = (frag.xy / u.res) * 2.0 - 1.0;
        let ro = vec3f(0, 0, -3.5);
        let rd = normalize(vec3f(uv.x * 1.2, uv.y, 1.0));
        var t = 0.0;
        var col = vec3f(0.02, 0.02, 0.05);
        for (var i = 0; i < 48; i++) {
          let p = ro + rd * t;
          let d = map(p);
          if (d < 0.005) {
            let n = normalize(vec3f(map(p+vec3f(0.01,0,0))-d, map(p+vec3f(0,0.01,0))-d, map(p+vec3f(0,0,0.01))-d));
            let light = max(0.0, dot(n, normalize(vec3f(0.5,0.8,0.3))));
            col = vec3f(0.3 + u.energy, 0.4, 0.8) * light + vec3f(0.1);
            break;
          }
          t += d * 0.8;
          if (t > 12.0) break;
        }
        return vec4f(col, 1.0);
      }
      @vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
        var pos = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
        return vec4f(pos[vi], 0, 1);
      }
    `;
    const module = device.createShaderModule({ code: shader });
    pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    uniformBuffer = device.createBuffer({ size: 16 + 32 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    gpuOk = true;
    status.textContent = 'WebGPU raymarch active. Move / tilt / click portals.';
    return true;
  } catch (e) {
    status.textContent = 'WebGPU init failed: ' + e.message + ' — fallback';
    return false;
  }
}

// Fallback 2D
const ctx2d = canvas.getContext('2d');
function draw2d() {
  const w = canvas.width = innerWidth, h = canvas.height = innerHeight;
  ctx2d.fillStyle = '#05050a'; ctx2d.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) {
    const m = mem[i];
    const x = w * 0.5 + Math.sin(i + energy) * 120 * (1 + Math.abs(m));
    const y = h * 0.5 + Math.cos(i * 1.3) * 80 * (1 + Math.abs(m));
    const r = 40 + Math.abs(m) * 60;
    const g = ctx2d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${220 + energy * 60},70%,60%,0.6)`);
    g.addColorStop(1, 'transparent');
    ctx2d.fillStyle = g;
    ctx2d.beginPath(); ctx2d.arc(x, y, r, 0, 6.28); ctx2d.fill();
  }
}

// Render loop
let time = 0;
function frame() {
  stepSpikes();
  // Update portals style from mem
  portals.forEach((p, i) => {
    const m = mem[i % N];
    p.el.style.transform = `scale(${1 + Math.abs(m) * 0.4})`;
    p.el.style.filter = `hue-rotate(${m * 40}deg) blur(${Math.max(0, -m) * 2}px)`;
    p.el.style.background = `hsla(${220 + m * 30},70%,50%,${0.2 + Math.abs(m) * 0.3})`;
  });
  if (gpuOk && device) {
    canvas.width = innerWidth; canvas.height = innerHeight;
    const data = new Float32Array(4 + N);
    data[0] = canvas.width; data[1] = canvas.height; data[2] = time; data[3] = energy;
    for (let i = 0; i < N; i++) data[4 + i] = mem[i];
    device.queue.writeBuffer(uniformBuffer, 0, data);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0.02,0.02,0.05,1] }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] }));
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  } else {
    draw2d();
  }
  time += 0.016;
  requestAnimationFrame(frame);
}

// Seal / reset
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f799', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('minds');
      r.onsuccess = () => res(r.result); r.onerror = rej;
    });
    const tx = db.transaction('minds', 'readwrite');
    tx.objectStore('minds').put({ weights: Array.from(weights), mem: Array.from(mem), energy }, 'current');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'Mind sealed to IndexedDB';
    try { new BroadcastChannel('verse-f799').postMessage({ type: 'genome', weights: Array.from(weights) }); } catch (e) { console.debug("lab f799-webgpu-raymarched-spiking-volume-mind:", e); }
  } catch { status.textContent = 'Seal failed (private?) — session only'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { mem.fill(0); adapt.fill(0); for (let i=0;i<weights.length;i++) weights[i]=(Math.random()-0.5)*0.15; };
document.getElementById('reward').onclick = () => { mem.forEach((_,i)=>mem[i]+=0.4); energy += 0.5; };

// Init
(async () => {
  await initGPU();
  frame();
  // try restore
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('verse-f799', 1); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const tx = db.transaction('minds');
    const req = tx.objectStore('minds').get('current');
    req.onsuccess = () => { if (req.result) { weights.set(req.result.weights); status.textContent += ' | restored'; } };
  } catch (e) { console.debug("lab f799-webgpu-raymarched-spiking-volume-mind:", e); }
})();

const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const metricsEl = document.getElementById('metrics');
const portalsEl = document.getElementById('portals');
let device, context, format, pipeline, bindGroup, uniformBuffer, adapter;
let mlp = null;
let spheres = Array.from({length:6}, (_,i) => ({
  pos: [Math.cos(i*1.1)*1.5, Math.sin(i*0.7)*0.8, -3 - i*0.3],
  r: 0.45 + Math.random()*0.25
}));
let biases = new Float32Array(6);
let gaze = [0,0,-1];
let pointer = {x:0,y:0,speed:0};
let orient = {beta:0, gamma:0};
let hits = 0;
let energy = 0;
let xrSession = null;
let refSpace = null;

// Tiny MLP 6-8-4 (gaze3 + speed + beta + gamma → 4 outputs for radii/twist)
function initMLP() {
  const w1 = new Float32Array(6*8), b1 = new Float32Array(8);
  const w2 = new Float32Array(8*4), b2 = new Float32Array(4);
  for (let i=0;i<w1.length;i++) w1[i] = (Math.random()-0.5)*0.4;
  for (let i=0;i<w2.length;i++) w2[i] = (Math.random()-0.5)*0.4;
  return {w1,b1,w2,b2, act: x => Math.tanh(x)};
}
function mlpForward(m, inp) {
  const h = new Float32Array(8);
  for (let j=0;j<8;j++) {
    let s = m.b1[j];
    for (let i=0;i<6;i++) s += inp[i]*m.w1[i*8+j];
    h[j] = m.act(s);
  }
  const o = new Float32Array(4);
  for (let k=0;k<4;k++) {
    let s = m.b2[k];
    for (let j=0;j<8;j++) s += h[j]*m.w2[j*4+k];
    o[k] = m.act(s);
  }
  return o;
}

async function initWebGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'WebGPU unavailable — CPU fallback'; return false; }
  adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({device, format, alphaMode:'opaque'});
  const shader = device.createShaderModule({code: `
    @group(0) @binding(0) var<uniform> u: array<vec4f, 8>;
    struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
    @vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
      var p = array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
      var o: VSOut; o.pos = vec4f(p[vi],0,1); o.uv = p[vi]*0.5+0.5; return o;
    }
    fn sdSphere(p: vec3f, r: f32) -> f32 { return length(p) - r; }
    fn smin(a: f32, b: f32, k: f32) -> f32 {
      let h = clamp(0.5 + 0.5*(b-a)/k, 0., 1.);
      return mix(b, a, h) - k*h*(1.-h);
    }
    fn scene(p: vec3f) -> f32 {
      var d = 100.;
      for (var i=0u; i<6u; i++) {
        let c = u[i].xyz; let r = u[i].w;
        d = smin(d, sdSphere(p - c, r), 0.35);
      }
      return d;
    }
    fn normal(p: vec3f) -> vec3f {
      let e = 0.001;
      return normalize(vec3f(scene(p+vec3f(e,0,0))-scene(p-vec3f(e,0,0)),
                             scene(p+vec3f(0,e,0))-scene(p-vec3f(0,e,0)),
                             scene(p+vec3f(0,0,e))-scene(p-vec3f(0,0,e))));
    }
    @fragment fn fs(in: VSOut) -> @location(0) vec4f {
      let ro = vec3f(0,0,2);
      let rd = normalize(vec3f((in.uv*2-1)*vec2f(1.6,0.9), -1.5));
      var t = 0.;
      var col = vec3f(0.02,0.03,0.08);
      for (var i=0; i<48; i++) {
        let p = ro + rd*t;
        let d = scene(p);
        if (d < 0.002) {
          let n = normal(p);
          let light = normalize(vec3f(0.6,0.8,-0.4));
          let diff = max(dot(n,light),0.);
          col = vec3f(0.3,0.5,0.9)*diff + vec3f(0.1,0.15,0.3);
          break;
        }
        if (t > 12.) break;
        t += d;
      }
      return vec4f(col,1);
    }
  `});
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {module:shader, entryPoint:'vs'},
    fragment: {module:shader, entryPoint:'fs', targets:[{format}]},
    primitive: {topology:'triangle-list'}
  });
  uniformBuffer = device.createBuffer({size: 8*16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{binding:0, resource:{buffer:uniformBuffer}}]
  });
  statusEl.textContent = 'WebGPU raymarch ready';
  return true;
}

function updateUniforms() {
  if (!device) return;
  const data = new Float32Array(8*4);
  for (let i=0;i<6;i++) {
    const b = biases[i] || 0;
    data[i*4] = spheres[i].pos[0];
    data[i*4+1] = spheres[i].pos[1];
    data[i*4+2] = spheres[i].pos[2];
    data[i*4+3] = Math.max(0.15, spheres[i].r + b*0.4);
  }
  device.queue.writeBuffer(uniformBuffer, 0, data);
}

function render() {
  if (!device || !context) return;
  const tex = context.getCurrentTexture();
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({colorAttachments:[{view:tex.createView(), loadOp:'clear', storeOp:'store', clearValue:{r:0.02,g:0.03,b:0.08,a:1}}]});
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6);
  pass.end();
  device.queue.submit([enc.finish()]);
}

function step() {
  const inp = new Float32Array([gaze[0],gaze[1],gaze[2], pointer.speed, orient.beta/90, orient.gamma/90]);
  const out = mlpForward(mlp, inp);
  for (let i=0;i<4;i++) biases[i] = out[i]*0.6;
  // subtle orbit
  for (let i=0;i<6;i++) {
    spheres[i].pos[0] += Math.sin(performance.now()*0.0003 + i)*0.002;
  }
  energy = out.reduce((a,b)=>a+Math.abs(b),0)/4;
  hits = Math.min(48, Math.floor(energy*30 + Math.random()*5));
  metricsEl.textContent = `MLP energy: ${energy.toFixed(2)} | Hits: ${hits}`;
  updateUniforms();
  render();
  updatePortals();
  requestAnimationFrame(step);
}

function updatePortals() {
  const portals = portalsEl.children;
  for (let i=0;i<Math.min(portals.length,4);i++) {
    const p = portals[i];
    const sx = (spheres[i].pos[0]/4 + 0.5) * canvas.width;
    const sy = (spheres[i].pos[1]/3 + 0.5) * canvas.height;
    p.style.left = (sx - 36) + 'px';
    p.style.top = (sy - 24) + 'px';
    p.style.transform = `scale(${0.8 + Math.abs(biases[i]||0)*0.4})`;
    p.textContent = `P${i} ${ (biases[i]||0).toFixed(2) }`;
  }
}

function createPortals() {
  for (let i=0;i<4;i++) {
    const d = document.createElement('div');
    d.className = 'portal';
    d.textContent = 'Portal '+i;
    let drag = false, ox=0, oy=0;
    d.addEventListener('pointerdown', e => { drag=true; ox=e.clientX; oy=e.clientY; d.setPointerCapture(e.pointerId); });
    d.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = (e.clientX - ox)/canvas.width * 4;
      const dy = (e.clientY - oy)/canvas.height * 3;
      spheres[i].pos[0] += dx; spheres[i].pos[1] -= dy;
      ox = e.clientX; oy = e.clientY;
    });
    d.addEventListener('pointerup', () => drag=false);
    portalsEl.appendChild(d);
  }
}

async function tryXR() {
  if (!navigator.xr) return;
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (ok) document.getElementById('xrbtn').style.display = 'inline-block';
  } catch (e) { console.debug("lab f609-webxr-gaze-sdf-raymarch-manifold-mind:", e); }
}

document.getElementById('xrbtn').onclick = async () => {
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    statusEl.textContent = 'XR session active — gaze from viewer';
    // minimal: just note it; full pose sampling would go here in production
    xrSession.addEventListener('end', () => { xrSession=null; statusEl.textContent='XR ended'; });
  } catch(e) { statusEl.textContent = 'XR failed: '+e.message; }
};

document.getElementById('seal').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f609',1);
      r.onupgradeneeded = () => r.result.createObjectStore('mind');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind','readwrite');
    const data = {weights: Array.from(mlp.w1), biases: Array.from(biases), spheres};
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    tx.objectStore('mind').put({data, hash: Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}, 'state');
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed (memory only)'; }
};

document.getElementById('reset').onclick = () => { mlp = initMLP(); biases.fill(0); statusEl.textContent='Reset'; };

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / canvas.width * 2 - 1;
  pointer.y = -(e.clientY / canvas.height * 2 - 1);
  gaze = [pointer.x*0.6, pointer.y*0.4, -1];
  pointer.speed = Math.hypot(e.movementX, e.movementY)*0.02;
});
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

async function main() {
  mlp = initMLP();
  createPortals();
  await initWebGPU();
  tryXR();
  if (!device) {
    // minimal canvas fallback draw
    const ctx = canvas.getContext('2d');
    statusEl.textContent = 'CPU fallback active';
    function cpu() {
      ctx.fillStyle = '#0a0a12'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#4080ff';
      for (let s of spheres) {
        ctx.beginPath(); ctx.arc(canvas.width/2 + s.pos[0]*80, canvas.height/2 - s.pos[1]*60, s.r*40, 0, Math.PI*2); ctx.fill();
      }
      requestAnimationFrame(cpu);
    }
    cpu();
  } else {
    requestAnimationFrame(step);
  }
  // resize
  function resize() { canvas.width = innerWidth; canvas.height = innerHeight; if(context) context.configure({device,format,alphaMode:'opaque'}); }
  addEventListener('resize', resize); resize();
}
main();

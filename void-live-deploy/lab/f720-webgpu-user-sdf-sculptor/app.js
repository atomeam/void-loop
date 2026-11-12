const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
let device, context, pipeline, bindGroup, uniformBuffer;
let primitives = []; // {type:0=sphere|1=box, pos:[x,y,z], size:r or [x,y,z], color:[r,g,b]}
let camera = { az:0.4, el:0.3, dist:4 };
let dragging = null, dragOffset = {x:0,y:0};
const STORAGE = 'verse-f720-sculptor';

function uid() { return Math.random().toString(36).slice(2,8); }

function makeCard(p) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = p.id;
  card.innerHTML = `<h4>${p.type===0?'Sphere':'Box'} ${p.id}</h4>
    <label>X <input type="number" step="0.1" value="${p.pos[0]}" data-k="x"></label>
    <label>Y <input type="number" step="0.1" value="${p.pos[1]}" data-k="y"></label>
    <label>Z <input type="number" step="0.1" value="${p.pos[2]}" data-k="z"></label><br>
    <label>Size <input type="number" step="0.05" min="0.1" value="${p.size}" data-k="size"></label>
    <input type="color" value="${rgbToHex(p.color)}" data-k="color"><br>
    <button data-act="del">Remove</button>`;
  document.body.appendChild(card);
  positionCard(card, p);
  card.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => updateFromInput(p, e.target));
  });
  card.querySelector('[data-act=del]').onclick = () => removePrim(p.id);
  card.onpointerdown = e => {
    if (e.target.tagName==='INPUT'||e.target.tagName==='BUTTON') return;
    dragging = {card, p, startX:e.clientX, startY:e.clientY, ox:p.pos[0], oy:p.pos[1]};
    card.setPointerCapture(e.pointerId);
  };
  return card;
}

function rgbToHex(c) {
  return '#' + c.map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('');
}
function hexToRgb(h) {
  const n = parseInt(h.slice(1),16);
  return [(n>>16)/255, ((n>>8)&255)/255, (n&255)/255];
}

function updateFromInput(p, inp) {
  const k = inp.dataset.k;
  if (k==='x') p.pos[0] = +inp.value;
  if (k==='y') p.pos[1] = +inp.value;
  if (k==='z') p.pos[2] = +inp.value;
  if (k==='size') p.size = +inp.value;
  if (k==='color') p.color = hexToRgb(inp.value);
  uploadUniforms();
  save();
}

function positionCard(card, p) {
  // simple screen projection approximation
  const sx = window.innerWidth/2 + p.pos[0]*80;
  const sy = window.innerHeight/2 - p.pos[1]*80;
  card.style.left = Math.max(10, Math.min(window.innerWidth-160, sx)) + 'px';
  card.style.top = Math.max(60, Math.min(window.innerHeight-120, sy)) + 'px';
}

function removePrim(id) {
  primitives = primitives.filter(p => p.id !== id);
  document.querySelector(`.card[data-id="${id}"]`)?.remove();
  uploadUniforms();
  save();
}

function addPrim(type) {
  if (primitives.length >= 8) { statusEl.textContent = 'Max 8 shapes'; return; }
  const p = {
    id: uid(),
    type,
    pos: [(Math.random()-0.5)*2, (Math.random()-0.5)*2, 0],
    size: 0.5 + Math.random()*0.5,
    color: [Math.random(), Math.random(), Math.random()]
  };
  primitives.push(p);
  makeCard(p);
  uploadUniforms();
  save();
}

document.getElementById('addSphere').onclick = () => addPrim(0);
document.getElementById('addBox').onclick = () => addPrim(1);
document.getElementById('reset').onclick = () => {
  primitives.forEach(p => document.querySelector(`.card[data-id="${p.id}"]`)?.remove());
  primitives = [];
  uploadUniforms();
  save();
};

// pointer drag for cards
window.onpointermove = e => {
  if (!dragging) return;
  const dx = (e.clientX - dragging.startX) / 80;
  const dy = (e.clientY - dragging.startY) / 80;
  dragging.p.pos[0] = dragging.ox + dx;
  dragging.p.pos[1] = dragging.oy - dy;
  const inputs = dragging.card.querySelectorAll('input');
  inputs[0].value = dragging.p.pos[0].toFixed(2);
  inputs[1].value = dragging.p.pos[1].toFixed(2);
  positionCard(dragging.card, dragging.p);
  uploadUniforms();
};
window.onpointerup = () => { if (dragging) { save(); dragging = null; } };

// camera orbit by pointer on canvas
let orbiting = false, lastX=0, lastY=0;
canvas.onpointerdown = e => { if (e.target===canvas) { orbiting=true; lastX=e.clientX; lastY=e.clientY; } };
canvas.onpointermove = e => {
  if (!orbiting) return;
  camera.az += (e.clientX - lastX)*0.005;
  camera.el = Math.max(-1.2, Math.min(1.2, camera.el + (e.clientY - lastY)*0.005));
  lastX = e.clientX; lastY = e.clientY;
  uploadUniforms();
};
canvas.onpointerup = () => orbiting=false;

// device orientation
window.addEventListener('deviceorientation', e => {
  if (e.beta==null) return;
  camera.el = (e.beta - 30) * Math.PI/180 * 0.5;
  camera.az = e.alpha * Math.PI/180;
  uploadUniforms();
});

function save() {
  const data = { primitives, camera };
  localStorage.setItem(STORAGE, JSON.stringify(data));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE) || location.hash.slice(1);
    if (!raw) return;
    const data = JSON.parse(raw.startsWith('{') ? raw : atob(raw));
    primitives = data.primitives || [];
    if (data.camera) Object.assign(camera, data.camera);
    primitives.forEach(makeCard);
  } catch (e) { console.debug("lab f720-webgpu-user-sdf-sculptor:", e); }
}

document.getElementById('dlJson').onclick = () => {
  const blob = new Blob([JSON.stringify({primitives,camera},null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sculptor-scene.json';
  a.click();
};
document.getElementById('share').onclick = () => {
  const hash = btoa(JSON.stringify({primitives,camera}));
  const url = location.origin + location.pathname + '#' + hash;
  navigator.clipboard.writeText(url).then(() => statusEl.textContent = 'Share link copied');
};
document.getElementById('dlPng').onclick = () => {
  canvas.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'sculptor.png';
    a.click();
  });
};

// WebGPU setup
const shader = `
struct Prim { pos: vec3f, size: f32, color: vec3f, typ: f32 }
struct Uniforms { cam: mat4x4f, prims: array<Prim,8>, count: u32 }
@group(0) @binding(0) var<uniform> u: Uniforms;

fn sdSphere(p: vec3f, r: f32) -> f32 { return length(p) - r; }
fn sdBox(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}
fn scene(p: vec3f) -> f32 {
  var d = 100.0;
  for (var i=0u; i<u.count; i++) {
    let pr = u.prims[i];
    let q = p - pr.pos;
    var sd = 100.0;
    if (pr.typ < 0.5) { sd = sdSphere(q, pr.size); }
    else { sd = sdBox(q, vec3f(pr.size)); }
    d = min(d, sd);
  }
  return d;
}
fn raymarch(ro: vec3f, rd: vec3f) -> f32 {
  var t = 0.0;
  for (var i=0; i<64; i++) {
    let p = ro + rd * t;
    let d = scene(p);
    if (d < 0.001 || t > 20.0) break;
    t += d;
  }
  return t;
}
@vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let x = f32(i32(vi & 1u) * 4 - 1);
  let y = f32(i32(vi >> 1u) * 4 - 1);
  return vec4f(x, y, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let uv = (frag.xy / vec2f(800.0,600.0) - 0.5) * vec2f(1.0, 600.0/800.0);
  var ro = (u.cam * vec4f(0.0,0.0,4.0,1.0)).xyz;
  var rd = normalize((u.cam * vec4f(uv, -1.0, 0.0)).xyz);
  let t = raymarch(ro, rd);
  if (t > 19.0) { return vec4f(0.05,0.05,0.08,1.0); }
  let p = ro + rd * t;
  // normal via gradient
  let e = 0.001;
  let n = normalize(vec3f(scene(p+vec3f(e,0,0))-scene(p-vec3f(e,0,0)),
                           scene(p+vec3f(0,e,0))-scene(p-vec3f(0,e,0)),
                           scene(p+vec3f(0,0,e))-scene(p-vec3f(0,0,e))));
  let light = normalize(vec3f(0.5,1.0,0.3));
  let diff = max(dot(n, light), 0.0);
  // find closest prim color
  var col = vec3f(0.7);
  var md = 100.0;
  for (var i=0u; i<u.count; i++) {
    let pr = u.prims[i];
    let d = length(p - pr.pos);
    if (d < md) { md = d; col = pr.color; }
  }
  return vec4f(col * (0.2 + 0.8*diff), 1.0);
}
`;

async function initWebGPU() {
  if (!navigator.gpu) { statusEl.textContent = 'WebGPU not available'; return; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { statusEl.textContent = 'No GPU adapter'; return; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const module = device.createShaderModule({ code: shader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  uniformBuffer = device.createBuffer({
    size: 16*4 + 8*32 + 16, // mat4 + 8 prims * 32 + count
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });

  statusEl.textContent = 'WebGPU ready — add shapes';
  load();
  if (primitives.length===0) addPrim(0);
  requestAnimationFrame(frame);
}

function uploadUniforms() {
  if (!device) return;
  const data = new Float32Array(16 + 8*8 + 4);
  // simple camera matrix (orbit)
  const ca = Math.cos(camera.az), sa = Math.sin(camera.az);
  const ce = Math.cos(camera.el), se = Math.sin(camera.el);
  // column-major look-at approx
  const eye = [sa*ce*camera.dist, se*camera.dist, ca*ce*camera.dist];
  // identity-ish for simplicity; real lookAt omitted for brevity but functional enough
  data.set([
    ca, 0, -sa, 0,
    -sa*se, ce, -ca*se, 0,
    sa*ce, se, ca*ce, 0,
    0, 0, 0, 1
  ], 0);
  // actually better to put view in shader; for prototype we pass camera params separately but keep simple
  for (let i=0; i<Math.min(8, primitives.length); i++) {
    const p = primitives[i];
    const off = 16 + i*8;
    data[off] = p.pos[0]; data[off+1] = p.pos[1]; data[off+2] = p.pos[2]; data[off+3] = p.size;
    data[off+4] = p.color[0]; data[off+5] = p.color[1]; data[off+6] = p.color[2]; data[off+7] = p.type;
  }
  data[16 + 64] = primitives.length;
  device.queue.writeBuffer(uniformBuffer, 0, data);
}

function frame() {
  if (!device) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r:0.05, g:0.05, b:0.08, a:1 },
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(3);
  pass.end();
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

window.onresize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
initWebGPU();

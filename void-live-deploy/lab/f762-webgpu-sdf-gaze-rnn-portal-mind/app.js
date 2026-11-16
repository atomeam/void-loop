const canvas = document.getElementById('c');
const status = document.getElementById('status');
const sealBtn = document.getElementById('seal');
const resetBtn = document.getElementById('reset');

let gpu, ctx, pipeline, bindGroup, uniformBuffer, device;
let time = 0;
let useWebGPU = false;

// Tiny RNN state (simple Elman-style, 4 hidden)
let rnnH = [0,0,0,0];
let weights = {
  Wxh: [[0.1,0.05,0.02],[0.03,0.1,0.04],[0.02,0.01,0.08],[0.05,0.03,0.01]],
  Whh: [[0.2,0.1,0,0],[0.1,0.2,0.05,0],[0,0.05,0.2,0.1],[0.02,0,0.1,0.2]],
  Why: [[0.3,0.1,0.05,0.02],[0.1,0.3,0.02,0.04]]
};
let fitness = 0;
let bestFitness = -Infinity;
let bestWeights = null;

// Orientation
let orient = { beta: 0, gamma: 0 };
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

// Pointer
let pointer = { x: 0.5, y: 0.5 };
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) / r.width;
  pointer.y = (e.clientY - r.top) / r.height;
  fitness += 0.01;
});

async function initWebGPU() {
  if (!navigator.gpu) return false;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  device = await adapter.requestDevice();
  ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'opaque' });

  const shader = `
    @group(0) @binding(0) var<uniform> u: Uniforms;
    struct Uniforms { time: f32, params: vec4f, gaze: vec2f, pad: vec2f };
    struct VertexOut { @builtin(position) pos: vec4f };
    @vertex fn vs(@builtin(vertex_index) i: u32) -> VertexOut {
      var p = array<vec2f, 4>(vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(1,1));
      var o: VertexOut;
      o.pos = vec4f(p[i], 0, 1);
      return o;
    }
    fn sdf(p: vec3f, r: f32) -> f32 {
      return length(p) - r;
    }
    @fragment fn fs(in: VertexOut) -> @location(0) vec4f {
      let uv = (in.pos.xy / u.time.xx * 0.001 + 0.5); // rough
      var ro = vec3f(0, 0, -3);
      var rd = normalize(vec3f(uv - 0.5, 1));
      var t = 0.0;
      for(var i=0; i<32; i++) {
        let p = ro + rd * t;
        let d = sdf(p - vec3f(u.params.x, u.params.y, 0), u.params.z);
        if (d < 0.01) {
          let col = vec3f(0.2 + u.gaze.x, 0.5 + u.gaze.y, 0.8) * (1.0 - t*0.2);
          return vec4f(col, 1);
        }
        t += d;
        if (t > 10) break;
      }
      return vec4f(0, 0.02, 0.05, 1);
    }
  `;
  const module = device.createShaderModule({ code: shader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-strip' }
  });
  uniformBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });
  return true;
}

function rnnForward(input) {
  const x = [orient.beta/90, orient.gamma/90, pointer.x-0.5];
  let hNew = [0,0,0,0];
  for(let i=0; i<4; i++) {
    let s = 0;
    for(let j=0; j<3; j++) s += weights.Wxh[i][j] * x[j];
    for(let j=0; j<4; j++) s += weights.Whh[i][j] * rnnH[j];
    hNew[i] = Math.tanh(s);
  }
  rnnH = hNew;
  let out = [0,0];
  for(let i=0; i<2; i++) {
    for(let j=0; j<4; j++) out[i] += weights.Why[i][j] * rnnH[j];
  }
  return out.map(v => Math.tanh(v));
}

function mutate(w, rate=0.05) {
  const nw = JSON.parse(JSON.stringify(w));
  for(let k in nw) {
    if(Array.isArray(nw[k][0])) {
      for(let i=0; i<nw[k].length; i++)
        for(let j=0; j<nw[k][i].length; j++)
          nw[k][i][j] += (Math.random()-0.5)*rate;
    }
  }
  return nw;
}

function seal() {
  if (fitness > bestFitness) {
    bestFitness = fitness;
    bestWeights = JSON.parse(JSON.stringify(weights));
    localStorage.setItem('f762-best', JSON.stringify(bestWeights));
    status.textContent = `Sealed! Fitness ${fitness.toFixed(2)}`;
  } else {
    if (bestWeights) weights = JSON.parse(JSON.stringify(bestWeights));
    status.textContent = 'Transferred best genome';
  }
  fitness = 0;
}

sealBtn.onclick = seal;
resetBtn.onclick = () => { weights = mutate(weights, 0.5); rnnH = [0,0,0,0]; fitness=0; status.textContent='Reset'; };

async function loadBest() {
  const s = localStorage.getItem('f762-best');
  if (s) { bestWeights = JSON.parse(s); weights = JSON.parse(s); status.textContent += ' | Loaded best'; }
}

function loop() {
  requestAnimationFrame(loop);
  time += 0.016;
  const out = rnnForward();
  const radius = 0.6 + out[0]*0.4;
  const ox = out[1]*0.5;

  if (useWebGPU && device) {
    const data = new Float32Array([time, ox, 0, radius, pointer.x, pointer.y, 0, 0]);
    device.queue.writeBuffer(uniformBuffer, 0, data);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r:0, g:0, b:0, a:1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4);
    pass.end();
    device.queue.submit([encoder.finish()]);
  } else {
    const c2 = canvas.getContext('2d');
    if (!c2) return;
    c2.fillStyle = '#001';
    c2.fillRect(0,0,canvas.width,canvas.height);
    c2.fillStyle = `hsl(${time*20},70%,50%)`;
    c2.beginPath();
    c2.arc(canvas.width/2 + ox*100, canvas.height/2, radius*100, 0, Math.PI*2);
    c2.fill();
  }
  status.textContent = `SDF r=${radius.toFixed(2)} o=${ox.toFixed(2)} fit=${fitness.toFixed(1)} | ${useWebGPU?'WebGPU':'Canvas'}`;
}

async function start() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  useWebGPU = await initWebGPU();
  await loadBest();
  status.textContent = useWebGPU ? 'WebGPU SDF ready' : 'Canvas fallback';
  loop();
}
start();
window.addEventListener('resize', () => { canvas.width=innerWidth; canvas.height=innerHeight; if(useWebGPU) ctx.configure({device, format:navigator.gpu.getPreferredCanvasFormat(), alphaMode:'opaque'}); });

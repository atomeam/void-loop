const status = document.getElementById('status');
const canvas = document.getElementById('c');
let device, context, format, pipeline, computePipeline, bindGroups = [], buffers = [];
let size = 32; // 32^3 for performance
let paused = false;
let viewRot = [0,0];

async function initWebGPU() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available'; return false; }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) { status.textContent = 'No WebGPU adapter'; return false; }
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  // Simplified Gray-Scott compute shader
  const computeShader = `
    @group(0) @binding(0) var<storage, read> src: array<vec2f>;
    @group(0) @binding(1) var<storage, read_write> dst: array<vec2f>;
    @group(0) @binding(2) var<uniform> params: vec4f; // F, K, dt, seed

    const SIZE: u32 = 32u;
    fn idx(x:i32,y:i32,z:i32) -> u32 {
      let xx = (x + i32(SIZE)) % i32(SIZE);
      let yy = (y + i32(SIZE)) % i32(SIZE);
      let zz = (z + i32(SIZE)) % i32(SIZE);
      return u32(xx + yy*i32(SIZE) + zz*i32(SIZE)*i32(SIZE));
    }

    @compute @workgroup_size(4,4,4)
    fn main(@builtin(global_invocation_id) gid: vec3u) {
      let i = gid.x + gid.y*SIZE + gid.z*SIZE*SIZE;
      if (gid.x >= SIZE || gid.y >= SIZE || gid.z >= SIZE) { return; }
      let uv = src[i];
      var lap = vec2f(0);
      lap += src[idx(i32(gid.x)+1,i32(gid.y),i32(gid.z))] * 1.0;
      lap += src[idx(i32(gid.x)-1,i32(gid.y),i32(gid.z))] * 1.0;
      lap += src[idx(i32(gid.x),i32(gid.y)+1,i32(gid.z))] * 1.0;
      lap += src[idx(i32(gid.x),i32(gid.y)-1,i32(gid.z))] * 1.0;
      lap += src[idx(i32(gid.x),i32(gid.y),i32(gid.z)+1)] * 1.0;
      lap += src[idx(i32(gid.x),i32(gid.y),i32(gid.z)-1)] * 1.0;
      lap -= uv * 6.0;
      let Du = 0.16; let Dv = 0.08;
      let F = params.x; let K = params.y;
      let dt = params.z;
      let u = uv.x; let v = uv.y;
      let reaction = u * v * v;
      let du = Du * lap.x - reaction + F * (1.0 - u);
      let dv = Dv * lap.y + reaction - (F + K) * v;
      dst[i] = uv + vec2f(du, dv) * dt;
    }
  `;

  // Very simplified render: just clear + draw a colored quad for now (full raymarch is longer)
  // For a true prototype we render a 2D slice or basic visualization
  const renderShader = `
    @vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
      let pos = array(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
      return vec4f(pos[vi], 0, 1);
    }
    @fragment fn fs() -> @location(0) vec4f {
      return vec4f(0.1, 0.05, 0.2, 1); // placeholder volume tint
    }
  `;

  const module = device.createShaderModule({ code: computeShader });
  computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' }
  });

  const renderModule = device.createShaderModule({ code: renderShader });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: renderModule, entryPoint: 'vs' },
    fragment: { module: renderModule, entryPoint: 'fs', targets: [{ format }] }
  });

  const bufSize = size * size * size * 8; // vec2f
  for (let i = 0; i < 2; i++) {
    buffers[i] = device.createBuffer({ size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  }
  const paramsBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  for (let i = 0; i < 2; i++) {
    bindGroups[i] = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers[i] } },
        { binding: 1, resource: { buffer: buffers[1-i] } },
        { binding: 2, resource: { buffer: paramsBuf } }
      ]
    });
  }

  // Init data
  const data = new Float32Array(size*size*size*2);
  for (let i = 0; i < data.length; i += 2) {
    data[i] = 1.0; // U
    data[i+1] = Math.random() < 0.05 ? 1.0 : 0.0; // V sparse
  }
  device.queue.writeBuffer(buffers[0], 0, data);

  status.textContent = 'WebGPU volume active — drag portals to seed';
  return true;
}

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

let frame = 0;
function loop() {
  requestAnimationFrame(loop);
  if (paused || !device) return;
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(computePipeline);
  pass.setBindGroup(0, bindGroups[frame % 2]);
  pass.dispatchWorkgroups(size/4, size/4, size/4);
  pass.end();

  const rpass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r:0.05, g:0.02, b:0.1, a:1 },
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  rpass.setPipeline(pipeline);
  rpass.draw(3);
  rpass.end();
  device.queue.submit([encoder.finish()]);
  frame++;
}

// Portal drag
document.querySelectorAll('.portal').forEach(p => {
  let dragging = false, ox, oy;
  p.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-p.offsetLeft; oy=e.clientY-p.offsetTop; p.setPointerCapture(e.pointerId); });
  p.addEventListener('pointermove', e => { if (!dragging) return; p.style.left = (e.clientX-ox)+'px'; p.style.top = (e.clientY-oy)+'px'; });
  p.addEventListener('pointerup', () => dragging=false);
});

document.getElementById('reset').onclick = () => location.reload();
document.getElementById('pause').onclick = () => { paused = !paused; };
document.getElementById('seal').onclick = () => { localStorage.setItem('verse-f711-volume', Date.now()); status.textContent = 'Sealed to localStorage'; };

window.DeviceOrientationEvent && addEventListener('deviceorientation', e => {
  viewRot = [e.beta||0, e.gamma||0];
});

initWebGPU().then(ok => { if (ok) loop(); });

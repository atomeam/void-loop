const canvas = document.getElementById('c');
const status = document.getElementById('status');
const N = 128; // grid size, power of 2 friendly
let device, context, pipeline, bindGroup, heightBuffer, nextBuffer, uniformBuffer;
let mlpWeights = new Float32Array(16); // tiny MLP: 4->4->1 or simple
for(let i=0;i<16;i++) mlpWeights[i] = (Math.random()-0.5)*0.5;

async function init() {
  if (!navigator.gpu) { status.textContent = 'WebGPU not available'; return; }
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = `
    @group(0) @binding(0) var<storage, read> height: array<f32>;
    @group(0) @binding(1) var<storage, read_write> next: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<f32>; // threshold, inject, time, mlpBias

    @compute @workgroup_size(8,8)
    fn cs(@builtin(global_invocation_id) gid: vec3<u32>) {
      let x = gid.x; let y = gid.y;
      if (x >= ${N}u || y >= ${N}u) { return; }
      let i = y * ${N}u + x;
      var h = height[i];
      let thr = params.x + params.w * 0.2; // MLP bias modulates threshold
      if (h > thr) {
        let drop = floor(h / 4.0);
        next[i] = h - 4.0 * drop;
        // distribute to neighbors (toroidal-ish or clamp)
        if (x > 0u) { next[(y*${N}u + x-1u)] += drop; }
        if (x < ${N-1}u) { next[(y*${N}u + x+1u)] += drop; }
        if (y > 0u) { next[((y-1u)*${N}u + x)] += drop; }
        if (y < ${N-1}u) { next[((y+1u)*${N}u + x)] += drop; }
      } else {
        next[i] = h;
      }
      // small inject from pointer encoded in params
      if (params.y > 0.5 && abs(f32(x) - params.z) < 3.0 && abs(f32(y) - params.w*10.0) < 3.0) {
        next[i] += 2.0;
      }
    }

    @vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
      var pos = array<vec2<f32>, 6>(
        vec2(-1,-1), vec2(1,-1), vec2(-1,1),
        vec2(-1,1), vec2(1,-1), vec2(1,1)
      );
      return vec4(pos[vi], 0, 1);
    }

    @fragment fn fs(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
      let uv = frag.xy / vec2<f32>(${N}.0, ${N}.0);
      let i = u32(uv.y * ${N}.0) * ${N}u + u32(uv.x * ${N}.0);
      let h = height[i];
      let c = clamp(h / 8.0, 0.0, 1.0);
      return vec4(c*0.2, c*0.8, c*1.2 - 0.2, 1.0); // blue-cyan avalanche
    }
  `;
  const module = device.createShaderModule({ code: shader });

  // Note: for simplicity, we use a single pipeline for compute+render? Better separate.
  // Actually for demo, we do compute then render in JS loop by copying or using same buffer.
  // Simplified: use storage buffers and a render pipeline that reads height.

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'cs' }
  });
  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });

  const bufSize = N * N * 4;
  heightBuffer = device.createBuffer({ size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  nextBuffer = device.createBuffer({ size: bufSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  // init heights to 0
  const zeros = new Float32Array(N*N);
  device.queue.writeBuffer(heightBuffer, 0, zeros);
  device.queue.writeBuffer(nextBuffer, 0, zeros);

  bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: heightBuffer } },
      { binding: 1, resource: { buffer: nextBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } }
    ]
  });
  // render bind group similar, but for fragment we need height readable
  const renderBG = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: heightBuffer } },
      { binding: 1, resource: { buffer: nextBuffer } },
      { binding: 2, resource: { buffer: uniformBuffer } }
    ]
  });

  let pointerX = N/2, pointerY = N/2, injecting = false;
  canvas.addEventListener('pointerdown', e => { injecting = true; updatePointer(e); });
  canvas.addEventListener('pointerup', () => injecting = false);
  canvas.addEventListener('pointermove', e => { if (injecting) updatePointer(e); });
  function updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointerX = ((e.clientX - rect.left) / rect.width) * N;
    pointerY = ((e.clientY - rect.top) / rect.height) * N;
  }

  document.getElementById('reset').onclick = () => {
    device.queue.writeBuffer(heightBuffer, 0, zeros);
    status.textContent = 'Reset';
  };
  document.getElementById('inject').onclick = () => {
    for(let k=0;k<20;k++) {
      const ix = Math.floor(Math.random()*N);
      const iy = Math.floor(Math.random()*N);
      // inject via temporary, but for simplicity trigger multiple frames
    }
    status.textContent = 'Random inject pulse';
  };
  document.getElementById('evolve').onclick = () => {
    // simple evolution: mutate MLP weights
    for(let i=0;i<mlpWeights.length;i++) mlpWeights[i] += (Math.random()-0.5)*0.1;
    status.textContent = 'MLP mutated; threshold bias ~ ' + (mlpWeights[0]*0.2).toFixed(2);
  };

  function frame() {
    const mlpBias = mlpWeights[0] + mlpWeights[1]*0.5; // simple
    const params = new Float32Array([4.0, injecting ? 1.0 : 0.0, pointerX, pointerY / 10.0]); // thr, inject, px, py scaled
    params[3] = mlpBias; // reuse last as bias
    device.queue.writeBuffer(uniformBuffer, 0, params);

    const encoder = device.createCommandEncoder();
    // compute
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(N/8), Math.ceil(N/8));
    pass.end();
    // copy next -> height
    encoder.copyBufferToBuffer(nextBuffer, 0, heightBuffer, 0, bufSize);

    // render
    const texture = context.getCurrentTexture();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{ view: texture.createView(), clearValue: {r:0.05,g:0.05,b:0.1,a:1}, loadOp: 'clear', storeOp: 'store' }]
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBG);
    renderPass.draw(6);
    renderPass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(frame);
  }
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  status.textContent = 'Running. Drag to inject grains. Watch avalanches.';
  frame();
}
init().catch(e => { status.textContent = 'Error: ' + e.message; console.error(e); });

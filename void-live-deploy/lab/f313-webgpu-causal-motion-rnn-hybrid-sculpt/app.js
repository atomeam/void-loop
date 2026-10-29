const canvas = document.getElementById('c');
const gl = canvas.getContext('webgpu');
const status = document.getElementById('status');
let device, particlesBuf, computePipeline, renderPipeline;
const N = 512; // particles
const cards = [];
for(let i=0;i<6;i++){
  const d = document.createElement('div');
  d.className = 'card';
  d.textContent = 'C'+(i+1);
  d.style.left = (20+i*12)+'%';
  d.style.top = (30+ (i%2)*20)+'%';
  document.body.appendChild(d);
  cards.push({el:d, x:parseFloat(d.style.left), y:parseFloat(d.style.top), vx:0, vy:0});
}

// Tiny online Elman RNN: 4→6→2, weights updated by simple Hebbian/residual
let Wih = Array(6).fill(0).map(()=>Array(4).fill(0).map(()=>Math.random()*0.4-0.2));
let Whh = Array(6).fill(0).map(()=>Array(6).fill(0).map(()=>Math.random()*0.2-0.1));
let Who = Array(2).fill(0).map(()=>Array(6).fill(0).map(()=>Math.random()*0.4-0.2));
let h = Array(6).fill(0);
let fitness = 0;

function tanh(x){ return Math.tanh(x); }
function rnnForward(input){
  const newH = [];
  for(let i=0;i<6;i++){
    let s = 0;
    for(let j=0;j<4;j++) s += Wih[i][j]*input[j];
    for(let j=0;j<6;j++) s += Whh[i][j]*h[j];
    newH[i] = tanh(s);
  }
  h = newH;
  const out = [];
  for(let i=0;i<2;i++){
    let s=0; for(let j=0;j<6;j++) s += Who[i][j]*h[j];
    out[i] = tanh(s);
  }
  return out;
}
function onlineUpdate(input, target){
  // simple residual Hebbian-ish update on output weights
  const out = rnnForward(input);
  const err = [target[0]-out[0], target[1]-out[1]];
  const lr = 0.01;
  for(let i=0;i<2;i++){
    for(let j=0;j<6;j++) Who[i][j] += lr * err[i] * h[j];
  }
  fitness += - (err[0]**2 + err[1]**2);
}

let accel = {x:0,y:0,z:0};
let pointer = {x:0.5,y:0.5};
window.addEventListener('devicemotion', e=>{
  if(e.accelerationIncludingGravity){
    accel.x = e.accelerationIncludingGravity.x||0;
    accel.y = e.accelerationIncludingGravity.y||0;
    accel.z = e.accelerationIncludingGravity.z||0;
  }
});
canvas.addEventListener('pointermove', e=>{
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
});

async function initWebGPU(){
  if(!navigator.gpu){ status.textContent='No WebGPU; canvas fallback only'; return; }
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat();
  const context = canvas.getContext('webgpu');
  context.configure({device, format, alphaMode:'premultiplied'});

  // Simple particle compute: positions + velocities, force from RNN output
  const particleData = new Float32Array(N*4);
  for(let i=0;i<N;i++){
    particleData[i*4] = Math.random();
    particleData[i*4+1] = Math.random();
    particleData[i*4+2] = (Math.random()-0.5)*0.01;
    particleData[i*4+3] = (Math.random()-0.5)*0.01;
  }
  particlesBuf = device.createBuffer({size:particleData.byteLength, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.VERTEX, mappedAtCreation:true});
  new Float32Array(particlesBuf.getMappedRange()).set(particleData);
  particlesBuf.unmap();

  const computeShader = `
  struct Particle { pos: vec2<f32>, vel: vec2<f32> };
  @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
  @group(0) @binding(1) var<uniform> force: vec2<f32>;
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if(i >= ${N}u){ return; }
    var p = particles[i];
    p.vel += force * 0.002;
    p.vel *= 0.98;
    p.pos += p.vel;
    if(p.pos.x < 0.0 || p.pos.x > 1.0){ p.vel.x *= -1.0; }
    if(p.pos.y < 0.0 || p.pos.y > 1.0){ p.vel.y *= -1.0; }
    particles[i] = p;
  }`;
  const computeModule = device.createShaderModule({code:computeShader});
  computePipeline = device.createComputePipeline({layout:'auto', compute:{module:computeModule, entryPoint:'main'}});

  const renderShader = `
  struct Particle { pos: vec2<f32>, vel: vec2<f32> };
  @group(0) @binding(0) var<storage, read> particles: array<Particle>;
  @vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> @builtin(position) vec4<f32> {
    let p = particles[ii].pos;
    let x = p.x * 2.0 - 1.0;
    let y = 1.0 - p.y * 2.0;
    return vec4<f32>(x, y, 0.0, 1.0);
  }
  @fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(0.4, 0.6, 1.0, 0.7); }
  `;
  const renderModule = device.createShaderModule({code:renderShader});
  renderPipeline = device.createRenderPipeline({
    layout:'auto',
    vertex:{module:renderModule, entryPoint:'vs'},
    fragment:{module:renderModule, entryPoint:'fs', targets:[{format}]},
    primitive:{topology:'point-list'}
  });
  status.textContent = 'WebGPU ready. Shake or drag to train.';
}

function step(){
  // Causal input: accel + pointer
  const input = [
    Math.tanh(accel.x*0.1),
    Math.tanh(accel.y*0.1),
    pointer.x*2-1,
    pointer.y*2-1
  ];
  // Target: encourage particles toward center or cards (simple)
  const target = [Math.sin(performance.now()*0.001)*0.5, Math.cos(performance.now()*0.001)*0.5];
  onlineUpdate(input, target);
  const out = rnnForward(input); // force direction

  // Apply to cards (hybrid DOM)
  cards.forEach((c,i)=>{
    c.vx += out[0]*0.2 + (Math.random()-0.5)*0.05;
    c.vy += out[1]*0.2 + (Math.random()-0.5)*0.05;
    c.vx *= 0.92; c.vy *= 0.92;
    c.x = Math.max(5, Math.min(90, c.x + c.vx));
    c.y = Math.max(5, Math.min(80, c.y + c.vy));
    c.el.style.left = c.x+'%';
    c.el.style.top = c.y+'%';
    c.el.style.transform = `scale(${1+Math.abs(out[0])*0.3}) rotate(${out[1]*20}deg)`;
  });

  if(device && computePipeline){
    const forceBuf = device.createBuffer({size:8, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    device.queue.writeBuffer(forceBuf, 0, new Float32Array([out[0], out[1]]));
    const bindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries:[
        {binding:0, resource:{buffer:particlesBuf}},
        {binding:1, resource:{buffer:forceBuf}}
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(N/64));
    pass.end();
    // render
    const ctx = canvas.getContext('webgpu');
    const texture = ctx.getCurrentTexture();
    const rpass = encoder.beginRenderPass({colorAttachments:[{view:texture.createView(), loadOp:'clear', storeOp:'store', clearValue:{r:0.05,g:0.05,b:0.1,a:1}}]});
    rpass.setPipeline(renderPipeline);
    rpass.setBindGroup(0, device.createBindGroup({layout:renderPipeline.getBindGroupLayout(0), entries:[{binding:0, resource:{buffer:particlesBuf}}]}));
    rpass.draw(1, N);
    rpass.end();
    device.queue.submit([encoder.finish()]);
  } else {
    // 2D fallback draw
    const ctx2 = canvas.getContext('2d');
    if(ctx2){
      ctx2.fillStyle='rgba(10,10,18,0.3)';
      ctx2.fillRect(0,0,canvas.width,canvas.height);
      ctx2.fillStyle='#69f';
      for(let i=0;i<40;i++){
        ctx2.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2,2);
      }
    }
  }
  requestAnimationFrame(step);
}

function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
window.addEventListener('resize', resize); resize();

document.getElementById('seal').onclick = async ()=>{
  const genome = {Wih, Whh, Who, fitness};
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(genome)));
  const h = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const db = await openDB();
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({id:'champ', genome, hash:h, ts:Date.now()});
  status.textContent = 'Sealed '+h+' fitness '+fitness.toFixed(2);
};
document.getElementById('load').onclick = async ()=>{
  const db = await openDB();
  const rec = await db.transaction('genomes').objectStore('genomes').get('champ');
  if(rec){ Object.assign({Wih,Whh,Who}, rec.genome); fitness=rec.genome.fitness||0; status.textContent='Loaded '+rec.hash; }
};
document.getElementById('export').onclick = ()=>{
  const g = {Wih,Whh,Who,fitness};
  document.getElementById('payload').value = JSON.stringify(g);
};
document.getElementById('inject').onclick = ()=>{
  try{
    const g = JSON.parse(document.getElementById('payload').value);
    if(g.Wih) Object.assign({Wih:g.Wih, Whh:g.Whh, Who:g.Who});
    fitness = g.fitness||0;
    status.textContent='Injected';
  }catch(e){ status.textContent='Bad JSON'; }
};
document.getElementById('evolve').onclick = ()=>{
  // mutate
  for(let m of [Wih,Whh,Who]) for(let row of m) for(let i=0;i<row.length;i++) if(Math.random()<0.1) row[i] += (Math.random()-0.5)*0.1;
  status.textContent='Mutated';
};

function openDB(){
  return new Promise(res=>{
    const r = indexedDB.open('void-f313',1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('genomes',{keyPath:'id'});
    r.onsuccess = ()=> res(r.result);
  });
}

initWebGPU().then(()=> requestAnimationFrame(step));
status.textContent = 'Ready. Grant motion permission if prompted. Drag or shake.';

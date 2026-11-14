const canvas = document.getElementById('c');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
const N = 10;
const spheres = [];
const portals = [];
let orientation = {alpha:0,beta:0,gamma:0};
let lastOri = {...orientation};
let pointer = {x:0,y:0,vx:0,vy:0};
let gpu = null;
let ctx2d = null;
let useGPU = false;

function rand(a,b){return a+Math.random()*(b-a);}
function mlp(w, x){ // tiny 3->2 MLP
  const h = Math.tanh(w[0]*x[0]+w[1]*x[1]+w[2]*x[2]+w[3]);
  return [
    Math.tanh(w[4]*h + w[5]),
    Math.tanh(w[6]*h + w[7]),
    Math.tanh(w[8]*h + w[9])
  ];
}

function initAgents(){
  spheres.length = 0;
  portalsEl.innerHTML = '';
  portals.length = 0;
  for(let i=0;i<N;i++){
    const w = Array.from({length:12},()=>rand(-0.8,0.8));
    spheres.push({
      pos:[rand(-1.2,1.2),rand(-1.2,1.2),rand(1.5,3.5)],
      vel:[0,0,0],
      r:rand(0.15,0.35),
      energy:0.5,
      w,
      color:`hsl(${rand(0,360)},70%,60%)`
    });
    const p = document.createElement('div');
    p.className = 'portal';
    p.textContent = `A${i}`;
    portalsEl.appendChild(p);
    portals.push(p);
  }
}

function project(pos){
  const z = pos[2];
  const f = 1.8 / z;
  return {
    x: (pos[0]*f + 1)*0.5 * canvas.width,
    y: (-pos[1]*f + 1)*0.5 * canvas.height,
    s: (spheres[0].r * f) * canvas.height * 0.4
  };
}

function updateAgents(){
  const dAlpha = (orientation.alpha - lastOri.alpha) * 0.01;
  const dBeta = (orientation.beta - lastOri.beta) * 0.01;
  const dGamma = (orientation.gamma - lastOri.gamma) * 0.01;
  lastOri = {...orientation};
  const input = [dAlpha, dBeta, dGamma];
  for(const s of spheres){
    const out = mlp(s.w, input);
    s.vel[0] += out[0]*0.008;
    s.vel[1] += out[1]*0.008;
    s.vel[2] += out[2]*0.004;
    s.vel[0] *= 0.96; s.vel[1] *= 0.96; s.vel[2] *= 0.98;
    s.pos[0] += s.vel[0]; s.pos[1] += s.vel[1]; s.pos[2] += s.vel[2];
    s.pos[0] = Math.max(-2,Math.min(2,s.pos[0]));
    s.pos[1] = Math.max(-1.5,Math.min(1.5,s.pos[1]));
    s.pos[2] = Math.max(1.2,Math.min(5,s.pos[2]));
    s.energy = Math.min(1, s.energy*0.99 + Math.hypot(...s.vel)*8);
    s.r = Math.max(0.1, Math.min(0.5, s.r + out[2]*0.002));
  }
  // pointer attractor
  if(pointer.vx || pointer.vy){
    let best=0, bestD=1e9;
    for(let i=0;i<N;i++){
      const pr = project(spheres[i].pos);
      const d = Math.hypot(pr.x-pointer.x, pr.y-pointer.y);
      if(d<bestD){bestD=d;best=i;}
    }
    if(bestD<120){
      spheres[best].vel[0] += pointer.vx*0.0002;
      spheres[best].vel[1] -= pointer.vy*0.0002;
    }
  }
}

function updatePortals(){
  for(let i=0;i<N;i++){
    const pr = project(spheres[i].pos);
    const p = portals[i];
    p.style.left = pr.x+'px';
    p.style.top = pr.y+'px';
    p.style.transform = `translate(-50%,-50%) scale(${0.7+spheres[i].energy})`;
    p.textContent = `A${i} e:${spheres[i].energy.toFixed(2)}`;
    p.style.borderColor = spheres[i].color;
  }
}

function draw2D(){
  if(!ctx2d) return;
  ctx2d.fillStyle = '#050510';
  ctx2d.fillRect(0,0,canvas.width,canvas.height);
  // simple sky gradient
  const g = ctx2d.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#1a1a40'); g.addColorStop(1,'#050510');
  ctx2d.fillStyle = g;
  ctx2d.fillRect(0,0,canvas.width,canvas.height);
  for(const s of spheres){
    const pr = project(s.pos);
    ctx2d.beginPath();
    ctx2d.arc(pr.x, pr.y, Math.max(4, pr.s*1.5), 0, Math.PI*2);
    ctx2d.fillStyle = s.color;
    ctx2d.globalAlpha = 0.7 + s.energy*0.3;
    ctx2d.fill();
    ctx2d.globalAlpha = 1;
  }
}

async function initGPU(){
  if(!navigator.gpu) return false;
  try{
    const adapter = await navigator.gpu.requestAdapter();
    if(!adapter) return false;
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({device, format, alphaMode:'opaque'});
    const shader = `
    @group(0) @binding(0) var<uniform> spheres: array<vec4f, ${N}>;
    @group(0) @binding(1) var<uniform> res: vec2f;
    @fragment
    fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
      let uv = pos.xy / res;
      var col = vec3f(0.02,0.02,0.08) + vec3f(uv.y*0.1, 0.05, 0.15);
      for(var i=0u; i<${N}u; i++){
        let c = spheres[i].xy;
        let r = spheres[i].z;
        let d = length(pos.xy - c);
        if(d < r){
          let nd = d/r;
          col = mix(col, vec3f(0.4,0.6,1.0)* (1.0-nd*0.5), 0.85);
        }
      }
      return vec4f(col,1);
    }
    @vertex fn vs(@builtin(vertex_index) vi:u32) -> @builtin(position) vec4f {
      var p = array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
      return vec4f(p[vi],0,1);
    }`;
    const module = device.createShaderModule({code:shader});
    const pipeline = device.createRenderPipeline({
      layout:'auto',
      vertex:{module, entryPoint:'vs'},
      fragment:{module, entryPoint:'fs', targets:[{format}]},
      primitive:{topology:'triangle-list'}
    });
    const sphereBuf = device.createBuffer({size:N*16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const resBuf = device.createBuffer({size:8, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const bindGroup = device.createBindGroup({
      layout:pipeline.getBindGroupLayout(0),
      entries:[
        {binding:0, resource:{buffer:sphereBuf}},
        {binding:1, resource:{buffer:resBuf}}
      ]
    });
    gpu = {device, context, pipeline, sphereBuf, resBuf, bindGroup, format};
    return true;
  }catch(e){ console.warn(e); return false; }
}

function renderGPU(){
  if(!gpu) return;
  const data = new Float32Array(N*4);
  for(let i=0;i<N;i++){
    const pr = project(spheres[i].pos);
    data[i*4] = pr.x;
    data[i*4+1] = pr.y;
    data[i*4+2] = Math.max(8, pr.s*2);
    data[i*4+3] = 0;
  }
  gpu.device.queue.writeBuffer(gpu.sphereBuf, 0, data);
  gpu.device.queue.writeBuffer(gpu.resBuf, 0, new Float32Array([canvas.width, canvas.height]));
  const encoder = gpu.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments:[{view:gpu.context.getCurrentTexture().createView(), loadOp:'clear', storeOp:'store', clearValue:{r:0,g:0,b:0,a:1}}]
  });
  pass.setPipeline(gpu.pipeline);
  pass.setBindGroup(0, gpu.bindGroup);
  pass.draw(6);
  pass.end();
  gpu.device.queue.submit([encoder.finish()]);
}

function loop(){
  updateAgents();
  updatePortals();
  if(useGPU) renderGPU();
  else draw2D();
  requestAnimationFrame(loop);
}

function resize(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  if(ctx2d) ctx2d = canvas.getContext('2d');
}
addEventListener('resize', resize);
resize();

addEventListener('pointermove', e=>{
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

if('DeviceOrientationEvent' in window){
  addEventListener('deviceorientation', e=>{
    orientation.alpha = e.alpha||0;
    orientation.beta = e.beta||0;
    orientation.gamma = e.gamma||0;
  });
  statusEl.textContent = 'Orientation ready. Tilt to influence agents.';
}else{
  statusEl.textContent = 'No orientation. Use pointer.';
}

document.getElementById('seal').onclick = ()=>{
  const data = spheres.map(s=>({w:s.w, pos:s.pos.slice(), energy:s.energy}));
  try{
    localStorage.setItem('verse-f727-genome', JSON.stringify(data));
    statusEl.textContent = 'Genome sealed to localStorage.';
  }catch(e){ statusEl.textContent = 'Seal failed.'; }
};
document.getElementById('reset').onclick = ()=>{ initAgents(); statusEl.textContent = 'Reset.'; };

initAgents();
initGPU().then(ok=>{
  useGPU = ok;
  if(!ok){
    ctx2d = canvas.getContext('2d');
    statusEl.textContent += ' (Canvas2D fallback)';
  }else{
    statusEl.textContent += ' (WebGPU active)';
  }
  loop();
});

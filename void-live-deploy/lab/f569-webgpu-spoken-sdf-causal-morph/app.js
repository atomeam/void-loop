const canvas = document.getElementById('c');
const status = document.getElementById('status');
const txt = document.getElementById('txt');
let mind = new Float32Array(16);
let lastToken = 'verse';
let density = null; // for fallback

function hashEmbed(s) {
  const e = new Float32Array(16);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    e[i % 16] += Math.sin(c * 0.1 + i) * 0.3;
  }
  // normalize
  let n = 0; for (let v of e) n += v*v; n = Math.sqrt(n)||1;
  for (let i=0;i<16;i++) e[i]/=n;
  return e;
}

function updateMind(emb) {
  for (let i=0;i<16;i++) mind[i] = mind[i]*0.85 + emb[i]*0.15;
}

// Speech
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
if (SpeechRec) {
  rec = new SpeechRec();
  rec.lang = 'en-US';
  rec.onresult = e => {
    lastToken = e.results[0][0].transcript.trim().split(/\s+/)[0] || 'voice';
    txt.value = lastToken;
    status.textContent = 'heard: ' + lastToken;
  };
}
document.getElementById('speak').onclick = () => { if(rec) rec.start(); else status.textContent='speech not supported'; };
document.getElementById('seed').onclick = () => inject(txt.value || lastToken);
txt.onkeydown = e => { if(e.key==='Enter') inject(txt.value); };

function inject(token) {
  if(!token) return;
  lastToken = token;
  const emb = hashEmbed(token.toLowerCase());
  updateMind(emb);
  status.textContent = 'injected "' + token + '" · mind phase ' + mind[0].toFixed(2);
  if (gpu) gpuInject(emb); else canvasInject(emb);
}

// ---------- WebGPU path ----------
let gpu = null;
async function initGPU() {
  if (!navigator.gpu) return false;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  // Simple density: we'll simulate a low-res 3D texture conceptually via uniforms + procedural
  // For a true compute volume we'd need storage textures; keep this minimal & runnable
  const shader = `
    @group(0) @binding(0) var<uniform> u: Uniforms;
    struct Uniforms { time: f32, mind: array<f32,16>, mouse: vec2<f32>, res: vec2<f32> };
    struct VSOut { @builtin(position) pos: vec4<f32> };

    @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
      var p = array<vec2<f32>, 6>(
        vec2(-1.,-1.), vec2(1.,-1.), vec2(-1.,1.),
        vec2(-1.,1.), vec2(1.,-1.), vec2(1.,1.)
      );
      var o: VSOut;
      o.pos = vec4(p[i], 0., 1.);
      return o;
    }

    fn sdSphere(p: vec3<f32>, r: f32) -> f32 { return length(p) - r; }
    fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
      let q = abs(p) - b;
      return length(max(q, vec3(0.))) + min(max(q.x, max(q.y, q.z)), 0.);
    }

    fn scene(p: vec3<f32>) -> f32 {
      let t = u.time;
      let m0 = u.mind[0];
      let m1 = u.mind[1];
      var d = sdSphere(p - vec3(sin(t*0.3+m0)*1.2, cos(t*0.2)*0.6, 0.), 0.7 + m1*0.4);
      d = min(d, sdBox(p - vec3(0., -0.8 + sin(t+m0), cos(t*0.4)*0.5), vec3(0.5, 0.3+m0*0.2, 0.5)));
      // portals: subtract spheres where mind is low
      d = max(d, -sdSphere(p - vec3(1.5*sin(t*0.5), 0.5, 1.2), 0.4 + abs(m0)*0.3));
      return d;
    }

    @fragment fn fs(in: VSOut) -> @location(0) vec4<f32> {
      let uv = (in.pos.xy / u.res) * 2. - 1.;
      let ro = vec3(0., 0., -3.5);
      let rd = normalize(vec3(uv.x * 1.2, uv.y, 1.));
      var t = 0.;
      var col = vec3(0.02, 0.03, 0.08);
      for (var i = 0; i < 48; i++) {
        let p = ro + rd * t;
        let d = scene(p);
        if (d < 0.002) {
          let n = normalize(vec3(
            scene(p+vec3(0.01,0,0)) - scene(p-vec3(0.01,0,0)),
            scene(p+vec3(0,0.01,0)) - scene(p-vec3(0,0.01,0)),
            scene(p+vec3(0,0,0.01)) - scene(p-vec3(0,0,0.01))
          ));
          let light = normalize(vec3(0.6, 0.8, -0.4));
          let diff = max(dot(n, light), 0.);
          let mindc = vec3(u.mind[2], u.mind[3], u.mind[4]) * 0.5 + 0.5;
          col = mindc * (0.3 + diff * 0.7) + vec3(0.1);
          // portal glow
          if (d < -0.01) col += vec3(0.4, 0.2, 0.6);
          break;
        }
        t += d * 0.8;
        if (t > 12.) break;
      }
      return vec4(col, 1.);
    }
  `;
  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
  });
  const ubuf = device.createBuffer({ size: 16*4 + 16 + 8 + 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }]
  });

  gpu = { device, context, pipeline, ubuf, bind, format };
  status.textContent = 'WebGPU SDF ready · speak or type';
  return true;
}

function gpuInject(emb) {
  // mind already updated; next frame will pick it up
}

function frameGPU(t) {
  if (!gpu) return;
  const { device, context, pipeline, ubuf, bind } = gpu;
  const arr = new Float32Array(4 + 16 + 2 + 2);
  arr[0] = t * 0.001;
  for (let i=0;i<16;i++) arr[1+i] = mind[i];
  arr[17] = (pointer.x / canvas.width)*2-1;
  arr[18] = (pointer.y / canvas.height)*2-1;
  arr[19] = canvas.width;
  arr[20] = canvas.height;
  device.queue.writeBuffer(ubuf, 0, arr);
  const enc = device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: [0.02,0.03,0.06,1],
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.draw(6);
  pass.end();
  device.queue.submit([enc.finish()]);
  requestAnimationFrame(frameGPU);
}

// ---------- Canvas 2D fallback ----------
const ctx = canvas.getContext('2d');
let particles = [];
function canvasInject(emb) {
  for (let i=0;i<30;i++) {
    particles.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      vx: (Math.random()-0.5)*2 + emb[0]*3,
      vy: (Math.random()-0.5)*2 + emb[1]*3,
      life: 80 + Math.random()*40,
      c: `hsl(${(emb[2]*180+180)|0},70%,60%)`
    });
  }
}
function frameCanvas() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  particles = particles.filter(p => p.life-- > 0);
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.98; p.vy *= 0.98;
    // mind bias
    p.vx += mind[0]*0.05; p.vy += mind[1]*0.05;
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.28); ctx.fill();
  }
  // portals
  ctx.strokeStyle = `rgba(180,100,220,${0.4+Math.abs(mind[0])*0.3})`;
  ctx.beginPath(); ctx.arc(canvas.width*0.7, canvas.height*0.4, 40+mind[2]*20, 0, 6.28); ctx.stroke();
  requestAnimationFrame(frameCanvas);
}

// Pointer
const pointer = {x:0,y:0};
canvas.onpointermove = e => { pointer.x = e.clientX; pointer.y = e.clientY; };
canvas.onclick = e => {
  // portal click: shift mind
  for (let i=0;i<16;i++) mind[i] = (mind[i] + 0.3) % 1.0 - 0.5;
  status.textContent = 'portal entered · mind shifted';
};

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// boot
(async () => {
  const ok = await initGPU();
  if (ok) {
    requestAnimationFrame(frameGPU);
  } else {
    status.textContent = 'WebGPU unavailable · canvas fallback';
    frameCanvas();
  }
  inject('verse');
})();

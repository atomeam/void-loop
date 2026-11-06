const canvas = document.getElementById('c');
const statusEl = document.getElementById('status');
const HIST = 32, DIM = 16, HEADS = 4;
let history = []; // {x,y,ox,oy,dx,dy}
let weights = null; // simple QKV-like matrices flattened
let portals = [];
let db = null;
let gpu = null, ctx = null, pipeline = null, texture = null, sampler = null;
let useGPU = false;
let orientEnabled = false;

function initWeights() {
  weights = new Float32Array(HEADS * DIM * DIM * 3); // rough Q,K,V per head
  for (let i = 0; i < weights.length; i++) weights[i] = (Math.random() - 0.5) * 0.2;
}

async function openDB() {
  return new Promise((res) => {
    const r = indexedDB.open('f555-attention', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('weights');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}

async function loadWeights() {
  if (!db) return;
  return new Promise((res) => {
    const tx = db.transaction('weights', 'readonly');
    const g = tx.objectStore('weights').get('current');
    g.onsuccess = () => res(g.result || null);
    g.onerror = () => res(null);
  });
}

async function saveWeights() {
  if (!db || !weights) return;
  const tx = db.transaction('weights', 'readwrite');
  tx.objectStore('weights').put(weights, 'current');
}

function pushSample(x, y, ox=0, oy=0) {
  const prev = history[history.length-1] || {x, y};
  history.push({x, y, ox, oy, dx: x-prev.x, dy: y-prev.y});
  if (history.length > HIST) history.shift();
}

function runAttention() {
  if (history.length < 4) return new Float32Array(64*64);
  // Simplified multi-head: treat samples as tokens, compute crude attention map
  const map = new Float32Array(64*64);
  const n = history.length;
  for (let h = 0; h < HEADS; h++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const a = history[i], b = history[j];
        let score = (a.x - b.x) * (a.dx - b.dx) + (a.y - b.y) * (a.dy - b.dy);
        score += (a.ox - b.ox) * 0.1 + (a.oy - b.oy) * 0.1;
        score = Math.tanh(score * 0.01 + weights[(h*n*n + i*n + j) % weights.length] * 2);
        const ix = Math.floor((i / n) * 64);
        const iy = Math.floor((j / n) * 64);
        map[iy*64 + ix] += Math.max(0, score);
      }
    }
  }
  // normalize
  let mx = 0;
  for (let v of map) mx = Math.max(mx, v);
  if (mx > 0) for (let i = 0; i < map.length; i++) map[i] /= mx;
  return map;
}

function spawnPortals(map) {
  // prune old
  portals = portals.filter(p => p.el.parentNode);
  if (portals.length > 10) {
    const old = portals.shift();
    old.el.remove();
  }
  for (let i = 0; i < map.length; i += 8) {
    if (map[i] > 0.65 && Math.random() < 0.15) {
      const ix = i % 64, iy = Math.floor(i / 64);
      const px = (ix / 64) * window.innerWidth;
      const py = (iy / 64) * window.innerHeight;
      const pred = history.length ? (history[history.length-1].dx * 8).toFixed(1) + ',' + (history[history.length-1].dy * 8).toFixed(1) : '0,0';
      const el = document.createElement('div');
      el.className = 'portal';
      el.style.left = (px - 40) + 'px';
      el.style.top = (py - 20) + 'px';
      el.innerHTML = `\u0394 ${pred}<br><small>click to reinforce</small>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
      el.onclick = () => {
        if (history.length) {
          const last = history[history.length-1];
          for (let k = 0; k < 3; k++) pushSample(last.x + last.dx, last.y + last.dy);
        }
        el.style.borderColor = '#f6a';
      };
      document.body.appendChild(el);
      portals.push({el, life: 180});
    }
  }
  portals.forEach(p => { p.life--; if (p.life < 0) { p.el.remove(); } });
}

async function initGPU() {
  if (!navigator.gpu) return false;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  gpu = await adapter.requestDevice();
  ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device: gpu, format, alphaMode: 'opaque' });

  const shader = `
    @group(0) @binding(0) var tex: texture_2d<f32>;
    @group(0) @binding(1) var samp: sampler;
    struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
    @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
      var pos = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(-1,1), vec2f(1,-1), vec2f(1,1));
      var out: VSOut;
      out.pos = vec4f(pos[i], 0, 1);
      out.uv = pos[i] * 0.5 + 0.5;
      return out;
    }
    fn sdf(p: vec3f, uv: vec2f) -> f32 {
      let dens = textureSample(tex, samp, uv).r;
      let sphere = length(p) - 0.6 - dens * 0.4;
      return sphere;
    }
    @fragment fn fs(in: VSOut) -> @location(0) vec4f {
      let uv = in.uv;
      var ro = vec3f(0, 0, -2.2);
      var rd = normalize(vec3f(uv.x*2-1, uv.y*2-1, 1.2));
      var t = 0.0;
      for (var i = 0; i < 48; i++) {
        let p = ro + rd * t;
        let d = sdf(p, uv);
        if (d < 0.002) {
          let n = normalize(vec3f(
            sdf(p+vec3f(0.01,0,0), uv) - sdf(p-vec3f(0.01,0,0), uv),
            sdf(p+vec3f(0,0.01,0), uv) - sdf(p-vec3f(0,0.01,0), uv),
            sdf(p+vec3f(0,0,0.01), uv) - sdf(p-vec3f(0,0,0.01), uv)
          ));
          let light = max(dot(n, normalize(vec3f(0.5,0.8,0.3))), 0.1);
          let col = vec3f(0.2 + uv.x*0.5, 0.3 + light*0.6, 0.8) * light;
          return vec4f(col, 1);
        }
        t += d * 0.8;
        if (t > 6) break;
      }
      return vec4f(0.02, 0.02, 0.05, 1);
    }
  `;
  const module = gpu.createShaderModule({ code: shader });
  pipeline = gpu.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' }
  });
  texture = gpu.createTexture({
    size: [64, 64],
    format: 'r32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
  });
  sampler = gpu.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  return true;
}

function renderGPU(map) {
  if (!useGPU || !gpu) return;
  gpu.queue.writeTexture(
    { texture },
    map,
    { bytesPerRow: 64 * 4, rowsPerImage: 64 },
    [64, 64]
  );
  const commandEncoder = gpu.createCommandEncoder();
  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: ctx.getCurrentTexture().createView(),
      clearValue: { r:0.02, g:0.02, b:0.05, a:1 },
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  pass.setPipeline(pipeline);
  const bindGroup = gpu.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: sampler }
    ]
  });
  pass.setBindGroup(0, bindGroup);
  pass.draw(6);
  pass.end();
  gpu.queue.submit([commandEncoder.finish()]);
}

function renderFallback(map) {
  const c2d = canvas.getContext('2d');
  if (!c2d) return;
  c2d.fillStyle = '#0a0a12';
  c2d.fillRect(0,0,canvas.width,canvas.height);
  const img = c2d.createImageData(64, 64);
  for (let i = 0; i < map.length; i++) {
    const v = Math.min(255, map[i] * 255);
    img.data[i*4] = v * 0.4;
    img.data[i*4+1] = v * 0.6;
    img.data[i*4+2] = v;
    img.data[i*4+3] = 255;
  }
  c2d.putImageData(img, 0, 0);
  // scale up roughly
  c2d.imageSmoothingEnabled = true;
  c2d.drawImage(canvas, 0, 0, 64, 64, 0, 0, canvas.width, canvas.height);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointermove', e => {
  pushSample(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
});

document.getElementById('seal').onclick = async () => {
  await saveWeights();
  statusEl.textContent = 'Weights sealed to IndexedDB';
};

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') startOrient();
    });
  } else {
    startOrient();
  }
};

function startOrient() {
  orientEnabled = true;
  window.addEventListener('deviceorientation', e => {
    if (history.length) {
      const last = history[history.length-1];
      pushSample(last.x, last.y, (e.beta||0)/90, (e.gamma||0)/90);
    }
  });
  statusEl.textContent = 'Orientation active';
}

async function loop() {
  const map = runAttention();
  spawnPortals(map);
  if (useGPU) renderGPU(map);
  else renderFallback(map);
  requestAnimationFrame(loop);
}

(async () => {
  db = await openDB();
  const loaded = await loadWeights();
  if (loaded && loaded.length === weights?.length) {
    weights = loaded;
    statusEl.textContent = 'Loaded sealed weights';
  } else {
    initWeights();
    statusEl.textContent = 'New random weights';
  }
  useGPU = await initGPU();
  if (!useGPU) statusEl.textContent += ' (Canvas2D fallback)';
  loop();
})();

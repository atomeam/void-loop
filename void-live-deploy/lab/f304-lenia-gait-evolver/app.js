'use strict';
const C = LeniaCore, N = 160, R = 12;
const cv = document.getElementById('world'), stats = document.getElementById('stats'), panel = document.getElementById('panel');
let genome = null, params = null, dir = [1, 0], food = null, eaten = 0, gen = 0, bestFit = 0, gpu = null, paused = false;
// ---------- genome from URL hash or storage ----------
function parseG(s) { try { const g = s.split(',').map(Number); return g.length === 6 && g.every(v => v >= 0 && v <= 1) ? g : null; } catch (e) { return null; } }
genome = parseG(location.hash.slice(3)) || parseG(localStorage.getItem('f304-best') || '') || [0.47, 0.46, 0.65, 0.75, 0.42, 0.66];
params = C.decode(genome);
// ---------- WebGL2 Lenia with CPU fallback ----------
function initGPU() {
  const gl = cv.getContext('webgl2', { antialias: false }); if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  const vs = `#version 300 es
  in vec2 p; out vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0,1);}`;
  const stepFs = `#version 300 es
  precision highp float; uniform highp sampler2D S, K; uniform int E; uniform float mu, sg, dt; uniform int n; out vec4 o;
  void main(){ ivec2 c=ivec2(gl_FragCoord.xy); float u=0.;
    for(int dy=-28;dy<=28;dy++){ if(dy<-E||dy>E) continue; for(int dx=-28;dx<=28;dx++){ if(dx<-E||dx>E) continue;
      float w=texelFetch(K,ivec2(dx+E,dy+E),0).r; if(w==0.) continue;
      u+=w*texelFetch(S,(c+ivec2(dx,dy)+ivec2(n))%n,0).r; } }
    float a=texelFetch(S,c,0).r, d=u-mu, v=clamp(a+dt*(2.*exp(-d*d/(2.*sg*sg))-1.),0.,1.); o=vec4(v,0,0,1);} `;
  const drawFs = `#version 300 es
  precision highp float; uniform highp sampler2D S; uniform vec2 food; uniform float t; in vec2 uv; out vec4 o;
  void main(){ float a=texture(S,uv).r; vec3 col=mix(vec3(.008,.008,.03),vec3(.15,.25,.9),smoothstep(0.,.35,a));
    col=mix(col,vec3(1.,.85,.55),smoothstep(.45,1.,a)); col+=vec3(.6,.3,.9)*.25*smoothstep(.02,.0,abs(a-.12));
    float fd=length((uv-food)*vec2(1.,1.)); if(food.x>=0.) col+=vec3(1.,.5,.2)*smoothstep(.02,.0,fd)*(.7+.3*sin(t*6.));
    o=vec4(col,1);} `;
  function prog(f) { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, f]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); return p; }
  const P = prog(stepFs), D = prog(drawFs);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindAttribLocation(P, 0, 'p'); gl.bindAttribLocation(D, 0, 'p'); gl.linkProgram(P); gl.linkProgram(D);
  function tex(w, h, data) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST); return t; }
  const T = [tex(N, N, null), tex(N, N, null)], F = T.map(t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; });
  let cur = 0, ktex = null, E = 0; const read = new Float32Array(N * N * 4);
  return {
    kind: 'WebGL2',
    load(A) { gl.bindTexture(gl.TEXTURE_2D, T[cur]); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.FLOAT, A); },
    setKernel(offs) { let ext = 0; for (let i = 0; i < offs.length; i += 3) ext = Math.max(ext, Math.abs(offs[i]), Math.abs(offs[i + 1])); E = Math.min(28, ext); const W = 2 * E + 1, k = new Float32Array(W * W);
      for (let i = 0; i < offs.length; i += 3) if (Math.abs(offs[i]) <= E && Math.abs(offs[i + 1]) <= E) k[(offs[i + 1] + E) * W + offs[i] + E] = offs[i + 2];
      if (ktex) gl.deleteTexture(ktex); ktex = tex(W, W, k); },
    step(p) { gl.useProgram(P); gl.viewport(0, 0, N, N); gl.bindFramebuffer(gl.FRAMEBUFFER, F[1 - cur]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T[cur]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ktex);
      gl.uniform1i(gl.getUniformLocation(P, 'S'), 0); gl.uniform1i(gl.getUniformLocation(P, 'K'), 1); gl.uniform1i(gl.getUniformLocation(P, 'E'), E); gl.uniform1i(gl.getUniformLocation(P, 'n'), N);
      gl.uniform1f(gl.getUniformLocation(P, 'mu'), p.mu); gl.uniform1f(gl.getUniformLocation(P, 'sg'), p.sigma); gl.uniform1f(gl.getUniformLocation(P, 'dt'), p.dt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); cur = 1 - cur; },
    readback() { gl.bindFramebuffer(gl.FRAMEBUFFER, F[cur]); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, read); const A = new Float32Array(N * N); for (let i = 0; i < N * N; i++) A[i] = read[i * 4]; return A; },
    draw(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(D); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T[cur]);
      gl.uniform1i(gl.getUniformLocation(D, 'S'), 0); gl.uniform2f(gl.getUniformLocation(D, 'food'), food ? food[0] / N : -1, food ? food[1] / N : -1); gl.uniform1f(gl.getUniformLocation(D, 't'), t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  };
}
function initCPU() {
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), off = document.createElement('canvas'); off.width = off.height = N; const octx = off.getContext('2d');
  let A = new Float32Array(N * N), B = new Float32Array(N * N), offs = [];
  return { kind: 'CPU fallback', load(a) { A.set(a); }, setKernel(o) { offs = o; }, step(p) { C.step(A, B, N, offs, p); const t = A; A = B; B = t; }, readback() { return A; },
    draw() { for (let i = 0; i < N * N; i++) { const a = A[i]; img.data[i*4] = 40 + 215 * a * a; img.data[i*4+1] = 50 + 170 * a; img.data[i*4+2] = 30 + 200 * Math.sqrt(a); img.data[i*4+3] = 255; }
      octx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, cv.width, cv.height);
      if (food) { ctx.fillStyle = '#ffa050'; ctx.beginPath(); ctx.arc(food[0] / N * cv.width, (1 - food[1] / N) * cv.height, 7, 0, 7); ctx.fill(); } } };
}
function resize() { const s = Math.min(innerWidth, innerHeight); cv.width = cv.height = Math.round(s * Math.min(devicePixelRatio || 1, 2)); }
resize(); addEventListener('resize', resize);
try { gpu = initGPU(); } catch (e) { console.warn('WebGL2 path failed, using CPU', e); gpu = null; }
if (!gpu) gpu = initCPU();
function respawn() { const A = new Float32Array(N * N); C.seedBlob(A, N, R, (Math.random() * 1e9) | 0); gpu.load(A); seedMass = C.com(A, N).m; }
function applyGenome(g) { genome = g; params = C.decode(g); gpu.setKernel(C.kernel(params, R, dir[0], dir[1])); drawProfile(); morphPanel(); }
// ---------- physical UI: panel outline and HUD bend with the creature's kernel and the optimiser's step ----------
function drawProfile() { const c = document.getElementById('profile').getContext('2d'), w = 300, h = 46; c.clearRect(0, 0, w, h); c.strokeStyle = '#9fb2ff'; c.beginPath();
  for (let x = 0; x <= w; x++) { const v = C.shell(x / w, [1, params.b2, params.b3]); x ? c.lineTo(x, h - 4 - v * (h - 8)) : c.moveTo(x, h - 4 - v * (h - 8)); } c.stroke(); }
function morphPanel() { const lean = (8 + 40 * params.shift).toFixed(0);
  panel.style.borderRadius = `${8 + 30 * params.b2}px ${8 + 30 * params.b3}px ${lean}px ${10 + 200 * params.sigma}px`;
  panel.style.boxShadow = `${(-dir[0] * 10 * params.shift).toFixed(1)}px ${(dir[1] * 10 * params.shift).toFixed(1)}px 28px rgba(110,130,255,.35)`; }
// ---------- evolution strategy in a Worker ----------
const coreURL = new URL('core.js', location.href).href;
const wsrc = `importScripts(${JSON.stringify(coreURL)}); const C=self.LeniaCore; let es=null, run=true;
onmessage=e=>{ if(e.data.init){ es=C.makeES(6,e.data.seed,{pop:10,init:e.data.init}); loop(); } if('run' in e.data){ run=e.data.run; if(run) loop(); } };
function loop(){ if(!run) return; const gs=es.ask(), fs=gs.map(g=>C.evaluate(g,{N:40,R:6,T:70,seeds:[(es.gen%7)+1]})); es.tell(gs,fs);
  postMessage({gen:es.gen,best:es.best,bestFit:es.bestFit,gradNorm:es.gradNorm,mean:es.mean,genFit:Math.max(...fs)}); setTimeout(loop,30); }`;
const worker = new Worker(URL.createObjectURL(new Blob([wsrc], { type: 'text/javascript' })));
let swapped = 0;
worker.onmessage = e => { const m = e.data; gen = m.gen; document.documentElement.style.setProperty('--skew', `${Math.max(-6, Math.min(6, (m.gradNorm * 60) * (gen % 2 ? 1 : -1))).toFixed(2)}deg`);
  if (m.best && m.bestFit > bestFit + 0.05) { bestFit = m.bestFit; applyGenome(m.best); swapped++; localStorage.setItem('f304-best', m.best.map(v => v.toFixed(4)).join(',')); }
  render(); };
worker.postMessage({ init: genome, seed: (Math.random() * 1e9) | 0 });
// ---------- interaction ----------
function placeFood(ev) { const r = cv.getBoundingClientRect(); food = [(ev.clientX - r.left) / r.width * N, (1 - (ev.clientY - r.top) / r.height) * N]; }
cv.addEventListener('pointerdown', placeFood);
document.getElementById('pause').onclick = e => { paused = !paused; worker.postMessage({ run: !paused }); e.target.textContent = paused ? 'Resume evolution' : 'Pause evolution'; };
document.getElementById('reseed').onclick = respawn;
document.getElementById('share').onclick = () => { const u = location.href.split('#')[0] + '#g=' + genome.map(v => v.toFixed(4)).join(','); navigator.clipboard && navigator.clipboard.writeText(u); location.hash = 'g=' + genome.map(v => v.toFixed(4)).join(','); };
let mass = 0, pos = [N / 2, N / 2], seedMass = 0, explosions = 0;
function render() { stats.textContent = `engine: ${gpu.kind}\ngeneration ${gen} · best gait fitness ${bestFit.toFixed(2)} · swaps ${swapped}\nfood eaten ${eaten} · creature mass ${mass.toFixed(0)} · respawns from blow-ups ${explosions}\nμ ${params.mu.toFixed(3)}  σ ${params.sigma.toFixed(3)}  shift ${params.shift.toFixed(2)}`; }
// ---------- main loop ----------
respawn(); applyGenome(genome); render();
let frame = 0; const t0 = performance.now();
function tick() { for (let s = 0; s < 2; s++) gpu.step(params);
  if (++frame % 6 === 0) { const A = gpu.readback(), c = C.com(A, N); mass = c.m; pos = [c.x, c.y];
    if (mass < 5) respawn(); else if (mass > 3 * seedMass) { explosions++; respawn(); }
    if (food) { const dx = C.wrapD(food[0] - c.x, N), dy = C.wrapD(food[1] - c.y, N), d = Math.hypot(dx, dy);
      if (d < R * 0.9) { eaten++; food = null; } else { const nd = [dx / d, dy / d]; if (nd[0] * dir[0] + nd[1] * dir[1] < 0.995) { dir = nd; gpu.setKernel(C.kernel(params, R, dir[0], dir[1])); morphPanel(); } } }
    render(); }
  gpu.draw((performance.now() - t0) / 1000); requestAnimationFrame(tick); }
requestAnimationFrame(tick);
window.__f304 = () => ({ engine: gpu.kind, gen, bestFit, mass, pos, eaten, swapped, explosions, seedMass, setFood: (x, y) => { food = [x, y]; } });

import { TileMind, WFC, sampleMap, TILES, exactRules } from './core.js';
const n = TILES.length, SW = 24, SH = 24, WW = 48, WH = 48;
const qs = new URLSearchParams(location.search);
const st = { tile: 3, mind: null, map: null, rules: null, wfc: null, dirty: true, mode: 'acc', D: 8192, damage: 0, t0: 0, decodeMs: 0, learnMs: 0 };
const $ = id => document.getElementById(id);
function saveMap() { try { localStorage.setItem('f227-map', Array.from(st.map).join('')); } catch {} }
function loadMap() { try { const s = localStorage.getItem('f227-map'); if (s && s.length === SW * SH) return Uint8Array.from(s, c => +c); } catch {} return sampleMap(SW, SH, 3); }
function rebuildMind() { const t = performance.now(); st.mind = new TileMind(n, st.D, 7); st.mind.learnMap(st.map, SW, SH); st.mind.setDamage(st.damage); st.learnMs = performance.now() - t; st.dirty = true; }
function relearnRules() {
  const t = performance.now(); st.rules = st.mind.rules(st.mode, 4); st.decodeMs = performance.now() - t;
  const ex = exactRules(st.map, SW, SH, n); let truth = 0, got = 0, hit = 0;
  for (let d = 0; d < 4; d++) for (let a = 0; a < n; a++) { truth += popc(ex.allowed[d][a]); got += popc(st.rules.allowed[d][a]); hit += popc(ex.allowed[d][a] & st.rules.allowed[d][a]); }
  st.recall = hit / Math.max(1, truth); st.precision = hit / Math.max(1, got); st.truthRules = truth; st.gotRules = got;
  drawRules();
}
const popc = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
function dream(seed = (Math.random() * 1e9) | 0) {
  relearnRules(); const freq = Array.from(st.mind.freq, v => Math.max(0, v));
  st.wfc = new WFC(WW, WH, n, st.rules.allowed, freq, seed); st.t0 = performance.now(); st.dirty = false; st.finishedMs = 0;
}
// ---- sample painter
const sc = $('sample'), sx = sc.getContext('2d');
function drawSample() { const img = sx.createImageData(SW, SH); for (let i = 0; i < SW * SH; i++) { const c = TILES[st.map[i]].color; img.data.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4); } sx.putImageData(img, 0, 0); }
let painting = false, debounce = 0;
function paintAt(e) { const r = sc.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * SW), y = Math.floor((e.clientY - r.top) / r.height * SH); paintCell(x, y, st.tile); }
function paintCell(x, y, t) { for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= SW || Y >= SH) continue; st.mind.edit(st.map, SW, SH, X, Y, t); } drawSample(); saveMap(); clearTimeout(debounce); debounce = setTimeout(() => dream(), 250); }
sc.addEventListener('pointerdown', e => { painting = true; sc.setPointerCapture(e.pointerId); paintAt(e); });
sc.addEventListener('pointermove', e => painting && paintAt(e));
sc.addEventListener('pointerup', () => painting = false);
const pal = $('palette');
TILES.forEach((t, i) => { const b = document.createElement('button'); b.textContent = t.name; b.style.background = `rgb(${t.color.map(v => v * 255 | 0)})`; if (t.name === 'deep' || t.name === 'road' || t.name === 'forest') b.style.color = '#fff'; b.onclick = () => { st.tile = i; [...pal.children].forEach(c => c.classList.toggle('on', c === b)); }; if (i === st.tile) b.classList.add('on'); pal.append(b); });
$('dream').onclick = () => dream();
$('dim').onchange = e => { st.D = +e.target.value; rebuildMind(); dream(); };
$('dmg').oninput = e => { st.damage = +e.target.value / 100; $('dmgv').textContent = e.target.value + '%'; st.mind.setDamage(st.damage); clearTimeout(debounce); debounce = setTimeout(() => dream(), 200); };
$('bin').onchange = e => { st.mode = e.target.checked ? 'bin' : 'acc'; dream(); };
// ---- rule heatmap (max over the 4 directions)
const rc = $('rules'), rx = rc.getContext('2d');
function drawRules() { const img = rx.createImageData(n, n); let mx = 0; const M = new Float64Array(n * n); for (let d = 0; d < 4; d++) for (let k = 0; k < n * n; k++) M[k] = Math.max(M[k], st.rules.Z[d][k]); for (const v of M) mx = Math.max(mx, v); for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const v = mx ? Math.sqrt(M[a * n + b] / mx) : 0, c = TILES[b].color; img.data.set([c[0] * 255 * v, c[1] * 255 * v, c[2] * 255 * v, 255], (a * n + b) * 4); } rx.putImageData(img, 0, 0); rc.style.height = rc.clientWidth + 'px'; }
// ---- world renderer: instanced boxes (WebGL2), 2D fallback
const cv = $('world'); let gl = null, prog, vao, inst, instData, mode3d = false;
try { gl = cv.getContext('webgl2', { antialias: true }); } catch { gl = null; }
function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
try {
  if (!gl) throw new Error('no webgl2');
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `#version 300 es
  layout(location=0) in vec3 p; layout(location=1) in vec3 nrm; layout(location=2) in vec4 ixyh; layout(location=3) in vec4 col;
  uniform mat4 vp; out vec4 vc; out vec3 vn; out float vy;
  void main(){ vec3 w = vec3(ixyh.x + p.x*0.92, p.y*ixyh.z, ixyh.y + p.z*0.92); vy=p.y; vn=nrm; vc=col; gl_Position = vp*vec4(w,1.0); }`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `#version 300 es
  precision highp float; in vec4 vc; in vec3 vn; in float vy; out vec4 o;
  void main(){ float l = 0.45 + 0.55*max(dot(normalize(vn), normalize(vec3(0.4,1.0,0.3))),0.0); vec3 c = vc.rgb*l; if(vc.a<0.99) c += vec3(0.25,0.3,0.6)*vy*0.5; o = vec4(c, vc.a); }`));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const V = [], F = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const [nx, ny, nz] of F) { const u = ny ? [1, 0, 0] : [0, 1, 0], v = [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]]; const c = [nx * 0.5, ny * 0.5 + 0.5, nz * 0.5];
    const q = (s, t) => [c[0] + (u[0] * s + v[0] * t) * 0.5, c[1] + (u[1] * s + v[1] * t) * 0.5, c[2] + (u[2] * s + v[2] * t) * 0.5, nx, ny, nz];
    V.push(...q(-1, -1), ...q(1, -1), ...q(1, 1), ...q(-1, -1), ...q(1, 1), ...q(-1, 1)); }
  vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  instData = new Float32Array(WW * WH * 8); inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.bufferData(gl.ARRAY_BUFFER, instData.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(3, 1);
  mode3d = true;
} catch (e) { console.warn('F227 3D off:', e.message); mode3d = false; gl = null; }
const ctx2 = mode3d ? null : cv.getContext('2d');
function persp(f, a, n0, f0) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f0 + n0) / (n0 - f0), -1, 0, 0, 2 * f0 * n0 / (n0 - f0), 0]; }
function look(e, c) { const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; }
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
function mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
function cellVisual(m) {
  // collapsed: real tile; undecided: translucent pillar, height ~ options left, colour = mix of options
  if (!m) return { h: 0.2, c: [1, 0.1, 0.2, 1] };
  if (!(m & (m - 1))) { const t = TILES[31 - Math.clz32(m)]; return { h: t.h, c: [...t.color, 1] }; }
  let k = 0, r = 0, g = 0, b = 0; for (let t = 0; t < n; t++) if (m & (1 << t)) { k++; r += TILES[t].color[0]; g += TILES[t].color[1]; b += TILES[t].color[2]; }
  return { h: 0.4 + k * 0.35, c: [r / k, g / k, b / k, 0.05 + 0.035 * (n - k)] };
}
let ang = 0.7, lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; ang += dt * 0.06;
  if (st.dirty) dream();
  const w = st.wfc; if (w && !w.failed) { const t = performance.now(); let any = true; while (any && performance.now() - t < 6) any = w.step(); if (!any && !st.finishedMs) st.finishedMs = performance.now() - st.t0; }
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  if (cv.width !== (W * dpr | 0)) { cv.width = W * dpr | 0; cv.height = H * dpr | 0; }
  if (mode3d) {
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0.008, 0.008, 0.03, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const solid = [], ghost = [];
    for (let i = 0; i < WW * WH; i++) { const v = cellVisual(w.cell[i]); (v.c[3] < 0.99 ? ghost : solid).push([i % WW - WW / 2, ((i / WW) | 0) - WH / 2, v.h, 0, ...v.c]); }
    const all = solid.concat(ghost); for (let i = 0; i < all.length; i++) instData.set(all[i], i * 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, instData);
    const R = 62, eye = [Math.cos(ang) * R, 38, Math.sin(ang) * R], vp = mul(persp(0.75, cv.width / cv.height, 0.5, 400), look(eye, [0, 0, 0]));
    gl.useProgram(prog); gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'vp'), false, vp); gl.bindVertexArray(vao);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true); gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, solid.length);
    if (ghost.length) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      // draw ghosts by offsetting the instance pointer to the ghost block
      gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, solid.length * 32); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, solid.length * 32 + 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, ghost.length);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16); gl.depthMask(true); }
  } else {
    const s = Math.min(W, H) / WW * 0.9 * dpr, ox = (cv.width - s * WW) / 2, oy = (cv.height - s * WH) / 2; ctx2.fillStyle = '#020207'; ctx2.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < WW * WH; i++) { const v = cellVisual(w.cell[i]); ctx2.fillStyle = `rgba(${v.c[0] * 255 | 0},${v.c[1] * 255 | 0},${v.c[2] * 255 | 0},${v.c[3]})`; ctx2.fillRect(ox + (i % WW) * s, oy + ((i / WW) | 0) * s, s - 1, s - 1); }
  }
  $('stats').textContent = `renderer: ${mode3d ? 'WebGL2 instanced' : '2D fallback'}\nmemory: ${st.D} dims x 4 directions (${st.mode === 'bin' ? '1 bit' : 'integer'}), damage ${Math.round(st.damage * 100)}%\nrules recovered: ${st.gotRules} (true ${st.truthRules}), recall ${(st.recall * 100).toFixed(0)}%, precision ${(st.precision * 100).toFixed(0)}%\npeels per direction: ${st.rules.peels.join(', ')} (decode ${st.decodeMs.toFixed(0)} ms)\nworld: ${w.done}/${WW * WH} cells decided, ${w.repairs} local repairs${w.failed ? ', gave up' : ''}${st.finishedMs ? `, done in ${st.finishedMs.toFixed(0)} ms` : ''}`;
  requestAnimationFrame(frame);
}
st.map = loadMap(); drawSample(); rebuildMind(); dream(1);
window.__f227 = { st, paintCell, dream, get mode3d() { return mode3d; } };
if (qs.get('auto')) { // synthetic painter for tests: a snow lake inside the water band
  let k = 0; const iv = setInterval(() => { paintCell(4 + (k % 6), 4 + ((k / 6) | 0), 6); if (++k >= 18) { clearInterval(iv); window.__f227.autoDone = true; } }, 40);
}
requestAnimationFrame(frame);

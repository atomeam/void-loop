/**
 * splat — "view a splat", "open a gaussian splat file", "splat viewer": a card that shows a 3D Gaussian splat scan (a .splat file) you drop on it
 * or choose, or a small demo galaxy. The file is read on this device and goes nowhere: no upload, no network at all. Drag (or the arrow keys) to
 * orbit, scroll (or + and −) to zoom, R to reset. It turns by itself unless you prefer reduced motion. WebGL2 draws the splats as sorted,
 * alpha-blended ellipses; a browser without it gets the same picture from a 2D canvas with fewer splats.
 * The reading, the maths and the camera are in splat-core.js (tested in node); the projection follows antimatter15/splat (MIT).
 */
import { parseSplat, project, ellipse, depthOrder, fit, viewOf, perspective, toCamera, demoSplat, MAX_BYTES } from './splat-core.js';

export function splatAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}. ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return /\b(gaussian splat(s|ting)?|3dgs|splat (file|files|viewer|scene|scan|scans|model|capture))\b|\.splat\b|^(view|open|show|load|see|display|look at) (me )?(a |an |my |the |some )?(\w+ ){0,2}splats?$/.test(t) || /^splats?( viewer)?$/.test(t);
}

const VS = `#version 300 es
precision highp float;
in vec2 corner; in vec3 i_center; in vec3 i_a; in vec3 i_b; in vec4 i_color;
uniform mat4 view, proj; uniform vec2 viewport, focal;
out vec4 v_color; out vec2 v_pos;
void main() {
  vec4 cam = view * vec4(i_center, 1.0);
  float d = -cam.z;
  vec4 clip = proj * cam;
  vec3 ndc = clip.xyz / clip.w;
  if (d < 0.05 || abs(ndc.x) > 1.3 || abs(ndc.y) > 1.3 || ndc.z > 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  mat3 S = mat3(i_a.x, i_a.y, i_a.z, i_a.y, i_b.x, i_b.y, i_a.z, i_b.y, i_b.z);
  mat3 J = mat3(focal.x / d, 0.0, 0.0, 0.0, focal.y / d, 0.0, focal.x * cam.x / (cam.z * cam.z), focal.y * cam.y / (cam.z * cam.z), 0.0);
  mat3 T = J * mat3(view);
  mat3 C = T * S * transpose(T);
  float a = C[0][0] + 0.3, b = C[1][0], c = C[1][1] + 0.3;
  float mid = 0.5 * (a + c), rad = length(vec2(0.5 * (a - c), b));
  float l1 = mid + rad, l2 = max(mid - rad, 0.01);
  vec2 v = abs(l1 - c) >= abs(l1 - a) ? vec2(l1 - c, b) : vec2(b, l1 - a);
  vec2 dir = dot(v, v) > 1e-12 ? normalize(v) : vec2(1.0, 0.0);
  vec2 minor = vec2(-dir.y, dir.x);
  float r1 = min(sqrt(l1), 512.0), r2 = min(sqrt(l2), 512.0);
  vec2 p = corner * 3.0;
  v_pos = p; v_color = i_color;
  gl_Position = vec4(ndc.xy + (p.x * r1 * dir + p.y * r2 * minor) * 2.0 / viewport, ndc.z, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec4 v_color; in vec2 v_pos; out vec4 o;
void main() { float r2 = dot(v_pos, v_pos); if (r2 > 9.0) discard; float al = exp(-0.5 * r2) * v_color.a; o = vec4(v_color.rgb * al, al); }`;

const FOV = 0.9, BG = [0.03, 0.03, 0.06];

// WebGL2: one instanced quad per splat, the instances written far to near. Returns null when the browser has no WebGL2.
function glRenderer(canvas) {
  let gl; try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' }); } catch (_) { gl = null; }
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const loc = (n) => gl.getAttribLocation(prog, n), uni = (n) => gl.getUniformLocation(prog, n);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc('corner')); gl.vertexAttribPointer(loc('corner'), 2, gl.FLOAT, false, 0, 0);
  const inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  const STRIDE = 40; // centre 3 f32, covariance 6 f32, colour 4 u8
  for (const [name, size, type, norm, off] of [['i_center', 3, gl.FLOAT, false, 0], ['i_a', 3, gl.FLOAT, false, 12], ['i_b', 3, gl.FLOAT, false, 24], ['i_color', 4, gl.UNSIGNED_BYTE, true, 36]]) {
    gl.enableVertexAttribArray(loc(name)); gl.vertexAttribPointer(loc(name), size, type, norm, STRIDE, off); gl.vertexAttribDivisor(loc(name), 1);
  }
  let count = 0, packed = null, f32 = null, u8 = null;
  return {
    kind: 'webgl2',
    load(scene) { count = scene.count; packed = new ArrayBuffer(count * STRIDE); f32 = new Float32Array(packed); u8 = new Uint8Array(packed); this.scene = scene; },
    // write the splats into the instance buffer in this order (far to near)
    order(order) {
      const { center, sigma, color } = this.scene;
      for (let k = 0; k < count; k++) {
        const i = order[k], o = k * 10;
        f32[o] = center[3 * i]; f32[o + 1] = center[3 * i + 1]; f32[o + 2] = center[3 * i + 2];
        for (let j = 0; j < 6; j++) f32[o + 3 + j] = sigma[6 * i + j];
        u8.set(color.subarray(4 * i, 4 * i + 4), k * STRIDE + 36);
      }
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.bufferData(gl.ARRAY_BUFFER, packed, gl.DYNAMIC_DRAW);
    },
    draw(view, w, h) {
      gl.viewport(0, 0, w, h); gl.clearColor(...BG, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      if (!count) return;
      const proj = perspective(FOV, w / h, 0.05, 1000);
      gl.useProgram(prog); gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uni('view'), false, view); gl.uniformMatrix4fv(uni('proj'), false, proj);
      gl.uniform2f(uni('viewport'), w, h); gl.uniform2f(uni('focal'), (proj[0] * w) / 2, (proj[5] * h) / 2);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
    dispose() { try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (_) {} },
  };
}

// no WebGL2: the same picture from a 2D canvas, thinned to what it can draw quickly
function canvasRenderer(canvas) {
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const CAP = 20000; let scene = null, thin = 1;
  return {
    kind: '2d',
    load(s) { scene = s; thin = Math.max(1, Math.ceil(s.count / CAP)); this.scene = s; },
    order(order) { this.ord = order; },
    draw(view, w, h) {
      ctx.fillStyle = `rgb(${BG.map((v) => Math.round(v * 255)).join(',')})`; ctx.fillRect(0, 0, w, h);
      if (!scene) return;
      const f = (h / 2) / Math.tan(FOV / 2), ord = this.ord || [];
      for (let k = 0; k < ord.length; k += thin) {
        const i = ord[k], c = toCamera(view, [scene.center[3 * i], scene.center[3 * i + 1], scene.center[3 * i + 2]]);
        const p = project(scene.sigma.subarray(6 * i, 6 * i + 6), view, c, f, f); if (!p) continue;
        const e = ellipse(p.a, p.b, p.c), x = w / 2 + (f * c[0]) / p.depth, y = h / 2 - (f * c[1]) / p.depth;
        if (x < -50 || y < -50 || x > w + 50 || y > h + 50) continue;
        ctx.fillStyle = `rgba(${scene.color[4 * i]},${scene.color[4 * i + 1]},${scene.color[4 * i + 2]},${(scene.color[4 * i + 3] / 255) * 0.55})`;
        ctx.beginPath(); ctx.ellipse(x, y, Math.min(e.r1 * 1.6, 200), Math.min(e.r2 * 1.6, 200), -e.angle, 0, Math.PI * 2); ctx.fill();
      }
    },
    dispose() {},
  };
}

function run(text, api) {
  const { showPage, say, loopLog } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Splat viewer</h2>'
      + '<div class="sub">Drop a <b>.splat</b> file on this card, or choose one. It is read on this device and goes nowhere.</div>'
      + '<p><input type="file" accept=".splat" data-splat-file aria-label="Choose a .splat file"> <button type="button" data-splat-demo>Try a demo galaxy</button></p>'
      + '<canvas data-splat-canvas tabindex="0" role="img" aria-label="3D splat scene. Arrow keys orbit, plus and minus zoom, R resets." style="width:100%;aspect-ratio:4/3;display:block;border-radius:10px;background:#08080f;touch-action:none"></canvas>'
      + '<div data-splat-status role="status" aria-live="polite" class="sub">Nothing loaded yet.</div>'
      + '<div class="sub">Drag or arrow keys to orbit · scroll or + − to zoom · R to reset</div>';
  });
  const $ = (s) => el.querySelector(s), canvas = $('[data-splat-canvas]'), status = $('[data-splat-status]');
  const say2 = (msg, alert) => { status.textContent = msg; status.setAttribute('role', alert ? 'alert' : 'status'); };
  const still = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('a2m.void.motion.v1') === 'still'; } catch (_) { return false; } })();
  const R = glRenderer(canvas) || (() => { const c2 = canvas.cloneNode(false); canvas.replaceWith(c2); return canvasRenderer(c2); })();
  const cv = el.querySelector('[data-splat-canvas]');
  if (!R) { say2('This browser cannot draw the splat view (no WebGL2 and no 2D canvas).', true); say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'splat' }); return 'splat'; }
  el.dataset.splatRenderer = R.kind;

  let cam = { yaw: 0.6, pitch: 0.35, dist: 6, target: [0, 0, 0] }, home = null, scene = null, lastSort = { yaw: 1e9, pitch: 1e9, dist: 1e9, t: 0 }, dirty = true, idle = 0, last = performance.now(), raf = 0;
  const load = (s, name) => {
    scene = s; R.load(s); const f = fit(s.center, s.count); cam = { yaw: 0.6, pitch: 0.35, dist: f.dist, target: f.target }; home = { ...cam }; lastSort.yaw = 1e9; dirty = true;
    el.dataset.splatCount = String(s.count);
    say2((name ? name + ': ' : '') + 'Showing ' + s.count.toLocaleString() + ' splats' + (s.step > 1 ? ' (1 in ' + s.step + ' of ' + s.total.toLocaleString() + ')' : '') + '.');
    say('splat scene loaded');
  };
  const useBuffer = (buf, name) => { const r = parseSplat(buf); if (r.error) { say2(r.error, true); return; } if (!r.count) { say2('There was nothing drawable in that file.', true); return; } load(r, name); };
  $('[data-splat-demo]').addEventListener('click', () => useBuffer(demoSplat(), 'Demo galaxy'));
  $('[data-splat-file]').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) readFile(f); });
  async function readFile(f) {
    if (f.size > MAX_BYTES) { say2('That file is larger than ' + Math.round(MAX_BYTES / 1048576) + ' MB; try a smaller or thinned-out scan.', true); return; }
    say2('Reading ' + f.name + '…');
    try { useBuffer(await f.arrayBuffer(), f.name); } catch (_) { say2('I could not read that file.', true); }
  }
  el.addEventListener('dragover', (e) => { e.preventDefault(); });
  el.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });

  // orbit, zoom, reset: pointer, wheel, pinch and keys
  const touch = (n = 4) => { idle = n; dirty = true; };
  const clampDist = (d) => (home ? Math.max(home.dist * 0.15, Math.min(home.dist * 6, d)) : d);
  const pts = new Map(); let pinch = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; touch(); });
  cv.addEventListener('pointerup', (e) => { pts.delete(e.pointerId); pinch = 0; });
  cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = 0; });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { cam.yaw -= (e.clientX - p[0]) * 0.008; cam.pitch += (e.clientY - p[1]) * 0.008; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch)); }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = clampDist(cam.dist * (pinch / d)); pinch = d; }
    touch();
  });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clampDist(cam.dist * Math.exp(e.deltaY * 0.001)); touch(); }, { passive: false });
  cv.addEventListener('keydown', (e) => {
    const k = e.key; let used = true;
    if (k === 'ArrowLeft') cam.yaw -= 0.12; else if (k === 'ArrowRight') cam.yaw += 0.12; else if (k === 'ArrowUp') cam.pitch = Math.min(1.45, cam.pitch + 0.1); else if (k === 'ArrowDown') cam.pitch = Math.max(-1.45, cam.pitch - 0.1);
    else if (k === '+' || k === '=') cam.dist = clampDist(cam.dist / 1.15); else if (k === '-' || k === '_') cam.dist = clampDist(cam.dist * 1.15);
    else if (k === 'r' || k === 'R') { if (home) cam = { ...home }; } else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); touch(); }
  });

  function frame(now) {
    raf = 0;
    if (!el.isConnected) { R.dispose(); return; } // the card was closed
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!still && scene && idle <= 0 && !document.hidden) { cam.yaw += dt * 0.15; dirty = true; } else if (idle > 0) idle -= dt * 4;
    if (dirty && scene && !document.hidden) {
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(64, Math.round(r.width * dpr)), h = Math.max(48, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const view = viewOf(cam);
      const moved = Math.abs(cam.yaw - lastSort.yaw) + Math.abs(cam.pitch - lastSort.pitch) > 0.01 || Math.abs(cam.dist / lastSort.dist - 1) > 0.05;
      if (moved && now - lastSort.t > 60) { R.order(depthOrder(view, scene.center, scene.count)); lastSort = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, t: now }; }
      R.draw(view, w, h); dirty = false;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'splat' });
  return 'splat';
}

export default {
  name: 'splat',
  splatAsk,
  examples: ['view a gaussian splat', 'open a splat file', 'splat viewer', 'show me a splat', 'load a 3dgs scan', 'open a .splat file', 'view a splat scan', 'gaussian splatting viewer'],
  nearMisses: ['splat the paint on the wall', 'splatoon 3', 'splatter paint ideas', 'how to clean a splat of ketchup', 'splat the bug', 'what is a splash screen'],
  match(lower, text) { return splatAsk(text || lower); },
  run,
};

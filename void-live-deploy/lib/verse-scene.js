// A real-time 3D backdrop any Verse page can wear (the quality engine's shared component: one file lifts every page that loads it).
// A field of lit crystals in depth, drawn with WebGL2 in one instanced call: Lambert light, a rim glow, depth fog, a slow camera drift that follows
// the pointer. Each page gets its own hue and layout from its address. A phone gets a lighter tier (fewer crystals, a lower pixel ratio) and the
// scene starts after the page has loaded and the browser is idle; it pauses when the tab is hidden, draws one still frame when motion is reduced,
// and steps its own detail down when frames run long. It sits behind the page (pointer-events none) and never touches the page's content.
// Usage: <script type="module" src="/lib/verse-scene.js"></script>   (the home keeps its own starfield and is never given this)
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec4 aOff; in vec4 aRot; in float aHue;
uniform float uT; uniform vec2 uView; uniform vec2 uLook;
out vec3 vN; out float vFog; out float vHue; out vec3 vV;
mat3 rot(vec3 k, float a){ k = normalize(k); float c = cos(a), s = sin(a), t = 1.0 - c;
  return mat3(t*k.x*k.x + c, t*k.x*k.y + s*k.z, t*k.x*k.z - s*k.y, t*k.x*k.y - s*k.z, t*k.y*k.y + c, t*k.y*k.z + s*k.x, t*k.x*k.z + s*k.y, t*k.y*k.z - s*k.x, t*k.z*k.z + c); }
void main(){
  mat3 R = rot(aRot.xyz, uT * aRot.w + aOff.w * 6.28);
  vec3 p = R * (aPos * aOff.w * 0.9) + aOff.xyz;
  p.x += sin(uT * 0.11 + aOff.z) * 0.35; p.y += cos(uT * 0.13 + aOff.x) * 0.3;
  p.xy += uLook * (0.25 + (p.z + 8.0) * 0.06);
  vN = R * aNor; vHue = aHue; vV = normalize(vec3(-p.xy, 6.0 - p.z));
  float z = 6.0 - p.z; vFog = clamp((z - 4.0) / 14.0, 0.0, 1.0);
  float f = 1.9, w = max(z, 0.5) * 0.52; gl_Position = vec4(p.x * f / uView.x, p.y * f / uView.y, ((z - 0.5) / 14.0 * 2.0 - 1.0) * w, w);
}`;
const FS = `#version 300 es
precision mediump float; in vec3 vN; in float vFog; in float vHue; in vec3 vV; uniform float uBase; out vec4 o;
vec3 pal(float h){ return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))); }
void main(){
  vec3 n = normalize(vN), l = normalize(vec3(-0.5, 0.8, 0.6)), c = mix(pal(uBase + vHue * 0.18), vec3(0.62, 0.55, 1.0), 0.35);
  float d = max(dot(n, l), 0.0), rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.4), spec = pow(max(dot(reflect(-l, n), normalize(vV)), 0.0), 28.0);
  vec3 col = c * (0.10 + 0.75 * d) + c * rim * 0.9 + vec3(1.0) * spec * 0.55;
  float a = (1.0 - vFog) * 0.78; o = vec4(col * (1.0 - vFog * 0.8), a);
}`;

// an octahedron with a flattened waist: a crystal. Flat shaded: every face has its own normal.
function crystal() {
  const t = 0.62, v = [[0, 1.5, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1], [0, -1.5, 0]].map((p) => p.map((x) => x * t * (x === 0 ? 1 : 1)));
  const f = [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]], pos = [], nor = [];
  for (const [a, b, c] of f) {
    const A = v[a], B = v[b], C = v[c], u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(...n) || 1; n = n.map((x) => x / L);
    pos.push(...A, ...B, ...C); nor.push(...n, ...n, ...n);
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), count: f.length * 3 };
}

export function start(opts = {}) {
  if (typeof document === 'undefined' || window.__verseScene) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, saver = navigator.connection && navigator.connection.saveData;
  if (saver) return null;
  const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true'); cv.id = 'verse-scene';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:' + (opts.opacity || 0.9);
  const gl = cv.getContext('webgl2', { alpha: true, antialias: !phone, powerPreference: 'low-power', premultipliedAlpha: false });
  if (!gl) return null;
  window.__verseScene = { tier: phone ? 'phone' : 'desktop', api: 'webgl2' };
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s; window.__verseSceneLog = gl.getShaderInfoLog(s); return null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS), pr = gl.createProgram();
  if (!vs || !fs) return null;
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  const seed = hash(opts.seed || location.pathname), r = rng(seed), base = (seed % 360) / 360, mesh = crystal();
  let N = opts.count || (phone ? 46 : 120); const off = new Float32Array(N * 4), rot = new Float32Array(N * 4), hue = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    off.set([(r() - 0.5) * 15, (r() - 0.5) * 9, -8 + r() * 12, 0.35 + r() * r() * 1.1], i * 4);
    rot.set([r() - 0.5, r() - 0.5, r() - 0.5, (r() - 0.5) * 0.5], i * 4); hue[i] = r();
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = (data, name, size, div = 0) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); if (div) gl.vertexAttribDivisor(l, 1); };
  buf(mesh.pos, 'aPos', 3); buf(mesh.nor, 'aNor', 3); buf(off, 'aOff', 4, 1); buf(rot, 'aRot', 4, 1); buf(hue, 'aHue', 1, 1);
  const U = (n) => gl.getUniformLocation(pr, n), uT = U('uT'), uView = U('uView'), uLook = U('uLook'), uBase = U('uBase');
  let look = [0, 0], goal = [0, 0], raf = 0, last = 0, slow = 0, frames = 0, scale = Math.min(devicePixelRatio || 1, phone ? 1.25 : 1.75), shown = 0;
  addEventListener('pointermove', (e) => { goal = [(e.clientX / innerWidth - 0.5) * 2, -(e.clientY / innerHeight - 0.5) * 2]; }, { passive: true });
  const size = () => { cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); };
  addEventListener('resize', size); size();
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const draw = (ms) => {
    const t = ms / 1000; look[0] += (goal[0] - look[0]) * 0.04; look[1] += (goal[1] - look[1]) * 0.04;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(pr); gl.bindVertexArray(vao);
    gl.uniform1f(uT, t); gl.uniform1f(uBase, base); gl.uniform2f(uView, cv.width / cv.height * 4.2, 4.2); gl.uniform2f(uLook, look[0], look[1]);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, mesh.count, N); shown++;
  };
  const loop = (ms) => {
    raf = requestAnimationFrame(loop);
    if (last) { const dt = ms - last; frames++; if (frames > 20 && dt > 26) slow++; else if (dt < 20) slow = Math.max(0, slow - 1);
      if (slow > 12 && scale > 0.6) { scale *= 0.8; slow = 0; size(); } }
    last = ms; draw(ms);
  };
  // the scene sits above the page's background and below its content: each plain (static) child of the body is lifted over it; fixed and absolute ones keep their own place
  for (const el of document.body.children) { if (el !== cv && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName) && getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.style.zIndex = '1'; } }
  document.body.prepend(cv);
  if (reduced) { draw(4000); return cv; }
  const go = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else go(); });
  go();
  return cv;
}
const later = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 600));
if (typeof document !== 'undefined' && !/^\/$|^\/index\.html$/.test(location.pathname)) {
  const run = () => later(() => { try { start(); } catch (_) { /* a page is never broken by its backdrop */ } });
  if (document.readyState === 'complete') run(); else addEventListener('load', run, { once: true });
}

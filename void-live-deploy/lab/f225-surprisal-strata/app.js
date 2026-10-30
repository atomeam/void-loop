const { PPM, Strata, pearson } = F225;
const ed = document.getElementById('ed'), ghostEl = document.getElementById('ghost');
const $ = id => document.getElementById(id);
let model = new PPM(4), strata = new Strata(96, 64);
let bits = [], prevText = '', totalBits = 0, totalChars = 0, lastKey = performance.now(), pendingFlight = null;
const flights = [], surps = []; let saved = 0, ghost = '';
const HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
const bucket = b => b < 1.5 ? 0 : b < 3.5 ? 1 : b < 6 ? 2 : b < 9 ? 3 : 4;

function textOf() { return ed.innerText.replace(/\r/g, ''); }
function onEdit() {
  const t = textOf();
  let p = 0; while (p < prevText.length && p < t.length && prevText[p] === t[p]) p++;
  let s = 0; while (s < prevText.length - p && s < t.length - p && prevText[prevText.length - 1 - s] === t[t.length - 1 - s]) s++;
  const ins = t.slice(p, t.length - s), delCount = prevText.length - p - s;
  bits.splice(p, delCount);
  // model context = the text right before the insertion point
  model.hist = t.slice(Math.max(0, p - model.order), p);
  const nb = [];
  for (const c of ins) {
    const b = model.feed(c); nb.push(b); totalBits += b; totalChars++;
    if (c === '\n') strata.newline(); else strata.deposit(b);
  }
  if (ins.length === 1 && pendingFlight != null) { flights.push(Math.min(pendingFlight, 2000)); surps.push(nb[0]); if (flights.length > 600) { flights.shift(); surps.shift(); } }
  pendingFlight = null;
  bits.splice(p, 0, ...nb);
  prevText = t;
  model.hist = t.slice(Math.max(0, t.length - s - model.order), t.length - s);
  paint(); updateGhost(); stats(nb.length ? nb[nb.length - 1] : null);
  try { localStorage.setItem('f225.text', t.slice(-20000)); } catch {}
}
function paint() {
  if (!HL) return;
  const sets = [[], [], [], [], []];
  const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let node, off = 0;
  // map innerText offsets onto text nodes (plaintext-only keeps newlines as text or <br>)
  const t = prevText; let ti = 0;
  while ((node = walker.nextNode())) {
    const v = node.nodeValue; let runStart = 0, runB = -1;
    for (let i = 0; i <= v.length; i++) {
      while (ti < t.length && i < v.length && t[ti] !== v[i]) ti++; // skip <br>-newlines
      const b = i < v.length ? bucket(bits[ti] ?? 0) : -2;
      if (b !== runB) { if (runB >= 0 && i > runStart) { const r = new Range(); r.setStart(node, runStart); r.setEnd(node, i); sets[runB].push(r); } runStart = i; runB = b; }
      if (i < v.length) ti++;
    }
  }
  sets.forEach((rs, k) => CSS.highlights.set('s' + k, new Highlight(...rs)));
}
function updateGhost() {
  ghost = model.predict(16, 0.5);
  ghostEl.innerHTML = ghost ? 'Tab accepts <b>' + ghost.replace(/[&<]/g, c => c === '&' ? '&amp;' : '&lt;').replace(/ /g, '·') + '</b>' : '';
}
function stats(last) {
  $('bpc').textContent = totalChars ? (totalBits / totalChars).toFixed(2) : '–';
  if (last != null) $('last').textContent = last.toFixed(1) + ' bits';
  $('ctx').textContent = model.contexts;
  $('r').textContent = flights.length >= 20 ? pearson(flights, surps).toFixed(2) + ' (n=' + flights.length + ')' : 'need 20 keys';
  $('saved').textContent = saved;
}
ed.addEventListener('keydown', e => {
  const now = performance.now();
  if (e.key.length === 1) pendingFlight = now - lastKey;
  lastKey = now;
  if (e.key === 'Tab' && ghost) { e.preventDefault(); saved += ghost.length - 1; document.execCommand('insertText', false, ghost); }
});
ed.addEventListener('input', onEdit);
$('forget').onclick = () => { model = new PPM(4); strata = new Strata(96, 64); bits = []; prevText = ''; totalBits = totalChars = 0; flights.length = surps.length = 0; ed.textContent = ''; localStorage.removeItem('f225.text'); onEdit(); };
const PAGE = "The void is not empty. It is the place where every possible thing waits to be noticed. When you write, the void listens, and it learns the shape of your words one letter at a time. Familiar letters fall quietly into the valleys. Surprising letters rise up as mountains, and the mountains remember you.\n";
$('teach').onclick = () => { for (const c of PAGE.repeat(3)) model.learn(c); model.hist = prevText.slice(-model.order); updateGhost(); stats(null); };

// ---------- WebGL2 terrain ----------
const cv = $('w'); let gl = cv.getContext('webgl2', { antialias: true });
let render = () => {};
try { if (gl) {
  const W = strata.W, D = strata.D;
  const vs = `#version 300 es
  precision highp float; precision highp usampler2D; uniform sampler2D H; uniform usampler2D L; uniform mat4 M; uniform float T;
  in vec2 g; out vec3 c; out float f;
  void main(){ ivec2 q=ivec2(g); float h=texelFetch(H,q,0).r; uint l=texelFetch(L,q,0).r;
    vec3 p=vec3(g.x/float(${W - 1})*2.-1., (1.-exp(-h*.45))*.55, g.y/float(${D - 1})*2.-1.);
    float a=float(l)*.785; vec3 base=vec3(.35+.25*cos(a),.35+.25*cos(a+2.1),.55+.25*cos(a+4.2));
    c=mix(base*.25, vec3(1.,.55,.7), clamp(h*.5,0.,1.)) + vec3(.6,.9,.85)*smoothstep(.8,2.5,h)*.6;
    gl_Position=M*vec4(p,1.); f=gl_Position.z; gl_PointSize=2.; }`;
  const fs = `#version 300 es
  precision highp float; in vec3 c; in float f; out vec4 o; void main(){ o=vec4(c*exp(-f*.12),1.); }`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  const grid = [], idx = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) grid.push(x, z);
  for (let z = 0; z < D - 1; z++) for (let x = 0; x < W - 1; x++) { const i = z * W + x; idx.push(i, i + 1, i + 1, i + 1 + W, i, i + W); } // wireframe-ish line list
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'g'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const tH = gl.createTexture(), tL = gl.createTexture();
  for (const t of [tH, tL]) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
  const persp = (fy, a, n, f) => { const t = 1 / Math.tan(fy / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
  const look = (e, c) => { const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; };
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  render = (t) => {
    const dpr = Math.min(devicePixelRatio, 2), w = innerWidth * dpr | 0, h = innerHeight * dpr | 0;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0.008, 0.008, 0.02, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
    gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tH); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, D, 0, gl.RED, gl.FLOAT, strata.h);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tL); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, W, D, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, strata.layer);
    gl.uniform1i(gl.getUniformLocation(pr, 'H'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'L'), 1);
    const a = t * 0.00006, e = [Math.sin(a) * 2.3, 1.25, Math.cos(a) * 2.3];
    gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'M'), false, mul(persp(0.9, w / h, 0.05, 20), look(e, [0, 0.1, 0])));
    gl.bindVertexArray(vao); gl.drawElements(gl.LINES, idx.length, gl.UNSIGNED_SHORT, 0);
  };
} } catch (e) { console.warn('WebGL2 terrain failed, using 2D', e); gl = null; }
if (!gl) {
  const c2 = document.createElement('canvas').getContext('2d') && (cv.replaceWith(Object.assign(document.createElement('canvas'),{id:'w'})), document.getElementById('w').getContext('2d'));
  const cv2 = document.getElementById('w');
  render = () => { const cv = cv2; cv.width = innerWidth; cv.height = innerHeight; const { W, D, h } = strata; for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { const v = Math.min(1, h[z * W + x] * .5); c2.fillStyle = `rgba(255,${120 + 100 * v | 0},170,${v})`; c2.fillRect(x / W * cv.width, z / D * cv.height * .6, cv.width / W, cv.height / D * .6); } };
}
let frames = 0;
function loop(t) { strata.erode(0.9997); render(t); frames++; requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// restore
const savedText = (() => { try { return localStorage.getItem('f225.text') || ''; } catch { return ''; } })();
if (savedText && !/auto/.test(location.search)) { ed.textContent = savedText; onEdit(); }
window.__f225 = { get model() { return model; }, get bits() { return bits; }, strata, HL, webgl2: !!gl, get frames() { return frames; }, flights, surps, get ghost() { return ghost; }, onEdit };
// ?auto=1 : synthetic typist (for tests) whose pauses are random — r should be ~0
if (/auto=1/.test(location.search)) {
  ed.focus(); const src = PAGE.repeat(4); let i = 0;
  (function step() { if (i >= src.length) { window.__f225.done = true; return; } const c = src[i++]; ed.dispatchEvent(new KeyboardEvent('keydown', { key: c === '\n' ? 'Enter' : c })); document.execCommand('insertText', false, c); setTimeout(step, 2 + Math.random() * 6); })();
}

import { TasteGP, rng, makeTaster, DIM } from './core.js';
const NAMES = ['blob', 'twist', 'spikes', 'hue', 'symmetry', 'smooth'];
const qs = new URLSearchParams(location.search);
const r = rng((Date.now() & 0xffff) + 1);
let gp, history = [];
const KEY = 'f231-duels';
function rebuild() { gp = new TasteGP(); for (const d of history) gp.addDuel(d.w, d.l); gp.radius = history.length ? history.at(-1).radius : 0.15; }
try { history = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { history = []; }
rebuild();
let pair = gp.propose(r);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(history.slice(-300))); } catch {} };
function choose(c) {
  const [a, b] = gp.lastPair; gp.answer(c);
  history.push({ w: c === 0 ? a : b, l: c === 0 ? b : a, radius: gp.radius }); save();
  pair = gp.propose(r); morph = 0; drawMap(); stats();
}
// ---------- WebGL2 raymarched sculptures ----------
const cv = document.getElementById('gl');
const gl = cv.getContext('webgl2', { antialias: false });
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0,1); }`;
const FS = `#version 300 es
precision highp float; out vec4 o;
uniform vec2 res; uniform float t; uniform float A[6]; uniform float B[6]; uniform vec2 sd; uniform float pickFx;
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
float shape(vec3 q, float P[6]){
  q.xz *= rot(q.y*P[1]*3.0);                      // twist
  float n = floor(2.0+P[4]*6.0);                  // symmetry folds
  float an = atan(q.z,q.x), seg = 6.2831/n;
  an = mod(an+seg*.5,seg)-seg*.5; float rr=length(q.xz); q.xz = vec2(cos(an),sin(an))*rr;
  float sph = length(q)-0.75;
  float tor = length(vec2(length(q.xz)-0.62,q.y))-0.22;
  float base = mix(sph,tor,P[0]);
  float lobe = length(q-vec3(0.55,0.,0.))-0.28;
  float d = smin(base,lobe,0.05+P[5]*0.45);
  d += P[2]*0.12*sin(9.0*q.x)*sin(9.0*q.y+t*.6)*sin(9.0*q.z);   // spikes
  return d*0.7;
}
vec3 hue(float h){ return .55+.45*cos(6.2831*(h+vec3(0.,.33,.67))); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
void main(){
  vec2 uv = gl_FragCoord.xy/res; bool left = uv.x<.5;
  float P[6]; for(int i=0;i<6;i++) P[i] = left?A[i]:B[i];
  float u = left?sd.x:sd.y;
  vec2 c = (gl_FragCoord.xy - vec2(res.x*(left?.31:.75), res.y*.52))/res.y;
  float ang = t*.25 + (left?0.:1.7);
  vec3 ro = vec3(2.6*sin(ang),.6,2.6*cos(ang)), fw = normalize(-ro), rt = normalize(cross(vec3(0,1,0),fw)), up = cross(fw,rt);
  vec3 rd = normalize(fw + c.x*rt*1.1 + c.y*up*1.1);
  float jit = (hash(gl_FragCoord.xy+t)-.5)*u*0.08;   // uncertainty: grain in the march
  float dist=0., d=1.; int i;
  for(i=0;i<90;i++){ vec3 q=ro+rd*dist; d=shape(q,P)+jit; if(d<.001||dist>6.) break; dist+=d; }
  vec3 bg = vec3(.01,.012,.03) + .04*vec3(.2,.3,.8)*pow(1.-length(c),3.);
  vec3 col = bg;
  if(d<.01){
    vec3 q=ro+rd*dist; vec2 e=vec2(.002,0);
    vec3 n=normalize(vec3(shape(q+e.xyy,P)-shape(q-e.xyy,P),shape(q+e.yxy,P)-shape(q-e.yxy,P),shape(q+e.yyx,P)-shape(q-e.yyx,P)));
    vec3 l=normalize(vec3(.6,.8,.4)); float dif=max(dot(n,l),0.), rim=pow(1.-max(dot(n,-rd),0.),3.);
    col = hue(P[3])*(.12+.8*dif) + rim*vec3(.6,.7,1.)*.6 + pow(max(dot(reflect(rd,n),l),0.),32.)*.5;
  }
  col = mix(col, vec3(.35,.38,.55)*(.6+.4*hash(gl_FragCoord.xy*.37+t)), u*0.5); // haze = how unsure the model is
  col *= 1. - .25*smoothstep(.002,.0,abs(uv.x-.5));
  o = vec4(pow(col,vec3(.4545)),1);
}`;
let prog, loc = {}, morph = 1, curA = pair[0].slice(), curB = pair[1].slice();
function mk(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
if (gl) {
  prog = gl.createProgram(); gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['res', 't', 'A', 'B', 'sd']) loc[n] = gl.getUniformLocation(prog, n);
}
let frames = 0, sdNow = [0, 0];
// Preference GPs only pin down differences, so absolute sd stays near the prior; show the part above 55% of it.
const unsure = (sd) => Math.min(1, Math.max(0, (sd / 2 - 0.55) / 0.45));
function frame(ts) {
  const dpr = Math.min(devicePixelRatio || 1, 1.5), w = innerWidth * dpr | 0, h = innerHeight * dpr | 0;
  const scale = qs.has('lowres') ? 0.5 : 1;
  if (cv.width !== (w * scale | 0)) { cv.width = w * scale | 0; cv.height = h * scale | 0; }
  morph = Math.min(1, morph + 0.04);
  for (let i = 0; i < DIM; i++) { curA[i] += (pair[0][i] - curA[i]) * morph * 0.25; curB[i] += (pair[1][i] - curB[i]) * morph * 0.25; }
  sdNow = [gp.predict(pair[0]).sd, gp.predict(pair[1]).sd];
  if (gl) {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(loc.res, cv.width, cv.height); gl.uniform1f(loc.t, ts / 1000);
    gl.uniform1fv(loc.A, curA); gl.uniform1fv(loc.B, curB); gl.uniform2f(loc.sd, unsure(sdNow[0]), unsure(sdNow[1]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  frames++; requestAnimationFrame(frame);
}
// ---------- taste map (2-D slice of the posterior through the favourite) ----------
const mc = document.getElementById('map'), mx = mc.getContext('2d'), dx = document.getElementById('dx'), dy = document.getElementById('dy');
NAMES.forEach((n, i) => { dx.add(new Option(n, i)); dy.add(new Option(n, i)); }); dx.value = 0; dy.value = 2;
function drawMap() {
  const inc = gp.X.length ? gp.incumbent() : pair[0], S = 48, img = mx.createImageData(S, S), ix = +dx.value, iy = +dy.value;
  const vals = []; let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const p = inc.slice(); p[ix] = x / (S - 1); p[iy] = 1 - y / (S - 1); const q = gp.predict(p); vals.push(q); lo = Math.min(lo, q.mu); hi = Math.max(hi, q.mu); }
  vals.forEach((q, k) => { const v = (q.mu - lo) / (hi - lo + 1e-9), g = (Math.random() - .5) * unsure(q.sd) * 160; img.data[k * 4] = 40 + 120 * v + g; img.data[k * 4 + 1] = 30 + 170 * v + g; img.data[k * 4 + 2] = 90 + 160 * v + g; img.data[k * 4 + 3] = 255; });
  mx.putImageData(img, 0, 0);
  mx.fillStyle = '#fff'; mx.fillRect(inc[ix] * (S - 1) - 1, (1 - inc[iy]) * (S - 1) - 1, 3, 3);
}
dx.onchange = dy.onchange = drawMap;
function stats() { const inc = gp.X.length ? gp.incumbent() : null; document.getElementById('stats').textContent = `${history.length} choices · search radius ${gp.radius.toFixed(2)} · unsure L ${sdNow[0].toFixed(2)} / R ${sdNow[1].toFixed(2)}` + (inc ? ` · favourite: ${inc.map((v, i) => NAMES[i] + ' ' + v.toFixed(2)).join(', ')}` : ''); }
document.getElementById('L').onclick = () => choose(0); document.getElementById('R').onclick = () => choose(1);
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') choose(0); if (e.key === 'ArrowRight') choose(1); });
document.getElementById('undo').onclick = () => { history.pop(); save(); rebuild(); pair = gp.propose(r); drawMap(); stats(); };
document.getElementById('reset').onclick = () => { history = []; save(); rebuild(); pair = gp.propose(r); drawMap(); stats(); };
let autoT = null;
function autoTaster(n = Infinity, seed = 7) { const T = makeTaster(seed); let k = 0; clearInterval(autoT); return new Promise((res) => { autoT = setInterval(() => { if (k++ >= n) { clearInterval(autoT); res(T); return; } const [a, b] = gp.lastPair; choose(T.choose(a, b, r)); }, 60); }); }
document.getElementById('auto').onclick = () => (autoT ? (clearInterval(autoT), autoT = null) : autoTaster());
window.__f231 = { get gp() { return gp; }, get history() { return history; }, get frames() { return frames; }, hasGL: !!gl, choose, autoTaster, reset: () => document.getElementById('reset').click() };
drawMap(); stats(); requestAnimationFrame(frame);
if (qs.has('auto')) autoTaster(+qs.get('auto') || 40);

/**
 * void-ring — a summoned circle drawn as something alive instead of a CSS border (Adam, 2026-10-09): a WebGL ring whose
 * radius breathes with slow noise, a feathered dark hole that pulls inward like an eclipse, a faint glow bleeding into
 * the black, and it reacts to the "Ask the Void" box: as you type it turns faster, brightens and draws in, then settles.
 * Not a skill: void.html's mountShape loads it for circles only, so the empty page loads none of it. One small raw WebGL
 * canvas per circle (no three.js), kept per id so the stage re-rendering never makes a new context. Reduced motion: still.
 *   ringCanvas(id, color) -> canvas (or null where WebGL can't run: the caller keeps its CSS ring)
 *   pulse()  a tap: the ring ripples and draws in
 */
const VERT = 'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.,1.);}';
// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT), then the ring
const FRAG = `precision mediump float;varying vec2 uv;uniform float t,energy,still;uniform vec3 col;
vec3 m289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=m289(i);vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 nr=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nr.x;p1*=nr.y;p2*=nr.z;p3*=nr.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
void main(){
  float r=length(uv),a=atan(uv.y,uv.x),spin=t*(.05+.22*energy);
  vec3 q=vec3(cos(a+spin)*1.3,sin(a+spin)*1.3,t*.11);
  float n=snoise(q)*.6+snoise(q*2.3+4.1)*.25;
  float R=.62*(1.-.07*energy)+n*(.028+.03*energy)*(1.-still);
  float d=r-R;
  float line=exp(-d*d/(2.*pow(.015+.007*energy,2.)));          // the ring: a soft line, not a hard stroke
  float glow=exp(-max(d,0.)*4.2)*smoothstep(-.03,.03,d)*(.30+.30*energy); // light bleeding outward into the black
  float hole=smoothstep(R+.01,R-.32,r);                           // inside: a feathered shadow deepening toward the middle
  float rim=exp(-abs(d+.03)*28.)*.18;                               // the inner edge catches a little light, like an eclipse
  vec3 c=mix(col,vec3(.62,.70,1.),.35)*(line*(.55+.45*energy)+glow+rim);
  float alpha=clamp(line*.9+glow+rim+hole*.92,0.,1.);
  c=mix(c,vec3(0.),hole*(1.-line));                                 // the hole is darker than the void around it
  float edge=smoothstep(1.,.86,r);                                  // fade out before the canvas edge: no box
  gl_FragColor=vec4(c*edge,alpha*edge);
}`;

const rings = new Map(); // id -> { canvas, gl, prog, u, color }
let energy = 0, target = 0, bound = false, raf = 0, last = 0;
const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

function bindInput() {
  if (bound) return; bound = true;
  const input = document.getElementById('input');
  if (!input) return;
  // each keystroke feeds the ring; it settles back once you stop
  input.addEventListener('input', () => { target = Math.min(1, target + 0.35); wake(); });
  input.addEventListener('focus', () => { target = Math.max(target, 0.25); wake(); });
}
function hexToRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0xe8ecff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

function make(id, color) {
  const canvas = document.createElement('canvas');
  canvas.className = 'void-ring';
  canvas.style.cssText = 'position:absolute;left:-25%;top:-25%;width:150%;height:150%;pointer-events:none';
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); } catch (e) { console.warn('[void-ring]', e); return null; }
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const u = { t: gl.getUniformLocation(prog, 't'), energy: gl.getUniformLocation(prog, 'energy'), still: gl.getUniformLocation(prog, 'still'), col: gl.getUniformLocation(prog, 'col') };
  return { canvas, gl, u, color: hexToRgb(color), born: performance.now() };
}

/** the living ring for circle `id` (the same canvas every render), or null where WebGL can't run */
export function ringCanvas(id, color) {
  let r = rings.get(id);
  if (!r) { r = make(id, color); if (!r) return null; rings.set(id, r); }
  r.color = hexToRgb(color);
  bindInput(); wake();
  return r.canvas;
}

/** a tap on a ring: it ripples and draws in, as if it took something in */
export function pulse() { target = 1; wake(); }
function wake() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
  target = Math.max(0, target - dt * 0.5);             // the feed fades
  energy += (target - energy) * Math.min(1, dt * 3);    // and the ring follows it smoothly
  const s = still();
  let alive = 0;
  for (const [id, r] of rings) {
    if (!r.canvas.isConnected) { if (now - (r.gone || (r.gone = now)) > 5000) { r.gl.getExtension('WEBGL_lose_context')?.loseContext(); rings.delete(id); } continue; }
    r.gone = 0; alive++;
    const w = r.canvas.clientWidth, h = r.canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (r.canvas.width !== Math.round(w * dpr) || r.canvas.height !== Math.round(h * dpr)) { r.canvas.width = Math.round(w * dpr); r.canvas.height = Math.round(h * dpr); r.gl.viewport(0, 0, r.canvas.width, r.canvas.height); }
    const { gl, u } = r;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.t, s ? 0 : (now - r.born) / 1000); gl.uniform1f(u.energy, s ? 0 : energy); gl.uniform1f(u.still, s ? 1 : 0);
    gl.uniform3fv(u.col, r.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  if (rings.size && !s) raf = requestAnimationFrame(frame); else last = 0;
  if (s && alive) last = 0; // reduced motion: one still frame per change
}

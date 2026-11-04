// A quiet WebGL wash behind the home horizon. It starts after load, on an idle callback, and only when the
// visitor has not asked for reduced motion or data saver. If WebGL is missing, the canvas is removed and the
// CSS horizon in void.html is the whole background. Nothing here is read as content.

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
const FRAG = [
  'precision mediump float;',
  'uniform float uTime;uniform vec2 uRes;',
  'void main(){',
  'vec2 uv=gl_FragCoord.xy/uRes;vec2 p=uv-0.5;p.x*=uRes.x/max(uRes.y,1.0);',
  'float r=length(p);float breathe=0.5+0.5*sin(uTime*0.35);',
  'float ring=smoothstep(0.045,0.0,abs(r-0.30));',
  'vec3 col=vec3(0.02,0.015,0.05);',
  'col+=vec3(0.45,0.32,0.85)*ring*(0.28+0.18*breathe);',
  'col+=vec3(0.20,0.45,0.55)*exp(-r*3.4)*0.22;',
  'float n=sin(p.x*16.0+uTime*0.18)*sin(p.y*12.0-uTime*0.12);',
  'col+=vec3(0.30,0.22,0.55)*n*0.035;',
  'gl_FragColor=vec4(col,0.85);',
  '}',
].join('');

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}

export function mountField(doc = document) {
  if (!doc.getElementById || !doc.getElementById('void-depth') || doc.getElementById('verse-field')) return null;
  let reduce = false, save = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  try { save = !!(navigator.connection && navigator.connection.saveData); } catch (_) {}
  if (reduce || save) return null;
  const canvas = doc.createElement('canvas');
  canvas.id = 'verse-field';
  canvas.setAttribute('aria-hidden', 'true');
  doc.body.prepend(canvas);
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return null; }
  const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return null; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 'uTime'), uRes = gl.getUniformLocation(prog, 'uRes');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  let raf = 0, last = 0, stopped = false;
  const size = () => {
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.floor(Math.min(window.innerWidth || 2, 1280) * dpr));
    const h = Math.max(2, Math.floor(Math.min(window.innerHeight || 2, 800) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  const frame = (t) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (t - last < 32) return;
    last = t;
    if (document.hidden) return;
    size();
    gl.uniform1f(uTime, t * 0.001);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  size();
  raf = requestAnimationFrame(frame);
  const stop = () => { stopped = true; cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!stopped) raf = requestAnimationFrame(frame); });
  return { stop };
}

const start = () => {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
  idle(() => { try { mountField(); } catch (_) {} });
};
if (document.readyState === 'complete') start();
else addEventListener('load', start);

// blub: a real-time 3D blobfish, drawn on the graphics card by ray marching a distance field (WebGL2).
// Wet translucent skin (thickness-based glow through the flesh, wrap light, fresnel sheen, two highlights), caustics on the sea floor and on the fish,
// a sagging nose, a downturned mouth, sunken eyes that follow the pointer, breathing, blinking and a "blub" that opens the mouth and lets bubbles go.
// A phone gets a lighter tier (fewer steps) and the picture scales itself to hold the frame rate. Reduced motion draws one still frame.
const q = (s) => document.querySelector(s);
const canvas = q('#blub'), stage = q('#stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, saver = !!(navigator.connection && navigator.connection.saveData);
const phone = matchMedia('(max-width: 700px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float BLUB; uniform float BLINK; uniform float TURN; uniform int STEPS;
out vec4 O;
float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
float ell(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0-1.)/k1; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float caustic(vec2 p, float t){
  float c = 0.; vec2 q = p;
  for (int i = 0; i < 3; i++){ q += vec2(sin(q.y*1.7 + t*.6 + float(i)), cos(q.x*1.9 - t*.5 + float(i)*1.3))*.55; c += abs(sin(q.x*2.3)*sin(q.y*2.1)); }
  return pow(clamp(1. - c/3., 0., 1.), 6.)*1.6;
}
// the fish faces the viewer's left; x runs tail (+) to nose (-). A blobfish is a tadpole: a huge soft head, a nose that sags over a frowning mouth, a thin tail.
float fish(vec3 p, out float part){
  float br = sin(T*1.6)*.015 + BLUB*.03;
  p.y += sin(T*.9)*.03;
  vec3 w = p; w.y += .035*sin(p.x*3. + T*1.3) + .03*noise(p.xz*3. + T*.2);       // skin wobble
  float head = ell(w - vec3(-.45, -.02, 0.), vec3(.95 + br, .78 + br, .84 + br));
  float belly = ell(w - vec3(-.3, -.36, 0.), vec3(.8, .5, .72));                 // heavy sagging underside
  float d = smin(head, belly, .35);
  float taper = ell(w - vec3(.75, -.05, 0.), vec3(.85, .46 - .1*smoothstep(.2, 1.6, w.x), .4));
  d = smin(d, taper, .45);
  float nose = ell(w - vec3(-1.02, .0 + .02*sin(T*1.2), 0.), vec3(.58, .54, .48));    // the big drooping nose
  d = smin(d, nose, .3);
  float tip = ell(w - vec3(-1.3, -.24 + .02*sin(T*1.2), 0.), vec3(.3, .38, .3));
  d = smin(d, tip, .2);
  float tail = ell(w - vec3(1.75, .0, 0.), vec3(.7, .2, .06 + .03*sin(w.x*3.)));
  tail = smax(tail, -ell(w - vec3(2.5, .0, 0.), vec3(.3, .16, .5)), .06);
  d = smin(d, tail, .3);
  vec3 s = vec3(w.x, w.y, abs(w.z));
  float fin = ell(s - vec3(-.05, -.22, .72), vec3(.24, .07, .06));
  d = smin(d, fin, .1);
  float jaw = BLUB * .14;
  vec3 m = w - vec3(-1.05, -.36 - jaw, 0.);                                         // the mouth: a wide frown under the nose
  float lips = noise(vec2(m.z*5., m.x*5.))*.03;
  float lipU = ell(m - vec3(.04, .12 - m.z*m.z*.2, 0.), vec3(.48, .15, .66));
  float lipL = ell(m - vec3(.06, -.14 - jaw - m.z*m.z*.12, 0.), vec3(.44, .16 + jaw*.4, .62));
  float jowl = ell(vec3(m.x - .1, m.y + .22 + jaw, abs(m.z) - .5), vec3(.3, .22, .22));       // droopy cheeks
  d = smin(d, smin(smin(lipU, lipL, .08), jowl, .12) + lips, .1);
  float groove = max(abs(m.y + .38*m.z*m.z - .0) - (.012 + jaw*1.3), abs(m.z) - .66);
  groove = max(groove, abs(m.x - .02) - .55);
  d = smax(d, -groove, .02);
  vec3 sp = vec3(w.x, w.y, abs(w.z));
  float sock = ell(sp - vec3(-.66, .26, .7), vec3(.15, .12*BLINK + .02, .15));
  d = smax(d, -sock, .08);
  part = 0.;
  float eye = ell(sp - vec3(-.66 + M.x*.02, .25 + M.y*.02, .66), vec3(.062, .058*BLINK + .006, .062));
  if (eye < d) { part = 1.; d = eye; }
  return d;
}
float scene(vec3 p, out float part, out float floorHit){
  floorHit = 0.;
  float f = fish(p, part);
  float fl = p.y + 1.18 + .04*noise(p.xz*1.5);
  if (fl < f) { floorHit = 1.; return fl; }
  return f;
}
float sdf(vec3 p){ float a, b; return scene(p, a, b); }
vec3 nrm(vec3 p){ vec2 e = vec2(.004, 0.); return normalize(vec3(sdf(p+e.xyy)-sdf(p-e.xyy), sdf(p+e.yxy)-sdf(p-e.yxy), sdf(p+e.yyx)-sdf(p-e.yyx))); }
float shadow(vec3 ro, vec3 rd){ float res = 1., t = .05; for (int i = 0; i < 18; i++){ float h = sdf(ro + rd*t); res = min(res, 7.*h/t); t += clamp(h, .05, .4); if (res < .02 || t > 5.) break; } return clamp(res, 0., 1.); }
float thick(vec3 p, vec3 n){ float a = 0.; for (int i = 1; i <= 5; i++){ float t = float(i)*.1; a += max(0., -sdf(p - n*t)); } return a; }
vec3 sea(vec3 rd){
  float g = clamp(rd.y*.5 + .55, 0., 1.);
  vec3 c = mix(vec3(.01, .03, .06), vec3(.03, .16, .24), g);
  c += vec3(.05, .18, .2) * pow(max(0., rd.y), 2.) * (.6 + .4*sin(T*.4 + rd.x*6.));
  return c;
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*R)/R.y;
  float yaw = TURN - .45 + (M.x)*.35 + (RED), pitch = .1 + M.y*.12;
  vec3 ro = vec3(sin(yaw)*4.4, .45 + pitch*3., cos(yaw)*4.4);
  vec3 ta = vec3(-.1, -.12, 0.), fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(fw*1.7 + rt*uv.x + up*uv.y);
  float t = 0., part = 0., fl = 0., hit = 0.;
  for (int i = 0; i < 96; i++){
    if (i >= STEPS) break;
    vec3 p = ro + rd*t; float d = scene(p, part, fl);
    if (d < .0016*t) { hit = 1.; break; }
    t += d*.85; if (t > 12.) break;
  }
  vec3 col = sea(rd);
  vec3 L1 = normalize(vec3(-.4, 1., .6)), L2 = normalize(vec3(.8, .3, -.5));
  if (hit > .5){
    vec3 p = ro + rd*t, n = nrm(p), v = -rd;
    float sh = shadow(p + n*.02, L1);
    float cs = caustic(p.xz*.9 + vec2(0., p.y*.3), T);
    if (fl > .5){
      float tex = noise(p.xz*5.)*.5 + noise(p.xz*18.)*.3;
      vec3 sand = mix(vec3(.16, .15, .14), vec3(.32, .29, .24), tex);
      col = sand*(.25 + .75*sh) + vec3(.35, .75, .8)*cs*(.4 + .6*sh)*.9;
      col = mix(col, sea(rd)*1.4, 1. - exp(-.07*t));
    } else if (part > .5){
      float gl = pow(max(0., dot(reflect(-L1, n), v)), 90.) + pow(max(0., dot(reflect(-L2, n), v)), 60.)*.5;
      col = vec3(.015, .012, .014) + vec3(1.)*gl*1.6 + sea(reflect(rd, n))*.25;
    } else {
      float wrap = clamp((dot(n, L1) + .5)/1.5, 0., 1.);
      float lipMask = smoothstep(.62, .3, length(vec2((p.x + 1.08)*1.1, (p.y + .38 + p.z*p.z*.3)*1.7)));
      vec3 skin = mix(vec3(.88, .58, .57), vec3(.74, .62, .66), noise(p.xy*3. + 1.)*.6);
      skin = mix(skin, vec3(.92, .76, .78), smoothstep(-.35, .35, p.y)*smoothstep(-.6, -1.1, p.x)*.8);     // the pale nose bulb
      skin = mix(skin, vec3(.62, .22, .3), lipMask);                         // dark wet lips
      float th = thick(p, n);
      vec3 sss = vec3(1., .32, .26) * exp(-th*2.6) * (.55 + .45*wrap) * 1.1;  // light through the jelly
      float ao = clamp(.5 + .5*(sdf(p + n*.2)/.2), 0., 1.);
      vec3 diff = skin * (.12 + wrap*sh*.95) * mix(vec3(.6, .85, 1.), vec3(1.), sh);
      float fres = pow(1. - max(0., dot(n, v)), 3.);
      float spec = pow(max(0., dot(reflect(-L1, n), v)), 70.)*sh*1.5 + pow(max(0., dot(reflect(-L2, n), v)), 40.)*.5;
      vec3 refl = sea(reflect(rd, n))*fres*1.6;
      col = diff*ao + sss*.75*ao + refl + vec3(1., .96, .94)*spec*(.6 + .6*fres) + skin*vec3(.3, .7, .8)*cs*.45*max(0., n.y + .4);
      col += vec3(.5, .8, .9) * fres * .12;                                   // rim of the water
    }
  }
  // marine snow and bubbles
  float sn = 0.;
  for (int i = 0; i < 4; i++){ vec2 g = uv*(6. + float(i)*5.) + vec2(float(i)*3.7, T*(.05 + .02*float(i))); vec2 id = floor(g), f = fract(g) - .5; float h = hash(id + float(i)); vec2 o = (vec2(hash(id + 7.), hash(id + 9.)) - .5)*.6; sn += smoothstep(.07, .0, length(f - o))*step(.55, h)*(.12 + .1*float(i)); }
  col += vec3(.6, .8, .9)*sn*.5;
  for (int i = 0; i < 7; i++){
    float k = float(i), life = fract(T*.18 + k*.31 + BLUB*0.), bx = -.34 + sin(k*5.3)*.05 + sin(T*1.3 + k)*.02*life*5.;
    float by = -.12 + life*(.75 + BLUB*.2);
    vec2 bp = vec2(bx - .02*k, by) - uv; float r = .012 + .01*hash(vec2(k, 3.)) + BLUB*.01;
    float ring = smoothstep(r, r*.8, length(bp)) - smoothstep(r*.8, r*.55, length(bp));
    col += vec3(.7, .9, 1.)*(ring*.7 + smoothstep(r*.9, 0., length(bp - vec2(-r*.3, r*.3)))*.15*step(.5, BLUB + .5))*step(life, .95)*(1.-life)*.9;
  }
  col *= 1. - .5*dot(uv, uv)*1.3;                                              // gentle vignette
  col = pow(max(col, 0.), vec3(.9));
  col = col/(1. + col*.35);
  col += (hash(gl_FragCoord.xy + T) - .5)/200.;
  O = vec4(col, 1.);
}`;
const fixed = FRAG.replace('(RED)', (reduced ? '0.' : 'sin(T*.25)*.12'));
const VERT = '#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';
const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
const note = q('#note');
function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
let ok = false, prog, U = {}, soft = false;
try {
  if (!gl) throw new Error('no webgl2');
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fixed)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['R', 'T', 'M', 'BLUB', 'BLINK', 'TURN', 'STEPS']) U[n] = gl.getUniformLocation(prog, n);
  try { const x = gl.getExtension('WEBGL_debug_renderer_info'); soft = !!x && /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL))); } catch (_) { /* unknown renderer: assume a real one */ }
  ok = true;
} catch (e) { console.warn('blub: the 3D picture is not available here (' + e.message + '); showing the photo'); }
if (!ok) { canvas.hidden = true; q('#photo').hidden = false; note.textContent = 'This browser cannot draw the 3D blobfish, so here is a real one.'; } else {
  let scale = soft ? .3 : saver ? .5 : phone ? .8 : 1, mx = 0, my = 0, tx = 0, ty = 0, blub = 0, turn = 0, turnTo = 0, last = performance.now(), slow = 0, fast = 0, frames = 0, t0 = last, blinkAt = 3;
  const steps = soft ? 36 : phone || saver ? 44 : 80;
  window.__blub = { frames: 0, scale, steps, tier: soft ? 'software' : phone ? 'phone' : 'desktop' };
  function size() { const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 3); // the device's own pixel ratio (a phone is 3): the picture is no longer drawn small and stretched canvas.width = Math.max(64, Math.round(r.width*dpr*scale)); canvas.height = Math.max(64, Math.round(r.height*dpr*scale)); gl.viewport(0, 0, canvas.width, canvas.height); }
  size(); addEventListener('resize', size);
  stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); tx = ((e.clientX - r.left)/r.width - .5)*2; ty = -((e.clientY - r.top)/r.height - .5)*2; });
  stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  const say = () => { blub = 1; const b = document.createElement('span'); b.className = 'word'; b.textContent = ['blub', 'blub blub', 'blub!', 'bluuub'][Math.floor(Math.random()*4)]; b.style.left = 36 + Math.random()*10 + '%'; stage.append(b); setTimeout(() => b.remove(), 2200); };
  q('#say').addEventListener('click', say); stage.addEventListener('click', say);
  q('#turn').addEventListener('click', () => { turnTo += Math.PI*.5; });
  function frame(now) {
    const dt = Math.min(.1, (now - last)/1000); last = now;
    mx += (tx - mx)*Math.min(1, dt*6); my += (ty - my)*Math.min(1, dt*6); blub = Math.max(0, blub - dt*1.6); turn += (turnTo - turn)*Math.min(1, dt*3);
    const T = reduced ? 3.2 : (now - t0)/1000; if (T > blinkAt) blinkAt = T + 2.5 + Math.random()*3;
    const blink = T > blinkAt - .18 && T < blinkAt ? .1 : 1;
    gl.uniform2f(U.R, canvas.width, canvas.height); gl.uniform1f(U.T, T); gl.uniform2f(U.M, mx, my); gl.uniform1f(U.BLUB, Math.sin(Math.min(1, blub)*Math.PI)); gl.uniform1f(U.BLINK, blink); gl.uniform1f(U.TURN, turn); gl.uniform1i(U.STEPS, steps);
    gl.drawArrays(gl.TRIANGLES, 0, 3); window.__blub.frames = ++frames;
    if (dt > .024) { slow++; fast = 0; } else if (dt < .0185) { fast++; slow = Math.max(0, slow - 1); }
    if (slow > 8 && scale > .25) { scale = Math.max(.25, scale*.8); slow = 0; size(); } else if (fast > 240 && scale < 1) { scale = Math.min(1, scale*1.15); fast = 0; size(); }
    window.__blub.scale = +scale.toFixed(2);
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

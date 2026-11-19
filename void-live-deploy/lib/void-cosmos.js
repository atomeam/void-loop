// The idle canvas as an explorable, deterministic 3D cosmic map. One WebGL2 context, pre-allocated typed arrays,
// no network. Frame one is drawn from these arrays. The existing particle morph/constellation/ripple canvas is untouched.
import { SEED, STARS, LANDMARKS, GALACTIC_TILT, GALACTIC_INCLINE, SOL_GALACTOCENTRIC_LY, ARM_COUNT, BAR_LENGTH_LY, project, raDecOf, radiusOf, lyOf, hms, dms, fmtLy, rng, bvColor, armPoint } from './sky-catalog.js';

export const CAM_KEY = 'a2m.void.cosmos.v1', TRAIL_KEY = 'a2m.void.cosmos.trail.v1';
export const LOG_MIN = Math.log10(6800 / 9.4607e12), LOG_MAX = Math.log10(200000); // LEO (km) -> deep field (ly), one log scale
export const HOME = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, scaleLog: LOG_MIN };
export const TRAIL_CAP = 96, VISIT_CAP = 24;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), finite = (v, d = 0) => (Number.isFinite(v) ? v : d);

export function clampCam(c) { const o = { ...HOME, ...(c || {}) }; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'scaleLog']) o[k] = finite(o[k], HOME[k]); o.yaw = ((o.yaw % 6.283185) + 6.283185) % 6.283185; o.pitch = clamp(o.pitch, -1.45, 1.45); o.scaleLog = clamp(o.scaleLog, LOG_MIN, LOG_MAX); return o; }
export const layerOffset = (s) => Math.pow(10, s);                  // double precision metres/ly scalar
export const zoomOf = (s) => Math.pow(10, (s - LOG_MIN) * 0.12);    // logarithmic zoom, 1 -> ~50
export function viewPoint(c, q) { const z = zoomOf(c.scaleLog); return [(q[0] - c.x) * z, (q[1] - c.y) * z, (q[2] - c.z) * z]; } // floating origin: subtract first
export function screenOf(c, q, W, H) { const v = viewPoint(c, q), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch); const t = v[0] * sy + v[2] * cy; const rx = v[0] * cy - v[2] * sy, ry = v[1] * cp - t * sp, rz = v[1] * sp + t * cp; const d = Math.max(0.2, 1 + rz / 1200); return [W / 2 + rx * (H / 2) / (d * 420), H / 2 - ry * (H / 2) / (d * 420), d]; }
export function stepKeys(c, k, dt) { const o = { ...c }, s = (k.Shift ? 8 : 1) * dt; if (k.w) o.scaleLog = clamp(o.scaleLog + 0.3 * s, LOG_MIN, LOG_MAX); if (k.s) o.scaleLog = clamp(o.scaleLog - 0.3 * s, LOG_MIN, LOG_MAX); if (k.a) o.x -= 60 * s; if (k.d) o.x += 60 * s; if (k.arrowup) o.y += 60 * s; if (k.arrowdown) o.y -= 60 * s; o.x *= 0.999; o.y *= 0.999; o.z *= 0.999; return o; }
export function encodeHash(c) { return '#pos=' + [c.x, c.y, c.z].map((v) => v.toFixed(1)).join(',') + '&o=' + [c.yaw, c.pitch, c.scaleLog].map((v) => v.toFixed(3)).join(','); }
export function decodeHash(s) { const m = /pos=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(String(s || '')), o = /o=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/.exec(String(s || '')); if (!m) return null; const c = { x: +m[1], y: +m[2], z: +m[3] }; if (o) { c.yaw = +o[1]; c.pitch = +o[2]; c.scaleLog = +o[3]; } return clampCam(c); }
export function saveState(c, store) { try { store.setItem(CAM_KEY, JSON.stringify(c)); } catch (_) {} }
export function loadState(store, hash) { let c = null; try { c = JSON.parse(store.getItem(CAM_KEY)); } catch (_) {} const h = decodeHash(hash); return clampCam(h || c || HOME); }
export function addVisited(list, id, cap = VISIT_CAP) { const a = (list || []).filter((x) => x !== id); a.push(id); while (a.length > cap) a.shift(); return a; }
export function pickLandmark(c, W, H, mx, my, radius = 28) { let best = null, bd = radius * radius; for (const L of LANDMARKS) { const s = screenOf(c, project(L[1], L[2], L[3]), W, H); const d = (s[0] - mx) ** 2 + (s[1] - my) ** 2; if (s[2] > 0 && d < bd) { bd = d; best = L; } } return best; }
export function telemetry(c) { const p = raDecOf(c.x, c.y, c.z), ly = layerOffset(c.scaleLog); const dist = ly < 1e-6 ? (ly * 9.4607e12).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' km' : fmtLy(ly); return 'RA ' + hms(p.ra) + ' \u00b7 Dec ' + dms(p.dec) + ' \u00b7 ' + dist; }

/** Build the entire static universe once, from typed arrays and one fixed seed. Pure apart from allocations. */
export function buildUniverse(n = 5200) {
  const rnd = rng(SEED), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n); let i = 0;
  // fourth component is an opacity weight: stars sit inside the depth field, deep-sky dust is a whisper on top of it.
  // size is the sprite's diameter in pixels before zoom: every point is drawn as a (1 - r)^4 falloff, so a wide sprite is a soft glow, never a disc
  const put = (p, c, w = 1, sz = 4) => { if (i >= n) return; pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; const k = i * 4; col[k] = c[0]; col[k + 1] = c[1]; col[k + 2] = c[2]; col[k + 3] = w; size[i] = sz; i++; };
  // desaturated star temperatures: ice white, pale gold, faint blue-white. No neon.
  const soft = (c) => { const l = (c[0] + c[1] + c[2]) / 3; return [l * .55 + c[0] * .45, l * .6 + c[1] * .4, l * .65 + c[2] * .35]; };
  for (const s of STARS) { const p = project(s[1], s[2], s[3] * 3.26156), c = soft(bvColor(s[4])); put(p, c, .6, 10); for (let j = 0; j < 26; j++) put([p[0] + (rnd() - .5) * 2.4, p[1] + (rnd() - .5) * 2.4, p[2] + (rnd() - .5) * 2.4], c, .03, 5); }
  // Messier/NGC landmarks: a soft silver-blue or warm-dust Gaussian haze, never coloured noise or a cluster of pixel specks: each of its
  // points is a wide, faint sprite, so they overlap into one smooth cloud. The global scale fade keeps the catalog invisible at overview.
  const gauss = () => (rnd() + rnd() + rnd()) / 3 - .5;
  for (const L of LANDMARKS) { const p = project(L[1], L[2], L[3]), dust = L[4] === 'galaxy' ? [.54, .7, .95] : L[4] === 'cluster' ? [.85, .78, .72] : [.74, .8, .9]; for (let j = 0; j < 140; j++) { const s = gauss() * 26; put([p[0] + s * 2, p[1] + gauss() * 26, p[2] + gauss() * 2], dust, .006, 44); } }
  const tilt = GALACTIC_TILT * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt), off = radiusOf(SOL_GALACTOCENTRIC_LY);
  const place = (q) => { const z = q[2] * Math.cos(GALACTIC_INCLINE * Math.PI / 180 / 2); return [q[0] - off * ct, q[1] * ct - z * st, q[1] * st + z * ct]; };
  for (let a = 0; a < ARM_COUNT; a++) for (let j = 0; j < 620 && i < n; j++) { const t = rnd(); const q = armPoint(a, t, rnd() - .5, .5 + t); put(place(q), [.58, .64, .76], .5, 4); }
  for (let j = 0; j < 700 && i < n; j++) { const th = rnd() * 6.2832, r = radiusOf(BAR_LENGTH_LY) * rnd(); put(place([Math.cos(th) * r * 2.2, (rnd() - .5) * 60, Math.sin(th) * r]), [.78, .74, .66], .55, 4); }
  while (i < n) { const r = 300 + rnd() * 900, th = rnd() * 6.2832, ph = Math.acos(2 * rnd() - 1); put([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], [.42, .48, .6], .35, 3); }
  return { pos, col, size, count: i };
}

/** DOM/WebGL half. Called once from the page with the stage's own ask function. */
export function mount(opts = {}) {
  if (typeof document === 'undefined' || document.getElementById('void-cosmos')) return null;
  const ask = typeof opts.ask === 'function' ? opts.ask : () => {};
  const cv = document.createElement('canvas'); cv.id = 'void-cosmos'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
  const gl = cv.getContext('webgl2', { alpha: true, antialias: false, depth: false, premultipliedAlpha: true });
  if (!gl) { cv.remove(); return null; }
  const VS = '#version 300 es\nin vec3 aP;in vec4 aC;in float aS;uniform vec3 uCam;uniform vec2 uAng,uR;uniform float uZoom,uFade,uDpr;out vec3 vC;out float vA;void main(){vec3 p=(aP-uCam)*uZoom;float cy=cos(uAng.x),sy=sin(uAng.x),cp=cos(uAng.y),sp=sin(uAng.y);float t=p.x*sy+p.z*cy;vec3 q=vec3(p.x*cy-p.z*sy,p.y*cp-t*sp,p.y*sp+t*cp);float d=max(.2,1.+q.z/1200.);gl_Position=vec4(q.xy*vec2(uR.y/uR.x,1.)/(d*420.),0.,1.);gl_PointSize=clamp(aS*uDpr*(.9+.35*uZoom),1.,128.);vC=aC.rgb;vA=uFade*aC.a;}';
  const FS = '#version 300 es\nprecision mediump float;in vec3 vC;in float vA;out vec4 o;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=pow(1.-r,4.)*vA;o=vec4(vC*a,a);}';
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };
  const P = prog(VS, FS); if (!P) { cv.remove(); return null; };
  const U = (p, k) => gl.getUniformLocation(p, k), uCam = U(P, 'uCam'), uAng = U(P, 'uAng'), uR = U(P, 'uR'), uZoom = U(P, 'uZoom'), uFade = U(P, 'uFade'), uDpr = U(P, 'uDpr');
  const uni = buildUniverse(), buf = gl.createBuffer(), cbuf = gl.createBuffer(), sbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, uni.pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf); gl.bufferData(gl.ARRAY_BUFFER, uni.col, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.bufferData(gl.ARRAY_BUFFER, uni.size, gl.STATIC_DRAW);
  const lbuf = gl.createBuffer(), lcbuf = gl.createBuffer(), lp = new Float32Array((TRAIL_CAP * 2 + VISIT_CAP * 48) * 3), lc = new Float32Array(lp.length); let ln = 0;
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); // premultiplied light, added
  const style = document.createElement('style'); style.textContent = '#void-cosmos{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block}#void-cosmos-hud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:7;display:none;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:6px 12px;border-radius:999px;font:12px/1.3 ui-sans-serif,system-ui,sans-serif;color:#dfe4ff;background:rgba(16,18,30,.72);border:1px solid rgba(160,180,255,.24);backdrop-filter:blur(8px);cursor:pointer}#void-cosmos-hud.on{display:flex}@media(prefers-reduced-motion:reduce){#void-cosmos-hud{transition:none}}';
  document.head.appendChild(style);
  const hud = document.createElement('div'); hud.id = 'void-cosmos-hud'; hud.setAttribute('role', 'status'); document.body.appendChild(hud);
  const mobile = innerWidth < 700 || matchMedia('(pointer: coarse)').matches, reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let cam = loadState(window.localStorage, location.hash), trail = [], visited = [];
  try { const t = JSON.parse(localStorage.getItem(TRAIL_KEY) || '{}'); trail = (t.trail || []).slice(-TRAIL_CAP); visited = (t.visited || []).slice(0, VISIT_CAP); } catch (_) {}
  let dpr = 1, raf = 0, lastT = 0, hashTimer = 0, lastTrail = cam.scaleLog, lastSave = 0;
  const size = () => { dpr = Math.min(mobile ? 1.5 : 2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, cv.width, cv.height); };
  size(); addEventListener('resize', size);
  const save = () => { saveState(cam, window.localStorage); try { localStorage.setItem(TRAIL_KEY, JSON.stringify({ trail, visited })); } catch (_) {} };
  const hash = () => { clearTimeout(hashTimer); hashTimer = setTimeout(() => { try { history.replaceState(null, '', location.pathname + location.search + encodeHash(cam)); } catch (_) {} }, 420); };
  const remember = () => { if (Math.abs(cam.scaleLog - lastTrail) > .14 || Math.hypot(cam.x, cam.y, cam.z) > 80) { lastTrail = cam.scaleLog; trail = trail.concat([[cam.x, cam.y, cam.z, cam.scaleLog]]).slice(-TRAIL_CAP); } save(); hash(); };
  const lines = () => { ln = 0; const add = (p, c) => { if (ln + 3 > lp.length) return; lp.set(p, ln); lc.set(c, ln); ln += 3; }; for (let i = 1; i < trail.length; i++) { const a = trail[i - 1], b = trail[i]; add([a[0], a[1], a[2]], [.2, .35, .6]); add([b[0], b[1], b[2]], [.35, .6, .9]); } for (const id of visited) { const L = LANDMARKS.find((x) => x[0] === id); if (!L) continue; const p = project(L[1], L[2], L[3]); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, b = (k + 1) / 24 * 6.2832; add([p[0] + Math.cos(a) * 9, p[1], p[2] + Math.sin(a) * 9], [.5, .7, .9]); add([p[0] + Math.cos(b) * 9, p[1], p[2] + Math.sin(b) * 9], [.5, .7, .9]); } } if (ln) { gl.bindBuffer(gl.ARRAY_BUFFER, lbuf); gl.bufferData(gl.ARRAY_BUFFER, lp.subarray(0, ln), gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, lcbuf); gl.bufferData(gl.ARRAY_BUFFER, lc.subarray(0, ln), gl.DYNAMIC_DRAW); } };
  const draw = (now) => { raf = 0; const dt = lastT ? Math.min(.05, (now - lastT) / 1000) : 1 / 60; lastT = now; if (Object.keys(keys).length) { cam = stepKeys(cam, keys, dt); if (now - lastSave > 500) { lastSave = now; remember(); } } const W = cv.width, H = cv.height; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P); const ap = gl.getAttribLocation(P, 'aP'), ac = gl.getAttribLocation(P, 'aC'), as = gl.getAttribLocation(P, 'aS');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, cbuf); gl.enableVertexAttribArray(ac); gl.vertexAttribPointer(ac, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.enableVertexAttribArray(as); gl.vertexAttribPointer(as, 1, gl.FLOAT, false, 0, 0); gl.uniform1f(uDpr, dpr);
    gl.uniform3f(uCam, cam.x, cam.y, cam.z); gl.uniform2f(uAng, cam.yaw, cam.pitch); gl.uniform2f(uR, W, H); gl.uniform1f(uZoom, zoomOf(cam.scaleLog)); gl.uniform1f(uFade, clamp((cam.scaleLog - LOG_MIN) / 1.2, 0, 1)); gl.drawArrays(gl.POINTS, 0, uni.count);
    // the trail and the visited rings are faint hairlines (.12), drawn only on demand: while you steer the map or point at a landmark
    if (ln && (drag || hud._ask || Object.keys(keys).length)) { gl.disableVertexAttribArray(as); gl.vertexAttrib1f(as, 1); gl.bindBuffer(gl.ARRAY_BUFFER, lbuf); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, lcbuf); gl.enableVertexAttribArray(ac); gl.vertexAttribPointer(ac, 3, gl.FLOAT, false, 0, 0); gl.uniform1f(uFade, .12); gl.drawArrays(gl.LINES, 0, ln / 3); }
    if (Object.keys(keys).length && !reduce.matches && !document.hidden) raf = requestAnimationFrame(draw); };
  const kick = () => { if (document.hidden) return; if (reduce.matches) { draw(performance.now()); return; } if (!raf) raf = requestAnimationFrame(draw); };
  const typing = (t) => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable);
  const busy = (t) => typing(t) || (t && t.closest && t.closest('#row, #dock, .vpage, .thing, button, a, #void-fly-hud, #void-cosmos-hud')) || document.documentElement.classList.contains('void-flying');
  const keys = {};
  addEventListener('keydown', (e) => { if (busy(e.target)) return; const k = e.key.toLowerCase(); if (!'wasd'.includes(k) && k !== 'shift' && !k.startsWith('arrow')) return; if (e.metaKey || e.ctrlKey || e.altKey) return; e.preventDefault(); keys[k === 'shift' ? 'Shift' : k] = true; kick(); }, true);
  addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); delete keys[k === 'shift' ? 'Shift' : k]; }, true);
  addEventListener('blur', () => { for (const k in keys) delete keys[k]; });
  let drag = null;
  addEventListener('pointerdown', (e) => { if (busy(e.target) || e.button > 0) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; }, true);
  addEventListener('pointermove', (e) => { if (drag && drag.id === e.pointerId) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; cam.yaw += dx * .004; cam.pitch = clamp(cam.pitch - dy * .004, -1.45, 1.45); drag.x = e.clientX; drag.y = e.clientY; kick(); return; } if (busy(e.target) || !e.isPrimary) return; const was = hud._ask, L = pickLandmark(cam, innerWidth, innerHeight, e.clientX, e.clientY, mobile ? 36 : 26); if (L) { hud.textContent = L[0] + ' \u00b7 tap to inspect'; hud.classList.add('on'); hud._ask = L[5]; } else { hud.classList.remove('on'); hud._ask = null; } if (was !== hud._ask) kick(); }, { passive: true, capture: true });
  addEventListener('pointerup', (e) => { if (!drag || drag.id !== e.pointerId) return; const moved = drag.moved; drag = null; kick(); if (!moved) { const L = pickLandmark(cam, innerWidth, innerHeight, e.clientX, e.clientY, mobile ? 36 : 26); if (L) { visited = addVisited(visited, L[0]); lines(); ask(L[5]); remember(); } } else remember(); }, true);
  addEventListener('wheel', (e) => { if (busy(e.target)) return; e.preventDefault(); cam.scaleLog = clamp(cam.scaleLog - e.deltaY * .0012, LOG_MIN, LOG_MAX); cam.x *= .985; cam.y *= .985; cam.z *= .985; kick(); remember(); }, { passive: false, capture: true });
  hud.addEventListener('click', (e) => { e.stopPropagation(); if (hud._ask) ask(hud._ask); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  reduce.addEventListener('change', kick);
  lines(); draw(performance.now());
  return { state: () => ({ ...cam }), redraw: draw };
}

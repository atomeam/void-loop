// A garden snail (Cornu aspersum), Verse's own 3D version. First faithful to the real animal (form, how it moves, what it does; the facts are in
// snail-facts.js and checked by tools/world-facts.mjs), then past reality: slow time, look inside, change the weather, look up through glass at the foot.
// Built from code, with no model files, so it loads light and grows on a strong device. Sizes are in centimetres. The snail faces +X and walks on the ground plane y = 0.
import { manifest, CARDS } from './snail-facts.js';
export { manifest };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export async function build(ctx, detail) {
  const { THREE, scene, camera } = ctx, full = detail === 'full';
  const rand = rnd(7), disposables = [], root = new THREE.Group(); scene.add(root);
  const keep = (o) => { disposables.push(o); return o; };
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = keep(new THREE.CanvasTexture(c)); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = full ? 8 : 2; return t; };
  const normalFrom = (w, h, heightDraw, strength) => { // a normal map from a drawn height field
    const hc = document.createElement('canvas'); hc.width = w; hc.height = h; const hx = hc.getContext('2d'); heightDraw(hx, w, h);
    const src = hx.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4), at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; out[i] = (-dx / l * 0.5 + 0.5) * 255; out[i + 1] = (dy / l * 0.5 + 0.5) * 255; out[i + 2] = (1 / l * 0.5 + 0.5) * 255; out[i + 3] = 255; }
    const t = keep(new THREE.DataTexture(out, w, h)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; t.anisotropy = full ? 8 : 2; return t;
  };
  const TEX = full ? 1024 : 512;

  // ---------- the ground: soil, leaf litter and moss, gently uneven ----------
  const heightAt = (x, z) => (ctx.surface === 'glass' ? 0 : 0.16 * Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27) + 0.07 * Math.sin(x * 0.9 + z * 0.7));
  const groundTex = canvasTex(TEX, TEX, (g, w, h) => {
    g.fillStyle = '#4a3a26'; g.fillRect(0, 0, w, h); const r = rnd(3);
    for (let i = 0; i < w * 2.2; i++) { const x = r() * w, y = r() * h, s = 1 + r() * 5; g.fillStyle = `hsl(${24 + r() * 14},${25 + r() * 20}%,${14 + r() * 20}%)`; g.beginPath(); g.ellipse(x, y, s * 1.6, s, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h, s = 18 + r() * 34, a = r() * 6; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `hsl(${r() < 0.4 ? 30 + r() * 10 : 84 + r() * 30},${40 + r() * 20}%,${22 + r() * 18}%)`; g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.55, s, 0); g.quadraticCurveTo(0, s * 0.55, -s, 0); g.fill(); g.strokeStyle = '#0003'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke(); g.restore(); }
    for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h; const gr = g.createRadialGradient(x, y, 0, x, y, 12 + r() * 22); gr.addColorStop(0, 'hsla(100,55%,30%,.75)'); gr.addColorStop(1, 'hsla(100,55%,30%,0)'); g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); }
  });
  groundTex.repeat.set(6, 6);
  const groundNormal = normalFrom(256, 256, (g, w, h) => { const r = rnd(11); g.fillStyle = '#777'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { const v = 90 + r() * 120; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 4, 0, 7); g.fill(); } }, 2.2); groundNormal.repeat.set(10, 10);
  const gGeo = keep(new THREE.CircleGeometry(70, full ? 160 : 72)); gGeo.rotateX(-Math.PI / 2);
  { const p = gGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)) - 0.03); gGeo.computeVertexNormals(); const uv = gGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 24, p.getZ(i) / 24); }
  const ground = new THREE.Mesh(gGeo, keep(new THREE.MeshStandardMaterial({ map: groundTex, normalMap: groundNormal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, metalness: 0 }))); ground.receiveShadow = true; root.add(ground);
  const glassMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false }));
  const glass = new THREE.Mesh(keep(new THREE.CircleGeometry(40, 48)), glassMat); glass.rotation.x = -Math.PI / 2; glass.visible = false; root.add(glass);
  const bounce = new THREE.PointLight(0xffe2b8, 0, 60, 1.6); bounce.position.set(0, -7, 0); root.add(bounce);

  // props: grass, pebbles, clover and dew, kept outside the snail's walking circle so nothing is walked through
  const props = new THREE.Group(); root.add(props);
  { const blade = keep(new THREE.BufferGeometry()); blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0, 1, 0.12, -0.05, 0.5, 0, 0.05, 0.5, 0], 3)); blade.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(10), 2)); blade.setIndex([0, 1, 3, 1, 4, 3, 3, 4, 2]); blade.computeVertexNormals();
    const n = full ? 1500 : 380, im = new THREE.InstancedMesh(blade, keep(new THREE.MeshStandardMaterial({ color: 0x5f9a3a, roughness: 0.6, side: THREE.DoubleSide })), n), m = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { const a = rand() * 6.283, d = 13 + rand() * 40; m.position.set(Math.cos(a) * d, heightAt(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d); m.rotation.set((rand() - 0.5) * 0.4, rand() * 6.283, (rand() - 0.5) * 0.4); m.scale.set(1, 3 + rand() * 6, 1); m.updateMatrix(); im.setMatrixAt(i, m.matrix); im.setColorAt(i, c.setHSL(0.24 + rand() * 0.07, 0.5, 0.25 + rand() * 0.18)); }
    im.castShadow = true; im.receiveShadow = true; props.add(im);
    const pm = keep(new THREE.MeshStandardMaterial({ color: 0x8b857a, roughness: 0.85 }));
    for (let i = 0; i < (full ? 26 : 10); i++) { const a = rand() * 6.283, d = 10 + rand() * 22, s = 0.3 + rand() * 1.1, p = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(s, 2)), pm); p.scale.set(1.3, 0.55, 1); p.position.set(Math.cos(a) * d, heightAt(Math.cos(a) * d, Math.sin(a) * d) + s * 0.1, Math.sin(a) * d); p.rotation.y = rand() * 6; p.castShadow = true; p.receiveShadow = true; props.add(p); }
    const dm = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1, ior: 1.33 })), dg = keep(new THREE.SphereGeometry(0.1, 12, 8));
    for (let i = 0; i < (full ? 70 : 18); i++) { const a = rand() * 6.283, d = 4 + rand() * 11, s = 0.5 + rand() * 1.2, p = new THREE.Mesh(dg, dm); p.scale.set(s, s * 0.8, s); p.position.set(Math.cos(a) * d, heightAt(Math.cos(a) * d, Math.sin(a) * d) + 0.04, Math.sin(a) * d); props.add(p); }
  }

  // ---------- the shell: a logarithmic spiral tube, banded and ridged ----------
  const WH = 4.5, VEND = WH * 2 * Math.PI, G = 0.155, R0 = 0.0215, HC = -0.0125, VSTART = 0.9;
  const shellPoint = (u, v, out) => { const k = Math.exp(G * v), r = R0 * k, cx = R0 * 1.05 * k * Math.cos(v), cz = R0 * 1.05 * k * Math.sin(v), cy = HC * k; const rx = Math.cos(v), rz = Math.sin(v); out[0] = cx + r * Math.cos(u) * rx; out[1] = cy + r * Math.sin(u); out[2] = cz + r * Math.cos(u) * rz; return out; };
  const US = full ? 96 : 40, VS = full ? 520 : 170, sp = new Float32Array((US + 1) * (VS + 1) * 3), suv = new Float32Array((US + 1) * (VS + 1) * 2), sidx = [], tmp = [0, 0, 0];
  for (let j = 0; j <= VS; j++) for (let i = 0; i <= US; i++) { const u = (i / US) * 6.2832, v = VSTART + (j / VS) * (VEND - VSTART), n = j * (US + 1) + i; shellPoint(u, v, tmp); sp.set(tmp, n * 3); suv[n * 2] = i / US; suv[n * 2 + 1] = j / VS; }
  for (let j = 0; j < VS; j++) for (let i = 0; i < US; i++) { const a = j * (US + 1) + i, b = a + 1, c = a + US + 1, d = c + 1; sidx.push(a, c, b, b, c, d); }
  const sGeo = keep(new THREE.BufferGeometry()); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sGeo.setAttribute('uv', new THREE.BufferAttribute(suv, 2)); sGeo.setIndex(sidx); sGeo.computeVertexNormals();
  { // face outward: the normal at the outermost point of the last whorl must point away from the axis
    const n0 = (VS) * (US + 1), nrm = sGeo.attributes.normal; const px = sp[n0 * 3], pz = sp[n0 * 3 + 2], tangent = [Math.cos(VEND) * Math.cos(VEND) + 0, 0, 0]; void tangent; const o = Math.sign(nrm.getX(n0) * Math.cos(VEND) + nrm.getZ(n0) * Math.sin(VEND)); void px; void pz; if (o < 0) { sidx.forEach((_, k) => { if (k % 3 === 1) { const t = sidx[k]; sidx[k] = sidx[k + 1]; sidx[k + 1] = t; } }); sGeo.setIndex(sidx); sGeo.computeVertexNormals(); } }
  const shellTex = canvasTex(full ? 1024 : 512, full ? 2048 : 1024, (g, w, h) => {
    const r = rnd(5); g.fillStyle = '#c99a5a'; g.fillRect(0, 0, w, h);
    const bands = [[0.06, 0.1], [0.3, 0.07], [0.5, 0.11], [0.74, 0.07], [0.9, 0.05]];
    for (const [c, wd] of bands) { const gr = g.createLinearGradient((c - wd) * w, 0, (c + wd) * w, 0); gr.addColorStop(0, 'rgba(70,36,14,0)'); gr.addColorStop(0.5, 'rgba(70,36,14,.9)'); gr.addColorStop(1, 'rgba(70,36,14,0)'); g.fillStyle = gr; g.fillRect((c - wd) * w, 0, wd * 2 * w, h); }
    for (let i = 0; i < 1600; i++) { const x = r() * w, y = r() * h, l = 6 + r() * 30; g.strokeStyle = `rgba(${r() < 0.5 ? '255,235,190' : '90,50,20'},${0.04 + r() * 0.09})`; g.lineWidth = 1 + r() * 2.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 10, y + l); g.stroke(); }
    for (let i = 0; i < 90; i++) { const y = r() * h; g.fillStyle = 'rgba(40,20,8,.18)'; g.fillRect(0, y, w, 1 + r() * 3); }
    for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * h; g.fillStyle = `rgba(255,245,215,${0.1 + r() * 0.2})`; g.beginPath(); g.ellipse(x, y, 3 + r() * 14, 1 + r() * 4, 1.57, 0, 7); g.fill(); }
  });
  const shellBump = normalFrom(256, 1024, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); const r = rnd(9); for (let y = 0; y < h; y += 7 + r() * 5) { g.fillStyle = `rgb(${190 + r() * 60},${190 + r() * 60},${190 + r() * 60})`; g.fillRect(0, y, w, 2 + r() * 3); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 1 + r() * 14, 1); } }, 3.2);
  const shellSolid = keep(new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, map: shellTex, normalMap: shellBump, normalScale: new THREE.Vector2(1, 1), roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.28, sheen: 0.4, sheenColor: new THREE.Color(0xffe2b0) }));
  const shellGhost = keep(new THREE.MeshPhysicalMaterial({ map: shellTex, color: 0xffe7c4, roughness: 0.18, transparent: true, opacity: 0.2, depthWrite: false, clearcoat: 1 }));
  const shell = new THREE.Mesh(sGeo, shellSolid); shell.castShadow = true; shell.receiveShadow = true; shell.userData.part = 'shell';
  // the shell frame: aperture centre and the direction the opening faces, so the body can come out of it
  const A = shellPoint(0, VEND, [0, 0, 0]); const aperC = (() => { const a = [0, 0, 0], b = [0, 0, 0]; shellPoint(0, VEND, a); shellPoint(Math.PI, VEND, b); return new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); })(); void A;
  const aperN = new THREE.Vector3(-Math.sin(VEND), -0.18, Math.cos(VEND)).normalize();
  const shellRig = new THREE.Group(), shellPivot = new THREE.Group(); shellPivot.add(shell); shellPivot.position.copy(aperC).multiplyScalar(-1); shellRig.add(shellPivot); root.add(shellRig);
  { // orient: the opening faces forward and down and to the right; the coil axis points back, up and out to the right, as a real right-handed shell sits
    const e1 = new THREE.Vector3(0, 1, 0), e2 = aperN.clone().sub(e1.clone().multiplyScalar(aperN.dot(e1))).normalize(), e3 = new THREE.Vector3().crossVectors(e1, e2);
    const a = new THREE.Vector3(-0.45, 0.5, 0.74).normalize(), b0 = new THREE.Vector3(0.9, -0.4, -0.2), b = b0.sub(a.clone().multiplyScalar(b0.dot(a))).normalize(), c = new THREE.Vector3().crossVectors(a, b);
    const L = new THREE.Matrix4().makeBasis(e1, e2, e3), Wm = new THREE.Matrix4().makeBasis(a, b, c); shellRig.quaternion.setFromRotationMatrix(Wm.multiply(L.transpose())); }
  const baseQ = shellRig.quaternion.clone(), yawQ = new THREE.Quaternion();
  const lip = new THREE.Mesh(keep(new THREE.TorusGeometry(1, 0.1, 10, 40)), keep(new THREE.MeshPhysicalMaterial({ color: 0xe9c488, roughness: 0.4, clearcoat: 0.5 }))); // the thickened rim of the opening
  { const ap = [0, 0, 0], bp = [0, 0, 0]; shellPoint(0, VEND, ap); shellPoint(Math.PI, VEND, bp); const rr = Math.hypot(ap[0] - bp[0], ap[1] - bp[1], ap[2] - bp[2]) / 2; lip.scale.setScalar(rr); lip.position.copy(aperC); lip.lookAt(aperC.clone().add(aperN)); lip.position.sub(aperC); const hold = new THREE.Group(); hold.position.copy(aperC); hold.add(lip); lip.position.set(0, 0, 0); hold.lookAt = null; shellPivot.add(hold); hold.position.copy(aperC); lip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aperN); lip.castShadow = true; lip.userData.part = 'shell'; }
  const SHELL_K = 1.4 / (R0 * Math.exp(G * VEND)); shellRig.scale.setScalar(SHELL_K);

  // ---------- the body: a lofted foot that follows the path the head took ----------
  const BL = 4.6, N = full ? 120 : 56, M = full ? 44 : 22, SIDE = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
  const prof = (s) => { // half width, height, and the sole's flatness along the body (s = 0 at the nose)
    const nose = s < 0.07 ? Math.sqrt(Math.max(0, 1 - ((0.07 - s) / 0.07) ** 2)) : 1, tail = s > 0.62 ? Math.max(0.03, 1 - ((s - 0.62) / 0.38) ** 1.35) : 1;
    const w = 0.5 * nose * tail * (1 + 0.1 * sstep(0.2, 0.4, s)), hh = (0.4 + 0.5 * sstep(0.05, 0.28, s) - 0.1 * sstep(0.55, 0.8, s)) * nose * Math.pow(tail, 0.8); return { w, h: hh };
  };
  const hist = [], STEP = 0.05; let pos = { x: -6, z: 2, a: 0.25 }, travelled = 0; for (let i = 0; i < 140; i++) hist.push({ x: pos.x - Math.cos(pos.a) * i * STEP, z: pos.z - Math.sin(pos.a) * i * STEP }); // newest first
  const back = (d) => { const f = clamp(d / STEP, 0, hist.length - 1.001), i = Math.floor(f), k = f - i, p = hist[i], q = hist[i + 1]; return { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k }; };
  const bGeo = keep(new THREE.BufferGeometry()), bp = new Float32Array(N * (M + 1) * 3), bc = new Float32Array(N * (M + 1) * 3), buv = new Float32Array(N * (M + 1) * 2), bidx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j <= M; j++) { const n = i * (M + 1) + j; buv[n * 2] = j / M * 2; buv[n * 2 + 1] = (i / (N - 1)) * BL / 0.9; const th = (j / M) * 6.2832, top = Math.max(0, Math.sin(th)), s = i / (N - 1); const dark = sstep(0.0, 0.8, top) * (0.75 + 0.25 * Math.cos(th * 3)) * (0.9 - 0.25 * sstep(0.55, 1, s)); const base = [0.86, 0.8, 0.66], back = [0.43, 0.38, 0.29]; for (let k = 0; k < 3; k++) bc[n * 3 + k] = base[k] * (1 - dark) + back[k] * dark; }
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1; bidx.push(a, b, c, b, d, c); }
  bGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3)); bGeo.setAttribute('uv', new THREE.BufferAttribute(buv, 2)); bGeo.setIndex(bidx);
  const skinNormal = normalFrom(256, 256, (g, w, h) => { g.fillStyle = '#707070'; g.fillRect(0, 0, w, h); const r = rnd(21); for (let i = 0; i < 520; i++) { const v = 150 + r() * 100; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 9, 1.5 + r() * 3, 1.57 + (r() - 0.5) * 0.5, 0, 7); g.fill(); } }, 3);
  const bodySolid = keep(new THREE.MeshPhysicalMaterial({ vertexColors: true, normalMap: skinNormal, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18, sheen: 0.3, sheenColor: new THREE.Color(0xf4ecd0), side: THREE.DoubleSide }));
  const collar = new THREE.Mesh(keep(new THREE.TorusGeometry(1, 0.13, 10, 36)), bodySolid); // the mantle: the skin collar at the rim of the shell
  { const ap = [0, 0, 0], bp = [0, 0, 0]; shellPoint(0, VEND, ap); shellPoint(Math.PI, VEND, bp); collar.scale.setScalar(Math.hypot(ap[0] - bp[0], ap[1] - bp[1], ap[2] - bp[2]) * 0.45); collar.position.copy(aperC); collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aperN); collar.castShadow = true; collar.userData.part = 'mantle'; shellPivot.add(collar); }
  const bodyGhost = keep(new THREE.MeshPhysicalMaterial({ color: 0xe8e0c8, roughness: 0.15, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  const body = new THREE.Mesh(bGeo, bodySolid); body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false; body.userData.part = 'foot'; root.add(body);

  // tentacles: four tapered tubes; the upper two end in a bulb with an eye
  const TS = 9, TR = 8;
  const mkTube = (len, r0, bulb) => { const g = keep(new THREE.BufferGeometry()), p = new Float32Array((TS + 1) * (TR + 1) * 3), id = []; for (let i = 0; i < TS; i++) for (let j = 0; j < TR; j++) { const a = i * (TR + 1) + j, b = a + 1, c = a + TR + 1, d = c + 1; id.push(a, c, b, b, c, d); } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setIndex(id); const m = new THREE.Mesh(g, bodySolid); m.castShadow = true; m.frustumCulled = false; return { mesh: m, len, r0, bulb, p }; };
  const tent = [{ side: 1, up: true }, { side: -1, up: true }, { side: 1, up: false }, { side: -1, up: false }].map((d) => { const t = mkTube(d.up ? 1.9 : 0.75, d.up ? 0.085 : 0.06, d.up); Object.assign(t, d); t.mesh.userData.part = d.up ? 'upper-tentacle' : 'lower-tentacle'; t.ext = 1; t.target = 1; root.add(t.mesh); if (d.up) { const eye = new THREE.Mesh(keep(new THREE.SphereGeometry(0.075, 12, 10)), keep(new THREE.MeshPhysicalMaterial({ color: 0x080808, roughness: 0.05, clearcoat: 1 }))); eye.userData.part = 'eye'; t.eye = eye; root.add(eye); const bulbM = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 14, 10)), bodySolid); bulbM.castShadow = true; bulbM.userData.part = 'upper-tentacle'; t.bulb = bulbM; root.add(bulbM); } return t; });
  const mouthM = new THREE.Mesh(keep(new THREE.SphereGeometry(0.16, 12, 8)), keep(new THREE.MeshStandardMaterial({ color: 0x2b1810, roughness: 0.6 }))); mouthM.userData.part = 'mouth'; mouthM.scale.set(1.1, 0.5, 1.4); root.add(mouthM);
  const pneu = new THREE.Mesh(keep(new THREE.SphereGeometry(0.1, 12, 8)), keep(new THREE.MeshStandardMaterial({ color: 0x1b120c, roughness: 0.5 }))); pneu.userData.part = 'pneumostome'; pneu.scale.set(1, 0.55, 1); root.add(pneu);
  const epi = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 28)), keep(new THREE.MeshPhysicalMaterial({ color: 0xf2eadb, roughness: 0.5, transparent: true, opacity: 0.88, side: THREE.DoubleSide }))); epi.visible = false; root.add(epi);
  const inner = new THREE.Group(), organMat = (c, o = 0.95) => keep(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.6, transparent: o < 1, opacity: o })); inner.visible = false; root.add(inner);
  const organ = (id, geo, mat, parent = inner) => { const m = new THREE.Mesh(keep(geo), mat); m.userData.part = id; parent.add(m); return m; };
  // organs that live in the shell: the dark digestive gland coiled up the spire, the pale gonad at the tip, the heart and the lung under the last whorl
  const insideShell = new THREE.Group(); shellPivot.add(insideShell); insideShell.visible = false;
  { const pts = []; for (let v = 3.2; v < VEND - 2.4; v += 0.18) { const o = [0, 0, 0]; shellPoint(Math.PI * 0.5, v, o); const c = [0, 0, 0], d = [0, 0, 0]; shellPoint(0, v, c); shellPoint(Math.PI, v, d); const mid = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2, (c[2] + d[2]) / 2]; pts.push(new THREE.Vector3(...mid)); }
    const curve = new THREE.CatmullRomCurve3(pts), tube = organ('digestive-gland', new THREE.TubeGeometry(curve, full ? 140 : 60, 0.0205 * 0.62 * Math.exp(G * 10) * 0.9, 12, false), organMat(0x4a3322), insideShell); tube.scale.setScalar(1); void tube;
    const tip = organ('digestive-gland', new THREE.SphereGeometry(R0 * Math.exp(G * 5) * 1.0, 14, 10), organMat(0xd9c9a0), insideShell); tip.position.copy(pts[0]); tip.userData.part = 'gonad';
    const lungS = organ('lung', new THREE.SphereGeometry(1, 20, 14), organMat(0xf0a8a0, 0.55), insideShell); lungS.scale.set(0.012 * 28, 0.012 * 16, 0.012 * 22); const lp = new THREE.Vector3(); const o1 = [0, 0, 0]; shellPoint(Math.PI * 0.5, VEND - 2.1, o1); lp.set(...o1); lungS.position.copy(lp);
    const heart = organ('heart', new THREE.SphereGeometry(1, 16, 12), organMat(0xc0393b), insideShell); heart.scale.set(0.011 * 9, 0.011 * 11, 0.011 * 8); const o2 = [0, 0, 0]; shellPoint(Math.PI * 0.2, VEND - 3.5, o2); heart.position.set(...o2); insideShell.userData.heart = heart; insideShell.userData.lung = lungS; }
  const buccal = organ('mouth', new THREE.SphereGeometry(1, 16, 12), organMat(0xb06a54), inner); buccal.scale.set(0.34, 0.26, 0.28);
  const radulaM = organ('radula', new THREE.TorusGeometry(0.2, 0.045, 8, 22, Math.PI * 1.4), organMat(0xe9e1c0, 1), inner); radulaM.rotation.y = Math.PI / 2;
  const ganglia = organ('brain', new THREE.TorusGeometry(0.16, 0.05, 8, 18), organMat(0xf2d55a, 1), inner); ganglia.rotation.y = Math.PI / 2;
  // mucus: a glossy ribbon laid down behind the foot
  const MN = full ? 420 : 200, mG = keep(new THREE.BufferGeometry()), mp = new Float32Array(MN * 2 * 3), mi = []; for (let i = 0; i < MN - 1; i++) mi.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  mG.setAttribute('position', new THREE.BufferAttribute(mp, 3)); { const nn = new Float32Array(MN * 2 * 3), uu = new Float32Array(MN * 2 * 2); for (let i = 0; i < MN * 2; i++) nn[i * 3 + 1] = 1; mG.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); mG.setAttribute('uv', new THREE.BufferAttribute(uu, 2)); } mG.setIndex(mi);
  const mucus = new THREE.Mesh(mG, keep(new THREE.MeshPhysicalMaterial({ color: 0xe6f1ee, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.36, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }))); mucus.frustumCulled = false; mucus.userData.part = 'mucus'; mucus.renderOrder = 1; root.add(mucus);
  const trail = []; // the head's past, one point per step, for the ribbon

  // ---------- life ----------
  const food = []; const foodMat = keep(new THREE.MeshStandardMaterial({ color: 0x78b84a, roughness: 0.55, side: THREE.DoubleSide })), foodGeo = keep(new THREE.CircleGeometry(1, 20));
  const st = { speed: 0, speedRel: 0, wave: 0, retreat: 0, retreatGoal: 0, goal: null, feed: 0, breathe: 0, poke: 0, wander: { x: 2, z: 0 }, xray: false, glass: false, last: new THREE.Vector3(), phase: 0, turn: 0 };
  const posAt = new THREE.Vector3(), spine = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(1, 0, 0), s: new THREE.Vector3(0, 0, 1), w: 0, h: 0 }));
  const world = (obj) => obj.getWorldPosition(new THREE.Vector3());
  function placeBody(time) {
    const rho = st.retreat, stretch = 1 - 0.7 * rho, wscale = 1 - 0.3 * rho, f = 1.55 * (0.55 + 0.45 * st.speedRel);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1), d = s * BL * stretch, a = back(d), b = back(d + 0.1), c = back(Math.max(0, d - 0.1));
      const sp = spine[i], tx = c.x - b.x, tz = c.z - b.z, tl = Math.hypot(tx, tz) || 1; sp.t.set(tx / tl, 0, tz / tl); sp.s.set(sp.t.z, 0, -sp.t.x); // forward and to the right
      const { w, h } = prof(s), wave = Math.sin(6.2832 * (2.6 * s * (BL / 4.4) + st.phase)), live = (1 - rho) * sstep(0.04, 0.2, s) * (1 - sstep(0.78, 1, s));
      sp.w = w * wscale; sp.h = h * (1 - 0.15 * rho) * (1 + 0.035 * wave * live * (1 - (ctx.surface === 'glass' ? 0 : 0)));
      sp.p.set(a.x, heightAt(a.x, a.z) + 0.02 + (1 - rho) * 0.03 * (0.5 + 0.5 * wave) * live * (0.4 + 0.6 * st.speedRel), a.z);
      for (let j = 0; j <= M; j++) {
        const th = (j / M) * 6.2832, cs = Math.cos(th), sn = Math.sin(th), lower = sn < 0, side = sp.w * Math.sign(cs) * Math.pow(Math.abs(cs), lower ? 0.55 : 0.8);
        let y = lower ? -0.0 + sn * 0.0 : sp.h * Math.pow(Math.max(0, sn), 0.78);
        if (lower) y = Math.max(0, sp.h * 0.0) + (ctx.surface === 'glass' ? 0 : 0) + sn * 0.0; // the sole is flat
        const lift = lower ? 0.07 * ((1 + wave) / 2) * live * st.speedRel * (ctx.surface === 'glass' ? 1.4 : 1) : 0, n = (i * (M + 1) + j) * 3;
        bp[n] = sp.p.x + sp.s.x * side; bp[n + 1] = sp.p.y + y + lift * (1 - Math.abs(cs)) * 0.0 + (lower ? lift * Math.abs(cs) * 0.0 : 0) + (lower ? Math.max(0, lift * (1 - Math.abs(cs))) : 0); bp[n + 2] = sp.p.z + sp.s.z * side;
      }
    }
    void f; bGeo.attributes.position.needsUpdate = true; bGeo.computeVertexNormals();
  }
  const at = (s) => spine[clamp(Math.round(s * (N - 1)), 0, N - 1)];
  function placeTube(t, base, dir, ext, time, sway) {
    const len = t.len * ext, r0 = t.r0; for (let i = 0; i <= TS; i++) { const u = i / TS, bend = Math.sin(time * 1.3 + (t.side > 0 ? 0 : 2) + u * 2) * sway * u * u + (1 - ext) * u * u * 1.2; const cx = base.x + dir.x * len * u, cy = base.y + dir.y * len * u - bend * 0.4 * (1 - ext) - 0.25 * u * u * len * (1 - st.poke * 0), cz = base.z + dir.z * len * u + bend * 0.15 * t.side; const rr = r0 * (1 - 0.35 * u) * (t.bulb && u > 0.9 ? 1.4 : 1) * (0.25 + 0.75 * ext); const nx = dir.z, nz = -dir.x; for (let j = 0; j <= TR; j++) { const th = (j / TR) * 6.2832, n = (i * (TR + 1) + j) * 3; t.p[n] = cx + nx * Math.cos(th) * rr; t.p[n + 1] = cy + Math.sin(th) * rr; t.p[n + 2] = cz + nz * Math.cos(th) * rr; } }
    t.mesh.geometry.attributes.position.needsUpdate = true; t.mesh.geometry.computeVertexNormals(); const tip = new THREE.Vector3(t.p[TS * (TR + 1) * 3], t.p[TS * (TR + 1) * 3 + 1], t.p[TS * (TR + 1) * 3 + 2]); return tip;
  }
  const dir3 = new THREE.Vector3(), base3 = new THREE.Vector3(), seen = [];
  function place(time, raw) {
    const head = at(0.03), neck = at(0.09), fwd = head.t;
    const ext = 1 - st.retreat; st.poke = Math.max(0, st.poke - raw * 0.5);
    tent.forEach((t, k) => {
      const want = st.poke > 0 && t.up ? 0.12 : 1; t.ext += (Math.min(want, ext) - t.ext) * (1 - Math.exp(-raw * (want < 1 ? 14 : 2.2)));
      const ux = t.up ? 0.5 : 0.42, uy = t.up ? 0.85 : 0.12, lat = (t.up ? 0.34 : 0.62) * t.side, seekX = st.goal ? 0.18 : 0;
      base3.set(head.p.x + fwd.x * 0.12 + head.s.x * 0.2 * t.side, head.p.y + head.h * (t.up ? 0.9 : 0.35), head.p.z + fwd.z * 0.12 + head.s.z * 0.2 * t.side);
      dir3.set(fwd.x * (ux + seekX) + head.s.x * lat, uy, fwd.z * (ux + seekX) + head.s.z * lat).normalize();
      const tip = placeTube(t, base3, dir3, t.ext, time, t.up ? 0.5 : 0.25); if (t.up) { t.bulb.position.copy(tip); t.eye.position.copy(tip).addScaledVector(dir3, 0.07).addScaledVector(new THREE.Vector3(head.s.x * t.side, 0.05, head.s.z * t.side), 0.05); t.eye.visible = t.bulb.visible = t.ext > 0.2; t.bulb.scale.setScalar(0.4 + 0.6 * t.ext); t.eye.scale.setScalar(0.4 + 0.6 * t.ext); } t.mesh.visible = t.ext > 0.05;
    });
    const mc = at(0.0); mouthM.position.set(mc.p.x + mc.t.x * 0.28, mc.p.y + 0.2, mc.p.z + mc.t.z * 0.28); mouthM.rotation.y = -Math.atan2(mc.t.z, mc.t.x); mouthM.scale.set(1.1, 0.5 + 0.35 * Math.abs(Math.sin(st.feed * 8)), 1.4); mouthM.visible = st.retreat < 0.6;
    const pn = at(0.36); pneu.position.set(pn.p.x + pn.s.x * (pn.w * 0.95) + pn.t.x * 0.1, pn.p.y + pn.h * 0.62, pn.p.z + pn.s.z * (pn.w * 0.95) + pn.t.z * 0.1); const open = 0.35 + 0.65 * Math.max(0, Math.sin(st.breathe)); pneu.scale.set(open, 0.55 * open, open); pneu.visible = st.retreat < 0.5;
    // the shell rides the back, its opening at the neck
    const sh = at(0.4), fy = pos.a; shellRig.position.set(sh.p.x - sh.t.x * 0.1 + sh.s.x * 0.05, sh.p.y + 0.8 * (1 - 0.15 * st.retreat), sh.p.z - sh.t.z * 0.1 + sh.s.z * 0.05); shellRig.quaternion.copy(yawQ.setFromAxisAngle(UPV, -fy)).multiply(baseQ);
    // seal: the thin membrane over the opening when it has pulled in
    const ap = aperC.clone().multiplyScalar(0), wp = new THREE.Vector3(); shell.localToWorld(wp.copy(aperC)); const nrm = aperN.clone().transformDirection(shell.matrixWorld);
    epi.visible = st.retreat > 0.85; epi.position.copy(wp); epi.lookAt(wp.clone().add(nrm)); epi.scale.setScalar(1.18); void ap;
    // inside view: place the organs on the live body
    inner.visible = st.xray; insideShell.visible = st.xray; if (st.xray) {
      const hd = at(0.1); buccal.position.set(hd.p.x + hd.t.x * 0.05, hd.p.y + hd.h * 0.38, hd.p.z + hd.t.z * 0.05); buccal.rotation.y = -Math.atan2(hd.t.z, hd.t.x); radulaM.position.copy(buccal.position).addScaledVector(new THREE.Vector3(hd.t.x, 0, hd.t.z), 0.17).add(new THREE.Vector3(0, -0.02 + 0.04 * Math.sin(st.feed * 8), 0)); radulaM.rotation.set(0, -Math.atan2(hd.t.z, hd.t.x) + Math.PI / 2, Math.PI / 2);
      const gg = at(0.16); ganglia.position.set(gg.p.x, gg.p.y + gg.h * 0.55, gg.p.z); ganglia.rotation.y = -Math.atan2(gg.t.z, gg.t.x);
      const hb = 1 + 0.18 * Math.max(0, Math.sin(time * 9 * (0.4 + 0.6 * st.speedRel + 0.001))); insideShell.userData.heart.scale.setScalar(hb); const lb = 1 + 0.06 * Math.sin(st.breathe); insideShell.userData.lung.scale.set(0.012 * 28 * lb, 0.012 * 16 * lb, 0.012 * 22 * lb);
    }
  }
  const findTarget = () => (food.length ? food[0] : null);
  function think(dt, time) {
    const temp = ctx.params.temp, wet = ctx.params.wet; st.retreatGoal = temp < 3 || wet < 22 ? 1 : 0; st.retreat += (st.retreatGoal - st.retreat) * (1 - Math.exp(-dt * (st.retreatGoal ? 1.4 : 0.8)));
    const act = clamp((temp - 2) / 14, 0, 1) * clamp((wet - 15) / 45, 0.25, 1), moving = (1 - st.retreat) > 0.6 && act > 0.03;
    const tgt = findTarget(); let gx, gz; if (tgt) { gx = tgt.x; gz = tgt.z; } else { if (Math.hypot(st.wander.x - pos.x, st.wander.z - pos.z) < 1.5 || Math.hypot(pos.x, pos.z) > 15) { const r = rand() * 6.283, d = 4 + rand() * 7; st.wander.x = Math.cos(r) * d * (Math.hypot(pos.x, pos.z) > 15 ? 0.3 : 1) - (Math.hypot(pos.x, pos.z) > 15 ? pos.x * 0.5 : -pos.x * 0); st.wander.z = Math.sin(r) * d - (Math.hypot(pos.x, pos.z) > 15 ? pos.z * 0.5 : 0); } gx = st.wander.x; gz = st.wander.z; }
    const want = Math.atan2(gz - pos.z, gx - pos.x); let da = want - pos.a; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
    const feeding = tgt && Math.hypot(tgt.x - pos.x, tgt.z - pos.z) < 0.95; st.goal = tgt;
    const v = moving && !feeding ? 0.24 * act * (1 - 0.55 * Math.min(1, Math.abs(da))) : 0; // 2.4 mm a second at best, in centimetres a second
    st.speed += (v - st.speed) * (1 - Math.exp(-dt * 2.5)); st.speedRel = clamp(st.speed / 0.24, 0, 1);
    pos.a += clamp(da, -1, 1) * Math.min(1, dt * 0.9 * (0.3 + st.speedRel)) * (moving ? 1 : 0);
    const dist = st.speed * dt; pos.x += Math.cos(pos.a) * dist; pos.z += Math.sin(pos.a) * dist; travelled += dist;
    while (travelled >= STEP) { travelled -= STEP; const k = hist[0]; hist.unshift({ x: pos.x - Math.cos(pos.a) * travelled, z: pos.z - Math.sin(pos.a) * travelled }); void k; if (hist.length > 160) hist.pop(); if (hist.length % 3 === 0) { trail.push({ x: hist[0].x - Math.cos(pos.a) * BL * 0.55, z: hist[0].z - Math.sin(pos.a) * BL * 0.55, a: pos.a }); if (trail.length > MN) trail.shift(); } }
    if (hist[0]) { hist[0].x = pos.x; hist[0].z = pos.z; }
    st.phase += dt * (0.25 + 1.5 * st.speedRel) * (1 - st.retreat) * (moving ? 1 : 0.15); st.breathe += dt * (0.8 + 0.5 * act);
    if (feeding && tgt) { st.feed += dt; tgt.r -= dt * 0.025; if (tgt.r <= 0.12) { food.shift(); scene.remove(tgt.mesh); } else tgt.mesh.scale.set(tgt.r, tgt.r, tgt.r); }
    void time;
  }
  function layTrail() {
    const n = trail.length; for (let i = 0; i < MN; i++) { const k = trail[Math.min(i, n - 1)] || { x: 0, z: 0, a: 0 }, w = n > 1 ? 0.34 * Math.min(1, i / 8) * Math.min(1, (n - i) / 10 + 0.1) : 0, nx = -Math.sin(k.a), nz = Math.cos(k.a), y = heightAt(k.x, k.z) + 0.012; mp.set([k.x + nx * w, y, k.z + nz * w, k.x - nx * w, y, k.z - nz * w], i * 6); }
    mG.attributes.position.needsUpdate = true; mG.setDrawRange(0, Math.max(0, (n - 1) * 6)); mucus.visible = n > 2 && ctx.surface !== 'xx';
  }
  const parts = () => { const ids = new Set(); root.traverse((o) => { if (o.userData && o.userData.part) ids.add(o.userData.part); }); return [...ids]; };
  const pickables = [shell, collar, body, mucus, ...tent.flatMap((t) => [t.mesh, t.bulb, t.eye].filter(Boolean)), mouthM, pneu, inner, insideShell, ground];
  let lastTime = 0; placeBody(0); place(0, 0.016);

  return {
    pickables, parts,
    tick(dt, time, raw) { lastTime = time; think(dt, time); placeBody(time); place(time, raw); layTrail(); bounce.intensity = st.glass ? 900 : 0; },
    focus() { const m = at(0.4); posAt.set(m.p.x, m.p.y + 0.8, m.p.z); return posAt; },
    toggle(id, on) {
      if (id === 'xray') { st.xray = on; shell.material = on ? shellGhost : shellSolid; body.material = on ? bodyGhost : bodySolid; tent.forEach((t) => { t.mesh.material = on ? bodyGhost : bodySolid; }); }
      if (id === 'glass') { st.glass = on; ground.visible = !on; props.visible = !on; glass.visible = on; ctx.surface = on ? 'glass' : 'ground'; }
    },
    vary() {},
    pick(hit, ray) {
      if (hit) { let o = hit.object, id = ''; while (o && !id) { id = (o.userData && o.userData.part) || ''; o = o.parent; } if (id === 'gonad') id = 'digestive-gland'; if (id && id !== '') { if (id === 'upper-tentacle' || id === 'eye') st.poke = 1.4; const c = CARDS[id]; if (c) return { title: c[0], lines: [c[1]], source: c[2] }; } }
      const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3(); if (!st.glass && ray && ray.ray.intersectPlane(pl, pt) && Math.hypot(pt.x, pt.z) < 24 && food.length < 3) { const m = new THREE.Mesh(foodGeo, foodMat); m.rotation.x = -Math.PI / 2; m.position.set(pt.x, heightAt(pt.x, pt.z) + 0.05, pt.z); const f = { x: pt.x, z: pt.z, r: 0.8, mesh: m }; m.scale.set(f.r, f.r, f.r); m.castShadow = true; m.receiveShadow = true; scene.add(m); food.push(f); return { title: 'A piece of leaf', lines: ['The snail smells food with its lower tentacles and turns toward it. Watch it feed.'], source: 'Wikipedia, Cornu aspersum' }; }
      return null;
    },
    partCard(id) { const c = CARDS[id]; return c ? { title: c[0], lines: [c[1]], source: c[2] } : null; },
    labels() {
      if (!st.xray) return [];
      const L = [], w = (o, dx = 0, dy = 0, dz = 0) => world(o).add(new THREE.Vector3(dx, dy, dz));
      L.push({ id: 'heart', text: 'Heart', at: w(insideShell.userData.heart, 0, 0.3) }, { id: 'lung', text: 'Lung', at: w(insideShell.userData.lung, 0, 0.55) }, { id: 'brain', text: 'Brain ring', at: w(ganglia, 0, 0.3) }, { id: 'radula', text: 'Radula', at: w(radulaM, 0, -0.1) });
      const dg = insideShell.children.find((c) => c.userData.part === 'digestive-gland'); if (dg) L.push({ id: 'dg', text: 'Digestive gland', at: world(insideShell.children[0]).add(new THREE.Vector3(0, 1.9, 0)) });
      return L;
    },
    dispose() { scene.remove(root); food.forEach((f) => scene.remove(f.mesh)); for (const d of disposables) d.dispose && d.dispose(); },
    stats: () => ({ time: lastTime, retreat: st.retreat, speed: st.speed, speedRel: st.speedRel, pos: { ...pos }, xray: st.xray, glass: st.glass, food: food.length, poke: st.poke, ext: tent.map((t) => t.ext), feed: st.feed, wavePhase: st.phase, trail: trail.length, shown: { epi: epi.visible, inner: inner.visible, pneu: pneu.visible, glassOn: glass.visible } }),
  };
}

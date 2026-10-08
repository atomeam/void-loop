/**
 * heart miniature — one heart, salvaged from the two built in parallel: a museum-style anatomical heart in deep red
 * lacquer (ventricles with the apex turned to the left, two atria, the aortic arch with its three branches, the
 * pulmonary trunk and arteries, the superior vena cava, coronary vessels in their grooves) on a walnut plinth with an
 * engraved brass plate, beside a small bedside monitor whose green ECG trace and bpm read-out run on the same clock as
 * the beat: the P wave as the atria squeeze, the QRS spike just before the ventricles, the T wave as they relax.
 * Period exactly 60 / bpm. The beat carries information, so it keeps going (gentler) when the visitor asked for less motion.
 * data: { bpm: number (30 to 220) }
 */
const H = 0.085; // ventricles, base to apex: a life-size heart is about 12 cm tall
const bump = (s, a, w) => (s <= a || s >= a + w ? 0 : Math.sin(Math.PI * (s - a) / w) ** 2); // smooth 0..1..0 over [a, a + w]
function beatAt(t, bpm) { // seconds into the beat, and the stretch factor: beats faster than 100 bpm squeeze the timings so they fit
  const P = 60 / Math.max(20, Math.min(240, +bpm || 60));
  return [((t % P) + P) % P, Math.min(1, P / 0.6)];
}
/** Ventricle squeeze 0..1 at time t (seconds): the main contraction ("lub") about 120 ms in, then a small second pulse ("dub"); 0 at rest. */
export function beatPhase(t, bpm) { const [s, k] = beatAt(t, bpm); return Math.max(bump(s, 0.1 * k, 0.26 * k), 0.3 * bump(s, 0.36 * k, 0.12 * k)); }
/** Atrial squeeze 0..1: the short kick that comes just before the ventricles. */
export function atriaPhase(t, bpm) { const [s, k] = beatAt(t, bpm); return bump(s, 0, 0.12 * k); }

function grainTexture(THREE) { // walnut: dark, wavy, with a few lighter streaks
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#4a2c18'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    const y0 = (i * 37.3) % 128, a = 1.5 + (i % 5), f = 0.01 + (i % 7) * 0.003;
    g.strokeStyle = i % 9 === 0 ? 'rgba(150,100,60,0.35)' : i % 2 ? 'rgba(30,16,8,0.45)' : 'rgba(110,70,40,0.25)'; g.lineWidth = 0.6 + (i % 3) * 0.7;
    g.beginPath(); for (let x = 0; x <= 512; x += 8) { const y = y0 + Math.sin(x * f + i) * a + Math.sin(x * 0.043 + i * 0.7) * 1.2; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function plateTexture(THREE, bpm) { // engraved brass label
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#e2c27a'); gr.addColorStop(0.5, '#c79e4e'); gr.addColorStop(1, '#a8823a');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = 'rgba(60,40,10,0.7)'; g.lineWidth = 4; g.strokeRect(12, 12, 488, 136);
  g.fillStyle = '#3a2808'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 76px Georgia, "Times New Roman", serif'; g.fillText(Math.round(bpm) + ' BPM', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

const clampBpm = (b) => Math.max(30, Math.min(220, Math.round(+b || 60)));
// the ECG on the beat's clock (seconds into the beat): P as the atria squeeze, QRS just before the ventricles, T as they relax
const gauss = (s, c, w) => Math.exp(-(((s - c) / w) ** 2));
export function ecgAt(s, bpm) {
  const k = Math.min(1, (60 / clampBpm(bpm)) / 0.6); // faster than 100 bpm squeezes the timings, as beatPhase does
  return 0.12 * gauss(s, 0.045 * k, 0.02 * k) - 0.15 * gauss(s, 0.088 * k, 0.006 * k) + gauss(s, 0.097 * k, 0.008 * k) - 0.25 * gauss(s, 0.108 * k, 0.007 * k) + 0.28 * gauss(s, 0.33 * k, 0.045 * k);
}

export default function build(ctx, data) {
  const { THREE, root } = ctx;
  const model = new THREE.Group(); model.position.x = -0.042; root.add(model); // the heart on its stand, left of the monitor
  const geos = [], texs = [], G = (g) => (geos.push(g), g);
  const muscle = new THREE.MeshPhysicalMaterial({ color: '#8a1220', roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.07, sheen: 0.35, sheenColor: new THREE.Color('#ff5a66'), sheenRoughness: 0.5 });
  const atrium = new THREE.MeshPhysicalMaterial({ color: '#7a101c', roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3, sheenColor: new THREE.Color('#ff5a66') });
  const artery = new THREE.MeshPhysicalMaterial({ color: '#a3141f', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const vein = new THREE.MeshPhysicalMaterial({ color: '#3b2350', roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07 }); // museum convention: deoxygenated vessels in deep plum
  const lumen = new THREE.MeshStandardMaterial({ color: '#3a060c', roughness: 0.6 });
  const walnut = new THREE.MeshPhysicalMaterial({ map: grainTexture(THREE), roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.18, flatShading: true });
  const brass = new THREE.MeshPhysicalMaterial({ color: '#d0a85a', metalness: 1, roughness: 0.26, clearcoat: 0.4 });
  const plateMat = new THREE.MeshPhysicalMaterial({ map: plateTexture(THREE, clampBpm(data.bpm)), metalness: 0.85, roughness: 0.32, clearcoat: 0.5 });
  texs.push(walnut.map, plateMat.map);
  const mats = [muscle, atrium, artery, vein, lumen, walnut, brass, plateMat];
  const shade = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // ---- the stand: an octagonal walnut plinth in two tiers, a brass post, a brass plate on the front facet
  const stand = new THREE.Group();
  const tier1 = shade(new THREE.Mesh(G(new THREE.CylinderGeometry(0.052, 0.058, 0.014, 8, 1, false, Math.PI / 8)), walnut)); tier1.position.y = 0.007;
  const tier2 = shade(new THREE.Mesh(G(new THREE.CylinderGeometry(0.04, 0.045, 0.008, 8, 1, false, Math.PI / 8)), walnut)); tier2.position.y = 0.018;
  const post = shade(new THREE.Mesh(G(new THREE.CylinderGeometry(0.0022, 0.0022, 0.05, 24)), brass)); post.position.set(0.004, 0.045, -0.012);
  const collar = shade(new THREE.Mesh(G(new THREE.CylinderGeometry(0.0055, 0.0065, 0.004, 32)), brass)); collar.position.set(0.004, 0.024, -0.012);
  const ap = 0.055 * Math.cos(Math.PI / 8), slope = Math.atan2(0.006, 0.014); // front facet: its centre and how far it leans back
  const plate = shade(new THREE.Mesh(G(new THREE.BoxGeometry(0.03, 0.0094, 0.0008)), [brass, brass, brass, brass, plateMat, brass]));
  plate.position.set(0, 0.0072, ap + 0.0005); plate.rotation.x = -slope;
  stand.add(tier1, tier2, post, collar, plate); model.add(stand);

  // ---- ventricles: a turned profile, flattened front to back, with the interventricular groove, apex curling to the left
  const heart = new THREE.Group(); heart.position.set(0, 0.116, 0); model.add(heart);
  const prof = new THREE.SplineCurve([[0, 0], [0.007, 0.002], [0.017, 0.011], [0.028, 0.026], [0.036, 0.044], [0.0395, 0.06], [0.038, 0.072], [0.031, 0.08], [0.017, 0.0845], [0, H]]
    .map(([x, y]) => new THREE.Vector2(x, y))).getPoints(72);
  const GROOVE = 0.42; // the groove's angle around the heart (0 = straight at the viewer)
  const deform = (x, y, z, out) => { // the same shaping for the mesh and for vessels laid on its surface
    const h = y / H, phi = Math.atan2(x, z), dg = Math.atan2(Math.sin(phi - GROOVE), Math.cos(phi - GROOVE));
    const k = 1 - 0.06 * Math.exp(-((dg / 0.13) ** 2)) * Math.sin(Math.PI * Math.min(1, h * 1.1)) ** 0.7;
    out.set(x * k * 1.12 + 0.013 * (1 - h) ** 2, y - H, z * k * 0.8); return out;
  };
  const vGeo = G(new THREE.LatheGeometry(prof, 128, Math.PI)), pos = vGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { deform(pos.getX(i), pos.getY(i), pos.getZ(i), v); pos.setXYZ(i, v.x, v.y, v.z); }
  vGeo.computeVertexNormals();
  const ventricles = new THREE.Group(); ventricles.rotation.z = 0.42; heart.add(ventricles); // the long axis leans, apex to the heart's left
  ventricles.add(shade(new THREE.Mesh(vGeo, muscle)));
  const radiusAt = (h) => { const y = h * H; for (let i = 1; i < prof.length; i++) if (prof[i].y >= y) { const a = prof[i - 1], b = prof[i], f = (y - a.y) / Math.max(1e-6, b.y - a.y); return a.x + (b.x - a.x) * f; } return 0; };
  const surf = (h, phi, lift = 1.004) => { const r = radiusAt(h) * lift; return deform(r * Math.sin(phi), h * H, r * Math.cos(phi), new THREE.Vector3()); };
  const tube = (pts, r, mat, parent, seg = 64) => { const m = shade(new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 16)), mat)); parent.add(m); return m; };
  // coronary vessels: thin ridges lying on the surface (they squeeze with the muscle)
  const path = (hs, phis, lift) => hs.map((h, i) => surf(h, phis[i], lift));
  tube(path([0.93, 0.8, 0.6, 0.4, 0.2, 0.06], [GROOVE + 0.06, GROOVE + 0.02, GROOVE, GROOVE - 0.02, GROOVE - 0.08, GROOVE - 0.3], 1.0), 0.0014, artery, ventricles); // anterior descending, in the groove
  tube(path([0.9, 0.75, 0.55, 0.35], [GROOVE + 0.5, GROOVE + 0.75, GROOVE + 0.95, GROOVE + 1.05], 1.01), 0.0009, artery, ventricles); // a diagonal branch
  tube(path([0.95, 0.9, 0.84, 0.8], [-0.9, -0.5, -0.1, GROOVE - 0.15], 1.01), 0.0011, vein, ventricles); // great cardiac vein along the top
  tube(path([0.97, 0.94, 0.9, 0.86], [-2.2, -1.7, -1.2, -0.75], 1.012), 0.0015, artery, ventricles); // right coronary in the right groove
  tube(path([0.86, 0.66, 0.44, 0.26], [-1.25, -1.35, -1.3, -1.1], 1.01), 0.0009, artery, ventricles); // its marginal branch

  // ---- atria: the right one on the viewer's left, the left one behind, each with its ear-shaped appendage
  const atria = new THREE.Group(); atria.position.set(0, 0.004, 0); heart.add(atria);
  const lobe = (r, x, y, z, sx, sy, sz, rz = 0) => { const m = shade(new THREE.Mesh(G(new THREE.SphereGeometry(r, 64, 48)), atrium)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.z = rz; atria.add(m); return m; };
  lobe(0.022, -0.03, -0.004, -0.002, 1, 1.05, 0.9); // right atrium
  lobe(0.02, 0.012, 0.0, -0.022, 1.25, 0.8, 0.8); // left atrium
  lobe(0.011, -0.024, 0.006, 0.018, 1.2, 0.7, 0.8, -0.5); // right auricle, folded over the aortic root
  lobe(0.009, 0.033, 0.003, 0.01, 1.3, 0.65, 0.8, 0.6); // left auricle, beside the pulmonary trunk

  // ---- great vessels: cut ends show a dark lumen, like a teaching model
  const vessels = new THREE.Group(); heart.add(vessels);
  const capEnd = (curve, r, mat) => { // a lip and a dark lumen where the vessel is cut
    const p = curve.getPointAt(1), d = curve.getTangentAt(1), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    const lip = shade(new THREE.Mesh(G(new THREE.TorusGeometry(r * 0.92, r * 0.1, 10, 40)), mat)); lip.position.copy(p); lip.quaternion.copy(q);
    const hole = new THREE.Mesh(G(new THREE.CircleGeometry(r * 0.88, 40)), lumen); hole.position.copy(p).addScaledVector(d, -r * 0.05); hole.quaternion.copy(q);
    vessels.add(lip, hole);
  };
  const vessel = (pts, r, mat, cap = true) => { const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); tube(c.getPoints(24), r, mat, vessels, 96); if (cap) capEnd(c, r, mat); return c; };
  const aorta = vessel([[-0.003, -0.004, 0.004], [-0.007, 0.022, 0.008], [-0.006, 0.044, 0.002], [0.004, 0.054, -0.01], [0.017, 0.046, -0.022], [0.022, 0.024, -0.028], [0.022, -0.006, -0.03]], 0.0105, artery);
  for (const [f, dx, r] of [[0.33, -0.009, 0.0045], [0.45, -0.001, 0.0036], [0.56, 0.007, 0.0038]]) { // brachiocephalic, left carotid, left subclavian
    const p = aorta.getPointAt(f); vessel([[p.x, p.y - 0.004, p.z], [p.x + dx * 0.4, p.y + 0.012, p.z], [p.x + dx, p.y + 0.024, p.z + 0.002]], r, artery);
  }
  vessel([[0.013, -0.008, 0.016], [0.011, 0.014, 0.022], [0.005, 0.028, 0.013], [0.0, 0.032, 0.002]], 0.0088, vein, false); // pulmonary trunk, in front of the aorta
  vessel([[0.002, 0.031, 0.004], [-0.014, 0.034, -0.006], [-0.034, 0.03, -0.01]], 0.0058, vein); // right pulmonary artery, under the arch
  vessel([[0.002, 0.031, 0.004], [0.02, 0.036, -0.004], [0.038, 0.032, -0.008]], 0.0058, vein); // left pulmonary artery
  vessel([[-0.032, 0.008, -0.004], [-0.031, 0.03, -0.004], [-0.029, 0.052, -0.006]], 0.0074, vein); // superior vena cava



  // ---- the bedside monitor (from the first heart): a white case, a dark screen tilted back, a green ECG sweep and the rate
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#e9ebee', roughness: 0.5, clearcoat: 0.2 });
  const bezel = new THREE.MeshPhysicalMaterial({ color: '#15171a', roughness: 0.3, clearcoat: 0.8 });
  const sc = document.createElement('canvas'); sc.width = 320; sc.height = 200; const g = sc.getContext('2d');
  const screenTex = new THREE.CanvasTexture(sc); screenTex.colorSpace = THREE.SRGBColorSpace; texs.push(screenTex);
  const glow = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  mats.push(plastic, bezel, glow);
  const mon = new THREE.Group();
  const box = shade(new THREE.Mesh(G(new THREE.BoxGeometry(0.07, 0.05, 0.03)), plastic)); box.position.y = 0.025;
  const scr = new THREE.Mesh(G(new THREE.BoxGeometry(0.06, 0.038, 0.002)), bezel); scr.position.set(0, 0.027, 0.0151);
  const screen = new THREE.Mesh(G(new THREE.PlaneGeometry(0.056, 0.035)), glow); screen.position.set(0, 0.027, 0.0163);
  const knobG = G(new THREE.CylinderGeometry(0.003, 0.003, 0.003, 20).rotateX(Math.PI / 2));
  for (const x of [0.026, 0.018]) { const k = new THREE.Mesh(knobG, bezel); k.position.set(x, 0.004, 0.0155); mon.add(k); }
  mon.add(box, scr, screen); mon.scale.setScalar(1.35); mon.position.set(0.075, 0, 0.012); mon.rotation.y = -0.38; root.add(mon);

  ctx.frame(root, { view: [0.22, 0.3, 1], pad: 0.84, light: [0.55, 1.15, 0.85], minZoom: 0.5, maxZoom: 2 });

  let bpm = clampBpm(data.bpm), lastV = -1, lastA = -1, phase = 0, acc = 0, head = 0, beatT = 0;
  const trace = new Float32Array(160);
  function drawScreen() {
    g.fillStyle = '#04110a'; g.fillRect(0, 0, 320, 200);
    g.strokeStyle = 'rgba(40,120,70,0.25)'; g.lineWidth = 1;
    for (let x = 0; x < 320; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 200); g.stroke(); }
    for (let y = 0; y < 200; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(320, y); g.stroke(); }
    g.strokeStyle = '#3dff8a'; g.lineWidth = 3; g.shadowColor = '#3dff8a'; g.shadowBlur = 6; g.beginPath();
    for (let i = 0; i < trace.length; i++) { const val = trace[(head + i) % trace.length], x = i * 2, y = 130 - val * 80; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#3dff8a'; g.font = '700 46px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'right'; g.fillText(String(bpm), 308, 48);
    g.font = '600 18px Arial, sans-serif'; g.fillText('BPM', 308, 70); g.textAlign = 'left'; g.fillText('♥ HR', 10, 26);
    screenTex.needsUpdate = true;
  }
  { const P = 60 / bpm; for (let i = 0; i < trace.length; i++) trace[i] = ecgAt(((i / trace.length) * 2.2 % 1) * P, bpm); } // a settled trace from the start
  drawScreen();

  const amp = () => (ctx.still ? 0.35 : 1); // the beat carries the rate, so it stays when motion is reduced, only gentler
  function pose(t) {
    const vq = beatPhase(t, bpm) * amp(), aq = atriaPhase(t, bpm) * amp();
    if (Math.abs(vq - lastV) < 1e-4 && Math.abs(aq - lastA) < 1e-4) return false;
    lastV = vq; lastA = aq;
    ventricles.scale.set(1 - 0.07 * vq, 1 - 0.035 * vq, 1 - 0.07 * vq); // squeezes toward the base, so the apex lifts
    atria.scale.setScalar(1 - 0.09 * aq + 0.03 * vq); // atria empty first, then refill while the ventricles contract
    vessels.scale.setScalar(1 + 0.012 * vq); // the arteries swell a little as the blood is pushed out
    return true;
  }
  return {
    update(d) {
      const next = clampBpm(d && d.bpm);
      if (next !== bpm) { bpm = next; plateMat.map.dispose(); plateMat.map = plateTexture(THREE, bpm); texs.push(plateMat.map); plateMat.needsUpdate = true; drawScreen(); }
    },
    state: () => ({ bpm, phase, squeeze: lastV, atria: lastA }), // for tests
    tick(dt) {
      beatT += dt; const P = 60 / bpm; phase = (beatT % P) / P;
      // the monitor sweeps on the same clock: one beat spans 70 samples, so the screen shows a little over two beats
      acc += dt; const sample = P / 70;
      while (acc >= sample) { acc -= sample; trace[head] = ecgAt(((beatT - acc) % P + P) % P, bpm) + (Math.random() - 0.5) * 0.02; head = (head + 1) % trace.length; }
      drawScreen(); pose(beatT);
      return 'view'; // the floor shadow barely changes with the beat, so it is not recomputed each frame
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}

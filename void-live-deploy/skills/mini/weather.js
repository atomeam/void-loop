/**
 * weather miniature — a little diorama on a turned walnut plinth: a cottage, trees and a lawn under the sky the forecast
 * reports. Sun or moon by local day/night, clouds, rain or snow actually falling, fog, lightning in a storm, the wind
 * leaning the rain and swaying the trees, and a glass thermometer whose red column stands at the real temperature.
 * data: { code: WMO weather code, temp: °C, unit: 'C' | 'F', isDay: bool, wind: km/h }
 */
import { MODELS } from './tabletop.js';
import { makeCloud, cloudGeometry, makePrecip, makeGlow } from '../sky3d.js';

const kindOf = (c) => (c >= 95 ? 'storm' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain'
  : c === 45 || c === 48 ? 'fog' : c === 3 ? 'overcast' : c === 2 ? 'partly' : 'clear');
export default async function build(ctx, data) {
  const { THREE, root, scene, keyLight, sky, phone } = ctx;
  const own = { g: [], m: [], t: [] };
  const G = (g) => (own.g.push(g), g), M = (m) => (own.m.push(m), m);
  const R = 0.11; // the plinth is 22 cm across
  // ---- plinth and ground
  const [wood, woodN] = await Promise.all([ctx.loadTexture(MODELS + 'wood-v1/table-color.webp', { srgb: true, repeat: [1, 1] }), ctx.loadTexture(MODELS + 'wood-v1/table-normal.webp', { repeat: [1, 1] })]);
  own.t.push(wood, woodN);
  const plinthMat = M(new THREE.MeshPhysicalMaterial({ map: wood, normalMap: woodN, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.25, color: '#b48a6a' }));
  const prof = [[0, 0], [R * 1.02, 0], [R * 1.06, 0.004], [R * 1.06, 0.014], [R * 1.02, 0.018], [R, 0.022], [0, 0.022]];
  const plinth = new THREE.Mesh(G(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96)), plinthMat); plinth.castShadow = plinth.receiveShadow = true;
  // a gently rolling lawn (or snowfield), displaced from a disc
  const lawnG = G(new THREE.CircleGeometry(R * 0.985, 96, 0, Math.PI * 2).rotateX(-Math.PI / 2));
  { const p = lawnG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) / R; p.setY(i, (1 - r * r) * 0.012 + Math.sin(x * 60) * Math.cos(z * 50) * 0.0015 * (1 - r)); } lawnG.computeVertexNormals(); }
  { const p = lawnG.attributes.position, col = new Float32Array(p.count * 3); // mottled grass, a little darker at the rim
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), n = 0.85 + 0.15 * Math.sin(x * 140 + Math.cos(z * 90) * 2) * Math.cos(z * 120), r = Math.hypot(x, z) / R; const v = n * (1 - r * 0.25); col.set([v, v, v], i * 3); }
    lawnG.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const lawnMat = M(new THREE.MeshStandardMaterial({ color: '#5f8f3e', roughness: 0.95, vertexColors: true }));
  const lawn = new THREE.Mesh(lawnG, lawnMat); lawn.position.y = 0.022; lawn.receiveShadow = true;
  root.add(plinth, lawn);
  // ---- cottage: walls, pitched roof, chimney, door, windows that glow at night
  const house = new THREE.Group(); house.position.set(-0.02, 0.03, -0.015); house.rotation.y = 0.5;
  const wallMat = M(new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.85 }));
  const roofMat = M(new THREE.MeshStandardMaterial({ color: '#7a3b2e', roughness: 0.7 }));
  const winMat = M(new THREE.MeshStandardMaterial({ color: '#2b3440', roughness: 0.2, metalness: 0.2, emissive: '#ffb347', emissiveIntensity: 0 }));
  const walls = new THREE.Mesh(G(new THREE.BoxGeometry(0.05, 0.034, 0.038)), wallMat); walls.position.y = 0.017;
  const roofShape = new THREE.Shape(); roofShape.moveTo(-0.031, 0); roofShape.lineTo(0.031, 0); roofShape.lineTo(0, 0.024); roofShape.closePath();
  const roof = new THREE.Mesh(G(new THREE.ExtrudeGeometry(roofShape, { depth: 0.046, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2 })), roofMat); roof.position.set(0, 0.034, -0.023);
  const chimney = new THREE.Mesh(G(new THREE.BoxGeometry(0.008, 0.02, 0.008)), roofMat); chimney.position.set(0.014, 0.05, -0.006);
  const door = new THREE.Mesh(G(new THREE.BoxGeometry(0.01, 0.018, 0.002)), M(new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.6 }))); door.position.set(0, 0.009, 0.0195);
  const winG = G(new THREE.BoxGeometry(0.009, 0.009, 0.002));
  for (const [x, z, ry] of [[-0.015, 0.0195, 0], [0.015, 0.0195, 0], [0.0255, 0, Math.PI / 2], [-0.0255, 0, Math.PI / 2]]) { const w = new THREE.Mesh(winG, winMat); w.position.set(x, 0.02, z); w.rotation.y = ry; house.add(w); }
  house.add(walls, roof, chimney, door); root.add(house);
  // ---- trees: rounded crowns on trunks, and a pine
  const trunkMat = M(new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 0.9 }));
  const leafMat = M(new THREE.MeshStandardMaterial({ color: '#3f7a35', roughness: 0.8, flatShading: true }));
  const trees = [];
  const crownG = G(new THREE.IcosahedronGeometry(0.016, 1)), trunkG = G(new THREE.CylinderGeometry(0.002, 0.003, 0.024, 8)), pineG = G(new THREE.ConeGeometry(0.014, 0.05, 10));
  for (const [x, z, s, pine] of [[0.05, 0.03, 1, false], [0.06, -0.035, 0.8, true], [-0.065, 0.035, 0.9, true], [0.025, -0.06, 0.75, false]]) {
    const t = new THREE.Group(); t.position.set(x, 0.026, z); t.scale.setScalar(s);
    const trunk = new THREE.Mesh(trunkG, trunkMat); trunk.position.y = 0.012; t.add(trunk);
    const crown = new THREE.Mesh(pine ? pineG : crownG, leafMat); crown.position.y = pine ? 0.04 : 0.032; if (!pine) crown.scale.set(1, 1.15, 1); t.add(crown);
    t.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); root.add(t); trees.push(t);
  }
  // ---- thermometer: a glass tube on a little brass-capped board, red column to scale (-20 °C .. 40 °C)
  const thermo = new THREE.Group(); thermo.position.set(0.075, 0.03, 0.045); thermo.rotation.y = -0.5;
  const board = new THREE.Mesh(G(new THREE.BoxGeometry(0.016, 0.07, 0.004)), plinthMat); board.position.y = 0.035; board.castShadow = true;
  const tubeG = G(new THREE.CylinderGeometry(0.0022, 0.0022, 0.056, 16)), tube = new THREE.Mesh(tubeG, M(new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, roughness: 0.05, clearcoat: 1 })));
  tube.position.set(0, 0.038, 0.003);
  const bulb = new THREE.Mesh(G(new THREE.SphereGeometry(0.0038, 16, 12)), M(new THREE.MeshStandardMaterial({ color: '#c81d1d', roughness: 0.3, emissive: '#400000' }))); bulb.position.set(0, 0.008, 0.003);
  const col = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 10).translate(0, 0.5, 0)), bulb.material); col.position.set(0, 0.01, 0.003);
  const tick = G(new THREE.BoxGeometry(0.004, 0.0004, 0.0006)), tickMat = M(new THREE.MeshBasicMaterial({ color: '#2a2018' }));
  for (let i = 0; i <= 6; i++) { const k = new THREE.Mesh(tick, tickMat); k.position.set(-0.0045, 0.012 + i * 0.008, 0.0022); thermo.add(k); }
  const label = document.createElement('canvas'); label.width = 256; label.height = 128; const lt = new THREE.CanvasTexture(label); lt.colorSpace = THREE.SRGBColorSpace; own.t.push(lt);
  const tag = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false }))); tag.scale.set(0.05, 0.025, 1); tag.position.set(0, 0.085, 0.004);
  thermo.add(board, tube, bulb, col, tag); root.add(thermo);
  // ---- sky things
  const sunMat = M(new THREE.MeshBasicMaterial({ color: '#ffd77a' })), moonMat = M(new THREE.MeshStandardMaterial({ color: '#dfe3ea', emissive: '#9aa4b8', emissiveIntensity: 0.6, roughness: 1 }));
  const orb = new THREE.Mesh(G(new THREE.SphereGeometry(0.014, 32, 16)), sunMat); orb.position.set(-0.075, 0.125, -0.07); orb.userData.noContactShadow = true;
  const glow = makeGlow(THREE); own.t.push(glow.material.map); M(glow.material); glow.scale.setScalar(0.09); orb.add(glow);
  root.add(orb);
  const cloudMat = M(new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 1 }));
  const puffG = G(cloudGeometry(THREE));
  const clouds = [];
  // seeded cumulus from skills/sky3d.js (the same clouds the stage summons), each one its own shape, flat underneath
  const addCloud = (x, y, z, s, seed) => { const c = makeCloud(THREE, { seed, size: 0.06 * s, mat: cloudMat, geo: puffG }); c.position.set(x, y, z); c.userData.x0 = x; root.add(c); clouds.push(c); return c; };
  addCloud(0.02, 0.15, -0.02, 1.2, 11); addCloud(-0.05, 0.135, 0.03, 0.9, 23); addCloud(0.065, 0.14, 0.02, 0.85, 37);
  // ---- precipitation: instanced streaks or flakes, recycled from cloud height to the ground (skills/sky3d.js)
  const precip = makePrecip(THREE, { n: phone ? 220 : 420, box: { w: R * 1.9, d: R * 1.9, round: true, top: 0.14, bottom: 0.03 }, speed: 0.32 });
  const drops = precip.drops, flakes = precip.flakes;
  root.add(drops, flakes);
  const fogC = document.createElement('canvas'); fogC.width = fogC.height = 128; { const g = fogC.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(225,230,236,0.8)'); gr.addColorStop(1, 'rgba(225,230,236,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const fogT = new THREE.CanvasTexture(fogC); own.t.push(fogT);
  const fogs = [];
  for (let i = 0; i < 7; i++) { const f = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: fogT, transparent: true, depthWrite: false, opacity: 0.55 }))); f.scale.set(0.16, 0.06, 1); f.position.set((Math.random() - 0.5) * 0.15, 0.04 + Math.random() * 0.03, (Math.random() - 0.5) * 0.15); f.userData.noContactShadow = true; root.add(f); fogs.push(f); }
  const flash = new THREE.PointLight('#cfd8ff', 0, 1, 2); flash.position.set(0, 0.2, 0.05); root.add(flash);
  // ---- apply the forecast
  let st = {}, kind = 'clear', boltT = 0;
  function apply(d) {
    st = { code: +d.code || 0, temp: d.temp == null ? 15 : +d.temp, unit: d.unit === 'F' ? 'F' : 'C', isDay: d.isDay !== false, wind: +d.wind || 0 };
    kind = kindOf(st.code);
    const day = st.isDay, wet = kind === 'rain' || kind === 'storm', grey = wet || kind === 'overcast' || kind === 'fog' || kind === 'snow';
    orb.material = day ? sunMat : moonMat; orb.visible = kind === 'clear' || kind === 'partly'; glow.visible = day && orb.visible;
    clouds.forEach((c, i) => { c.visible = kind !== 'clear' && !(kind === 'partly' && i === 2); });
    cloudMat.color.set(kind === 'storm' ? '#6d737c' : wet ? '#9aa1aa' : kind === 'snow' ? '#e6e9ee' : '#f4f6f8');
    lawnMat.color.set(kind === 'snow' ? '#f3f5f8' : st.temp < 2 ? '#7d8f72' : '#5f8f3e');
    leafMat.color.set(kind === 'snow' ? '#5d7f62' : '#3f7a35');
    precip.set(wet ? 'rain' : kind === 'snow' ? 'snow' : null);
    for (const f of fogs) f.visible = kind === 'fog';
    winMat.emissiveIntensity = day ? (grey ? 0.3 : 0) : 2.2;
    keyLight.color.set(day ? (grey ? '#e6ecf2' : '#fff1d8') : '#9fb2d8');
    keyLight.intensity = day ? (grey ? 1.1 : 2.6) : 0.35;
    sky.color.set(day ? (grey ? '#c9d1db' : '#cfe3ff') : '#3a4a70'); sky.intensity = day ? 0.6 : 0.25;
    scene.environmentIntensity = day ? (grey ? 0.55 : 0.85) : 0.18;
    ctx.handle.exposure = day ? 1 : 0.85;
    // thermometer: the column to scale, and the reading on its tag
    const c = Math.max(-20, Math.min(40, st.temp)); col.scale.y = Math.max(0.002, 0.008 * ((c + 20) / 10));
    const g = label.getContext('2d'); g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(250,245,235,0.92)'; g.beginPath(); g.roundRect(28, 22, 200, 84, 18); g.fill();
    g.fillStyle = '#2a1e16'; g.font = '600 58px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(Math.round(st.unit === 'F' ? st.temp * 9 / 5 + 32 : st.temp) + '°' + st.unit, 128, 66); lt.needsUpdate = true;
    ctx.requestRender();
  }
  apply(data);
  ctx.frame(root, { view: [0.15, 0.42, 1], pad: 0.6, light: [0.6, 1.4, 0.5], minZoom: 0.5, maxZoom: 1.8 });
  return {
    update: apply,
    state: () => ({ kind, sun: orb.visible && orb.material === sunMat, moon: orb.visible && orb.material === moonMat, rain: drops.visible, snow: flakes.visible, fog: fogs[0].visible, clouds: clouds.filter((c) => c.visible).length, column: col.scale.y, windows: winMat.emissiveIntensity }), // for tests
    tick(dt, t) {
      const lean = Math.min(0.5, st.wind / 60);
      if (ctx.still && kind !== 'rain' && kind !== 'snow' && kind !== 'storm') return false; // weather that is happening keeps happening
      for (const c of clouds) c.position.x = c.userData.x0 + Math.sin(t * 0.15 + c.userData.x0 * 40) * 0.01 * (1 + lean);
      for (const tr of trees) tr.rotation.z = Math.sin(t * 1.6 + tr.position.x * 30) * 0.03 * (0.4 + lean * 2);
      if (precip.on) precip.step(dt, t, lean);
      if (kind === 'storm') { boltT -= dt; if (boltT < -3 - Math.random() * 4) boltT = 0.18; flash.intensity = boltT > 0 ? 6 * (boltT / 0.18) : 0; }
      for (const f of fogs) if (f.visible) f.position.x += Math.sin(t * 0.3 + f.position.z * 20) * 0.00008;
      return 'view';
    },
    dispose() { for (const g of own.g) g.dispose(); for (const m of own.m) m.dispose(); for (const t of own.t) t.dispose(); precip.dispose(); },
  };
}

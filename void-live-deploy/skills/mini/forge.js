/**
 * forge miniature — frontier #14: the thing you asked Void to make, standing on a small turntable in the void. The mesh is
 * the exact one the STL prints (skills/forge-rules.js build(key)), shown at real scale (millimetres), in a matte
 * print-like material with the turntable turning it slowly; drag the space around it to look closer. Under reduced
 * motion it stays still. data: { key, angle? (degrees, the card's turntable angle when still) }
 */
import { build } from '../forge-rules.js';

const MM = 0.001;
export default async function build3d(ctx, data) {
  const { THREE, root } = ctx;
  const geos = [], mats = [];
  const plastic = new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.55, metalness: 0.02 }); mats.push(plastic);
  const plate = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8, metalness: 0.3 }); mats.push(plate);
  const spin = new THREE.Group(); root.add(spin);
  let mesh = null, builtKey = '', size = [0, 0, 0];
  function make(key) {
    if (mesh) { spin.remove(mesh); mesh.geometry.dispose(); }
    const m = build(key), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3)); g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    g.scale(MM, MM, MM);
    mesh = new THREE.Mesh(g, plastic); spin.add(mesh); builtKey = key; size = m.size;
  }
  make(ctx.handle.data.key);
  const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.006, 64), plate); geos.push(turntable.geometry);
  turntable.position.y = -0.003; root.add(turntable);
  ctx.frame(root, { view: [0.6, 0.45, 1], pad: 0.9, minZoom: 0.4, maxZoom: 4 });
  const t0 = performance.now();
  let lastKey = '';
  return {
    update() { if (ctx.handle.data.key !== builtKey) make(ctx.handle.data.key); ctx.requestRender(); },
    // the turntable turns from the clock (never accumulated); still under reduced motion
    tick(_dt, seconds) {
      const d = ctx.handle.data, still = ctx.still, k = d.key + ':' + (still ? d.angle || 0 : 'spin');
      if (still && k === lastKey) return false;
      lastKey = k;
      spin.rotation.y = still ? (d.angle || 0) * Math.PI / 180 : (Number.isFinite(seconds) ? seconds : (performance.now() - t0) / 1000) * 0.5;
      return 'view';
    },
    state() { return { key: builtKey, triangles: mesh ? mesh.geometry.index.count / 3 : 0, size, spinning: !ctx.still }; },
    dispose() { if (mesh) mesh.geometry.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}

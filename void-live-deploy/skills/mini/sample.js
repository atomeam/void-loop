/**
 * The template miniature (docs/miniatures.md): a lacquered wooden spinning top that idles with a slow spin and a wobble.
 * data: { color?: '#rrggbb', spin?: number (turns per second) }. Copy this file to skills/mini/<card kind>.js to start one.
 */
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  // a turned profile: tip, belly, shoulder, stem (x = radius, y = height, in metres: a 5 cm top)
  const prof = [[0, 0], [0.004, 0.002], [0.012, 0.008], [0.022, 0.016], [0.026, 0.021], [0.025, 0.025], [0.018, 0.028], [0.006, 0.030], [0.004, 0.034], [0.0042, 0.046], [0.0035, 0.049], [0, 0.0495]];
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96);
  const mat = new THREE.MeshPhysicalMaterial({ color: data.color || '#a0522d', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 0.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.0012, 16, 96).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d9b45a', metalness: 1, roughness: 0.25 }));
  ring.position.y = 0.022;
  const top = new THREE.Group(); const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.receiveShadow = true; ring.castShadow = true;
  top.add(body, ring); root.add(top);
  ctx.frame(root, { view: [0.2, 0.55, 1], pad: 1.25 });
  let spin = data.spin ?? 0.6;
  return {
    update(d) { if (d.color) mat.color.set(d.color); if (d.spin !== undefined) spin = d.spin; },
    tick(dt, t) { // decorative idle motion stays off when the visitor asked for less motion
      if (still) return false;
      top.rotation.y += dt * spin * Math.PI * 2; top.rotation.z = Math.sin(t * 1.3) * 0.06; top.rotation.x = Math.cos(t * 1.1) * 0.04;
      return true;
    },
    dispose() { geo.dispose(); mat.dispose(); ring.geometry.dispose(); ring.material.dispose(); },
  };
}

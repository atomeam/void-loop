/**
 * pot miniature: the recipe card's 3D figure (owner, 2026-10-25: "should be a card for all too and 3d figure if possible"). A steel cooking pot
 * on a wooden cutting board, its lid lifted a little, with the recipe card leaning against it: the dish's name and how many ingredients it takes.
 * A new dish lifts the lid and drops it back (a puff of steam rises while it is up); with reduced motion the new card is simply there.
 * data: { dish: text, n?: ingredients }. state(): { dish, n, lifting }.
 */
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [], keep = (x) => { made.push(x); return x; };
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.22, side: THREE.DoubleSide }));
  const blackM = keep(new THREE.MeshStandardMaterial({ color: '#222226', roughness: 0.6 }));
  const wood = keep(new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.75 }));
  const soup = keep(new THREE.MeshStandardMaterial({ color: '#c8642a', roughness: 0.4 }));
  // the pot: a lathe wall with a rolled rim; 16 cm across
  const PR = 0.08, PH = 0.09;
  const wall = keep(new THREE.LatheGeometry([[0, 0], [PR - 0.006, 0], [PR, 0.006], [PR, PH], [PR + 0.003, PH + 0.002], [PR - 0.002, PH + 0.003]].map(([x, y]) => new THREE.Vector2(x, y)), 72));
  const pot = new THREE.Mesh(wall, steel); pot.castShadow = true; pot.receiveShadow = true;
  const top = new THREE.Mesh(keep(new THREE.CircleGeometry(PR - 0.002, 64).rotateX(-Math.PI / 2)), soup); top.position.y = PH * 0.78;
  const handleGeo = keep(new THREE.TorusGeometry(0.014, 0.004, 12, 32, Math.PI));
  const h1 = new THREE.Mesh(handleGeo, blackM), h2 = new THREE.Mesh(handleGeo, blackM); h1.rotation.set(0, 0, -Math.PI / 2); h1.position.set(PR + 0.002, PH * 0.75, 0); h2.rotation.set(0, Math.PI, -Math.PI / 2); h2.position.set(-PR - 0.002, PH * 0.75, 0);
  const lidGeo = keep(new THREE.SphereGeometry(PR + 0.004, 64, 16, 0, Math.PI * 2, 0, 0.42)), knobGeo = keep(new THREE.SphereGeometry(0.009, 24, 12));
  const lid = new THREE.Group(), lidShell = new THREE.Mesh(lidGeo, steel), knob = new THREE.Mesh(knobGeo, blackM); lidShell.position.y = -(PR + 0.004) * Math.cos(0.42); knob.position.y = (PR + 0.004) * (1 - Math.cos(0.42)) + 0.004; lidShell.castShadow = true; lid.add(lidShell, knob);
  const LID_Y = PH + 0.003; lid.position.y = LID_Y;
  const potG = new THREE.Group(); potG.add(pot, top, h1, h2, lid); potG.position.set(0.03, 0.012, 0);
  const board = new THREE.Mesh(keep(new THREE.BoxGeometry(0.34, 0.012, 0.22)), wood); board.position.y = 0.006; board.receiveShadow = true; board.castShadow = true;
  // the recipe card, leaning on the pot
  const cardGeo = keep(new THREE.BoxGeometry(0.1, 0.07, 0.002)), cardMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.9 })), paperM = keep(new THREE.MeshStandardMaterial({ color: '#f6f0e1', roughness: 0.9 }));
  const card = new THREE.Mesh(cardGeo, [paperM, paperM, paperM, paperM, cardMat, paperM]); card.position.set(-0.1, 0.045, 0.06); card.rotation.set(-0.3, 0.35, 0); card.castShadow = true;
  // steam: a few soft white puffs over the pot while the lid is up
  const puffGeo = keep(new THREE.SphereGeometry(0.012, 16, 10)), puffMat = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0, roughness: 1, depthWrite: false }));
  const puffs = [0, 1, 2].map((i) => { const p = new THREE.Mesh(puffGeo, puffMat); p.position.set(0.03 + (i - 1) * 0.025, PH + 0.03, (i - 1) * 0.01); return p; });
  root.add(board, potG, card, ...puffs);
  let dish = '', n = 0, lift = 0, tex = null;
  const paint = (d) => {
    dish = String(d.dish || ''); n = Math.max(0, Math.floor(Number(d.n) || 0));
    const c = document.createElement('canvas'); c.width = 512; c.height = 358; const g = c.getContext('2d');
    g.fillStyle = '#f6f0e1'; g.fillRect(0, 0, 512, 358); g.strokeStyle = '#c94a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(30, 100); g.lineTo(482, 100); g.stroke();
    g.strokeStyle = 'rgba(70,110,170,.35)'; g.lineWidth = 3; for (let y = 160; y < 340; y += 44) { g.beginPath(); g.moveTo(30, y); g.lineTo(482, y); g.stroke(); }
    g.fillStyle = '#2b2620'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; let size = 58; const t = dish.slice(0, 40); g.font = '700 ' + size + 'px Georgia, serif';
    while (size > 24 && g.measureText(t).width > 452) { size -= 3; g.font = '700 ' + size + 'px Georgia, serif'; } g.fillText(t, 30, 82);
    g.font = 'italic 36px Georgia, serif'; g.fillStyle = '#55493b'; if (n) g.fillText(n + ' ingredient' + (n === 1 ? '' : 's'), 34, 150);
    if (tex) tex.dispose(); tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; cardMat.map = tex; cardMat.needsUpdate = true;
  };
  paint(data);
  ctx.frame(root, { view: [0.1, 0.7, 1], pad: 1.1 });
  const pose = () => { const up = Math.sin(Math.min(1, lift) * Math.PI); lid.position.y = LID_Y + up * 0.03; lid.rotation.z = up * 0.25; puffMat.opacity = up * 0.55; puffs.forEach((p, i) => { p.position.y = PH + 0.03 + up * (0.02 + i * 0.012); p.scale.setScalar(0.6 + up * (0.6 + i * 0.2)); }); };
  return {
    update(d) { const changed = String(d.dish || '') !== dish; paint(d); if (changed && !still) lift = 0.0001; ctx.requestRender(); },
    tick(dt) { if (!lift) return false; lift = lift + dt / 1.4; if (lift >= 1) lift = 0; pose(); return true; },
    state() { return { dish, n, lifting: lift > 0 }; },
    dispose() { for (const x of made) x.dispose(); if (tex) tex.dispose(); },
  };
}

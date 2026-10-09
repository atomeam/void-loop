/**
 * The counter card's miniature (docs/miniatures.md): a chrome hand tally counter, about 5 cm across, with four number
 * strips behind a window, a plunger on top and a finger ring below. The wheels roll to the card's value, and pressing
 * the plunger counts one up, like the real thing.
 * data: { value: number, onPress?: () => void (called when the plunger is tapped) }
 */
export function wheelDigits(value, n = 4) {
  const v = Math.abs(Math.trunc(+value || 0)) % Math.pow(10, n);
  return String(v).padStart(n, '0').split('').map(Number);
}

const R = 0.024; // body radius, metres

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => { made.push(x); return x; };

  const chrome = keep(new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 1, roughness: 0.16 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: '#17181b', metalness: 0.2, roughness: 0.6 }));

  // the body: a rounded drum facing the viewer
  const prof = [[0, -0.009], [R - 0.003, -0.009], [R - 0.0005, -0.0075], [R, -0.005], [R, 0.005], [R - 0.0005, 0.0075], [R - 0.003, 0.009], [0, 0.009]];
  const body = new THREE.Mesh(keep(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96)), chrome);
  body.rotation.x = Math.PI / 2; body.castShadow = true; body.receiveShadow = true;

  // the window: a dark bezel with four number strips that scroll up as the count goes up (one digit shows in each)
  const win = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.037, 0.0145)), dark); win.position.set(0, 0.002, 0.00915);
  const strip = document.createElement('canvas'); strip.width = 128; strip.height = 1280;
  { const g = strip.getContext('2d'); g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, 128, 1280);
    g.fillStyle = '#141414'; g.font = '700 100px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) g.fillText(String(d), 64, d * 128 + 68);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let d = 0; d <= 10; d++) g.fillRect(0, d * 128 - 2, 128, 4); }
  const digitGeo = keep(new THREE.PlaneGeometry(0.0072, 0.0118));
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const t = keep(new THREE.CanvasTexture(strip)); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 0.1); t.anisotropy = 4;
    const mesh = new THREE.Mesh(digitGeo, keep(new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 })));
    mesh.position.set(-0.01335 + i * 0.0089, 0.002, 0.0093);
    wheels.push({ mesh, tex: t, at: 0, to: 0 });
  }
  const glass = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.037, 0.0145)), keep(new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false })));
  glass.position.set(0, 0.002, 0.0096);

  // the plunger on top and the finger ring below
  const stem = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0022, 0.0022, 0.008, 24)), chrome); stem.position.y = R + 0.003;
  const button = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 40)), chrome); button.position.y = R + 0.0085;
  const press = new THREE.Group(); press.add(stem, button);
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.011, 0.0022, 20, 64)), chrome); ring.position.y = -R - 0.009;
  for (const m of [stem, button, ring]) { m.castShadow = true; m.receiveShadow = true; }

  const all = new THREE.Group(); all.add(body, win, glass, press, ring, ...wheels.map((w) => w.mesh));
  all.position.y = R + 0.02; root.add(all);
  ctx.frame(root, { view: [0.12, 0.08, 1], pad: 1.05 });

  // digit d shows when the strip's offset is (9 - d) / 10; counting up scrolls the strip down by a tenth per digit
  const offsetOf = (d) => (9 - d) / 10;
  let value = +data.value || 0, pressT = 0;
  const set = (v, instant) => {
    value = +v || 0;
    wheelDigits(value).forEach((d, i) => {
      const w = wheels[i]; let to = offsetOf(d);
      while (to > w.at + 1e-9) to -= 1; // the strips only roll one way, like the real mechanism (the texture repeats)
      w.to = to; if (instant || still) { w.at = to; w.tex.offset.y = to; }
    });
  };
  set(value, true);

  ctx.onTap((hits) => {
    if (!hits.some((h) => h.object === button || h.object === stem)) return;
    pressT = 1; ctx.requestRender();
    const fn = ctx.handle && ctx.handle.data && ctx.handle.data.onPress;
    if (typeof fn === 'function') fn();
  });

  return {
    get digits() { return wheelDigits(value); },
    update(d) { if (d.value !== undefined && +d.value !== value) { set(d.value, false); ctx.requestRender(); } },
    tick(dt) {
      let changed = false;
      for (const w of wheels) {
        if (Math.abs(w.to - w.at) > 1e-4) { w.at += Math.max(w.to - w.at, -dt * 1.6); w.tex.offset.y = w.at; changed = true; }
      }
      if (pressT > 0) { pressT = Math.max(0, pressT - dt * 6); press.position.y = -0.003 * Math.sin(pressT * Math.PI); changed = true; }
      return changed;
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}

/**
 * The list card's miniature (docs/miniatures.md): a hardboard clipboard with a chrome clip, lined paper showing the
 * list's title and items, and a yellow pencil. When an item is ticked, the pencil goes to its line and draws the tick,
 * then the line is crossed out.
 * data: { title?: string, items: [{ text, done }] }
 */
const PW = 0.082, PH = 0.11; // paper size, metres
const CW = 512, CH = 688, ROW0 = 176, ROWH = 72, ROWS = 7;

export function rowsOf(items) { return (Array.isArray(items) ? items : []).slice(0, ROWS).map((i) => ({ text: String(i && i.text || ''), done: !!(i && i.done) })); }
// the item that was just ticked: the first one done now that was not done before (same position)
export function newlyDone(before, after) {
  for (let i = 0; i < after.length; i++) if (after[i].done && before[i] && !before[i].done && before[i].text === after[i].text) return i;
  return -1;
}

function drawPaper(c, title, rows, ink) {
  const g = c.getContext('2d');
  g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, CW, CH);
  g.strokeStyle = 'rgba(70,120,200,0.28)'; g.lineWidth = 2;
  for (let y = ROW0 + ROWH - 12; y < CH - 20; y += ROWH) { g.beginPath(); g.moveTo(24, y); g.lineTo(CW - 24, y); g.stroke(); }
  g.strokeStyle = 'rgba(210,70,70,0.4)'; g.beginPath(); g.moveTo(84, 120); g.lineTo(84, CH - 10); g.stroke();
  g.fillStyle = '#1d1d1f'; g.font = '600 54px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'; g.textBaseline = 'middle';
  g.fillText(String(title || 'List').slice(0, 16), 36, 104);
  rows.forEach((r, i) => {
    const y = ROW0 + i * ROWH + 14;
    g.strokeStyle = '#2b2b2e'; g.lineWidth = 3; g.strokeRect(36, y - 18, 36, 36);
    g.fillStyle = r.done ? '#7a7a80' : '#1d1d1f'; g.font = '46px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';
    const text = r.text.length > 15 ? r.text.slice(0, 14) + '…' : r.text;
    g.fillText(text, 100, y);
    const t = ink && ink.i === i ? ink.t : (r.done ? 1 : 0);
    if (t > 0) { // the tick: down stroke then up stroke, drawn as far as t
      g.strokeStyle = '#1f3f8f'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
      const a = [44, y - 2], b = [54, y + 10], d = [76, y - 22], k = Math.min(1, t / 0.35);
      g.moveTo(a[0], a[1]); g.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k);
      if (t > 0.35) { const k2 = Math.min(1, (t - 0.35) / 0.4); g.lineTo(b[0] + (d[0] - b[0]) * k2, b[1] + (d[1] - b[1]) * k2); }
      g.stroke();
      if (t > 0.75) { const w = g.measureText(text).width * Math.min(1, (t - 0.75) / 0.25); g.strokeStyle = 'rgba(30,30,32,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(98, y + 2); g.lineTo(100 + w, y + 2); g.stroke(); }
    }
  });
}

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => { made.push(x); return x; };

  const board = new THREE.Mesh(keep(new THREE.BoxGeometry(PW + 0.012, PH + 0.02, 0.003)), keep(new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.7 })));
  board.castShadow = true; board.receiveShadow = true;
  const canvas = document.createElement('canvas'); canvas.width = CW; canvas.height = CH;
  const tex = keep(new THREE.CanvasTexture(canvas)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const paper = new THREE.Mesh(keep(new THREE.PlaneGeometry(PW, PH)), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })));
  paper.position.set(0, -0.004, 0.0016); paper.receiveShadow = true;
  // the clip: a chrome plate and a rolled lever
  const chrome = keep(new THREE.MeshStandardMaterial({ color: '#d5d8de', metalness: 1, roughness: 0.2 }));
  const plate = new THREE.Mesh(keep(new THREE.BoxGeometry(0.036, 0.012, 0.0025)), chrome); plate.position.set(0, PH / 2 + 0.002, 0.0028);
  const roll = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 32)), chrome); roll.rotation.z = Math.PI / 2; roll.position.set(0, PH / 2 + 0.008, 0.0048);
  for (const m of [plate, roll]) { m.castShadow = true; }
  // the pencil: a yellow hexagonal body, a wooden cone, a graphite tip, a pink eraser in a brass ferrule
  const pencil = new THREE.Group();
  const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0034, 0.0034, 0.07, 6)), keep(new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.45 })));
  const cone = new THREE.Mesh(keep(new THREE.ConeGeometry(0.0034, 0.009, 24)), keep(new THREE.MeshStandardMaterial({ color: '#e3c49a', roughness: 0.8 })));
  cone.rotation.x = Math.PI; cone.position.y = -0.0395;
  const lead = new THREE.Mesh(keep(new THREE.ConeGeometry(0.0011, 0.003, 16)), keep(new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.4, metalness: 0.3 })));
  lead.rotation.x = Math.PI; lead.position.y = -0.0455;
  const ferrule = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0036, 0.0036, 0.005, 24)), keep(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.3 })));
  ferrule.position.y = 0.0375;
  const eraser = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0034, 0.0034, 0.005, 24)), keep(new THREE.MeshStandardMaterial({ color: '#e88a9a', roughness: 0.8 })));
  eraser.position.y = 0.0425;
  pencil.add(body, cone, lead, ferrule, eraser);
  pencil.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  // the pencil's tip sits at the pencil's origin offset; aim it by moving the group so the lead touches (x, y) on the paper
  const tipOff = new THREE.Vector3(0, -0.047, 0);
  const rest = { x: PW / 2 + 0.006, y: -0.01, z: 0.012, rz: -0.35, rx: 0.5 };
  const pad = new THREE.Group(); pad.add(board, paper, plate, roll, pencil);
  pad.rotation.x = -0.62; pad.position.y = 0.012; // lying back on the desk, the way you would write on it
  root.add(pad);
  ctx.frame(root, { view: [0.04, 0.35, 1], pad: 1.02 });

  const toPaper = (cx, cy) => ({ x: (cx / CW - 0.5) * PW, y: -0.004 + (0.5 - cy / CH) * PH });
  const place = (x, y, lift, rz) => {
    pencil.rotation.set(rest.rx, 0, rz);
    const off = tipOff.clone().applyEuler(pencil.rotation);
    pencil.position.set(x - off.x, y - off.y, 0.0018 + lift - off.z);
  };
  place(rest.x, rest.y, rest.z, rest.rz);

  let title = data.title || '', rows = rowsOf(data.items), ink = null, inkT = 0;
  drawPaper(canvas, title, rows, null); tex.needsUpdate = true;

  return {
    get rows() { return rows; },
    get inking() { return ink ? ink.i : -1; },
    update(d) {
      const nextRows = rowsOf(d.items !== undefined ? d.items : rows), nextTitle = d.title !== undefined ? d.title : title;
      const i = newlyDone(rows, nextRows);
      rows = nextRows; title = nextTitle;
      if (i >= 0 && !still) { ink = { i, t: 0 }; inkT = 0; }
      drawPaper(canvas, title, rows, ink); tex.needsUpdate = true; ctx.requestRender();
    },
    tick(dt) {
      if (!ink) return false;
      inkT += dt;
      const y = ROW0 + ink.i * ROWH + 14, p = toPaper(60, y);
      if (inkT < 0.35) { const k = inkT / 0.35, e = k * k * (3 - 2 * k); place(rest.x + (p.x - rest.x) * e, rest.y + (p.y - rest.y) * e, rest.z * (1 - e) + 0.001, rest.rz * (1 - e) - 0.25 * e); }
      else if (inkT < 1.15) { ink.t = (inkT - 0.35) / 0.8; const q = toPaper(44 + 32 * Math.min(1, ink.t / 0.75), y + (ink.t < 0.35 ? 10 * ink.t / 0.35 : 10 - 32 * Math.min(1, (ink.t - 0.35) / 0.4))); place(q.x, q.y, 0, -0.25); drawPaper(canvas, title, rows, ink); tex.needsUpdate = true; }
      else if (inkT < 1.5) { const k = (inkT - 1.15) / 0.35, e = k * k * (3 - 2 * k); place(p.x + (rest.x - p.x) * e, p.y + (rest.y - p.y) * e, 0.001 + rest.z * e, -0.25 + (rest.rz + 0.25) * e); }
      else { place(rest.x, rest.y, rest.z, rest.rz); ink = null; drawPaper(canvas, title, rows, null); tex.needsUpdate = true; }
      return true;
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}

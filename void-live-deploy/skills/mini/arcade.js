/**
 * arcade miniature — a Verse arcade cabinet standing in the void (owner, 2026-10-19: "also a 3d arcade machine", "Verse brand cabinet of course").
 * An upright cabinet in Verse's violet and cyan: a lit VERSE marquee, side art, a screen that lists the arcade games (your record against Verse
 * beside each once played), a joystick and two buttons. Tap a game on the screen to start it; or nudge the joystick to move the highlight and
 * press the big button. Built from code: every panel is drawn on a canvas, nothing is downloaded. skills/arcade.js owns the list and what a pick does.
 * data: { games: [{ id, title, line }], onPick(id) }
 */
import { tweens } from './tabletop.js';

const VIOLET = '#5b3fd6', DEEP = '#1a1233', CYAN = '#4fe3e3', INK = '#f2eeff';
const CW = 0.26, CH = 0.56, CD = 0.2; // the cabinet: width, height, depth (scene units; ctx.frame fits it to the card)

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { t, c };
}
function marquee(x, w, h) {
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, DEEP); g.addColorStop(0.5, VIOLET); g.addColorStop(1, DEEP);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.shadowColor = CYAN; x.shadowBlur = h * 0.25; x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${Math.round(h * 0.56)}px Georgia, 'Times New Roman', serif`; x.fillText('VERSE', w / 2, h * 0.47);
  x.shadowBlur = 0; x.fillStyle = CYAN; x.font = `600 ${Math.round(h * 0.15)}px system-ui, sans-serif`; x.fillText('A R C A D E', w / 2, h * 0.84);
}
function sideArt(x, w, h) {
  x.fillStyle = DEEP; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) { x.strokeStyle = i % 2 ? CYAN : VIOLET; x.globalAlpha = 0.55 - i * 0.07; x.lineWidth = w * 0.035;
    x.beginPath(); x.moveTo(-w * 0.2, h * (0.25 + i * 0.12)); x.bezierCurveTo(w * 0.4, h * (0.1 + i * 0.12), w * 0.6, h * (0.55 + i * 0.08), w * 1.2, h * (0.4 + i * 0.1)); x.stroke(); }
  x.globalAlpha = 1; x.save(); x.translate(w * 0.5, h * 0.82); x.rotate(-Math.PI / 2); x.fillStyle = INK; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.font = `700 ${Math.round(w * 0.22)}px Georgia, serif`; x.fillText('VERSE', 0, 0); x.restore();
}
/** the screen: a title, one row per game, the highlighted one framed in cyan. Rows are evenly spaced from TOP so a tap's uv finds its row. */
const TOP = 0.2, ROWS_H = 0.72;
function screen(x, w, h, games, sel) {
  x.fillStyle = '#05040c'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { x.fillStyle = 'rgba(255,255,255,.025)'; x.fillRect(0, y, w, 1); } // scanlines
  x.fillStyle = CYAN; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
  x.fillText('PICK A GAME · YOU vs VERSE', w / 2, h * 0.1);
  const n = Math.max(1, games.length), rh = (h * ROWS_H) / n;
  games.forEach((g, i) => {
    const y = h * TOP + i * rh;
    if (i === sel) { x.strokeStyle = CYAN; x.lineWidth = 3; x.strokeRect(w * 0.06, y + rh * 0.08, w * 0.88, rh * 0.84); }
    x.fillStyle = i === sel ? INK : '#b8a8ff'; x.textAlign = 'left'; x.font = `700 ${Math.round(rh * 0.36)}px system-ui, sans-serif`;
    x.fillText((i === sel ? '▶ ' : '  ') + g.title, w * 0.1, y + rh * 0.4);
    if (g.line) { x.fillStyle = '#7f72b8'; x.font = `500 ${Math.round(rh * 0.24)}px system-ui, sans-serif`; x.fillText(g.line, w * 0.16, y + rh * 0.76); }
  });
}
/** which row a tap's uv (0..1, v up) lands on, or -1. Pure. */
export function rowAt(v, n) {
  const fromTop = 1 - v;
  if (fromTop < TOP || fromTop >= TOP + ROWS_H || n < 1) return -1;
  return Math.min(n - 1, Math.floor(((fromTop - TOP) / ROWS_H) * n));
}

export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const games = data.games || [];
  let sel = 0;
  const cab = new THREE.Group(); cab.name = 'arcade'; root.add(cab);
  const owned = [];
  const mat = (o) => { const m = new THREE.MeshPhysicalMaterial(o); owned.push(m); return m; };
  const body = mat({ color: DEEP, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const trim = mat({ color: VIOLET, roughness: 0.35, clearcoat: 0.6, emissive: VIOLET, emissiveIntensity: 0.15 });
  const box = (w, h, d, x, y, z, m, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; b.castShadow = b.receiveShadow = true; cab.add(b); return b; };
  // sides with art (you look from -z, so the art faces outward on ±x)
  const art = canvasTex(THREE, 256, 512, sideArt); owned.push(art.t);
  const sideM = mat({ map: art.t, roughness: 0.45, clearcoat: 0.5 });
  box(0.012, CH, CD, -CW / 2, CH / 2, 0, [sideM, sideM, body, body, body, body]);
  box(0.012, CH, CD, CW / 2, CH / 2, 0, [sideM, sideM, body, body, body, body]);
  box(CW, CH, 0.01, 0, CH / 2, CD / 2 - 0.005, body); // back
  box(CW - 0.012, CH * 0.42, 0.012, 0, CH * 0.21, -CD / 2 + 0.03, body); // the lower front, set back a little
  box(CW - 0.012, 0.012, CD * 0.55, 0, CH * 0.42, -CD / 2 + CD * 0.27, trim); // the control deck's top edge
  const deck = box(CW - 0.012, 0.01, CD * 0.42, 0, CH * 0.445, -CD / 2 + 0.05, body, -0.35); // the control deck, tilted toward you
  // the screen and its bezel, leaning back
  const scr = canvasTex(THREE, 512, 512, (x, w, h) => screen(x, w, h, games, sel)); owned.push(scr.t);
  const screenM = new THREE.MeshBasicMaterial({ map: scr.t }); owned.push(screenM);
  const bezel = box(CW - 0.012, CH * 0.36, 0.012, 0, CH * 0.66, -CD / 2 + 0.07, body, 0.18);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(CW * 0.8, CH * 0.3), screenM);
  glass.position.set(0, CH * 0.66, -CD / 2 + 0.062); glass.rotation.set(0.18, Math.PI, 0); glass.userData.screen = true; cab.add(glass);
  // the marquee, lit
  const mq = canvasTex(THREE, 512, 160, marquee); owned.push(mq.t);
  const mqM = new THREE.MeshBasicMaterial({ map: mq.t }); owned.push(mqM);
  box(CW - 0.012, CH * 0.12, 0.05, 0, CH * 0.92, -CD / 2 + 0.05, body);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.02, CH * 0.11), mqM); sign.position.set(0, CH * 0.92, -CD / 2 + 0.024); sign.rotation.y = Math.PI; cab.add(sign);
  // controls: a joystick on the left, two buttons on the right (your left is +x)
  const stickM = mat({ color: '#15121f', roughness: 0.4 }), ballM = mat({ color: '#e0303e', roughness: 0.3, clearcoat: 0.8 });
  const btnA = mat({ color: CYAN, roughness: 0.3, clearcoat: 0.8, emissive: CYAN, emissiveIntensity: 0.25 }), btnB = mat({ color: VIOLET, roughness: 0.3, clearcoat: 0.8 });
  const deckY = CH * 0.455, deckZ = -CD / 2 + 0.045;
  const stick = new THREE.Group(); stick.position.set(CW * 0.22, deckY, deckZ); stick.userData.stick = true; cab.add(stick);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 12), stickM); shaft.position.y = 0.015; shaft.userData.stick = true; stick.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.009, 20, 16), ballM); ball.position.y = 0.032; ball.userData.stick = true; stick.add(ball);
  const button = (x, m, name) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 24), m); b.position.set(x, deckY + 0.003, deckZ); b.userData[name] = true; b.castShadow = true; cab.add(b); return b; };
  const start = button(-CW * 0.12, btnA, 'start'); button(-CW * 0.28, btnB, 'start');
  void deck; void bezel;
  const repaint = () => { screen(scr.c.getContext('2d'), scr.c.width, scr.c.height, games, sel); scr.t.needsUpdate = true; ctx.requestRender(); };
  const tw = tweens();
  const pick = (i) => { const g = games[i]; if (g && typeof ctx.handle.data.onPick === 'function') ctx.handle.data.onPick(g.id); };
  ctx.onTap((hits) => {
    const h = hits[0]; if (!h) return;
    const o = h.object.userData;
    if (o.screen && h.uv) { const i = rowAt(h.uv.y, games.length); if (i >= 0) { sel = i; repaint(); pick(i); } }
    else if (o.stick) { sel = (sel + 1) % Math.max(1, games.length); stick.rotation.z = 0.35; setTimeout(() => { stick.rotation.z = 0; ctx.requestRender(); }, 160); repaint(); }
    else if (o.start) { const home = start.position.clone(), down = home.clone(); down.y -= 0.003; tw.add(start, down, { dur: 0.08, hop: 0, done: () => tw.add(start, home, { dur: 0.1, hop: 0 }) }); pick(sel); ctx.requestRender(); }
  });
  ctx.addContactShadow({ y: 0.0005, size: Math.max(CW, CD) * 3, opacity: 0.7, blur: 3, darkness: 0.9, exclude: [] });
  ctx.frame(cab, { view: [0.35, 0.45, -1], pad: 0.9, ground: 'none', minZoom: 0.6, maxZoom: 2, light: [-0.6, 1.2, -0.8] });
  return {
    update(d) { if (d && Array.isArray(d.games)) { games.splice(0, games.length, ...d.games); sel = Math.min(sel, Math.max(0, games.length - 1)); repaint(); } },
    tick(dt) { return tw.tick(dt); },
    state() { return { games: games.map((g) => g.id), selected: games[sel] ? games[sel].id : null }; },
    dispose() { cab.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of owned) m.dispose(); },
  };
}

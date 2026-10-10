/**
 * forge skill — frontier #14, first piece: "make me a rocket" (a vase, a bottle, a table, a snowman, a lighthouse, a teapot, a house,
 * a sailboat, a tree: things no figure covers yet) puts the thing on the stage as a model you can turn and inspect, and "print it" downloads it as an
 * STL sized for a home printer (millimetres, flat base, inside a 180 mm cube). The model, the flat render here and the
 * STL all come from one recipe (skills/forge-rules.js; tests in tools/forge.test.mjs); in 3D it stands on a turntable
 * beside the card (skills/mini/forge.js). Offline: no model service, no network.
 * "make me a rocket", "3d print a vase", "forge a lighthouse", "print it", "download the stl".
 */
import * as F from './forge-rules.js';

const NAMES = Object.values(F.THINGS).flatMap((t) => t.names).sort((a, b) => b.length - a.length).map((n) => n.replace(/ /g, '\\s+')).join('|');
const MAKE = new RegExp('^(?:please\\s+)?(?:(?:can|could)\\s+you\\s+)?(?:make|build|forge|model|sculpt|create|3d[\\s-]?print|print)\\s+(?:me\\s+)?(?:a\\s+|an\\s+)?(?:3d\\s+|printable\\s+)?(' + NAMES + ')(?:\\s+(?:in\\s+3d|i\\s+can\\s+print|to\\s+print|model))?(?:\\s+please)?$');
const PRINT = /^(?:please\s+)?(?:print\s+(?:it|this|that)|3d[\s-]?print\s+(?:it|this|that)|download\s+(?:the|its|an?)\s+stl|(?:give\s+me\s+|export\s+)?(?:the\s+|an?\s+)?stl(?:\s+file)?(?:\s+(?:of|for)\s+(?:it|this|that))?|save\s+(?:it|this)\s+as\s+(?:an?\s+)?stl)(?:\s+please)?$/;

/** what the ask means: null, { make: key } or { print: true } */
export function forgeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = MAKE.exec(t);
  if (m) return { make: F.thingOf(m[1].replace(/\s+/g, ' ')) };
  if (PRINT.test(t)) return { print: true };
  return null;
}

export const fileName = (key) => 'void-' + key + '.stl';
const dims = (s) => s.map((v) => Math.round(v)).join(' × ') + ' mm';

/** the flat fallback: the same mesh, shaded and drawn back to front, turned about its upright axis */
function drawFlat(cv, model, angleDeg) {
  const g = cv.getContext && cv.getContext('2d'); if (!g) return;
  const W = cv.width, H = cv.height, P = model.positions, I = model.indices, a = angleDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt), span = Math.max(...model.size) * 1.15, sc = Math.min(W, H) / span;
  const n = P.length / 3, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1] - model.size[1] / 2, z = P[i * 3 + 2];
    const rx = x * ca + z * sa, rz = -x * sa + z * ca, ry = y * ct - rz * st, rzz = y * st + rz * ct;
    X[i] = W / 2 + rx * sc; Y[i] = H / 2 - ry * sc; Z[i] = rzz;
  }
  const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    const p = I[t], q = I[t + 1], r = I[t + 2];
    const cross = (X[q] - X[p]) * (Y[r] - Y[p]) - (Y[q] - Y[p]) * (X[r] - X[p]);
    if (cross >= 0) continue; // facing away
    tris.push([Z[p] + Z[q] + Z[r], p, q, r]);
  }
  tris.sort((u, v) => u[0] - v[0]);
  g.clearRect(0, 0, W, H);
  for (const [, p, q, r] of tris) {
    // light from the upper left, from the face's own normal in screen space
    const ux = X[q] - X[p], uy = Y[q] - Y[p], uz = Z[q] - Z[p], vx = X[r] - X[p], vy = Y[r] - Y[p], vz = Z[r] - Z[p];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const lit = Math.max(0, -0.45 * nx - 0.55 * ny + 0.7 * Math.abs(nz)), c = Math.round(70 + 170 * lit);
    g.fillStyle = 'rgb(' + c + ',' + (c + 4) + ',' + (c + 10) + ')';
    g.beginPath(); g.moveTo(X[p], Y[p]); g.lineTo(X[q], Y[q]); g.lineTo(X[r], Y[r]); g.closePath(); g.fill();
  }
}

function download(model) {
  const blob = new Blob([F.stl(model)], { type: 'model/stl' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName(model.key);
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function mount(th, stageApi) {
  const model = F.build(th.key);
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card forge-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(320px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title"></span><span class="g-sub">forged · ready to print</span></div>';
  el.querySelector('.g-title').textContent = model.label;
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 240; cv.className = 'forge-view'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'the ' + model.label.toLowerCase() + ' Void made, shaded');
  cv.style.cssText = 'width:100%;height:auto;display:block;background:#0b0b0e;border-radius:10px';
  const facts = document.createElement('div'); facts.className = 'forge-facts g-status'; facts.style.cssText = 'display:block;margin-top:8px';
  facts.textContent = dims(model.size) + ' · ' + (model.indices.length / 3).toLocaleString('en') + ' triangles · flat base, fits a 180 mm printer';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn, aria) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const turn = (d) => { th.angle = ((th.angle || 0) + d + 360) % 360; drawFlat(cv, model, th.angle); if (stageApi.save) stageApi.save(); };
  row.append(btn('⟲', 'forge-left', () => turn(-30), 'turn it left'), btn('⟳', 'forge-right', () => turn(30), 'turn it right'),
    btn('Print it (STL)', 'g-primary forge-print', () => download(model), 'download an STL of the ' + model.label.toLowerCase()));
  const note = document.createElement('div'); note.className = 'g-rules'; note.textContent = 'Millimetres, Z up. Open the STL in any slicer (Cura, PrusaSlicer, Bambu Studio).';
  el.append(cv, facts, row, note);
  drawFlat(cv, model, th.angle || 0);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  if (stageApi.miniature) stageApi.miniature(el, 'forge', { key: th.key, angle: th.angle || 0 }, { key: th.id, place: 'beside', width: 220, height: 240, label: '3D ' + model.label.toLowerCase() + ' on a turntable: drag around it to look closer' }).catch(() => {});
}

async function run(text, api) {
  const q = forgeOf(text);
  if (!q) return 'none';
  const forged = Object.values(api.stage.things()).filter((t) => t.kind === 'forge');
  if (q.print) {
    const sel = api.stage.selected && api.stage.selected(), th = forged.find((t) => t.id === sel) || forged[forged.length - 1];
    if (!th) { api.say('Nothing forged to print yet · say "make me a rocket" (or a vase, a bottle, a table, a snowman, a lighthouse, a teapot, a house, a sailboat, a tree)'); return 'forge'; }
    const model = F.build(th.key);
    download(model);
    api.say('Downloading ' + fileName(th.key) + ' · ' + dims(model.size) + ' · open it in your slicer');
    return 'forge';
  }
  const model = F.build(q.make);
  api.summon('forge', { key: q.make, angle: 0, center: true });
  api.say(model.label + ' · ' + dims(model.size) + ' · say "print it" for the STL');
  return 'forge';
}

export default {
  name: 'forge',
  forgeOf,
  examples: ['make me a rocket', 'make a vase', '3d print a bottle', 'forge a lighthouse', 'build me a snowman', 'make me a teapot', 'make a little house', 'make me a sailboat', 'forge a tree', 'make me a table i can print', 'print it', 'download the stl'],
  nearMisses: ['make me a coffee', 'make a reservation', 'print the page', 'table of contents', 'what is a rocket', 'make me a zombie', 'make a list', 'make a 3d torus', 'make me a mug', 'make a chair'],
  match(lower, text) { return !!forgeOf(text); },
  run,
  stageKinds: { forge: { mount } },
};

/**
 * forge skill — frontier #14, first piece: "make me a rocket" (a vase, a bottle, a table, a snowman, a lighthouse, a teapot, a house,
 * a sailboat, a tree: things no figure covers yet) puts the thing on the stage as a model you can turn and inspect, and "print it" downloads it as an
 * STL sized for a home printer (millimetres, flat base, inside a 180 mm cube). The card says what a slicer will find (printCheck:
 * fits the bed, stands on its base, watertight, how much PLA, whether it needs supports). The model, the flat render here and the
 * STL all come from one recipe (skills/forge-rules.js; tests in tools/forge.test.mjs); in 3D it stands on a turntable
 * beside the card (skills/mini/forge.js). Offline: no model service, no network.
 * "make me a rocket", "3d print a vase", "forge a lighthouse", "print it", "download the stl".
 */
import * as F from './forge-rules.js';
import { add as recordPrint } from '../lib/prints.js';
import * as Makes from '../lib/forge-makes.js';

const store = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; } };
/** What Verse's probes asked the forge for, each with its status in the forge now (asked by Verse, ask-20261015-2045-2: the probe
 *  output linked to the frontier #14 tracker): 'made' when a recipe answers that name today (with its key), else 'wanted'. Pure. */
export function wantsStatus(wants) {
  return (Array.isArray(wants) ? wants : []).filter((w) => w && typeof w.thing === 'string').map((w) => {
    const key = F.thingOf(w.thing) || F.thingOf(w.thing.replace(/s$/, ''));
    return { thing: w.thing, n: +w.n || 1, status: key ? 'made' : 'wanted', key };
  });
}
const wantsHtml = (esc, rows) => (rows.length ? '<div class="sub" style="margin-top:10px">Asked for by my probes (frontier #14 tracker)</div><ul data-forge-wants style="padding-left:18px">'
  + rows.map((r) => '<li data-status="' + r.status + '">' + esc(r.thing) + (r.n > 1 ? ' (asked ' + r.n + ' times)' : '') + ' · ' + (r.status === 'made' ? '<b>made</b>: <a href="#" data-ask="make me a ' + esc(r.key) + '">make me a ' + esc(r.key) + '</a>' : 'not made yet') + '</li>').join('') + '</ul>' : '');

const NAMES = Object.values(F.THINGS).flatMap((t) => t.names).sort((a, b) => b.length - a.length).map((n) => n.replace(/ /g, '\\s+')).join('|');
const MAKE = new RegExp('^(?:please\\s+)?(?:(?:can|could)\\s+you\\s+)?(?:make|build|forge|model|sculpt|create|3d[\\s-]?print|print)\\s+(?:me\\s+)?(?:a\\s+|an\\s+)?(?:3d\\s+|printable\\s+)?(' + NAMES + ')(?:\\s+(?:in\\s+3d|i\\s+can\\s+print|to\\s+print|model))?(?:\\s+please)?$');
const PRINT = /^(?:please\s+)?(?:print\s+(?:it|this|that)|3d[\s-]?print\s+(?:it|this|that)|download\s+(?:the|its|an?)\s+stl|(?:give\s+me\s+|export\s+)?(?:the\s+|an?\s+)?stl(?:\s+file)?(?:\s+(?:of|for)\s+(?:it|this|that))?|save\s+(?:it|this)\s+as\s+(?:an?\s+)?stl)(?:\s+please)?$/;

const LIST = /^(?:(?:show|open)\s+(?:me\s+)?)?(?:the\s+)?(?:forge\s+(?:history|gallery|recipes?|catalog(?:ue)?)|what\s+can\s+you\s+(?:(?:make|forge)(?:\s+(?:for\s+)?me)?|3d\s+print\s+(?:for\s+)?me)|what\s+(?:things\s+)?(?:can|do)\s+you\s+(?:forge|make\s+in\s+3d)|(?:my|your)\s+forge)$/;
// "check it before printing" / "verify the vase": the geometry check without the download (asked by Verse: forge to print-file link); "forge iterations": every make kept (recipe versioning)
const VERIFY = new RegExp('^(?:please\\s+)?(?:(?:check|verify|inspect|test)\\s+(?:the\\s+|my\\s+)?(?:geometry\\s+of\\s+(?:the\\s+|my\\s+)?)?(' + NAMES + '|it|this|that)(?:\\s+(?:before\\s+(?:i\\s+)?print(?:ing)?(?:\\s+it)?|geometry))?|(?:check|verify)\\s+(?:it|this|that)\\s+before\\s+(?:i\\s+)?print(?:ing)?(?:\\s+it)?|is\\s+(?:it|this|that)\\s+(?:ready|safe)\\s+to\\s+print)$');
const ITER = /^(?:show\s+(?:me\s+)?)?(?:the\s+|my\s+)?(?:forge\s+(?:iterations?|makes|versions|log)|recipe\s+(?:versions|iterations))$/;
/** what the ask means: null, { make: key }, { print: true } or { list: true } (the forge history: every recipe and what stands on the stage) */
export function forgeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (LIST.test(t)) return { list: true };
  if (ITER.test(t)) return { iterations: true };
  const v = VERIFY.exec(t);
  if (v) { const w = (v[1] || 'it').replace(/\s+/g, ' '); return { verify: /^(?:it|this|that)$/.test(w) ? true : F.thingOf(w) }; }
  const m = MAKE.exec(t);
  if (m) return { make: F.thingOf(m[1].replace(/\s+/g, ' ')) };
  if (PRINT.test(t)) return { print: true };
  return null;
}

export const fileName = (key) => 'void-' + key + (F.recipeId(key) ? '-' + F.recipeId(key) : '') + '.stl'; // the recipe's id rides in the file name (asked by Verse: recipe versioning)
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

function download(model, buf) {
  const blob = new Blob([buf], { type: 'model/stl' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName(model.key);
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** The one way a forged thing goes to print (the card's button and "print it"): its STL is written, read back and held to
 *  the model (forge-rules.js verifyStl); only a file that passes downloads, and a failing one is refused with the reason. */
export function printOrRefuse(model, say, verify = F.verifyStl) {
  const buf = F.stl(model), v = verify(buf, model);
  if (!v.ok) { say('Not printed: the ' + model.label.toLowerCase() + '\'s file did not pass its check · ' + v.problems.join(' · ')); return false; }
  download(model, buf);
  const pc = F.printCheck(model);
  // the print ledger (lib/prints.js): what left for a printer, so "what have I printed" (inventory) knows what exists
  const ls = store(); if (ls) recordPrint(ls, { kind: 'stl', file: fileName(model.key), label: model.label, key: model.key, recipe: model.id, triangles: v.triangles, grams: pc.grams, size: model.size });
  say('Checked and downloading ' + fileName(model.key) + ' · ' + v.triangles.toLocaleString('en') + ' facets, watertight, fits a ' + F.BED_MM + ' mm bed · ' + dims(model.size) + ' · about ' + pc.grams + ' g in solid PLA'
    + (pc.supports ? ' · print with supports (it leans out on ' + pc.overhangPct + '% of its surface)' : ' · no supports needed') + ' · open it in any slicer');
  return true;
}

function mount(th, stageApi) {
  const model = F.build(th.key);
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card forge-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(320px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title"></span><span class="g-sub">forged · ready to print</span></div>';
  el.querySelector('.g-title').textContent = model.label;
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 240; cv.className = 'forge-view'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'the ' + model.label.toLowerCase() + ' Verse made, shaded');
  cv.style.cssText = 'width:100%;height:auto;display:block;background:#0b0b0e;border-radius:10px';
  const facts = document.createElement('div'); facts.className = 'forge-facts g-status'; facts.style.cssText = 'display:block;margin-top:8px';
  const pc = F.printCheck(model);
  facts.textContent = dims(model.size) + ' · ' + pc.triangles.toLocaleString('en') + ' triangles · ' + pc.notes.join(' · ') + (model.id ? ' · recipe ' + model.id : '');
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn, aria) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const turn = (d) => { th.angle = ((th.angle || 0) + d + 360) % 360; drawFlat(cv, model, th.angle); if (stageApi.save) stageApi.save(); };
  row.append(btn('⟲', 'forge-left', () => turn(-30), 'turn it left'), btn('⟳', 'forge-right', () => turn(30), 'turn it right'),
    btn('Print it (STL)', 'g-primary forge-print', () => printOrRefuse(model, (line) => { facts.textContent = line; }), 'check and download an STL of the ' + model.label.toLowerCase()));
  const note = document.createElement('div'); note.className = 'g-rules'; note.textContent = 'Millimetres, Z up. Open the STL in any slicer (Cura, PrusaSlicer, Bambu Studio). ';
  // the STL checker (asked by Verse: a utility to check the watertightness of STL print files): the same file "Print it" downloads, checked
  // edge by edge on /stl/ with its holes drawn in 3D (stl/app.js ?forge= builds it from this recipe in the page; nothing is sent)
  const chk = stop(document.createElement('a')); chk.className = 'forge-stl-check'; chk.href = '/stl/?forge=' + encodeURIComponent(th.key); chk.target = '_blank'; chk.rel = 'noopener'; chk.textContent = 'Check this STL';
  chk.addEventListener('click', (e) => e.stopPropagation()); note.appendChild(chk);
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
  if (q.list) { // forge history (asked by Verse twice): the recipes it can make, each with its size and print notes, and the ones standing on the stage now
    const { showPage, esc } = api, onStage = new Map(), askedOf = new Map(); for (const t of forged) { onStage.set(t.key, (onStage.get(t.key) || 0) + 1); if (t.ask) askedOf.set(t.key, t.ask); } // the ask behind a recipe on the stage is kept on its thing (asked by Verse: recipe versioning)
    const el = showPage((p) => {
      p.innerHTML = '<h2>Forge history</h2><div class="sub">' + Object.keys(F.THINGS).length + ' recipes, one mesh each: what you spin is what prints. ' + (forged.length ? forged.length + ' on the stage now.' : 'Nothing forged on this stage yet.') + '</div>'
        + '<ul style="padding-left:18px">' + Object.keys(F.THINGS).map((key) => { const m = F.build(key), pc = F.printCheck(m); return '<li><a href="#" data-ask="make me a ' + esc(key) + '">' + esc(m.label) + '</a> · ' + esc(dims(m.size)) + ' · ' + esc(pc.triangles.toLocaleString('en')) + ' triangles · ' + (pc.supports ? 'supports' : 'no supports') + (F.THINGS[key].figure ? ' · <span class="sub">a figure as a recipe</span>' : '') + (onStage.get(key) ? ' · <b>on the stage' + (onStage.get(key) > 1 ? ' ×' + onStage.get(key) : '') + '</b>' : '') + (askedOf.get(key) ? ' · <span class="sub">asked "' + esc(askedOf.get(key)) + '"</span>' : '') + '</li>'; }).join('') + '</ul>'
        + '<div data-forge-tracker></div>'
        + '<div class="src">Recipes from skills/forge-rules.js; what Verse\'s probes asked the forge for (frontier #14) is read from its probe ledger, each marked made or not made yet.</div>';
    });
    // the frontier #14 tracker (asked by Verse): the probe ledger's forge wants, each with its status in the forge today
    try {
      const r = await fetch('/api/probe-log'), j = r.ok ? await r.json() : null, rows = wantsStatus(j && j.stats && j.stats.forge);
      const slot = el && el.querySelector ? el.querySelector('[data-forge-tracker]') : (typeof document !== 'undefined' ? document.querySelector('.vpage.on [data-forge-tracker]') : null);
      if (slot) slot.innerHTML = rows.length ? wantsHtml(esc, rows) : '<div class="sub" style="margin-top:10px">My probes have not asked the forge for anything it cannot make.</div>'; // void-review: ok: every value goes through esc()
    } catch (_) {}
    return 'forge';
  }
  if (q.iterations) {
    const rows = Makes.withStatus(Makes.load(store()), (k) => F.recipeId(k));
    api.showPage((p) => { p.innerHTML = Makes.iterationsHtml(api.esc, rows); }); // void-review: ok: iterationsHtml escapes every value
    return 'forge';
  }
  if (q.verify) { // the check "print it" runs, without the download (asked by Verse)
    const sel = api.stage.selected && api.stage.selected(), th = forged.find((t) => t.id === sel) || forged[forged.length - 1], key = q.verify === true ? (th && th.key) : q.verify;
    if (!key) { api.say('Nothing forged to check yet · say "make me a vase", then "check it before printing"'); return 'forge'; }
    const m = F.build(key), v = F.verifyStl(F.stl(m), m), pc = F.printCheck(m);
    api.say(v.ok ? 'Geometry checked, not printed · the ' + m.label.toLowerCase() + ' is watertight, faces outward, ' + v.triangles.toLocaleString('en') + ' facets, fits a ' + F.BED_MM + ' mm bed · ' + dims(m.size) + (pc.supports ? ' · needs supports' : ' · no supports needed') + ' · say "print it" for the STL'
      : 'Held back: the ' + m.label.toLowerCase() + '\'s file did not pass its check · ' + v.problems.join(' · '));
    return 'forge';
  }
  if (q.print) {
    const sel = api.stage.selected && api.stage.selected(), th = forged.find((t) => t.id === sel) || forged[forged.length - 1];
    if (!th) { api.say('Nothing forged to print yet · say "make me a rocket" (or a vase, a bottle, a table, a snowman, a lighthouse, a teapot, a house, a sailboat, a tree)'); return 'forge'; }
    printOrRefuse(F.build(th.key), (line) => api.say(line));
    return 'forge';
  }
  const model = F.build(q.make);
  const ls = store(); if (ls) Makes.add(ls, { key: q.make, recipe: model.id, ask: text }); // the iteration is kept (lib/forge-makes.js)
  api.summon('forge', { key: q.make, angle: 0, center: true, ask: String(text || '').trim().slice(0, 80) });
  const pc = F.printCheck(model);
  api.say(model.label + ' · ' + dims(model.size) + (pc.supports ? ' · prints with supports' : ' · prints without supports') + ' · say "print it" for the STL');
  return 'forge';
}

export default {
  name: 'forge',
  forgeOf,
  examples: ['forge history', 'what can you make', 'make me a rocket', 'make a vase', '3d print a bottle', 'forge a lighthouse', 'build me a snowman', 'make me a teapot', 'make a little house', 'make me a sailboat', 'forge a tree', 'make me a table i can print', 'print it', 'download the stl', 'check it before printing', 'forge iterations', 'make me a person'],
  nearMisses: ['make me a coffee', 'make a reservation', 'print the page', 'table of contents', 'what is a rocket', 'make me a zombie', 'make a list', 'make a 3d torus', 'make me a mug', 'make a chair'],
  match(lower, text) { return !!forgeOf(text); },
  run,
  stageKinds: { forge: { mount } },
};

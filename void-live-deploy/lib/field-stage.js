// field-stage — the DOM half of Verse's field minds (lib/field-kit.js is the pure half; docs/playbooks/field-mind.md says how to add one).
// mountField(th, stageApi, idea) puts a small Canvas2D card on the stage and runs the idea's step law on it:
//   - one requestAnimationFrame loop, paused while the tab is hidden and gone when the card leaves the page;
//     with prefers-reduced-motion the field is warmed up once and then moves only when you touch it (no loop);
//   - the field's metrics become a morph of THE CARD ONLY (hue-rotate, corner radius, glow, a scale of the card's field and a shift,
//     a blur on the canvas): never the page around it;
//   - sound stays OFF until you tap "Sound on" (a Web Audio spectrum drone that follows the metrics); no Web Audio: the button says so;
//   - "Tilt" asks for the device orientation only on a tap (iOS asks permission, others just start); no sensor: the button says so;
//   - "Seal" keeps a SHA-256 of the idea's params + metrics in IndexedDB (try/catch; in memory when the store is blocked). It keeps
//     facts and counts only, never the pointer's path: the same privacy shape as the card mint store.
// An idea is { id, title, sub, W, H, warm, create(seed), step(s, dt, input), metrics(s), draw(g, s, W, H), params(s), status(s, m) }, and may add
// trails (keep the last frame instead of clearing it), morph(s, m) (its own morph numbers instead of morphOf), vars(s, m) (more CSS custom properties
// on the card, such as --ink-density), and dispose(s) (called once when the card leaves the page, e.g. to end a Worker).
// mount?(ctx) is also allowed: it adds the idea's own controls and background thinking (a Worker mind) and returns { dispose() }.
// fieldSkill(...) makes the whole skill (routing words, examples, stage kind) from an idea so a new field mind is one small file.
import { morphOf, morphCss, audioMap, tiltOf, pointerIn, seal } from './field-kit.js';
import { motionThrottle } from './motion-throttle.js';
import * as Field from './shared-field.js'; // the one shared field (also skills/field.js): every Mind Field mode's card is felt by Verse Brain there
import { linkMode } from './mode-field.js';
import { keepWhile } from './live-cards.js'; // a field card keeps running when the stage redraws (render() in void.html puts it back)
import { MODES, BRAIN, isMode } from './mind-field-modes.js'; // every field mind is a Mind Field mode: its card gets the Mode switcher // asked by Verse: chaotic motion slows to a quarter while someone types in another card

const reduced = () => { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };

// ---- the seal store (IndexedDB, facts only) ---------------------------------------------------------------------------------------
const mem = [];
const DB = 'void-field', STORE = 'seals', KEEP = 60;
function openDb() {
  return new Promise((res, rej) => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'hash' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')); } catch (e) { rej(e); }
  });
}
/** keep a seal: { hash, idea, ts, params, metrics } (numbers only). Resolves { kept, where } and never throws. */
export async function keepSeal(rec) {
  try {
    const db = await openDb();
    const kept = await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE); st.put(rec); const all = st.getAll(); all.onsuccess = () => { const rows = all.result.sort((a, b) => a.ts - b.ts); while (rows.length > KEEP) st.delete(rows.shift().hash); res(rows.length); }; tx.onerror = () => rej(tx.error); });
    db.close(); return { kept, where: 'this device' };
  } catch (_) { mem.push(rec); if (mem.length > KEEP) mem.shift(); return { kept: mem.length, where: 'this tab only' }; }
}

// ---- the sound (off until a tap) -----------------------------------------------------------------------------------------------------
function makeSound() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  let ctx = null, nodes = null;
  const build = () => {
    ctx = new AC(); const master = ctx.createGain(); master.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, an = ctx.createAnalyser(); an.fftSize = 64;
    const oscs = [0, 1, 2].map(() => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.connect(g); g.connect(master); o.start(); return { o, g }; });
    if (pan) { master.connect(pan); pan.connect(an); } else master.connect(an);
    an.connect(ctx.destination); nodes = { master, pan, oscs, an };
  };
  return {
    get on() { return !!ctx && ctx.state === 'running'; },
    async toggle() { if (!ctx) build(); if (ctx.state === 'running') { await ctx.suspend(); return false; } await ctx.resume(); return true; },
    update(m) { if (!nodes || ctx.state !== 'running') return; const a = audioMap(m), t = ctx.currentTime; a.freqs.forEach((f, i) => { nodes.oscs[i].o.frequency.setTargetAtTime(f, t, 0.15); nodes.oscs[i].g.gain.setTargetAtTime(a.gains[i], t, 0.15); }); nodes.master.gain.setTargetAtTime(a.master, t, 0.2); if (nodes.pan) nodes.pan.pan.setTargetAtTime(a.pan, t, 0.2); },
    close() { try { ctx && ctx.close(); } catch (_) { /* gone */ } }
  };
}

/** the header's subtitle. A list of tags ("F-034 · F-027 · F-044 ...") keeps each tag whole and wraps only between tags, in balanced lines
 *  (owner, 2026-10-18: "· F-042" sat alone on a second line); the full list is its title too. */
function subLine(sub, text) {
  const parts = String(text).split(' · ');
  if (parts.length < 2) { sub.textContent = text; return; }
  sub.textContent = ''; sub.title = text; sub.style.textWrap = 'balance';
  parts.forEach((t, i) => { const s = document.createElement('span'); s.className = 'g-tag'; s.style.whiteSpace = 'nowrap'; s.textContent = t + (i < parts.length - 1 ? ' ·' : ''); sub.append(s, i < parts.length - 1 ? ' ' : ''); });
}

/** mount a field card for an idea on the stage; returns { el, state, tick(n) }. */
export function mountField(th, stageApi, idea) {
  const W = idea.W || 320, H = idea.H || 240, cls = 'field-card ff-' + idea.id;
  // the state is not enumerable: the stage saves its things with JSON.stringify, and a field's typed arrays must not be written out with them
  const setState = (v) => { Object.defineProperty(th, 'state', { value: v, writable: true, enumerable: false, configurable: true }); return v; };
  setState(idea.create((Date.now() & 0xffff) || 1));
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card ' + cls; el.dataset.id = th.id; el.tabIndex = 0; el.dataset.field = idea.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(' + (W + 24) + 'px, calc(100vw - 20px))';
  // the header's insets are the same on both sides (owner, 2026-10-18: the subtitle sat against the right border): a long subtitle wraps
  // under the title, right-aligned, instead of running past the card's edge, and both keep 6px more than the card's padding
  el.innerHTML = '<div class="ff-body"><div class="g-head" style="flex-wrap:wrap;row-gap:2px;padding:0 6px"><span class="g-title"></span><span class="g-sub" style="flex:0 1 auto;min-width:0;margin-left:auto;text-align:right"></span></div>'
    + '<div class="ff-frame" style="border-radius:10px;overflow:hidden"></div>'
    + '<div class="ff-hud g-status" role="status" aria-live="polite" style="font-size:13px;margin-top:6px"></div>'
    + '<div class="ff-why" style="font-size:11.5px;color:var(--muted,#8a8a8a);min-height:1.4em"></div>'
    + '<div class="ff-btns" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
    + '<button type="button" class="g-btn ff-seal">Seal</button><button type="button" class="g-btn ff-sound" aria-pressed="false">Sound on</button>'
    + '<button type="button" class="g-btn ff-tilt" aria-pressed="false">Tilt</button><button type="button" class="g-btn ff-reset">Reset</button></div>'
    + '<div class="ff-sealed" style="font-size:11.5px;color:var(--muted,#8a8a8a);min-height:1.3em"></div></div>';
  const q = (s) => el.querySelector(s);
  q('.g-title').textContent = idea.title; subLine(q('.g-sub'), idea.sub || '');
  const cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.className = 'ff-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', idea.title + ' (a live field; move over it)');
  cv.style.cssText = 'display:block;width:100%;aspect-ratio:' + W + '/' + H + ';background:#05040c;touch-action:none;cursor:crosshair';
  if (idea.vars) cv.style.filter = 'contrast(calc(0.9 + var(--ink-density, 0) * 0.6)) blur(calc((1 - var(--ink-density, 0)) * 0.7px))'; // --ink-density: sharp and high-contrast when high, soft charcoal when low
  const g = cv.getContext('2d'); if (g) g.scale(dpr, dpr);
  q('.ff-frame').appendChild(cv);
  const hud = q('.ff-hud'), why = q('.ff-why'), sealed = q('.ff-sealed');
  for (const n of el.querySelectorAll('canvas,button')) n.addEventListener('pointerdown', (e) => e.stopPropagation());
  stageApi.bindDrag(el, th); keepWhile(el, th); stageApi.stage.appendChild(el);

  const input = { x: 0.5, y: 0.5, over: false, down: false, tiltX: 0, tiltY: 0, tilting: false };
  const at = (e) => { const p = pointerIn(e.clientX, e.clientY, cv.getBoundingClientRect()); input.x = p.x; input.y = p.y; };
  let still = reduced(), dirty = true;
  cv.addEventListener('pointermove', (e) => { at(e); input.over = true; if (still) { tick(1); } });
  cv.addEventListener('pointerdown', (e) => { at(e); input.down = true; input.over = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } if (still) tick(2); });
  const up = () => { input.down = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { input.over = false; input.down = false; });

  let metrics = idea.metrics(th.state), frames = 0, morphs = 0;
  // every Mind Field mode is part of Verse Brain: its card's numbers sit in one slot of the shared field (lib/mode-field.js), where the
  // brain feels them; the memory orbs write their own orbs, and the brain is the one feeling
  const modeLink = isMode(idea.id) && idea.id !== 'agent-fluid-memory-orbs' ? (() => { try { return linkMode(Field, idea.id); } catch (_) { return null; } })() : null;
  const morph = () => {
    metrics = idea.metrics(th.state); const mo = idea.morph ? idea.morph(th.state, metrics) : morphOf(metrics), css = morphCss(mo), extra = idea.vars ? idea.vars(th.state, metrics) : {};
    el.style.filter = css.filter; el.style.borderRadius = css.radius; el.style.boxShadow = css.glow;
    q('.ff-frame').style.transform = css.transform; hud.style.transform = css.hud; q('.ff-frame').style.filter = css.canvasFilter; // the field breathes, the buttons hold still under a finger (a scaled body kept Law, Mode and New game moving)
    for (const [k, v] of Object.entries({ ...css.vars, ...extra })) el.style.setProperty(k, v);
    if (extra['--ink-density'] != null) el.dataset.ink = extra['--ink-density'];
    el.dataset.hue = String(mo.hue); el.dataset.entropy = metrics.entropy.toFixed(3); el.dataset.activity = metrics.activity.toFixed(3); el.dataset.consensus = metrics.consensus.toFixed(3); el.dataset.radius = String(mo.radius); el.dataset.frames = String(frames);
    hud.textContent = idea.status ? idea.status(th.state, metrics) : '';
    if (sound) sound.update(metrics);
    if (modeLink && (morphs++ % 8 === 0 || still)) { try { modeLink.write(metrics, input); el.dataset.fieldSlot = String(modeLink.slot); } catch (_) { /* the field's own problem */ } }
  };
  const draw = () => { if (g) { g.save(); if (!idea.trails) g.clearRect(0, 0, W, H); idea.draw(g, th.state, W, H, input); g.restore(); } };
  const tick = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { idea.step(th.state, dt, input); frames++; } morph(); draw(); };
  const fresh = () => { setState(idea.create((Date.now() & 0xffff) || 1)); frames = 0; tick(idea.warm || 0); tick(1); };

  // sound: off until a tap
  const sound = (() => { try { return makeSound(); } catch (_) { return null; } })();
  const sb = q('.ff-sound');
  if (!sound) { sb.disabled = true; sb.textContent = 'Sound unavailable'; }
  sb.addEventListener('click', async () => { try { const on = await sound.toggle(); sb.setAttribute('aria-pressed', String(on)); sb.textContent = on ? 'Sound off' : 'Sound on'; sound.update(metrics); } catch (_) { sb.disabled = true; sb.textContent = 'Sound unavailable'; } });

  // tilt: asks only on a tap
  const tb = q('.ff-tilt');
  const onOrient = (e) => { const t = tiltOf(e.beta, e.gamma); input.tiltX = t.x; input.tiltY = t.y; };
  if (typeof DeviceOrientationEvent === 'undefined' || !('ondeviceorientation' in window)) { tb.disabled = true; tb.textContent = 'Tilt unavailable'; }
  tb.addEventListener('click', async () => {
    try {
      if (input.tilting) { window.removeEventListener('deviceorientation', onOrient); input.tilting = false; input.tiltX = input.tiltY = 0; tb.setAttribute('aria-pressed', 'false'); tb.textContent = 'Tilt'; return; }
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') { tb.textContent = 'Tilt not allowed'; return; }
      window.addEventListener('deviceorientation', onOrient); input.tilting = true; tb.setAttribute('aria-pressed', 'true'); tb.textContent = 'Tilt on';
    } catch (_) { tb.disabled = true; tb.textContent = 'Tilt unavailable'; }
  });

  q('.ff-reset').addEventListener('click', () => fresh());
  q('.ff-seal').addEventListener('click', async () => {
    try {
      const params = idea.params ? idea.params(th.state) : {}, s = await seal(idea.id, params, metrics);
      const r = await keepSeal({ hash: s.hash, idea: idea.id, ts: Date.now(), params, metrics });
      sealed.textContent = 'Sealed ' + s.short + ' (SHA-256 of the settings and numbers, no pointer path) · ' + r.kept + ' kept on ' + r.where; el.dataset.seal = s.short;
    } catch (_) { sealed.textContent = 'Could not seal here.'; }
  });

  // an idea may add its own controls and think in the background: idea.mount({ el, q, th, input, cv, W, H, tick, redraw, still }) -> { dispose() }
  let hook = null;
  if (typeof idea.mount === 'function') { try { hook = idea.mount({ el, q, th, input, cv, W, H, tick, redraw: () => { morph(); draw(); }, still: () => still }) || null; } catch (_) { hook = null; } }
  // Mind Field (owner, 2026-10-21: "combine anything that can be without taking away"): a mode's card switches to any other mode in
  // place; the old card leaves and the new one opens where it was, by the new mode's own ask (so its words, log and tests are its own)
  // a family of its own (Tilt Arena) passes idea.modes = { list, label, ask(m) } and gets the same switcher
  // every mode's switcher ends with Verse Brain, which feels all of them; idea.modes.beside opens the choice next to the card instead
  const MT = idea.modes || (isMode(idea.id) ? { list: [...MODES, BRAIN], label: 'Mind Field mode', ask: (m) => (m.id === 'doodle-mind' ? 'mind field' : m.ask) } : null);
  if (MT) {
    const row = document.createElement('label'), pick = document.createElement('select');
    row.className = 'mf-mode-row'; row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:100%;font-size:12px';
    row.append('Mode', pick); pick.className = 'mf-mode'; pick.setAttribute('aria-label', MT.label);
    pick.style.cssText = 'max-width:100%;min-width:0;font:inherit;font-size:12px;padding:3px 6px;border-radius:7px;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(255,255,255,.25)';
    row.firstChild.textContent = MT.beside ? 'Open' : 'Mode';
    for (const m of MT.list) { const o = document.createElement('option'); o.value = m.id; o.textContent = m.title; o.selected = m.id === idea.id; pick.appendChild(o); }
    for (const n of [row, pick]) n.addEventListener('pointerdown', (e) => e.stopPropagation());
    pick.addEventListener('change', () => {
      const m = MT.list.find((x) => x.id === pick.value); if (!m || m.id === idea.id || !stageApi.ask) return;
      if (MT.beside) { pick.value = idea.id; Promise.resolve(stageApi.ask(MT.ask(m))).catch(() => {}); return; } // the card stays; the choice opens beside it
      const things = stageApi.things(), at = { x: th.x, y: th.y };
      delete things[th.id]; if (stageApi.save) stageApi.save(); if (stageApi.render) stageApi.render();
      Promise.resolve(stageApi.ask(MT.ask(m))).then(() => {
        const now = Object.values(stageApi.things()).filter((t) => t.kind === m.id).pop(); if (!now) return;
        now.x = at.x; now.y = at.y; if (stageApi.save) stageApi.save(); if (stageApi.render) stageApi.render();
      }).catch(() => {});
    });
    q('.ff-btns').prepend(row); el.dataset.mode = idea.id;
    const cur = MT.list.find((x) => x.id === idea.id);
    if (cur && cur.link) { const a = document.createElement('a'); a.href = cur.link.href; a.target = '_blank'; a.rel = 'noopener'; a.className = 'mf-link'; a.textContent = cur.link.text; a.style.cssText = 'font-size:12px;max-width:100%'; q('.ff-btns').appendChild(a); }
  }
  // every control stays inside the card (owner, 2026-10-18: Tilt and Reset were clipped off the right edge): the row wraps, and no one control is wider than it
  for (const c of q('.ff-btns').children) c.style.maxWidth = '100%';
  const endHook = () => { try { hook && hook.dispose && hook.dispose(); } catch (_) { /* gone */ } hook = null; try { modeLink && modeLink.close(); } catch (_) { /* gone */ } };

  // the loop: paused while hidden, ended when the card leaves, none at all under reduced motion
  tick(idea.warm || 0); tick(1);
  let raf = 0, last = 0, cost = 0, gap = 16.7; const thr = motionThrottle(); // frame time is measured (data-frame-ms: the field's own work a frame; data-fps)
  const loop = (t) => { raf = 0; if (!el.isConnected) { endHook(); if (sound) sound.close(); try { idea.dispose && idea.dispose(th.state); } catch (_) { /* gone */ } window.removeEventListener('deviceorientation', onOrient); return; } const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60; last = t; if (!document.hidden && !still) { const t0 = performance.now(); tick(idea.perFrame || 1, dt * thr.scale(el)); cost = cost * 0.95 + (performance.now() - t0) * 0.05; gap = gap * 0.95 + dt * 1000 * 0.05; if ((frames & 31) === 0) { el.dataset.frameMs = cost.toFixed(2); el.dataset.fps = String(Math.round(1000 / Math.max(1, gap))); } } raf = requestAnimationFrame(loop); };
  if (!still) raf = requestAnimationFrame(loop);
  why.textContent = idea.how || '';
  return { el, state: th.state, tick, input, get still() { return still; } };
}

/** the whole skill for an idea: { name, examples, nearMisses, match, run, stageKinds }. words is the regexp body for the ask (anchored here). */
export function fieldSkill({ name, words, examples, nearMisses, idea, say }) {
  const WHEN = new RegExp('^(?:(?:show|open|start|run|make|give|let me see|i want)\\s+(?:me\\s+)?)?(?:a\\s+|an\\s+|the\\s+|your\\s+|(?:verse|v01d)\'?s\\s+|(?:verse|void)\'?s\\s+)?(?:' + words + ')(?:\\s+(?:demo|card|please))?$', 'i');
  const matches = (t) => WHEN.test(String(t || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
  return {
    name, examples, nearMisses, WHEN,
    match(lower, text) { return matches(text || lower); },
    async run(text, api) {
      if (!matches(text)) return 'none';
      const existing = Object.values(api.stage.things()).find((t) => t.kind === name);
      if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return name; }
      api.summon(name, { x: Math.max(10, Math.round(innerWidth / 2 - 180)), y: 50 });
      api.say(say);
      return name;
    },
    stageKinds: { [name]: { mount: (th, stageApi) => mountField(th, stageApi, idea) } }
  };
}

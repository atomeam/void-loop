/**
 * figures3d — Void's light 3D layer and its roaming figures (board Next #17). Not a skill: nothing imports this file until a figure is on the stage,
 * so the empty page loads no 3D code at all. On first use it loads the bundled three.js (/vendor/three-r180, shared with scene3d.js) and puts one transparent
 * WebGL canvas behind the cards, over the black stage. Pointer events pass through to the cards; the page asks this layer
 * whether a figure is under the pointer, and only then does a click, wheel or pinch go to the figure.
 *
 * API for later items (#16 slogan, #18 bodies, #19 scripts, #22 zoom):
 *   mountStage3D()            -> Promise<stage>   load three.js once, add the canvas, start the loop
 *   addFigure(spec)           -> Promise<figure>  spec: { id?, body: 'sprite'|'person'|'animal'|'object'|'place'|'idea', color?, prop?, line?, script?, x?, y? }
 *   pickBody / dressFromCard  re-exported from skills/bodies.js (Next #18; pure, no three.js)
 *   trimScript / fallbackScript / pickIdleAction  re-exported from skills/scripts.js (Next #19)
 *   removeFigures(ids?)       -> number           all figures, or the ids given
 *   syncFigures(list)         -> Promise          make the scene match the stage items of kind 'figure' (void.html calls this)
 *   mountInScene(mounter)     -> Promise<unmount> share the scene: mounter({ THREE, scene, camera, renderer, toWorld, still, requestRender })
 *                                                 may return { update(dt, t), dispose() }. Any module (the #16 slogan, Claude's
 *                                                 stage3d.js with its GLB/STL export) mounts here, so the page keeps one three.js
 *                                                 copy and one WebGL scene. loadThree() hands out the same three.js module.
 * The brain (stepFigure, pickTarget) is plain JS with no three.js, so it runs and is tested without WebGL.
 * Next #19/#20: each figure may carry a behavior script (drives, idle actions, reactsTo/tags). Unknown names are trimmed;
 * missing scripts fall back to the base-body defaults. Nearby figures trigger greet/follow/chase/flee/argue/team; reduced motion holds all still.
 */
import { dressFromCard, pickBody, SAMPLE_CARDS, BODIES, colorFromCard, propFor, lineFromCard } from './bodies.js';
import { PERSON, ANIMAL, bodyMesh, zombieMesh, zombieGroups, brainMesh, creatureMesh, CREATURE_KINDS, foodMesh, lifeMesh } from './sdfmesh.js';
import { makeCloud, cloudGeometry, cloudShade, makePrecip, makeGlow } from './sky3d.js';
import { trimScript, fallbackScript, pickIdleAction, visualAct, allowsDrive, pickReaction, pickNearbyReaction, climateAt, CONDITIONS, KNOWN_DRIVES, KNOWN_ACTIONS, KNOWN_REACTS, KNOWN_TAGS, FALLBACKS, subjectKey } from './scripts.js';
export { dressFromCard, pickBody, SAMPLE_CARDS, BODIES, colorFromCard, propFor, lineFromCard };
export { trimScript, fallbackScript, pickIdleAction, visualAct, allowsDrive, pickReaction, pickNearbyReaction, KNOWN_DRIVES, KNOWN_ACTIONS, KNOWN_REACTS, KNOWN_TAGS, FALLBACKS, subjectKey };
export const THREE_VERSION = '0.180.0';
export const THREE_URL = '/vendor/three-r180/build/three.module.min.js'; // the same bundled copy scene3d.js uses: one three.js on the page
export const MOTION_KEY = 'a2m.void.motion.v1';
const PALETTE = [0x9d8cff, 0x6ee7c8, 0xffa98a, 0x7cc4ff, 0xff8fc7, 0xc6f27a];
const R = 28;            // body radius in CSS px: a figure is about 80 px tall on the stage
const SPEED = 42;        // px per second while wandering
const NOTICE = 190;      // the cursor is "near" inside this many px
const MAX_ZOOM = 6;
const PAD = R * 1.3 + 42; // how far a goal sits from any card, just outside where cards start to push

// ---------- the brain: plain numbers in screen px (y grows downward) ----------
// a figure summoned without a look still differs from the last one: its seed (or id) picks a size, build and pace
export function variation(seed) {
  let a = seed >>> 0; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { size: 0.88 + r() * 0.24, wide: 0.9 + r() * 0.2, tall: 0.9 + r() * 0.2, pace: 0.85 + r() * 0.3 };
}
function hashId(id) { let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
export function makeBrain(spec = {}, rng = Math.random) {
  const body = spec.body || 'sprite';
  const script = spec.script ? trimScript(spec.script, body, spec.title || null) : null;
  return { id: spec.id || 'fig_' + Math.random().toString(36).slice(2, 8), x: spec.x ?? 200, y: spec.y ?? 200, vx: 0, vy: 0,
    tx: spec.x ?? 200, ty: spec.y ?? 200, mode: 'idle', modeT: 0.6 + rng() * 1.2, act: 'look', yaw: 0, lookX: 0, lookY: 0,
    blinkT: 0, nextBlink: 1.5 + rng() * 3, bob: rng() * 6.28, hop: 0, spin: 0, noticed: false, wave: 0, slide: 0, t: 0,
    script, body, react: null, reactId: null, reactT: 0, chasedOff: false, pace: +spec.pace || 1 }; // pace: this individual's walking speed
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function insideAny(x, y, rects, pad = 0) {
  return rects.some((r) => x > r.l - pad && x < r.r + pad && y > r.t - pad && y < r.b + pad);
}
/** A free spot on the stage: inside the bounds, away from every card (falls back to the least-bad spot). */
export function pickTarget(world, rng = Math.random, pad = PAD) {
  const b = world.bounds; let best = null, bestD = -1;
  for (let i = 0; i < 24; i++) {
    const x = b.l + rng() * Math.max(1, b.r - b.l), y = b.t + rng() * Math.max(1, b.b - b.t);
    if (!insideAny(x, y, world.rects || [], pad)) return { x, y };
    const d = Math.min(...(world.rects || []).map((r) => Math.hypot(x - clamp(x, r.l, r.r), y - clamp(y, r.t, r.b))));
    if (d > bestD) { bestD = d; best = { x, y }; }
  }
  return best || { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 };
}
/**
 * One step of a figure's life. world = { bounds:{l,t,r,b}, rects:[{l,t,r,b}], cursor:{x,y}|null, still, posing, others:[brain] }.
 * Drives: wander to a free spot, walk around cards, notice the cursor and turn to look at it, idle (look around, twirl, wave), blink, bob.
 */
export function stepFigure(f, dt, world, rng = Math.random) {
  dt = Math.min(dt, 0.1); f.t += dt;
  const rects = world.rects || [], b = world.bounds;
  if (world.still) { // reduced motion: a still pose, facing you, eyes open; no wandering, no bob, no reactions
    f.vx = 0; f.vy = 0; f.mode = 'still'; f.yaw = 0; f.lookX = 0; f.lookY = 0; f.blinkT = 0; f.hop = 0; f.spin = 0; f.wave = 0;
    f.react = null; f.reactId = null; f.reactT = 0;
    return f;
  }
  f.bob += dt * 2.3;
  // blink: every 1.5-5.5 s, now and then a double blink
  if (f.blinkT > 0) f.blinkT = Math.max(0, f.blinkT - dt);
  f.nextBlink -= dt;
  if (f.nextBlink <= 0) { f.blinkT = 0.14; f.nextBlink = rng() < 0.22 ? 0.22 : 1.5 + rng() * 4; }
  f.hop = Math.max(0, f.hop - dt * 2.2); f.wave = Math.max(0, f.wave - dt * 0.8);
  if (f.spin > 0) f.spin = Math.max(0, f.spin - dt * 5.5);
  const c = world.cursor, dc = c ? Math.hypot(c.x - f.x, c.y - f.y) : Infinity;
  const canNotice = allowsDrive(f.script, 'notice');
  let wantYaw = 0;
  if (world.posing) { // zoomed in on: hold the pose and look at the viewer
    f.mode = 'pose'; f.vx *= 0.8; f.vy *= 0.8; f.lookX *= 0.85; f.lookY *= 0.85;
  } else if (canNotice && dc < NOTICE) {
    if (!f.noticed) { f.hop = 1; f.noticed = true; }
    f.mode = 'notice';
    const lx = clamp((c.x - f.x) / 160, -1, 1), ly = clamp((f.y - c.y) / 160, -1, 1);
    f.lookX += (lx - f.lookX) * Math.min(1, dt * 8); f.lookY += (ly - f.lookY) * Math.min(1, dt * 8);
    wantYaw = clamp((c.x - f.x) / 220, -0.7, 0.7);
    f.vx *= Math.pow(0.02, dt); f.vy *= Math.pow(0.02, dt);
  } else {
    if (f.mode === 'notice' || f.mode === 'pose' || f.mode === 'still') { f.mode = 'idle'; f.modeT = 0.8 + rng() * 1.2; f.act = 'look'; }
    if (dc > NOTICE * 1.4) f.noticed = false;
    f.lookX *= Math.pow(0.1, dt); f.lookY *= Math.pow(0.1, dt);
    if (insideAny(f.tx, f.ty, rects, PAD - 12)) { const p = pickTarget(world, rng); f.tx = p.x; f.ty = p.y; } // a card landed on the goal
    // Next #20: react to a nearby figure when the script says so (cursor notice still wins above).
    const near = pickNearbyReaction(f, world.others || [], NOTICE * 1.15);
    if (near && (!f.react || f.reactId !== near.other.id || f.react !== near.react)) {
      f.react = near.react; f.reactId = near.other.id; f.reactT = 2.4 + rng() * 1.6;
      if (near.react === 'greet' || near.react === 'argue') { f.mode = near.react; f.hop = 1; f.wave = 1; f.act = 'wave'; }
      else if (near.react === 'chase' || near.react === 'follow' || near.react === 'flee' || near.react === 'team' || near.react === 'eat') {
        f.mode = near.react; f.modeT = 3;
      }
    }
    if (f.react && f.reactT > 0) f.reactT -= dt;
    if (f.mode === 'greet' || f.mode === 'argue') {
      const o = (world.others || []).find((x) => x && x.id === f.reactId);
      if (!o || f.reactT <= 0) { f.mode = 'idle'; f.modeT = 0.8 + rng() * 1.2; f.react = null; f.reactId = null; }
      else {
        wantYaw = clamp((o.x - f.x) / 220, -0.7, 0.7);
        f.lookX += (clamp((o.x - f.x) / 160, -1, 1) - f.lookX) * Math.min(1, dt * 8);
        f.vx *= Math.pow(0.05, dt); f.vy *= Math.pow(0.05, dt);
        if (f.act === 'wave') f.wave = Math.max(f.wave, 0.6);
      }
    } else if (f.mode === 'chase' || f.mode === 'follow' || f.mode === 'flee' || f.mode === 'team' || f.mode === 'eat') {
      const o = (world.others || []).find((x) => x && x.id === f.reactId && !x.chasedOff && !x.eaten);
      if (f.mode === 'eat' && o) f.reactT = Math.max(f.reactT, 0.5); // a hunter does not give up on food it can see
      if (!o || f.reactT <= 0) { f.mode = 'idle'; f.modeT = 0.8 + rng() * 1.2; f.react = null; f.reactId = null; }
      else {
        const dx0 = o.x - f.x, dy0 = o.y - f.y, dist = Math.hypot(dx0, dy0) || 1;
        let tx = o.x, ty = o.y, spd = SPEED;
        if (f.mode === 'flee') { tx = f.x - dx0; ty = f.y - dy0; spd = SPEED * 1.25; }
        else if (f.mode === 'chase') { spd = SPEED * 1.45; }
        else if (f.mode === 'eat') { spd = SPEED * 1.15; } // a steady, single-minded walk to the food
        else if (f.mode === 'team') { // stick near, not on top
          if (dist < R * 2.2) { tx = f.x; ty = f.y; }
          else { tx = o.x - (dx0 / dist) * R * 2; ty = o.y - (dy0 / dist) * R * 2; }
        } else if (f.mode === 'follow') {
          tx = o.x - (dx0 / dist) * R * 2.4; ty = o.y - (dy0 / dist) * R * 2.4;
        }
        if (f.mode === 'chase' && dist < R * 1.6) { // caught: chase the other off the stage
          o.chasedOff = true; f.mode = 'idle'; f.modeT = 1.2; f.react = null; f.reactId = null; f.hop = 1; f.wave = 1;
        } else if (f.mode === 'eat' && dist < R * 1.3) { // reached the food: eat it (it shrinks away where it lies)
          o.eaten = true; o.chasedOff = true; f.ate = (f.ate || 0) + 1; f.mode = 'idle'; f.modeT = 1.6; f.react = null; f.reactId = null; f.hop = 1; f.act = 'look';
        } else {
          f.tx = tx; f.ty = ty;
          const gx = f.tx - f.x, gy = f.ty - f.y, gd = Math.hypot(gx, gy) || 1;
          f.vx = gx / gd * spd; f.vy = gy / gd * spd;
          wantYaw = clamp(gx / 180, -0.7, 0.7);
        }
      }
    } else if (f.mode === 'idle') {
      f.modeT -= dt; f.vx *= Math.pow(0.05, dt); f.vy *= Math.pow(0.05, dt);
      if (f.act === 'look') { f.lookX = Math.sin(f.t * 1.3) * 0.6; wantYaw = Math.sin(f.t * 0.9) * 0.35; }
      if (f.modeT <= 0) {
        if (allowsDrive(f.script, 'wander')) { const p = pickTarget(world, rng); f.tx = p.x; f.ty = p.y; f.mode = 'wander'; }
        else { f.modeT = 1.5 + rng() * 3; const named = pickIdleAction(f.script, rng); f.act = visualAct(named); if (f.act === 'twirl') f.spin = 1; if (f.act === 'wave') f.wave = 1; }
      }
    } else { // wander toward the goal, sliding around cards
      const gx = f.tx - f.x, gy = f.ty - f.y, gd = Math.hypot(gx, gy) || 1;
      if (gd < 10) {
        f.mode = 'idle'; f.modeT = 1.5 + rng() * 3;
        const named = pickIdleAction(f.script, rng);
        f.act = visualAct(named);
        if (f.act === 'twirl') f.spin = 1; if (f.act === 'wave') f.wave = 1;
      } else {
        let dx = gx / gd * SPEED, dy = gy / gd * SPEED;
        const clear = R * 1.3, infl = clear + 40; let near = false; // keep the arms and the glow off the card
        for (const r of rects) {
          const nx = clamp(f.x, r.l, r.r), ny = clamp(f.y, r.t, r.b);
          let ax = f.x - nx, ay = f.y - ny, d = Math.hypot(ax, ay);
          if (d === 0) { // inside a card: step out by the shortest side
            const out = [[f.x - r.l, -1, 0], [r.r - f.x, 1, 0], [f.y - r.t, 0, -1], [r.b - f.y, 0, 1]].sort((p, q) => p[0] - q[0])[0];
            ax = out[1]; ay = out[2]; d = 0.001;
            dx += ax * SPEED * 3; dy += ay * SPEED * 3; continue;
          }
          if (d < infl) {
            ax /= d; ay /= d; const k = clamp(1 - (d - clear) / 40, 0, 2);
            // slide along the edge toward the goal; keep the chosen side until clear of the card, so it never dithers head-on
            let tx = -ay, ty = ax;
            if (!f.slide) {
              const dot = (tx * gx + ty * gy) / gd;
              f.slide = Math.abs(dot) > 0.2 ? Math.sign(dot) : Math.sign(tx * (f.x - (r.l + r.r) / 2) + ty * (f.y - (r.t + r.b) / 2)) || 1;
            }
            tx *= f.slide; ty *= f.slide; near = true;
            dx += (ax * 1.6 * k + tx * Math.min(1, k)) * SPEED; dy += (ay * 1.6 * k + ty * Math.min(1, k)) * SPEED;
          }
        }
        if (!near) f.slide = 0;
        for (const o of world.others || []) { // keep a little room between friends
          if (o === f) continue; const ox = f.x - o.x, oy = f.y - o.y, od = Math.hypot(ox, oy);
          if (od > 0 && od < R * 3) { dx += ox / od * SPEED * (1 - od / (R * 3)); dy += oy / od * SPEED * (1 - od / (R * 3)); }
        }
        const sp = Math.hypot(dx, dy), cap = SPEED * 1.6; if (sp > cap) { dx = dx / sp * cap; dy = dy / sp * cap; }
        const a = Math.min(1, dt * 3); f.vx += (dx - f.vx) * a; f.vy += (dy - f.vy) * a;
        wantYaw = clamp(f.vx / SPEED, -1, 1) * 0.85;
      }
    }
  }
  f.x += f.vx * dt * (f.pace || 1); f.y += f.vy * dt * (f.pace || 1);
  if (b) { f.x = clamp(f.x, b.l, b.r); f.y = clamp(f.y, b.t, b.b); }
  f.yaw += (wantYaw - f.yaw) * Math.min(1, dt * 5);
  return f;
}

// ---------- the layer ----------
let THREE = null, threeP = null, stage = null, mountP = null, desired = null;
const figures = new Map(); // id -> { brain, spec, obj, parts, born, leaving }
const extras = new Set();  // things other modules mounted into the scene (#16 slogan)
const ui = { cursor: null, zoom: 1, zoomTo: 1, zoomId: null, pinch: null, rects: [], rectsAt: 0, cam: { x: 0, y: 0 } };

export function loadThree() {
  if (!threeP) threeP = import(/* @vite-ignore */ THREE_URL).then((m) => (THREE = m)).catch((e) => { threeP = null; throw e; });
  return threeP;
}
function osStill() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
export function motionStill() { let mine = false; try { mine = localStorage.getItem(MOTION_KEY) === 'still'; } catch (_) {} return osStill() || mine; }

function worldNow() {
  const now = performance.now();
  if (now - ui.rectsAt > 350) { // cards, the open page and the ask box are obstacles
    ui.rectsAt = now;
    const els = [...document.querySelectorAll('#stage > *, .vpage.on, #row, #hints.on')];
    ui.rects = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom }));
  }
  const st = document.getElementById('stage'), sr = st ? st.getBoundingClientRect() : { bottom: innerHeight - 72 };
  const m = R + 16;
  return { bounds: { l: m, t: R * 2.2, r: Math.max(m + 1, innerWidth - m), b: Math.max(R * 2.2 + 1, sr.bottom - m - 10) }, rects: ui.rects };
}
// screen px -> world units (world z = 0 plane maps 1:1 to CSS px at zoom 1; y up)
const toWorld = (x, y) => ({ x: x - innerWidth / 2, y: innerHeight / 2 - y });

function softTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function mountStage3D() {
  if (mountP) return mountP;
  mountP = (async () => {
    await loadThree();
    const canvas = document.createElement('canvas');
    canvas.id = 'void-3d'; canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:0;transition:opacity .6s ease';
    const anchor = document.getElementById('stage');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(canvas, anchor); else document.body.appendChild(canvas);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
    } catch (e) { canvas.remove(); mountP = null; throw e; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
    // soft studio light: cool sky over a warm floor, a warm key from the upper left, a cool rim from behind
    scene.add(new THREE.HemisphereLight(0xcfdcff, 0x3a2340, 1.1));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(-300, 420, 600); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fbcff, 2.2); rim.position.set(260, 180, -500); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd6f0, 0.5); fill.position.set(400, -200, 300); scene.add(fill);
    stage = { THREE, scene, camera, renderer, canvas, raf: 0, last: 0, dirty: true, home: 1000, onResize: null };
    const resize = () => {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      stage.home = (h / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);
      camera.near = stage.home / 50; camera.far = stage.home * 4; camera.updateProjectionMatrix();
      ui.rectsAt = 0; requestRender();
    };
    stage.onResize = resize; resize();
    camera.position.set(0, 0, stage.home);
    bindPointer();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
    addEventListener('void-motion', requestRender);
    try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', requestRender); } catch (_) {}
    window.__void3d = { state: debugState, version: THREE_VERSION };
    requestAnimationFrame(() => { canvas.style.opacity = '1'; });
    return stage;
  })();
  return mountP;
}

function debugState() {
  return { mounted: !!stage, canvas: !!document.getElementById('void-3d'), animating: !!(stage && stage.raf), still: motionStill(), zoom: ui.zoom, zoomTo: ui.zoomTo,
    figures: [...figures.values()].filter((f) => !f.leaving).map((f) => ({ id: f.brain.id, body: f.spec.body || 'sprite', prop: f.spec.prop || null, line: f.spec.line || null, script: f.spec.script || f.brain.script || null, x: Math.round(f.brain.x), y: Math.round(f.brain.y), mode: f.brain.mode, act: f.brain.act, react: f.brain.react || null, blink: f.brain.blinkT > 0, color: f.spec.color || null, kindOf: f.spec.kindOf || null, seed: f.spec.seed ?? null, nature: f.nature || null, climate: f.climate || null })) };
}

// --- the void sprite: a soft, glossy little blob with big shiny eyes, rosy cheeks, a glowing antenna bulb and a wispy tail ---
function buildSprite(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const base = new T.Color(spec.color || PALETTE[0]);
  const light = base.clone().lerp(new T.Color(0xffffff), 0.45), deep = base.clone().multiplyScalar(0.55);
  const skin = new T.MeshPhysicalMaterial({ color: base, roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.28,
    sheen: 0.8, sheenColor: light, sheenRoughness: 0.45, emissive: deep, emissiveIntensity: 0.18 });
  const ink = new T.MeshPhysicalMaterial({ color: 0x0c0b16, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const shine = new T.MeshBasicMaterial({ color: 0xffffff });
  const blush = new T.MeshStandardMaterial({ color: 0xff8fb1, roughness: 0.8, transparent: true, opacity: 0.75, emissive: 0xff5c8a, emissiveIntensity: 0.15 });
  const glow = new T.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd36b, emissiveIntensity: 2.2, roughness: 0.3 });
  const parts = { mats: [skin, ink, shine, blush, glow], geos: [] };
  const geo = (x) => { parts.geos.push(x); return x; };
  const blob = new T.Mesh(geo(new T.SphereGeometry(R, 48, 32)), skin); blob.scale.set(1, 1.04, 0.94); body.add(blob);
  const eyes = new T.Group(); eyes.position.set(0, R * 0.16, R * 0.8); body.add(eyes);
  const eyeGeo = geo(new T.SphereGeometry(R * 0.19, 24, 16)), dotGeo = geo(new T.SphereGeometry(R * 0.055, 10, 8)), dot2 = geo(new T.SphereGeometry(R * 0.028, 8, 6));
  for (const s of [-1, 1]) {
    const e = new T.Group(); e.position.set(s * R * 0.36, 0, 0);
    const ball = new T.Mesh(eyeGeo, ink); ball.scale.set(0.82, 1.12, 0.55); e.add(ball);
    const hi = new T.Mesh(dotGeo, shine); hi.position.set(-R * 0.05, R * 0.08, R * 0.09); e.add(hi);
    const lo = new T.Mesh(dot2, shine); lo.position.set(R * 0.05, -R * 0.06, R * 0.09); e.add(lo);
    eyes.add(e);
  }
  const cheekGeo = geo(new T.SphereGeometry(R * 0.12, 16, 10));
  for (const s of [-1, 1]) { const ch = new T.Mesh(cheekGeo, blush); ch.position.set(s * R * 0.6, -R * 0.08, R * 0.74); ch.scale.set(1, 0.6, 0.3); body.add(ch); }
  const smile = new T.Mesh(geo(new T.TorusGeometry(R * 0.11, R * 0.026, 8, 20, Math.PI)), ink); smile.position.set(0, -R * 0.1, R * 0.93); smile.rotation.z = Math.PI; body.add(smile);
  const antenna = new T.Group(); antenna.position.set(0, R * 0.98, 0); body.add(antenna);
  const stalk = new T.Mesh(geo(new T.CylinderGeometry(R * 0.035, R * 0.055, R * 0.55, 10)), skin); stalk.position.y = R * 0.27; antenna.add(stalk);
  const bulb = new T.Mesh(geo(new T.SphereGeometry(R * 0.15, 20, 14)), glow); bulb.position.y = R * 0.6; antenna.add(bulb);
  const lamp = new T.PointLight(0xffd36b, 1.2, R * 6, 1.6); lamp.position.y = R * 0.6; antenna.add(lamp);
  const arms = [];
  const armGeo = geo(new T.CapsuleGeometry(R * 0.12, R * 0.24, 6, 12));
  for (const s of [-1, 1]) {
    const pivot = new T.Group(); pivot.position.set(s * R * 0.86, -R * 0.12, R * 0.05);
    const arm = new T.Mesh(armGeo, skin); arm.position.set(s * R * 0.12, -R * 0.14, 0); arm.rotation.z = s * 0.55; pivot.add(arm);
    body.add(pivot); arms.push(pivot);
  }
  // a soft teardrop wisp under the body: the sprite floats instead of walking
  const tail = new T.Group(); tail.position.set(0, -R * 0.78, -R * 0.05); body.add(tail);
  const drip = new T.Mesh(geo(new T.SphereGeometry(R * 0.36, 24, 16)), skin); drip.position.y = -R * 0.22; drip.scale.set(0.8, 1.15, 0.8); tail.add(drip);
  const tip = new T.Mesh(geo(new T.SphereGeometry(R * 0.16, 16, 12)), skin); tip.position.set(R * 0.06, -R * 0.62, 0); tail.add(tip);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: softTexture('rgba(255,225,150,0.9)', 'rgba(255,200,90,0)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  halo.scale.set(R * 0.9, R * 0.9, 1); halo.position.y = R * 0.6; antenna.add(halo); parts.mats.push(halo.material);
  // a soft aura behind the body and a soft pool of light below it: the sprite floats in the void
  const auraMat = new T.SpriteMaterial({ map: softTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'), color: base, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.35 });
  const aura = new T.Sprite(auraMat); aura.scale.set(R * 5, R * 5, 1); aura.position.z = -R * 1.5; g.add(aura);
  const poolMat = new T.MeshBasicMaterial({ map: softTexture('rgba(150,170,255,0.32)', 'rgba(150,170,255,0)'), transparent: true, depthWrite: false });
  const pool = new T.Mesh(geo(new T.PlaneGeometry(R * 3.2, R * 0.9)), poolMat); pool.position.set(0, -R * 2.1, -R * 0.5); g.add(pool);
  parts.mats.push(auraMat, poolMat);
  Object.assign(parts, { body, eyes, antenna, arms, tail, aura, pool, lamp, glow });
  return { obj: g, parts };
}

function poseSprite(f, now) {
  const b = f.brain, p = f.parts, still = b.mode === 'still';
  const w = toWorld(b.x, b.y);
  const bob = still ? 0 : Math.sin(b.bob) * 5;
  const hop = still ? 0 : Math.sin(Math.min(1, 1 - b.hop) * Math.PI) * (b.hop > 0 ? 16 : 0);
  // arrival pop and leaving shrink (skipped with less motion)
  let s = 1;
  if (f.leaving) s = Math.max(0, 1 - (now - f.leaving) / 280);
  else if (!still) { const a = Math.min(1, (now - f.born) / 650); s = a >= 1 ? 1 : 1 + Math.sin(a * Math.PI * 1.25) * 0.18 * (1 - a) - (1 - a) * (1 - a) * 0.9; s = Math.max(0.01, s); }
  f.obj.position.set(w.x, w.y + bob + hop, 0);
  const sz = (+f.spec.size || 1) * (f.growth || 1); f.obj.scale.set(s * sz * (+f.spec.wide || 1), s * sz * (+f.spec.tall || 1), s * sz); // this individual's size and build (from its seed)
  p.body.rotation.y = b.yaw + (b.spin > 0 ? (1 - b.spin) * Math.PI * 2 : 0) + b.lookX * 0.25;
  p.body.rotation.x = -b.lookY * 0.18 + (still ? 0 : Math.sin(b.bob * 0.5) * 0.03);
  p.body.rotation.z = still ? 0 : -b.vx / SPEED * 0.12;
  p.body.scale.set(1 + (still ? 0 : Math.sin(b.bob * 2) * 0.015), 1 - (still ? 0 : Math.sin(b.bob * 2) * 0.02), 1);
  if (p.eyes) {
    if (p.eyesBase == null) p.eyesBase = { x: p.eyes.position.x, y: p.eyes.position.y, z: p.eyes.position.z };
    p.eyes.scale.y = b.blinkT > 0 ? 0.12 : 1;
    p.eyes.position.x = p.eyesBase.x + b.lookX * R * 0.12;
    p.eyes.position.y = p.eyesBase.y + b.lookY * R * 0.08;
  }
  if (p.antenna && p.antenna.rotation) {
    p.antenna.rotation.z = still ? 0 : -b.vx / SPEED * 0.35 + Math.sin(b.t * 3.1) * 0.06;
    p.antenna.rotation.x = still ? 0 : Math.sin(b.t * 2.3) * 0.05;
  }
  if (p.glow && p.glow.emissiveIntensity != null) p.glow.emissiveIntensity = (b.mode === 'notice' || b.mode === 'pose') ? 3.2 : 2.2 + (still ? 0 : Math.sin(b.t * 2) * 0.3);
  if (p.lamp && p.glow) p.lamp.intensity = (p.glow.emissiveIntensity || 2) * 0.5;
  const wave = b.wave > 0 ? Math.sin(b.t * 14) * 0.5 + 1.2 : 0;
  if (p.arms && p.arms[0]) p.arms[0].rotation.z = still ? 0 : -Math.sin(b.bob) * 0.18 - (b.mode === 'notice' ? 0.3 : 0);
  if (p.arms && p.arms[1]) p.arms[1].rotation.z = still ? 0 : Math.sin(b.bob) * 0.18 + (b.mode === 'notice' ? 0.3 : 0) + wave;
  if (p.tail && p.tail.rotation) p.tail.rotation.z = still ? 0 : Math.sin(b.t * 2.6) * 0.18 - b.vx / SPEED * 0.25;
  if (p.pool && p.pool.position) { p.pool.position.y = -R * 2.1 - bob - hop; if (p.pool.scale && p.pool.scale.setScalar) p.pool.scale.setScalar(1 - (bob + hop) / 60); }
  if (p.bubble) p.bubble.material.opacity = still ? 1 : 0.97 + Math.sin(b.t * 2) * 0.03; // near-opaque: a see-through bubble read grey and faint
  if (p.bubble) { const half = R * 4.6 + 10; p.bubble.position.x = Math.max(half - b.x, Math.min(R * 3.6, innerWidth - half - b.x)); } // the bubble stays on screen near an edge
  if (p.zombie) poseZombie(f, w, hop, still);
  if (p.creature) poseCreature(f, still);
  if (p.life) poseLife(f, still);
}
// A zombie shambles: a slow, lopsided step (the bad leg dips deeper), a side sway, the head lolling on its own beat,
// the reaching arms bobbing out of step. Every number comes from the seed's gait, so each zombie walks its own way.
function poseZombie(f, w, hop, still) {
  const b = f.brain, p = f.parts, z = p.zombie, G = z.gait;
  p.body.rotation.y += z.turn; // a three-quarter turn: the forward reach and the hunch read from the front camera
  p.eyes.position.copy(p.eyesHome);
  if (still) { p.body.rotation.z = 0; p.head.rotation.set(0, 0, 0); for (const a of p.arms) a.rotation.set(0, 0, 0); return; }
  const moving = Math.min(1, Math.hypot(b.vx, b.vy) / SPEED), ph = b.bob * 1.4 * G.pace + G.phase, step = Math.sin(ph);
  const dip = Math.abs(step) * (step > 0 ? 2 + 4 * G.limp : 1.5) * (0.35 + moving * 0.65);
  f.obj.position.y = w.y + hop - dip;
  p.body.rotation.z = step * G.sway * (0.6 + moving) + (step > 0 ? z.drag * 0.05 * G.limp * moving : 0);
  p.body.rotation.x = Math.abs(step) * 0.05 * moving - b.lookY * 0.08;
  p.head.rotation.z = Math.sin(b.t * 0.7 + G.phase) * G.loll + step * 0.06;
  p.head.rotation.x = 0.08 + Math.sin(b.t * 0.9 + G.phase * 2) * G.loll * 0.6;
  const lift = b.wave > 0 ? -0.5 * Math.min(1, b.wave) : 0, grab = b.mode === 'notice' ? -0.15 : 0; // a tap or the cursor: the arms come up
  p.arms.forEach((a, i) => {
    const hangs = z.hang === (i ? 1 : -1) || z.hang === 2;
    if (z.living) { a.rotation.x = Math.sin(ph + i * Math.PI) * 0.32 * moving + lift; a.rotation.z = 0; return; } // a person: arms swing against the legs
    a.rotation.x = (hangs ? Math.sin(ph + i * Math.PI) * 0.22 * (0.3 + moving) : Math.sin(ph * 0.5 + i * 2.1) * 0.08 + lift + grab);
    a.rotation.z = Math.sin(ph + i) * 0.05;
  });
  if (p.eyeGlow) p.eyeGlow.emissiveIntensity = 0.7 + Math.sin(b.t * 1.3) * 0.15;
}



// ---------- Next #18: base bodies dressed from the card (person, animal, object, place, idea) ----------
function hexColor(c, fallback = PALETTE[0]) {
  if (c == null || c === '') return fallback;
  if (typeof c === 'number') return c;
  const s = String(c).trim();
  if (s[0] === '#') return parseInt(s.slice(1), 16);
  const n = Number(s); return Number.isFinite(n) ? n : fallback;
}
function softMats(baseHex) {
  const T = THREE, base = new T.Color(baseHex), light = base.clone().lerp(new T.Color(0xffffff), 0.45), deep = base.clone().multiplyScalar(0.55);
  const skin = new T.MeshPhysicalMaterial({ color: base, roughness: 0.45, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3,
    sheen: 0.7, sheenColor: light, sheenRoughness: 0.5, emissive: deep, emissiveIntensity: 0.14 });
  const ink = new T.MeshPhysicalMaterial({ color: 0x0c0b16, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const shine = new T.MeshBasicMaterial({ color: 0xffffff });
  const accent = new T.MeshStandardMaterial({ color: light, roughness: 0.5, emissive: base, emissiveIntensity: 0.25 });
  return { base, light, deep, skin, ink, shine, accent, mats: [skin, ink, shine, accent] };
}
function makeEyes(parts, ink, shine, y = R * 0.2, z = R * 0.72) {
  const T = THREE, eyes = new T.Group(); eyes.position.set(0, y, z);
  const eyeGeo = (parts.geos.push(new T.SphereGeometry(R * 0.16, 20, 14)), parts.geos[parts.geos.length - 1]);
  const dotGeo = (parts.geos.push(new T.SphereGeometry(R * 0.045, 10, 8)), parts.geos[parts.geos.length - 1]);
  for (const s of [-1, 1]) {
    const e = new T.Group(); e.position.set(s * R * 0.3, 0, 0);
    const ball = new T.Mesh(eyeGeo, ink); ball.scale.set(0.85, 1.1, 0.55); e.add(ball);
    const hi = new T.Mesh(dotGeo, shine); hi.position.set(-R * 0.04, R * 0.06, R * 0.08); e.add(hi);
    eyes.add(e);
  }
  return eyes;
}
function bubbleTexture(line) {
  const T = THREE, W = 1024, H = 400, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // soft bubble with a tail toward the figure
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  g.fillStyle = 'rgba(250,251,255,0.96)';
  const r = 54, L = 14, Tp = 14, R2 = W - 14, B = H - 84; g.beginPath();
  g.moveTo(L + r, Tp); g.arcTo(R2, Tp, R2, B, r); g.arcTo(R2, B, L, B, r);
  g.lineTo(150, B); g.lineTo(96, H - 16); g.lineTo(196, B); g.arcTo(L, B, L, Tp, r); g.arcTo(L, Tp, R2, Tp, r); g.closePath();
  g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(30,34,60,0.18)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#1b1e2c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  // the biggest type that fits in at most three lines
  let size = 64, lines = [];
  for (; size >= 40; size -= 4) {
    g.font = '600 ' + size + 'px system-ui,-apple-system,Segoe UI,sans-serif';
    const words = String(line || '…').split(/\s+/); lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > W - 120 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    if (lines.length <= 3) break;
  }
  let shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = shown[2].replace(/\s*\S*$/, '') + '…';
  const lh = size * 1.18, midY = (Tp + B) / 2, startY = midY - (shown.length - 1) * lh / 2;
  shown.forEach((ln, i) => g.fillText(ln, W / 2, startY + i * lh));
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function addSpeech(g, parts, line) {
  if (!line) return null;
  const T = THREE, mat = new T.SpriteMaterial({ map: bubbleTexture(line), transparent: true, depthWrite: false, toneMapped: false });
  const sp = new T.Sprite(mat); sp.scale.set(R * 9.2, R * 3.6, 1); sp.position.set(R * 3.6, R * 3.4, R * 0.2);
  g.add(sp); parts.mats.push(mat); parts.bubble = sp; return sp;
}
function buildPropMesh(kind, mats, geos) {
  const T = THREE, g = new T.Group();
  const geo = (x) => { geos.push(x); return x; };
  const accent = mats[3] || mats[0], skin = mats[0], ink = mats[1];
  if (kind === 'mic') {
    const stick = new T.Mesh(geo(new T.CylinderGeometry(R * 0.04, R * 0.05, R * 0.7, 8)), ink); stick.position.y = -R * 0.15; g.add(stick);
    const head = new T.Mesh(geo(new T.SphereGeometry(R * 0.16, 14, 10)), accent); head.position.y = R * 0.28; g.add(head);
  } else if (kind === 'book' || kind === 'quill') {
    const book = new T.Mesh(geo(new T.BoxGeometry(R * 0.42, R * 0.08, R * 0.55)), accent); g.add(book);
    if (kind === 'quill') { const q = new T.Mesh(geo(new T.CylinderGeometry(R * 0.02, R * 0.045, R * 0.7, 6)), skin); q.rotation.z = 0.6; q.position.set(R * 0.2, R * 0.25, 0); g.add(q); }
  } else if (kind === 'hat' || kind === 'wand') {
    const brim = new T.Mesh(geo(new T.CylinderGeometry(R * 0.35, R * 0.35, R * 0.05, 16)), accent); g.add(brim);
    const top = new T.Mesh(geo(new T.CylinderGeometry(R * 0.18, R * 0.22, R * 0.35, 12)), accent); top.position.y = R * 0.2; g.add(top);
  } else if (kind === 'leaf' || kind === 'flower') {
    const leaf = new T.Mesh(geo(new T.SphereGeometry(R * 0.22, 12, 8)), accent); leaf.scale.set(1.4, 0.35, 0.8); g.add(leaf);
  } else if (kind === 'bone' || kind === 'fish') {
    const bone = new T.Mesh(geo(new T.CapsuleGeometry(R * 0.07, R * 0.4, 4, 8)), skin); bone.rotation.z = Math.PI / 2; g.add(bone);
  } else if (kind === 'ball') {
    g.add(new T.Mesh(geo(new T.SphereGeometry(R * 0.2, 14, 10)), accent));
  } else if (kind === 'pin' || kind === 'key' || kind === 'lantern' || kind === 'map') {
    const pin = new T.Mesh(geo(new T.SphereGeometry(R * 0.18, 14, 10)), accent); pin.position.y = R * 0.1; g.add(pin);
    const stem = new T.Mesh(geo(new T.ConeGeometry(R * 0.08, R * 0.35, 8)), ink); stem.position.y = -R * 0.2; g.add(stem);
  } else if (kind === 'flag') {
    const pole = new T.Mesh(geo(new T.CylinderGeometry(R * 0.03, R * 0.03, R * 0.8, 6)), ink); g.add(pole);
    const cloth = new T.Mesh(geo(new T.PlaneGeometry(R * 0.5, R * 0.32)), accent); cloth.position.set(R * 0.28, R * 0.2, 0); g.add(cloth);
  } else if (kind === 'bulb' || kind === 'orbit' || kind === 'cloud') {
    const bulb = new T.Mesh(geo(new T.SphereGeometry(R * 0.22, 16, 12)), accent); g.add(bulb);
    const base = new T.Mesh(geo(new T.CylinderGeometry(R * 0.1, R * 0.12, R * 0.18, 8)), ink); base.position.y = -R * 0.28; g.add(base);
  } else if (kind === 'gear' || kind === 'tag' || kind === 'ribbon' || kind === 'spark' || kind === 'star') {
    const star = new T.Mesh(geo(new T.OctahedronGeometry(R * 0.22, 0)), accent); g.add(star);
  } else {
    g.add(new T.Mesh(geo(new T.SphereGeometry(R * 0.16, 12, 8)), accent));
  }
  return g;
}
function attachProp(bodyGroup, parts, prop, hold = { x: R * 0.95, y: -R * 0.05, z: R * 0.2 }) {
  if (!prop) return null;
  const mesh = buildPropMesh(prop, parts.mats, parts.geos);
  mesh.position.set(hold.x, hold.y, hold.z);
  bodyGroup.add(mesh); parts.prop = mesh; return mesh;
}

// One seamless mesh per living body (skills/sdfmesh.js: blended shapes, surface nets, gradient normals), built once and
// shared as plain arrays; each figure gets its own BufferGeometry of it, so removing one figure never disposes another's.
const SMOOTH = {};
function smoothBody(kind) {
  const m = SMOOTH[kind] || (SMOOTH[kind] = bodyMesh(kind === 'animal' ? ANIMAL(R) : PERSON(R), R));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions.slice(), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals.slice(), 3));
  g.setIndex(new THREE.BufferAttribute(m.indices.slice(), 1));
  g.computeBoundingSphere();
  return g;
}
function buildAnimal(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const col = hexColor(spec.color); const { skin, ink, shine, mats } = softMats(col);
  const parts = { mats, geos: [] }; const geo = (x) => { parts.geos.push(x); return x; };
  // body, chest, neck, head, snout, ears, four legs and the root of the tail are one smooth mesh, centred under the figure
  const fused = new T.Mesh(geo(smoothBody('animal')), skin); fused.position.set(-R * 0.15, R * 0.15, 0); body.add(fused);
  const head = fused, ears = [];
  const eyes = makeEyes(parts, ink, shine, R * 0.8, R * 0.33); eyes.position.x = R * 0.9; eyes.scale.setScalar(0.75); body.add(eyes);
  const tail = new T.Group(); tail.position.set(-R * 1.3, R * 0.57, 0); body.add(tail); // the tip wags from the end of the fused root
  const tip = new T.Mesh(geo(new T.SphereGeometry(R * 0.11, 14, 10)), skin); tip.scale.set(1.6, 0.8, 0.8); tip.position.x = -R * 0.1; tail.add(tip);
  const arms = [];
  for (const z of [R * 0.28, -R * 0.28]) { // the front paws (what "wave" lifts)
    const paw = new T.Group(); paw.position.set(R * 0.35, -R * 0.82, z);
    paw.add(new T.Mesh(geo(new T.SphereGeometry(R * 0.13, 14, 10)), skin)); body.add(paw); arms.push(paw);
  }
  attachProp(body, parts, spec.prop, { x: R * 0.2, y: -R * 0.7, z: R * 0.55 });
  addSpeech(g, parts, spec.line);
  Object.assign(parts, { body, eyes, arms, antenna: head, glow: skin, lamp: { intensity: 0 }, tail, pool: { position: { y: 0 }, scale: { setScalar() {} } }, ears });
  return { obj: g, parts };
}
function buildObject(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const col = hexColor(spec.color); const { skin, ink, shine, accent, mats } = softMats(col);
  const parts = { mats, geos: [] }; const geo = (x) => { parts.geos.push(x); return x; };
  const core = new T.Mesh(geo(new T.BoxGeometry(R * 1.1, R * 1.1, R * 1.1)), skin); core.rotation.y = 0.4; body.add(core);
  const lens = new T.Mesh(geo(new T.CylinderGeometry(R * 0.28, R * 0.35, R * 0.55, 16)), accent); lens.rotation.x = Math.PI / 2; lens.position.z = R * 0.7; body.add(lens);
  const eyes = makeEyes(parts, ink, shine, R * 0.15, R * 0.55); body.add(eyes);
  const arms = [new T.Group(), new T.Group()]; arms.forEach((a, i) => { a.position.set((i ? 1 : -1) * R * 0.7, 0, 0); body.add(a); });
  attachProp(body, parts, spec.prop, { x: R * 0.9, y: R * 0.5, z: 0 });
  addSpeech(g, parts, spec.line);
  Object.assign(parts, { body, eyes, arms, antenna: lens, glow: accent, lamp: { intensity: 0 }, tail: body, pool: { position: { y: 0 }, scale: { setScalar() {} } } });
  return { obj: g, parts };
}
function buildPlace(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const col = hexColor(spec.color); const { skin, ink, shine, accent, mats } = softMats(col);
  const parts = { mats, geos: [] }; const geo = (x) => { parts.geos.push(x); return x; };
  const base = new T.Mesh(geo(new T.CylinderGeometry(R * 1.05, R * 1.15, R * 0.22, 24)), skin); base.position.y = -R * 0.7; body.add(base);
  const tower = new T.Mesh(geo(new T.BoxGeometry(R * 0.7, R * 1.4, R * 0.7)), accent); tower.position.y = R * 0.15; body.add(tower);
  const roof = new T.Mesh(geo(new T.ConeGeometry(R * 0.55, R * 0.5, 4)), ink); roof.position.y = R * 1.1; roof.rotation.y = Math.PI / 4; body.add(roof);
  const eyes = makeEyes(parts, ink, shine, R * 0.35, R * 0.4); body.add(eyes);
  const arms = [new T.Group(), new T.Group()]; arms.forEach((a, i) => { a.position.set((i ? 1 : -1) * R * 0.55, R * 0.1, 0); body.add(a); });
  attachProp(body, parts, spec.prop, { x: R * 0.85, y: R * 0.9, z: 0 });
  addSpeech(g, parts, spec.line);
  Object.assign(parts, { body, eyes, arms, antenna: roof, glow: accent, lamp: { intensity: 0 }, tail: body, pool: { position: { y: 0 }, scale: { setScalar() {} } } });
  return { obj: g, parts };
}
function buildIdea(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const col = hexColor(spec.color); const { skin, ink, shine, accent, mats } = softMats(col);
  const parts = { mats, geos: [] }; const geo = (x) => { parts.geos.push(x); return x; };
  const orb = new T.Mesh(geo(new T.SphereGeometry(R * 0.75, 32, 24)), skin); body.add(orb);
  const ring = new T.Mesh(geo(new T.TorusGeometry(R * 1.05, R * 0.05, 8, 32)), accent); ring.rotation.x = Math.PI / 2.6; body.add(ring);
  const eyes = makeEyes(parts, ink, shine, R * 0.12, R * 0.65); body.add(eyes);
  const arms = [new T.Group(), new T.Group()]; arms.forEach((a, i) => { a.position.set((i ? 1 : -1) * R * 0.9, 0, 0); body.add(a); });
  const glow = accent; glow.emissiveIntensity = 1.4;
  attachProp(body, parts, spec.prop, { x: 0, y: R * 1.15, z: 0 });
  addSpeech(g, parts, spec.line);
  const auraMat = new T.SpriteMaterial({ map: softTexture('rgba(255,255,255,0.65)', 'rgba(255,255,255,0)'), color: new T.Color(col), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.4 });
  const aura = new T.Sprite(auraMat); aura.scale.set(R * 5.5, R * 5.5, 1); g.add(aura); parts.mats.push(auraMat);
  Object.assign(parts, { body, eyes, arms, antenna: ring, glow, lamp: { intensity: 0 }, tail: ring, pool: { position: { y: 0 }, scale: { setScalar() {} } }, aura });
  return { obj: g, parts };
}

// ---------- elements: realistic, no faces. A cumulus cloud of soft lobes with a flatter base, the sun, a campfire,
// a block of ice and a patch of water. What they do comes from CONDITIONS in skills/scripts.js (the cloud rains when it
// is heavy and the air is humid, snows when it is freezing; ice melts above freezing; a flower under rain grows). ----------
function seeded(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function elementParts(body, extra) { return Object.assign({ body, geos: [], mats: [], pool: null }, extra); }
function buildCloud(spec) { // the same seeded cumulus and rain the weather card draws (skills/sky3d.js), at stage size
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const mat = new T.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0 }), geo = cloudGeometry(T);
  body.add(makeCloud(T, { seed: spec.seed || 1, size: R * 4.2, mat, geo }));
  const precip = makePrecip(T, { n: 140, box: { w: R * 3.4, d: R * 1.2, top: -R * 0.3, bottom: -R * 6 }, speed: 260, drop: [0.8, 11], flake: 2.2 });
  g.add(precip.drops, precip.flakes);
  const boltGeo = new T.BufferGeometry(); boltGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(8 * 3), 3));
  const boltMat = new T.LineBasicMaterial({ color: 0xf2f6ff }); const bolt = new T.Line(boltGeo, boltMat); bolt.visible = false; bolt.frustumCulled = false; g.add(bolt);
  const parts = elementParts(body, { kind: 'cloud', mat, precip, bolt, flash: 0 }); parts.geos.push(geo, boltGeo, precip); parts.mats.push(mat, boltMat);
  return { obj: g, parts };
}
function buildSun(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const mat = new T.MeshBasicMaterial({ color: 0xfff1c4 }); const geo = new T.SphereGeometry(R * 0.9, 48, 32);
  body.add(new T.Mesh(geo, mat));
  const halo = makeGlow(T);
  halo.scale.set(R * 5, R * 5, 1); body.add(halo);
  const parts = elementParts(body, { kind: 'sun', halo }); parts.geos.push(geo); parts.mats.push(mat, halo.material);
  return { obj: g, parts };
}
function buildFire(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body); const r = seeded(spec.seed);
  const wood = new T.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.95 }), char = new T.MeshStandardMaterial({ color: 0x1c1512, roughness: 1, emissive: 0x3a0e00, emissiveIntensity: 0.6 });
  const logGeo = new T.CylinderGeometry(R * 0.16, R * 0.18, R * 1.9, 10), stone = new T.DodecahedronGeometry(R * 0.2, 0);
  const parts = elementParts(body, { kind: 'fire', flames: [] }); parts.geos.push(logGeo, stone); parts.mats.push(wood, char);
  for (let i = 0; i < 4; i++) { const l = new T.Mesh(logGeo, i % 2 ? wood : char); l.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2 + r() * 0.3, 0, 'YXZ'); l.position.y = -R * 0.85; body.add(l); }
  for (let i = 0; i < 9; i++) { const st = new T.Mesh(stone, wood); const a = (i / 9) * Math.PI * 2; st.position.set(Math.cos(a) * R * 1.05, -R * 1.25, Math.sin(a) * R * 0.6); st.scale.setScalar(0.8 + r() * 0.5); body.add(st); }
  const flameGeo = new T.ConeGeometry(R * 0.32, R * 1.3, 12, 1, true); parts.geos.push(flameGeo);
  [[0xffd27a, 0.55, 1], [0xff8a2a, 0.75, 1.3], [0xd8401a, 0.95, 1.55]].forEach(([c, w, h], i) => {
    const m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 - i * 0.18, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); parts.mats.push(m);
    for (let j = 0; j < 3; j++) { const f = new T.Mesh(flameGeo, m); f.scale.set(w + r() * 0.2, h, w); f.position.set((j - 1) * R * 0.28, -R * 0.35 + h * R * 0.2, (r() - 0.5) * R * 0.2); body.add(f); parts.flames.push({ f, h, ph: r() * 6 }); }
  });
  return { obj: g, parts };
}
function buildIce(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const mat = new T.MeshPhysicalMaterial({ color: 0xdff2ff, roughness: 0.06, metalness: 0, transmission: 0.92, thickness: R, ior: 1.31, transparent: true, opacity: 0.9, clearcoat: 1 });
  const geo = new T.BoxGeometry(R * 1.3, R * 1.3, R * 1.3, 2, 2, 2);
  const p = geo.attributes.position, r = seeded(spec.seed); for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.94 + r() * 0.1), p.getY(i) * (0.94 + r() * 0.1), p.getZ(i) * (0.94 + r() * 0.1)); geo.computeVertexNormals();
  const block = new T.Mesh(geo, mat); block.rotation.set(0.35, 0.6, 0); body.add(block);
  const wetMat = new T.MeshPhysicalMaterial({ color: 0x9cc8e6, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }), wetGeo = new T.CircleGeometry(R * 1.4, 40);
  const puddle = new T.Mesh(wetGeo, wetMat); puddle.rotation.x = -Math.PI / 2 + 0.35; puddle.position.y = -R * 0.95; puddle.scale.setScalar(0.2); g.add(puddle);
  const parts = elementParts(body, { kind: 'ice', block, puddle }); parts.geos.push(geo, wetGeo); parts.mats.push(mat, wetMat);
  return { obj: g, parts };
}
function buildWater(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const geo = new T.CircleGeometry(R * 2.6, 64), p = geo.attributes.position, r = seeded(spec.seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28]; // a smooth shoreline: a few slow waves round the edge, not noise
  for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), k = 0.9 + 0.07 * Math.sin(2 * a + ph[0]) + 0.04 * Math.sin(3 * a + ph[1]) + 0.025 * Math.sin(5 * a + ph[2]); p.setXY(i, p.getX(i) * k * 1.4, p.getY(i) * k); }
  const mat = new T.MeshPhysicalMaterial({ color: 0x1f5f86, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92 });
  const water = new T.Mesh(geo, mat); water.rotation.x = -Math.PI / 2 + 0.45; body.add(water);
  const parts = elementParts(body, { kind: 'water', water }); parts.geos.push(geo); parts.mats.push(mat);
  return { obj: g, parts };
}
// a real brain (skills/sdfmesh.js brainMesh): seeded folds, darker in the grooves, the wet pinkish grey of fresh tissue
function buildBrain(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const m = brainMesh(R, (spec.seed ?? 1) >>> 0), geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(m.positions, 3)); geo.setAttribute('normal', new T.BufferAttribute(m.normals, 3));
  geo.setAttribute('color', new T.BufferAttribute(m.colors, 3)); geo.setIndex(new T.BufferAttribute(m.indices, 1)); geo.computeBoundingSphere();
  const mat = new T.MeshPhysicalMaterial({ color: 0xd8a6a2, roughness: 0.42, metalness: 0, vertexColors: true, clearcoat: 0.7, clearcoatRoughness: 0.35, sheen: 0.5, sheenColor: new T.Color(0xf2c9c4) });
  const brain = new T.Mesh(geo, mat); brain.rotation.y = -1.15; brain.rotation.x = 0.15; brain.position.y = -R * 0.55; body.add(brain); // three-quarter side: the lobes and the cerebellum read
  const parts = elementParts(body, { kind: 'brain' }); parts.geos.push(geo); parts.mats.push(mat);
  return { obj: g, parts };
}
// real animals (skills/sdfmesh.js CREATURE): species build, seeded proportions and coat, small dark eyes, legs that walk
function creaturePart(m) {
  const T = THREE, g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(m.positions.slice(), 3)); g.setAttribute('normal', new T.BufferAttribute(m.normals.slice(), 3));
  g.setAttribute('color', new T.BufferAttribute(m.colors, 3)); g.setIndex(new T.BufferAttribute(m.indices.slice(), 1)); g.computeBoundingSphere();
  return g;
}
function buildCreature(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const C = creatureMesh(R, (spec.seed ?? 1) >>> 0, spec.kindOf), rig = C.rig;
  const fur = new T.MeshPhysicalMaterial({ color: rig.coat, roughness: rig.kind === 'mouse' ? 0.7 : 0.85, vertexColors: true, sheen: 1, sheenRoughness: 0.6, sheenColor: new T.Color(rig.coat).lerp(new T.Color(0xffffff), 0.4) });
  const eyeMat = new T.MeshPhysicalMaterial({ color: rig.kind === 'cat' ? 0x9a8a2a : 0x14100c, roughness: 0.05, clearcoat: 1 }), noseMat = new T.MeshStandardMaterial({ color: rig.kind === 'mouse' || rig.kind === 'rabbit' ? 0xc98a8a : 0x241c1a, roughness: 0.4 });
  const parts = { mats: [fur, eyeMat, noseMat], geos: [] }; const geo = (x) => { parts.geos.push(x); return x; };
  const torso = new T.Mesh(geo(creaturePart(C.body)), fur); body.add(torso);
  const eyeGeo = geo(new T.SphereGeometry(rig.eyeR, 14, 10)), eyes = new T.Group();
  for (const e of rig.eyes) { const m = new T.Mesh(eyeGeo, eyeMat); m.position.set(...e); eyes.add(m); } body.add(eyes);
  const nose = new T.Mesh(geo(new T.SphereGeometry(rig.eyeR * 0.9, 12, 8)), noseMat); nose.position.set(...rig.nose); nose.scale.set(0.8, 0.7, 1.1); body.add(nose);
  const legs = rig.legs.map((l) => { const pv = new T.Group(); pv.position.set(...l.pivot); const gm = creaturePart(C[l.part]); gm.translate(-l.pivot[0], -l.pivot[1], -l.pivot[2]); pv.add(new T.Mesh(geo(gm), fur)); body.add(pv); return pv; });
  let tail = null; if (C.tail) { tail = new T.Group(); tail.position.set(...rig.tailRoot); const gm = creaturePart(C.tail); gm.translate(-rig.tailRoot[0], -rig.tailRoot[1], -rig.tailRoot[2]); tail.add(new T.Mesh(geo(gm), fur)); body.add(tail); }
  addSpeech(g, parts, spec.line);
  Object.assign(parts, { body, eyes: null, arms: [], antenna: null, glow: null, lamp: { intensity: 0 }, tail, pool: null, creature: rig, legs });
  return { obj: g, parts };
}
// a four-legged walk: diagonal pairs swing together, the tail sways (a cat's slow, a dog's quick), held still when still
function poseCreature(f, still) {
  const b = f.brain, p = f.parts, G = p.creature.gait, moving = Math.min(1, Math.hypot(b.vx, b.vy) / SPEED);
  p.body.rotation.y = b.vx < 0 ? Math.PI : 0; // it faces the way it walks
  p.body.rotation.z = 0; p.body.rotation.x = 0;
  const ph = b.bob * 2.2 * G.pace + G.phase, amp = still ? 0 : 0.5 * moving;
  p.legs.forEach((l, i) => { l.rotation.z = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * amp; });
  if (p.tail) p.tail.rotation.y = still ? 0 : Math.sin(b.t * (p.creature.kind === 'dog' ? 9 : 2.2) + G.phase) * (p.creature.kind === 'dog' ? 0.5 : 0.25);
}
// real foods (skills/sdfmesh.js foodField): a bone, a wedge of cheese, a carrot, a banana; colour lives in the vertices
function buildFood(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const m = foodMesh(R, (spec.seed ?? 1) >>> 0, spec.kindOf), geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(m.positions, 3)); geo.setAttribute('normal', new T.BufferAttribute(m.normals, 3));
  geo.setAttribute('color', new T.BufferAttribute(m.colors, 3)); geo.setIndex(new T.BufferAttribute(m.indices, 1)); geo.computeBoundingSphere();
  const k = spec.kindOf, mat = new T.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: k === 'banana' ? 0.45 : k === 'cheese' ? 0.6 : k === 'carrot' ? 0.55 : 0.75, clearcoat: k === 'banana' ? 0.3 : 0, sheen: k === 'carrot' ? 0.3 : 0 });
  const mesh = new T.Mesh(geo, mat); mesh.rotation.y = -0.5; body.add(mesh);
  const parts = elementParts(body, { kind: k }); parts.geos.push(geo); parts.mats.push(mat);
  return { obj: g, parts };
}
// fish, sharks, bees and flowers (skills/sdfmesh.js lifeParts): coloured in the vertices; a tail that sweeps, wings that beat
function buildLife(spec) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const M = lifeMesh(R, (spec.seed ?? 1) >>> 0, spec.kindOf), info = M.info, k = info.kind;
  const mat = new T.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: k === 'fish' || k === 'shark' ? 0.3 : 0.6, clearcoat: k === 'fish' ? 0.8 : 0.2, sheen: k === 'bee' ? 1 : 0, sheenColor: new T.Color(0xf2d27a) });
  const wingMat = new T.MeshPhysicalMaterial({ color: 0xdfe8ef, transparent: true, opacity: 0.35, roughness: 0.1, side: T.DoubleSide, depthWrite: false });
  const parts = { mats: [mat, wingMat], geos: [] };
  const part = (name, m) => { const geo = creaturePart(M[name]); const at = info.pivots[name]; if (at) geo.translate(-at[0], -at[1], -at[2]); parts.geos.push(geo);
    const mesh = new T.Mesh(geo, name.startsWith('wing') ? wingMat : mat); if (!at) { body.add(mesh); return mesh; } const pv = new T.Group(); pv.position.set(...at); pv.add(mesh); body.add(pv); return pv; };
  part('body');
  const tail = M.tail ? part('tail') : null, wings = ['wingL', 'wingR'].filter((n) => M[n]).map((n) => part(n));
  if (info.eye) { const eyeMat = new T.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.05, clearcoat: 1 }), eg = new T.SphereGeometry(info.eyeR, 12, 8); parts.mats.push(eyeMat); parts.geos.push(eg);
    for (const zs of [1, -1]) { const e = new T.Mesh(eg, eyeMat); e.position.set(info.eye[0], info.eye[1], zs * info.eye[2]); body.add(e); } }
  Object.assign(parts, { body, eyes: null, arms: [], antenna: null, glow: null, lamp: { intensity: 0 }, tail: null, pool: null, life: { kind: k, tail, wings, swim: info.swim, fly: info.fly } });
  return { obj: g, parts };
}
function poseLife(f, still) {
  const b = f.brain, L = f.parts.life;
  if (L.swim || L.fly) f.parts.body.rotation.y = b.vx < 0 ? Math.PI : 0;
  if (L.tail) L.tail.rotation.y = still ? 0 : Math.sin(b.t * (L.kind === 'shark' ? 3 : 7)) * 0.45;
  for (const [i, w] of L.wings.entries()) w.rotation.x = still ? 0 : Math.sin(b.t * 60) * 0.7 * (i ? -1 : 1);
  if (L.kind === 'flower') f.parts.body.rotation.set(0, 0, still ? 0 : Math.sin(b.t * 0.9) * 0.04); // a slight sway in the air
  if (L.fly && !still) f.obj.position.y += Math.sin(b.t * 5) * 3;
}
const ELEMENTS = { cloud: buildCloud, sun: buildSun, fire: buildFire, ice: buildIce, water: buildWater, brain: buildBrain, cat: buildCreature, dog: buildCreature, mouse: buildCreature, rabbit: buildCreature, monkey: buildCreature, bone: buildFood, cheese: buildFood, carrot: buildFood, banana: buildFood, fish: buildLife, shark: buildLife, bee: buildLife, flower: buildLife };
// run a thing's conditions for one frame and show the result: rain, snow and lightning, a darkening cloud, melting ice,
// a flower growing under the rain. Returns true while something is visibly happening.
function stepElement(f, dt, now, still, others) {
  const kind = f.spec.kindOf, cond = CONDITIONS[kind]; if (!cond) return false;
  if (!f.nature) f.nature = cond.start();
  const env = climateAt({ id: f.brain.id, x: f.brain.x, y: f.brain.y }, others);
  f.nature = cond.step(f.nature, env, dt); f.climate = env;
  const p = f.parts, st = f.nature;
  if (kind === 'cloud' && p.mat) {
    p.mat.color.set(cloudShade(st.water));
    p.precip.set(st.falling); if (p.precip.on) p.precip.step(still ? 0 : dt, now / 1000);
    // a storm: lightning now and then (never with less motion)
    if (st.storm && !still && p.flash <= 0 && Math.random() < dt * 0.35) {
      p.flash = 0.18; const b = p.bolt.geometry.attributes.position; let x = (Math.random() - 0.5) * R * 2, y = -R * 0.4;
      for (let i = 0; i < 8; i++) { b.setXYZ(i, x, y, R * 0.6); x += (Math.random() - 0.5) * R * 0.9; y -= R * 0.75; } b.needsUpdate = true;
    }
    p.flash = Math.max(0, p.flash - dt); p.bolt.visible = p.flash > 0; p.mat.emissiveIntensity = p.flash > 0 ? 0.6 : 0;
    return !!st.falling || p.flash > 0;
  }
  if (kind === 'ice' && p.block) {
    const k = Math.max(0.02, Math.cbrt(1 - st.melt)); p.block.scale.setScalar(k); p.block.position.y = -R * 0.65 * (1 - k); p.puddle.scale.setScalar(0.2 + st.melt * 0.9);
    if (st.gone && !f.leaving) f.leaving = now;
    return st.melt > 0 && st.melt < 1;
  }
  if (kind === 'flower') { const g = 1 + st.grow * 0.7; f.growth = g; return env.rainedOn; }
  return false;
}
// ---------- a zombie: its own seeded body (skills/sdfmesh.js ZOMBIE), so each summon is a new individual ----------
export const isZombie = (spec) => !!spec && (spec.kindOf === 'zombie' || /\b(?:zombies?|undead|ghouls?)\b/i.test(spec.title || ''));
// the seed the figure carries; an older figure without one gets a steady seed from its id, so it looks the same after a reload
export function seedOf(spec) {
  if (spec.seed != null && Number.isFinite(Number(spec.seed))) return Number(spec.seed) >>> 0;
  let h = 2166136261; for (const ch of String(spec.id || spec.title || 'zombie')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function zombiePart(rig, part, m, at) {
  const T = THREE, { indices, groups, colors } = zombieGroups(rig, part, m), g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(m.positions.slice(), 3));
  g.setAttribute('normal', new T.BufferAttribute(m.normals.slice(), 3));
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  g.setIndex(new T.BufferAttribute(indices, 1));
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.mat);
  if (at) g.translate(-at[0], -at[1], -at[2]); // hang the part from its pivot (the neck, a shoulder)
  g.computeBoundingSphere();
  return g;
}
// a person from a card ("who is Marie Curie") is the same seeded adult body, alive: upright, whole, clean, the card's
// colour on the shirt, natural skin, clear eyes, an even walk (skills/sdfmesh.js ZOMBIE with living = true)
function buildPerson(spec) { return buildZombie(spec, true); }
function buildZombie(spec, living = false) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const Z = zombieMesh(R, seedOf(spec), 52, living), rig = Z.rig, col = rig.skin; // the seed's own skin: realistic, never the summon's flat colour
  // matte, mottled skin (the blotches are vertex colours) with a faint red sheen for blood under the skin; dull, stained cloth
  const skin = new T.MeshPhysicalMaterial({ color: col, roughness: living ? 0.6 : 0.8, metalness: 0, vertexColors: true, sheen: 0.4, sheenColor: new T.Color(living ? 0xe8b0a0 : 0x8a3b36), sheenRoughness: 0.75,
    emissive: new T.Color(col).multiplyScalar(0.05), emissiveIntensity: 1 }); // a little self-light only: more reads as plastic
  const shirtHex = living && spec.color ? hexColor(spec.color, rig.shirt) : rig.shirt;
  const shirt = new T.MeshStandardMaterial({ color: shirtHex, roughness: 0.95, vertexColors: true, emissive: new T.Color(shirtHex).multiplyScalar(0.1) });
  const pants = new T.MeshStandardMaterial({ color: rig.pants, roughness: 0.95, vertexColors: true, emissive: new T.Color(rig.pants).multiplyScalar(0.1) });
  const raw = new T.MeshStandardMaterial({ color: 0x2a0d10, roughness: 0.55, vertexColors: true });
  const set = [skin, shirt, pants, raw], parts = { mats: set.slice(), geos: [] }; const geo = (x) => { parts.geos.push(x); return x; };
  body.add(new T.Mesh(geo(zombiePart(rig, 'body', Z.body)), set));
  const head = new T.Group(); head.position.set(...rig.neck); body.add(head);
  head.add(new T.Mesh(geo(zombiePart(rig, 'head', Z.head, rig.neck)), set));
  if (rig.hair != null) { // hair: a cap over the crown and the back of the head, in a seeded natural colour
    const hairMat = new T.MeshPhysicalMaterial({ color: rig.hair, roughness: 0.55, sheen: 1, sheenColor: new T.Color(rig.hair).lerp(new T.Color(0xffffff), 0.3) }); parts.mats.push(hairMat);
    const cap = new T.Mesh(geo(new T.SphereGeometry(rig.headR * 1.04, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairMat);
    cap.position.set(rig.head[0] - rig.neck[0], rig.head[1] - rig.neck[1] + rig.headR * 0.12, rig.head[2] - rig.neck[2] - rig.headR * 0.08); cap.scale.set(0.9, 1.15, 1.02); cap.rotation.x = -0.35; head.add(cap);
  }
  // eyes sit deep in the dark sockets: pale and clouded, almost lost in shadow, or a faint green glow
  const eyeMat = rig.eyeKind === 3 ? new T.MeshPhysicalMaterial({ color: 0x2b2018, roughness: 0.05, clearcoat: 1 }) : rig.eyeKind === 2 ? new T.MeshStandardMaterial({ color: 0x9fe08a, emissive: 0x6fdc4a, emissiveIntensity: 0.7, roughness: 0.4 })
    : new T.MeshStandardMaterial({ color: rig.eyeKind === 0 ? 0xc9cbbf : 0x4a4038, roughness: 0.35, emissive: rig.eyeKind === 0 ? 0x2a2c26 : 0x000000 });
  parts.mats.push(eyeMat);
  const eyes = new T.Group(), ball = geo(new T.SphereGeometry(rig.headR * 0.17, 10, 8));
  for (const e of rig.eyes) { const m = new T.Mesh(ball, eyeMat); m.position.set(e[0] - rig.neck[0], e[1] - rig.neck[1], e[2] - rig.neck[2] - rig.headR * 0.06); eyes.add(m); }
  head.add(eyes);
  const arms = ['armL', 'armR'].map((k, i) => {
    const S = rig.shoulders[i], pivot = new T.Group(); pivot.position.set(...S);
    pivot.add(new T.Mesh(geo(zombiePart(rig, k, Z[k], S)), set)); body.add(pivot); return pivot;
  });
  attachProp(body, parts, spec.prop, { x: rig.hands[1][0], y: rig.hands[1][1], z: rig.hands[1][2] });
  addSpeech(g, parts, spec.line);
  // a dim aura in the skin colour, so a grey body still reads on the black stage
  const auraMat = new T.SpriteMaterial({ map: softTexture('rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'), color: new T.Color(col), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.16 });
  const aura = new T.Sprite(auraMat); aura.scale.set(R * 4.5, R * 4.5, 1); aura.position.z = -R; g.add(aura); parts.mats.push(auraMat);
  Object.assign(parts, { body, head, eyes, eyesHome: eyes.position.clone(), arms, antenna: null, glow: null, eyeGlow: rig.eyeKind === 2 ? eyeMat : null, lamp: { intensity: 0 }, tail: null, pool: null, aura, zombie: rig });
  return { obj: g, parts };
}

function buildFigure(spec) {
  if (ELEMENTS[spec.kindOf]) return ELEMENTS[spec.kindOf](spec);
  if (isZombie(spec)) return buildZombie(spec);
  const body = String(spec.body || 'sprite').toLowerCase();
  if (body === 'person') return buildPerson(spec);
  if (body === 'animal') return buildAnimal(spec);
  if (body === 'object') return buildObject(spec);
  if (body === 'place') return buildPlace(spec);
  if (body === 'idea') return buildIdea(spec);
  // sprite: keep the void buddy; still dress a speech line / prop when a card brought them
  const built = buildSprite(spec);
  if (spec.prop) attachProp(built.parts.body, built.parts, spec.prop);
  if (spec.line) addSpeech(built.obj, built.parts, spec.line);
  return built;
}

export async function addFigure(spec = {}) {
  await mountStage3D();
  const id = spec.id || 'fig_' + Math.random().toString(36).slice(2, 8);
  if (figures.has(id)) return figures.get(id);
  const n = figures.size, color = spec.color || PALETTE[n % PALETTE.length];
  const body = spec.body || 'sprite';
  const script = spec.script ? trimScript(spec.script, body, spec.title || null) : null;
  const brain = makeBrain({ id, x: spec.x, y: spec.y, body, script, title: spec.title || null, pace: spec.pace || 1 });
  if (spec.x == null || spec.y == null) { // a free spot away from cards and from the friends already here
    const w = worldNow(), near = [...figures.values()].map((o) => ({ l: o.brain.x - R * 2, r: o.brain.x + R * 2, t: o.brain.y - R * 2, b: o.brain.y + R * 2 }));
    const p = pickTarget({ ...w, rects: w.rects.concat(near) }); brain.x = brain.tx = p.x; brain.y = brain.ty = p.y;
  }
  const { obj, parts } = buildFigure({ ...spec, body, color });
  const f = { brain, spec: { ...spec, id, body, color: spec.color || null, prop: spec.prop || null, line: spec.line || null, script: script || null, title: spec.title || null }, obj, parts, born: performance.now(), leaving: 0 };
  stage.scene.add(obj); figures.set(id, f); poseSprite(f, f.born); requestRender();
  return f;
}
function disposeFigure(f) {
  stage.scene.remove(f.obj);
  for (const g of f.parts.geos) g.dispose && g.dispose();
  for (const m of f.parts.mats) { if (m.map && m.map.dispose) m.map.dispose(); m.dispose && m.dispose(); }
}
export function removeFigures(ids) {
  if (!stage) return 0;
  let n = 0; const now = performance.now(), still = motionStill();
  for (const [id, f] of figures) {
    if (ids && !ids.includes(id)) continue;
    if (f.leaving) continue; n += 1;
    if (ui.zoomId === id) { ui.zoomId = null; ui.zoomTo = 1; }
    if (still) { disposeFigure(f); figures.delete(id); } else f.leaving = now;
  }
  requestRender();
  return n;
}
export async function syncFigures(list) {
  desired = (list || []).map((t) => ({ id: t.id, body: t.body || 'sprite', color: t.color || null, prop: t.prop || null, line: t.line || null, script: t.script || null, title: t.title || null, x: t.sx, y: t.sy, seed: t.seed ?? null, kindOf: t.kindOf || null, size: t.size || null, wide: t.wide || null, tall: t.tall || null, pace: t.pace || null }));
  if (!desired.length && !stage) return;
  await mountStage3D();
  const want = desired, ids = want.map((d) => d.id);
  removeFigures([...figures.keys()].filter((id) => !ids.includes(id)));
  for (const d of want) {
    const f = figures.get(d.id);
    if (f && f.leaving) { disposeFigure(f); figures.delete(d.id); }
    if (!figures.has(d.id)) { const v = d.size ? {} : variation(d.seed ?? hashId(d.id)); // every figure is an individual, even ones summoned without a look
      await addFigure({ id: d.id, body: d.body, color: d.color || undefined, prop: d.prop || undefined, line: d.line || undefined, script: d.script || undefined, title: d.title || undefined, size: d.size || v.size, wide: d.wide || v.wide, tall: d.tall || v.tall, pace: d.pace || v.pace, seed: d.seed ?? undefined, kindOf: d.kindOf || undefined }); }
    else {
      if (d.script && (!f.spec.script || JSON.stringify(f.spec.script) !== JSON.stringify(d.script))) {
        const sc = trimScript(d.script, d.body || 'sprite', d.title || null);
        f.spec.script = sc; f.brain.script = sc;
      }
      if ((f.spec.color || null) !== (d.color || null)) { // "make everything blue" reaches figures too
        f.spec.color = d.color; const c = new THREE.Color(d.color || PALETTE[0]); f.parts.mats[0].color.copy(c); if (f.parts.mats[0].sheenColor) f.parts.mats[0].sheenColor.copy(c.clone().lerp(new THREE.Color(0xffffff), 0.45)); requestRender();
      }
    }
  }
}
/** "zoom in on the figure": glide the camera toward one figure. level 0 = the whole stage, 3 = a close-up. */
export function zoomToFigure(id, level) {
  const live = [...figures.values()].filter((f) => !f.leaving), f = (id && figures.get(id)) || live[live.length - 1];
  if (!f) return null;
  const lv = Math.max(0, Math.min(3, Number(level) || 0));
  ui.zoomId = lv > 0 ? f.brain.id : null;
  ui.zoomTo = [1, 1.8, 2.7, 3.8][lv];
  if (motionStill()) ui.zoom = ui.zoomTo;
  requestRender();
  return ui.zoomTo;
}
export async function mountInScene(mounter) {
  const s = await mountStage3D();
  const api = { THREE, scene: s.scene, camera: s.camera, renderer: s.renderer, toWorld, still: motionStill, requestRender };
  const handle = (mounter && mounter(api)) || {};
  extras.add(handle); requestRender();
  return () => { extras.delete(handle); try { handle.dispose && handle.dispose(); } catch (_) {} requestRender(); };
}

// --- pointer: cards keep every event; only a pointer over a figure (on the bare stage) reaches it ---
function onBareStage(e) {
  const t = e.target; if (!t || !t.closest) return true;
  return t.id === 'stage' || t === document.body || t === document.documentElement || t.id === 'void-3d';
}
function figureAt(x, y) {
  const k = ui.zoom, cam = camFor(k); let hit = null, best = Infinity;
  for (const f of figures.values()) {
    if (f.leaving) continue;
    // while zoomed the camera dollies in (k times bigger) and glides over the focused figure (ui.cam, in world units)
    const w = toWorld(f.brain.x, f.brain.y), sx = innerWidth / 2 + (w.x - cam.x) * k, sy = innerHeight / 2 - (w.y - cam.y) * k, d = Math.hypot(x - sx, y - sy);
    if (d < R * 1.5 * k && d < best) { best = d; hit = f; }
  }
  return hit;
}
// where the camera looks at a given zoom: over the focused figure, reached by zoom 2 (world units)
function camFor(k) {
  const z = ui.zoomId && figures.get(ui.zoomId); if (!z || k <= 1) return { x: 0, y: 0 };
  const fw = toWorld(z.brain.x, z.brain.y), m = Math.min(1, k - 1);
  return { x: fw.x * m, y: (fw.y + R * 0.3) * m };
}
let pointerBound = false;
function bindPointer() {
  if (pointerBound) return; pointerBound = true;
  const st = document.getElementById('stage');
  addEventListener('pointermove', (e) => {
    ui.cursor = { x: e.clientX, y: e.clientY };
    const over = onBareStage(e) && figureAt(e.clientX, e.clientY);
    if (st) st.style.cursor = over ? 'pointer' : '';
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ui.cursor = null; });
  addEventListener('blur', () => { ui.cursor = null; });
  addEventListener('pointerdown', (e) => {
    if (!onBareStage(e)) return;
    const f = figureAt(e.clientX, e.clientY);
    if (f) { f.brain.hop = 1; f.brain.wave = 1; requestRender(); } // a tap says hello back
    else if (ui.zoomTo > 1) { ui.zoomTo = 1; requestRender(); }   // a tap on the bare void steps back out
  }, true);
  const zoomBy = (f, factor) => {
    if (f && ui.zoomId !== f.brain.id) { if (ui.zoom > 1.02) return; ui.zoomId = f.brain.id; }
    ui.zoomTo = clamp(ui.zoomTo * factor, 1, MAX_ZOOM);
    if (ui.zoomTo <= 1.001) ui.zoomTo = 1;
    if (motionStill()) ui.zoom = ui.zoomTo;
    requestRender();
  };
  addEventListener('wheel', (e) => { // wheel, or a trackpad pinch (ctrl+wheel), over a figure zooms toward it
    const zoomed = ui.zoomTo > 1;
    if (!onBareStage(e) && !(zoomed && !e.target.closest('.vpage, #dock'))) return;
    const f = (zoomed && figures.get(ui.zoomId)) || figureAt(e.clientX, e.clientY); // once zoomed, the wheel keeps steering that figure
    if (!f) return;
    e.preventDefault();
    zoomBy(f, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
  }, { passive: false });
  addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2 || !onBareStage(e)) return;
    const [a, b] = e.touches, mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
    const f = figureAt(mx, my) || figureAt(a.clientX, a.clientY) || figureAt(b.clientX, b.clientY);
    if (f) { ui.pinch = { f, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, z: ui.zoomTo }; e.preventDefault(); }
  }, { passive: false });
  addEventListener('touchmove', (e) => {
    if (!ui.pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    ui.zoomTo = ui.pinch.z; zoomBy(ui.pinch.f, d / ui.pinch.d);
  }, { passive: false });
  addEventListener('touchend', () => { if (ui.pinch) ui.pinch = null; });
}

// --- the loop: runs only while something moves; with less motion the scene draws once per change ---
export function requestRender() {
  if (!stage) return;
  stage.dirty = true;
  if (!stage.raf) stage.raf = requestAnimationFrame(frame);
}
function frame(ts) {
  stage.raf = 0;
  if (document.hidden) return;
  const now = performance.now(), dt = stage.last ? Math.min(0.1, (now - stage.last) / 1000) : 1 / 60; stage.last = now;
  const still = motionStill(), world = worldNow();
  world.still = still; world.cursor = ui.cursor; world.others = [...figures.values()].map((f) => f.brain);
  let moving = false;
  const elems = [...figures.values()].filter((f) => f.spec.kindOf && !f.leaving).map((f) => ({ id: f.brain.id, x: f.brain.x, y: f.brain.y, kind: f.spec.kindOf, state: f.nature || null }));
  for (const [id, f] of figures) {
    if (f.leaving && now - f.leaving > 300) { disposeFigure(f); figures.delete(id); continue; }
    if (f.brain.chasedOff && !f.leaving) { // Next #20: a chase that caught this figure sends them off
      if (still) { disposeFigure(f); figures.delete(id); continue; }
      f.leaving = now; f.brain.chasedOff = false;
    }
    stepFigure(f.brain, dt, { ...world, posing: ui.zoomId === id && ui.zoomTo > 1 });
    poseSprite(f, now);
    if (f.spec.kindOf && CONDITIONS[f.spec.kindOf] && !f.leaving && stepElement(f, dt, now, still, elems)) moving = true;
    if (!still || f.leaving) moving = true;
  }
  // zoom: dolly the camera in and glide over the focused figure, so it grows and comes to the middle of the screen
  if (!figures.has(ui.zoomId)) { ui.zoomId = null; ui.zoomTo = 1; }
  ui.zoom = still ? ui.zoomTo : ui.zoom + (ui.zoomTo - ui.zoom) * Math.min(1, dt * 7);
  if (Math.abs(ui.zoom - ui.zoomTo) < 0.002) ui.zoom = ui.zoomTo; else moving = true;
  ui.cam = camFor(ui.zoom);
  stage.camera.position.set(ui.cam.x, ui.cam.y, stage.home / ui.zoom);
  for (const x of extras) { try { if (x.update) { x.update(dt, now / 1000); if (!still) moving = true; } } catch (_) {} }
  stage.renderer.render(stage.scene, stage.camera);
  stage.dirty = false;
  const empty = !figures.size && !extras.size;
  if (!figures.size) { ui.zoom = ui.zoomTo = 1; ui.zoomId = null; }
  stage.canvas.style.opacity = empty ? '0' : '1';
  stage.canvas.style.zIndex = ui.zoom > 1.05 ? '2' : '0'; // zoomed in, the figure comes in front of the cards; the ask box stays on top
  if (moving && !empty) stage.raf = requestAnimationFrame(frame);
  else stage.last = 0;
}

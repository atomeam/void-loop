/**
 * ringer skill — Ringer, the schoolyard marble game, single player (frontier build-order step 5): "play marbles",
 * "marbles", "shoot marbles", "ringer". "star marbles" stays with Aggravation. Thirteen glass marbles in a cross inside a
 * chalk ring on the dirt; aim the shooter, set the power, flick, and knock them out of the ring in as few shots as you can.
 * Behaviour is skills/ringer-rules.js (pure, tested alone); the look is figures.js marbleLook (seeded, every marble its
 * own); this card keeps the one state (th.state), steps it while marbles roll, and the flat board and the 3D ring
 * (mini/ringer.js, lifted by lift3d) both pose themselves from it.
 */
import * as R from './ringer-rules.js';
import { marbleLook } from './figures.js';
import { lift3d } from './lift3d.js';

export function ringerOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new|shoot)?\s*(?:(?:a|some)\s+)?(?:game\s+of\s+)?(?:ringer(?:\s+marbles)?|marbles(?:\s+ringer)?)(?:\s+game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t) ? { kind: 'ringer' } : null;
}

const loops = new Map(); // th.id -> the frame loop stepping a roll, so a re-render never runs two
const PX = 360, SPAN = R.RING + 0.05; // the flat board shows the ring and a little dirt round it

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = R.create((Math.random() * 4294967296) >>> 0);
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card ringer-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(400px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Ringer</span><span class="g-sub">knock the marbles out of the ring</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board ringer-board';
  const cv = document.createElement('canvas'); cv.width = PX; cv.height = PX; cv.className = 'ringer-flat';
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'the ring seen from above: tap where to aim');
  cv.style.cssText = 'width:100%;height:auto;display:block;border-radius:10px;touch-action:none;cursor:crosshair';
  wrap.appendChild(cv);
  const save = () => stageApi.save && stageApi.save();
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const controls = document.createElement('div'); controls.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px';
  const powerLabel = document.createElement('label'); powerLabel.style.cssText = 'display:flex;gap:6px;align-items:center;font-size:12px';
  powerLabel.textContent = 'Power';
  const power = stop(document.createElement('input')); power.type = 'range'; power.min = '0'; power.max = '100'; power.className = 'ringer-power'; power.setAttribute('aria-label', 'flick power');
  powerLabel.appendChild(power);
  const flickBtn = stop(document.createElement('button')); flickBtn.type = 'button'; flickBtn.className = 'g-btn g-primary ringer-flick'; flickBtn.textContent = 'Flick';
  const again = stop(document.createElement('button')); again.type = 'button'; again.className = 'g-btn ringer-new'; again.textContent = 'New game';
  controls.append(powerLabel, flickBtn, again);
  const status = document.createElement('div'); status.className = 'g-status ringer-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';

  const commit = (next, persist = true) => { if (next === th.state) return; th.state = next; if (persist) save(); paint(); };
  const aimAt = (x, y) => commit(R.aimAt(th.state, x, y), false);
  // drag to flick (the 3D ring): the pull sets aim and power through the rules; letting go flicks, unless the pull was too short
  let pulled = false;
  const pullTo = (x, y) => { pulled = R.pullLength(th.state, x, y) >= R.PULL_MIN; commit(R.pull(th.state, x, y), false); };
  const release = () => { if (pulled) doFlick(); else save(); pulled = false; };
  const doFlick = () => { const n = R.flick(th.state); if (n === th.state) return; commit(n); roll(); };
  power.addEventListener('input', () => commit(R.setPower(th.state, +power.value / 100), false));
  power.addEventListener('change', save);
  flickBtn.addEventListener('click', (e) => { e.stopPropagation(); doFlick(); });
  again.addEventListener('click', (e) => { e.stopPropagation(); cancelAnimationFrame(loops.get(th.id)); loops.delete(th.id); commit(R.newGame(th.state, (Math.random() * 4294967296) >>> 0)); }); // keeps the best clear
  const toWorld = (ev) => { const b = cv.getBoundingClientRect(); return [((ev.clientX - b.left) / b.width * 2 - 1) * SPAN, -((ev.clientY - b.top) / b.height * 2 - 1) * SPAN]; };
  cv.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    aimAt(...toWorld(e));
    const move = (ev) => aimAt(...toWorld(ev));
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); save(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });

  // a roll: step the one state every frame until everything stops (the 3D ring reads the same state each frame)
  function roll() {
    if (loops.has(th.id) || th.state.phase !== 'rolling') return;
    let last = performance.now();
    const frame = (now) => {
      if (!el.isConnected) { loops.delete(th.id); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      th.state = R.step(th.state, dt);
      paint();
      if (th.state.phase === 'rolling') loops.set(th.id, requestAnimationFrame(frame));
      else { loops.delete(th.id); save(); }
    };
    loops.set(th.id, requestAnimationFrame(frame));
  }

  const g = cv.getContext('2d'), k = PX / (2 * SPAN), px = (x, y) => [PX / 2 + x * k, PX / 2 - y * k];
  function paint() {
    const s = th.state;
    power.value = String(Math.round(s.power * 100));
    flickBtn.disabled = s.phase !== 'aim' || s.over;
    status.textContent = R.summary(s);
    if (!cv.getClientRects().length) return; // the 3D ring is up: it poses itself from the same state
    g.fillStyle = '#6b4f36'; g.fillRect(0, 0, PX, PX);
    g.strokeStyle = 'rgba(245,242,232,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(PX / 2, PX / 2, R.RING * k, 0, Math.PI * 2); g.stroke();
    for (const m of s.marbles) {
      const look = marbleLook(s.seed, m.id), [x, y] = px(m.x, m.y), r = Math.max(3.5, m.r * k);
      g.globalAlpha = m.out ? 0.45 : 1;
      g.fillStyle = look.glass; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (look.vanes[0]) { g.fillStyle = look.vanes[0]; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    if (s.phase === 'aim' && !s.over) {
      const sh = s.marbles[0], [x0, y0] = px(sh.x, sh.y), len = (20 + 70 * s.power);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(s.angle) * len, y0 - Math.sin(s.angle) * len); g.stroke(); g.setLineDash([]);
    }
  }
  el.append(wrap, controls, status);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  roll(); // a roll that was under way when the card re-rendered carries on
  const W = Math.min(440, (typeof innerWidth === 'number' ? innerWidth : 460) - 20);
  lift3d(th, stageApi, el, { kind: 'ringer', board: wrap, title: 'Ringer', W, H: Math.round(W * 0.8), label: '3D marble ring: drag the shooter back and let go to flick; tap or drag inside the ring to aim; drag outside the ring to look around',
    snapshot: () => ({ state: () => th.state, onAim: aimAt, onAimEnd: save, onPull: pullTo, onRelease: release }) });
}

async function run(text, api) {
  if (!ringerOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'ringer');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'ringer'; }
  api.summon('ringer', { state: R.create((Math.random() * 4294967296) >>> 0), x: Math.max(10, Math.round(innerWidth / 2 - 220)), y: 50 });
  api.say('Ringer · 13 marbles in the ring · aim, set the power, Flick');
  return 'ringer';
}

export default {
  name: 'ringer',
  ringerOf,
  examples: ['play marbles', 'marbles', 'shoot marbles', 'ringer', "let's play marbles", 'a game of marbles', 'play ringer'],
  nearMisses: ['lose my marbles', 'marble countertop', 'marble cake', 'star marbles', 'play star marbles', 'what are marbles made of', 'turn off the ringer'],
  match(lower, text) { return !!ringerOf(text); },
  run,
  stageKinds: { ringer: { mount } },
};

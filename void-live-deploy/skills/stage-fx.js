/**
 * stage-fx skill — small delights for the stage, every one opt-in and kept on this device (asked for by the owner, 2026-10-18):
 * "confetti when I finish a goal" (a list with every item ticked, or a habit ring with every habit marked today, throws
 * confetti once; "confetti off" stops it), "soft tick sound on keep" (a quiet tick when "keep this" makes a card),
 * "seasonal stage dust" (snow, petals, fireflies or leaves drifting behind the cards by the month; "winter dust" picks one),
 * "undo toast" (after something is removed a small bar offers Undo for a few seconds) and "give me the tour" (five short steps,
 * skippable, never starts by itself). Reduced motion is respected: no confetti flight, dust is still, the toast does not slide.
 * Nothing shows until asked, nothing is sent anywhere. Pure logic: lib/fx.js (tests: tools/tools-pack-8.test.mjs).
 */
import { localDay } from '../lib/stage-pack.js';
import { fxIntent, completeIds, stageDiff, seasonOf, dustSpecks, DUST, seeded, confettiPieces, confettiStep, TOUR } from '../lib/fx.js';

const KEY = 'a2m.void.fx.v1';
const doc = typeof document !== 'undefined' ? document : null;
const still = () => { try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
function write(patch) { const s = { ...read(), ...patch }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} return s; }

// ---------- confetti ----------
export function confetti(stageApi) {
  if (!doc) return;
  if (still()) { if (stageApi && stageApi.say) stageApi.say('goal complete'); return; }
  const cv = doc.createElement('canvas'); cv.className = 'fx-confetti'; cv.setAttribute('aria-hidden', 'true');
  cv.width = innerWidth; cv.height = innerHeight;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2000';
  doc.body.appendChild(cv);
  const g = cv.getContext('2d');
  let ps = confettiPieces(90, cv.width / 2, cv.height * 0.55, seeded(Date.now() & 0xffff)), t0 = performance.now(), last = t0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ps = ps.map((p) => confettiStep(p, dt));
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
    if (now - t0 < 2200 && ps.some((p) => p.y < cv.height + 20)) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
  if (stageApi && stageApi.say) stageApi.say('goal complete');
}

// ---------- the soft tick ----------
let actx = null;
export function tick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    actx = actx || new AC();
    if (actx.resume) actx.resume();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(1500, t); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.06);
    window.__fxTicks = (window.__fxTicks || 0) + 1;
  } catch (_) {}
}

// ---------- seasonal dust ----------
let dustCv = null, dustRaf = 0, dustKey = '';
function dustOff() {
  if (dustRaf) cancelAnimationFrame(dustRaf); dustRaf = 0;
  if (dustCv) { dustCv.remove(); dustCv = null; } dustKey = '';
}
function dustOn(seasonWord) {
  if (!doc) return;
  const season = seasonWord && DUST[seasonWord] ? seasonWord : seasonOf(new Date().getMonth());
  if (dustCv && dustKey === season) return;
  dustOff();
  dustKey = season;
  const cv = doc.createElement('canvas'); cv.className = 'fx-dust'; cv.dataset.season = season; cv.setAttribute('aria-hidden', 'true');
  cv.width = innerWidth; cv.height = innerHeight;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  const st = doc.getElementById('stage'); if (st && st.parentNode) st.parentNode.insertBefore(cv, st); else doc.body.appendChild(cv);
  dustCv = cv;
  const g = cv.getContext('2d'), specks = dustSpecks(season, Math.max(24, Math.min(70, Math.round(cv.width / 24))), cv.width, cv.height, seeded(7)), sway = DUST[season].sway;
  const draw = (tm) => {
    g.clearRect(0, 0, cv.width, cv.height);
    for (const s of specks) {
      const x = s.x + Math.sin(tm / 1800 + s.ph) * sway, y = s.y;
      g.globalAlpha = DUST[season].shape === 'glow' ? 0.35 + 0.45 * Math.abs(Math.sin(tm / 1200 + s.ph)) : 0.7;
      g.fillStyle = s.c; g.beginPath();
      if (DUST[season].shape === 'petal') g.ellipse(x, y, s.r, s.r * 0.55, s.ph, 0, 6.283); else g.arc(x, y, s.r, 0, 6.283);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  if (still()) { draw(0); return; }
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.06, (now - last) / 1000); last = now;
    if (!doc.hidden) { for (const s of specks) { s.y += s.vy * dt; if (s.y > cv.height + 8) s.y = -8; if (s.y < -8) s.y = cv.height + 8; } draw(now); }
    dustRaf = requestAnimationFrame(loop);
  };
  dustRaf = requestAnimationFrame(loop);
}

// ---------- the undo toast ----------
let toastTimer = 0;
function toast(stageApi, n) {
  if (!doc) return;
  let el = doc.getElementById('fx-toast');
  if (!el) {
    el = doc.createElement('div'); el.id = 'fx-toast'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2100;display:flex;gap:12px;align-items:center;padding:10px 14px;border-radius:12px;background:rgba(24,24,34,.96);border:1px solid rgba(255,255,255,.22);color:#eee;font:14px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    const msg = doc.createElement('span'); msg.className = 'fx-toast-msg';
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'fx-toast-undo'; b.textContent = 'Undo';
    b.style.cssText = 'font:inherit;font-weight:600;padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;cursor:pointer';
    b.addEventListener('click', () => { hideToast(); if (stageApi && stageApi.ask) stageApi.ask('undo'); });
    const x = doc.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'dismiss'); x.textContent = '×';
    x.style.cssText = 'font:inherit;border:0;background:none;color:#aaa;cursor:pointer;padding:0 4px'; x.addEventListener('click', hideToast);
    el.append(msg, b, x); doc.body.appendChild(el);
  }
  el.querySelector('.fx-toast-msg').textContent = n === 1 ? 'Removed 1 thing' : 'Removed ' + n + ' things';
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 8000);
}
function hideToast() { clearTimeout(toastTimer); const el = doc && doc.getElementById('fx-toast'); if (el) el.remove(); }

// ---------- watching the stage (confetti, tick, toast) ----------
let prev = null, prevDone = [], lastApi = null;
function look(stageApi) {
  if (!stageApi || !stageApi.things) return;
  lastApi = stageApi;
  const s = read(), things = stageApi.things(), cur = {};
  for (const t of Object.values(things)) if (t && t.id) cur[t.id] = t.kind;
  const done = completeIds(things, localDay());
  if (prev) {
    const d = stageDiff(prev, cur, prevDone, done);
    if (s.confetti && d.done.length) confetti(stageApi);
    if (s.tick && d.added.some((id) => cur[id] === 'kept')) tick();
    if (s.toast && d.removed.length && !d.added.length) toast(stageApi, d.removed.length);
    else if (d.added.length && doc && doc.getElementById('fx-toast')) hideToast();
  }
  prev = cur; prevDone = done;
}
if (doc) addEventListener('void:stage-change', () => setTimeout(() => look(lastApi), 80));

// ---------- the tour ----------
function tour() {
  if (!doc || doc.getElementById('fx-tour')) return;
  let i = 0;
  const o = doc.createElement('div'); o.id = 'fx-tour'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Tour of the stage');
  o.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:2200;width:min(92vw,380px);padding:16px 18px;border-radius:16px;background:rgba(20,20,30,.97);border:1px solid rgba(255,255,255,.25);color:#eee;font:15px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)';
  const btn = 'font:inherit;font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;cursor:pointer';
  const title = doc.createElement('div'); title.className = 'tour-title'; title.style.cssText = 'font-weight:700;margin-bottom:4px';
  const text = doc.createElement('div'); text.className = 'tour-text'; text.style.cssText = 'font-size:14px;opacity:.92';
  const step = doc.createElement('div'); step.className = 'tour-step'; step.style.cssText = 'font-size:12px;opacity:.6;margin-top:8px';
  const row = doc.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:space-between';
  const skip = doc.createElement('button'); skip.type = 'button'; skip.className = 'tour-skip'; skip.textContent = 'Skip tour'; skip.style.cssText = btn;
  const back = doc.createElement('button'); back.type = 'button'; back.className = 'tour-back'; back.textContent = 'Back'; back.style.cssText = btn;
  const next = doc.createElement('button'); next.type = 'button'; next.className = 'tour-next'; next.textContent = 'Next'; next.style.cssText = btn + ';font-weight:700';
  const right = doc.createElement('span'); right.style.cssText = 'display:flex;gap:8px'; right.append(back, next);
  row.append(skip, right); o.append(title, text, step, row);
  const close = () => { o.remove(); doc.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  const paint = () => { const s = TOUR[i]; title.textContent = s.title; text.textContent = s.text; step.textContent = 'Step ' + (i + 1) + ' of ' + TOUR.length; back.hidden = i === 0; next.textContent = i === TOUR.length - 1 ? 'Done' : 'Next'; };
  skip.addEventListener('click', close); back.addEventListener('click', () => { if (i > 0) { i--; paint(); } });
  next.addEventListener('click', () => { if (i >= TOUR.length - 1) close(); else { i++; paint(); } });
  doc.addEventListener('keydown', onKey, true);
  paint(); o.tabIndex = -1; doc.body.appendChild(o); o.focus(); // the dialog itself, not Next: the Enter that asked for the tour must not press it
}

/** carry out one effects ask; returns the sentence to say, or '' when the ask is not ours */
export function ask(text, stageApi) {
  const it = fxIntent(text);
  if (!it) return '';
  switch (it.op) {
    case 'confetti': write({ confetti: it.on }); look(stageApi); return it.on ? 'confetti on · finish a list or a habit ring and it flies' : 'confetti off';
    case 'confetti-now': confetti(stageApi); return '';
    case 'tick': write({ tick: it.on }); if (it.on) tick(); return it.on ? 'soft tick on · "keep this" will tick' : 'tick off';
    case 'dust': write({ dust: it.on ? it.season : false }); if (it.on) dustOn(it.season === 'auto' ? '' : it.season); else dustOff();
      return it.on ? (still() ? 'stage dust on (held still for reduced motion)' : 'stage dust on · "dust off" clears it') : 'dust off';
    case 'toast': write({ toast: it.on }); look(stageApi); return it.on ? 'undo toast on · after something is removed, Undo appears for a few seconds' : 'undo toast off';
    case 'tour': tour(); return '';
    default: return '';
  }
}

if (doc) {
  const apply = () => { const s = read(); if (s.dust) dustOn(s.dust === true || s.dust === 'auto' ? '' : s.dust); };
  if (doc.getElementById('stage')) apply(); else doc.addEventListener('DOMContentLoaded', apply, { once: true });
}

export default {
  name: 'stage-fx',
  examples: ['confetti when I finish a goal', 'soft tick sound on keep', 'seasonal stage dust', 'undo toast', 'give me the tour'],
  nearMisses: ['confetti cake recipe', 'what is a tick', 'how do I undo a commit', 'the dust on my shelf', 'tour of paris', 'undo'],
  intent: fxIntent,
  match(lower, text) { return !!fxIntent(text || lower); },
  async run(text, api) { const said = ask(text, api.stage); if (said && api.say) api.say(said); return fxIntent(text) ? 'stage-fx' : 'none'; },
  decorate(st) { look(st); },
};

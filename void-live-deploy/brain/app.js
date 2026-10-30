// Verse Brain full screen (owner, 2026-10-30: "verse brain needs a full screen and make sure it has everything"): the page's one brain
// (lib/brain-host.js, the same host the stage card adopts) mounted by the card's own code (skills/verse-brain.js idea, lib/field-stage.js
// mountField), with the field moved out of the card to fill the screen at the device's pixel ratio. Everything the card has stays in the side
// panel: Tell and why, Listen, Play a tune, Good, Forget, the organ table, the Mode row, Seal, Sound, Tilt and Reset. The live numbers and the
// lines it says about itself are read from the brain every few hundred ms (lib/brain.js selfOf, selfSays): none is made up here.
// Keys: the arrows move your point over the field, Enter or Space presses there, Esc leaves. What it keeps goes with it, as on the card.
// ?t=words tells it those words (or asks it a question) as the box would.
import { idea } from '/skills/verse-brain.js';
import { mountField } from '/lib/field-stage.js';
import * as B from '/lib/brain.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (s) => document.querySelector(s);
const field = $('#field'), slot = $('#card'), panel = $('#panel'), panelBtn = $('#panelBtn'), you = $('#you');
const narrow = () => matchMedia('(max-width: 720px)').matches;

// the card, mounted into the panel; a Mind Field mode or any other ask it makes opens on the Verse stage
const th = { id: 'brain-full', kind: 'verse-brain', x: 0, y: 0 };
const stageApi = { bindDrag() {}, stage: slot, ask: (t) => { location.assign('/?q=' + encodeURIComponent(t)); }, things: () => ({}), save() {}, render() {} };
const f = mountField(th, stageApi, idea);
const card = f.el, frame = card.querySelector('.ff-frame'), cv = frame.querySelector('canvas');
card.style.left = card.style.top = ''; card.style.width = '100%';
frame.style.borderRadius = '0'; field.insertBefore(frame, you);
cv.tabIndex = 0; cv.setAttribute('aria-label', 'Verse Brain, the whole screen: move over it, or use the arrow keys, to let it predict you');
const det = card.querySelector('details.vb-organs'); if (det && !narrow()) det.open = true;
document.body.dataset.ready = '1';

// the bar and the numbers are docked above and below the field (2026-10-30: the numbers box and the title sat over its labels): their heights
// are --top and --hud, so the field is every pixel they leave, and nothing on the page covers a thing the brain holds
const bar = $('#bar'), live = $('#live'), numBtn = $('#numBtn'), rootStyle = document.documentElement.style;
const dock = () => { rootStyle.setProperty('--top', bar.offsetHeight + 'px'); rootStyle.setProperty('--hud', (live.hidden ? 0 : live.offsetHeight) + 'px'); };
dock();
if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => dock()); ro.observe(bar); ro.observe(live); } else addEventListener('resize', dock);
numBtn.addEventListener('click', () => { live.hidden = !live.hidden; numBtn.setAttribute('aria-expanded', String(!live.hidden)); numBtn.textContent = live.hidden ? 'Show numbers' : 'Hide numbers'; dock(); });

// the field fills the screen, sharp at the device's pixel ratio, and follows the window's size
let size = null;
const fit = () => { const r = field.getBoundingClientRect(); size = f.resize(r.width, r.height); field.dataset.w = String(size.W); field.dataset.h = String(size.H); field.dataset.dpr = String(size.dpr); };
fit();
if (typeof ResizeObserver === 'function') new ResizeObserver(() => fit()).observe(field); else addEventListener('resize', fit);

// the panel: open on a wide screen, a closed sheet on a phone
const setPanel = (open) => {
  panel.hidden = !open; panelBtn.setAttribute('aria-expanded', String(open)); panelBtn.textContent = open ? 'Hide panel' : 'Show panel';
  document.body.classList.toggle('panel-open', open);
};
setPanel(!narrow());
panelBtn.addEventListener('click', () => setPanel(panel.hidden));

// Fill the screen: the browser's own full screen (Esc ends it there); a browser without it says so
const fsBtn = $('#fs'), root = document.documentElement;
if (!root.requestFullscreen) { fsBtn.disabled = true; fsBtn.textContent = 'Full screen not offered here'; }
fsBtn.addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen(); } catch (_) { fsBtn.textContent = 'Full screen not allowed'; } });
document.addEventListener('fullscreenchange', () => { const on = !!document.fullscreenElement; fsBtn.setAttribute('aria-pressed', String(on)); fsBtn.textContent = on ? 'Leave full screen' : 'Fill the screen'; });

// leaving: back to where you came from on Verse, or the stage
const leave = () => { try { if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { history.back(); return; } } catch (_) { /* no referrer */ } location.assign('/'); };

// the keyboard: your point over the field, as a pointer would move it
const input = f.input; let keyPoint = false;
const showYou = () => { you.style.display = keyPoint ? 'block' : 'none'; you.style.left = (input.x * 100).toFixed(2) + '%'; you.style.top = (input.y * 100).toFixed(2) + '%'; };
cv.addEventListener('pointermove', () => { if (keyPoint) { keyPoint = false; showYou(); } });
cv.addEventListener('blur', () => { if (keyPoint) { input.over = false; input.down = false; } });
cv.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 0.1 : 0.03, moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }, m = moves[e.key];
  if (m) { e.preventDefault(); input.x = Math.min(1, Math.max(0, input.x + m[0])); input.y = Math.min(1, Math.max(0, input.y + m[1])); input.over = true; keyPoint = true; showYou(); if (f.still) f.tick(1); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.over = true; input.down = true; keyPoint = true; showYou(); if (f.still) f.tick(2); setTimeout(() => { input.down = false; }, 220); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const t = e.target; if (t && /^(?:INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { t.blur(); return; }
  if (document.fullscreenElement) return; // the browser leaves its full screen first
  leave();
});

// the live numbers and what it says, read from the brain itself
const fmt = (v, d = 3) => (v == null || !Number.isFinite(+v) ? null : (+v).toFixed(d));
const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
const dl = (el, rows) => {
  const kept = rows.filter((r) => r && r[1] != null), sig = JSON.stringify(kept);
  if (el.dataset.sig === sig) return; el.dataset.sig = sig;
  const pairs = kept.length ? kept : [['None yet', 'each organ is shown once it has a score']];
  el.replaceChildren(...pairs.map(([k, v]) => { const d = document.createElement('div'); d.append(node('dt', k), node('dd', String(v))); return d; })); // one tile a number
};
const liveNow = $('#liveNow'), liveGains = $('#liveGains'), says = $('#says'), pulse = $('#pulse');
const read = () => {
  const b = th.state && th.state.b; if (!b) return;
  const s = B.selfOf(b), m = b.metrics;
  dl(liveNow, [
    ['Focus', 'region ' + (b.focus.region + 1) + ' of 12 at ' + fmt(b.focus.x, 2) + ', ' + fmt(b.focus.y, 2) + (b.board.thinking ? ', on "' + b.board.thinking + '"' : '')],
    ['Will', s.action + ' · utility ' + fmt(s.utility) + ' · ' + s.q + ' chosen'],
    ['Surprise', 'prediction error ' + fmt(b.reservoir.errAvg) + ' · budget ' + fmt(s.surpriseBudget, 2) + (b.concepts.lastBits != null && b.concepts.words.length ? ' · ' + fmt(b.concepts.lastBits, 1) + ' bits a letter' : '')],
    ['Tissue', 'entropy ' + fmt(m.entropy) + ' · activity ' + fmt(m.activity) + ' · order ' + fmt(m.order)],
    ['Organs', b.granted.length + ' of ' + B.ORGAN_IDS.length + ' ran this tick' + (s.starved ? ' · under-used: ' + s.starved : '')],
    ['Holds', s.concepts + ' words · ' + s.episodes + ' moments · ' + s.procedures + ' genomes'],
    ['Ticks', String(b.ticks) + (size ? ' · ' + size.W + 'x' + size.H + ' at ' + size.dpr + 'x' : '')],
  ]);
  const P = s.painter, G = s.grower, F = s.formula, C = s.current, R = s.grains, D = s.gardener, H = b.ear.guessed ? s.hearing : null;
  const tiles = D ? Object.values(D.classes).reduce((a, v) => a + v, 0) : 0;
  dl(liveGains, [
    P && P.score != null ? ['Painter', 'scores ' + P.score + (P.first != null ? ' (first ' + P.first + ', best ' + P.best + ')' : '') + ' · gen ' + P.gen] : null,
    G && G.score != null ? ['Grower', 'scores ' + fmt(G.score) + (G.best != null ? ' (best ' + G.best + ')' : '') + ' · gen ' + G.gen] : null,
    F && F.skill != null ? ['Formula', 'skill ' + fmt(F.skill) + (F.said != null ? ' · said ' + F.said : '') + ' · gen ' + F.gen] : null,
    C && C.gain != null ? ['Current', 'gain ' + C.gain + 'x over ' + C.lives + (C.lives === 1 ? ' life' : ' lives')] : null,
    R && R.gain != null ? ['Grains', 'gain ' + R.gain + 'x over ' + R.lives + (R.lives === 1 ? ' life' : ' lives')] : null,
    D && D.blinks ? ['Gardener', D.inBand + ' of ' + tiles + ' patches at the edge of chaos'] : null,
    H ? ['Hearing', Math.round(H.hit * 100) + '% of next notes right over ' + H.notes] : null,
    s.creature.trials ? ['Creature', 'generation ' + s.creature.generations + ' · ' + s.creature.trials + (s.creature.trials === 1 ? ' trial' : ' trials')] : null,
  ]);
  const lines = B.selfSays(b), sig = JSON.stringify(lines);
  if (says.dataset.sig !== sig) { says.replaceChildren(...lines.map((t) => node('li', t))); says.dataset.sig = sig; }
  says.dataset.lines = String(lines.length);
  pulse.style.opacity = String(0.45 + Math.min(0.55, (b.reservoir.errAvg || 0) * 4));
};
read(); setInterval(read, 250);
mountRelated($('#related'), '/brain/'); // the stage card and the tools that work with it

// a link may tell it something or ask it why (/brain/?t=ocean, ?t=what are you doing?): the card's own box takes it, after what it kept is back
const told = new URLSearchParams(location.search).get('t');
if (told && told.trim()) { const box = card.querySelector('.vb-word'), form = card.querySelector('.vb-form'); if (box && form) { box.value = told.trim().slice(0, 120); form.requestSubmit(); } }
showYou();

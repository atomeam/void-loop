// /lab/level/: a spirit level on the phone's own motion sensor, plus an angle-from-rise-and-run sum for anyone without one.
import { flatTilt, edgeAngle, poseOf, minusZero, slopeOf, angleOf, isLevel, smoother, sayOf } from './level.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.lab.level.v1';
let zero = { flat: { x: 0, y: 0 }, edge: 0 };
try { zero = { ...zero, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { /* first visit */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(zero)); } catch (_) { /* private mode: zero lasts this visit */ } };
// iOS reports gravity the other way round from Android and desktop Chrome (face up: z = -9.8 there, +9.8 here)
const flip = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? -1 : 1;
const sx = smoother(), sy = smoother(), se = smoother();
let last = null, held = false, seen = false, pose = 'flat';

function draw() {
  if (!last || held) return;
  pose = poseOf(last);
  const ring = $('ring'), bar = $('bar');
  if (pose === 'flat') {
    const t = flatTilt(last), x = minusZero(sx(t.x), zero.flat.x), y = minusZero(sy(t.y), zero.flat.y), worst = Math.max(Math.abs(x), Math.abs(y));
    ring.hidden = false; bar.hidden = true;
    // the bubble floats to the high side, as in a real level: 10° puts it on the rim
    const k = Math.min(1, Math.hypot(x, y) / 10), a = Math.atan2(y, x), r = 42 * k;
    $('bubble').setAttribute('cx', String(50 - Math.cos(a) * r)); $('bubble').setAttribute('cy', String(50 + Math.sin(a) * r));
    $('read').textContent = isLevel(worst) ? 'Level' : worst.toFixed(1) + '°';
    $('detail').textContent = 'Across ' + x.toFixed(1) + '°, along ' + y.toFixed(1) + '°. Lay the phone flat on the surface.';
    $('read').className = 'big ' + (isLevel(worst) ? 'ok' : '');
    $('say').dataset.v = isLevel(worst) ? 'Level (' + worst.toFixed(1) + '°)' : 'Across ' + x.toFixed(1) + '°, along ' + y.toFixed(1) + '°';
  } else {
    const e = minusZero(se(edgeAngle(last)), zero.edge);
    ring.hidden = true; bar.hidden = false;
    $('tube').setAttribute('cx', String(Math.max(8, Math.min(92, 50 - e * 4))));
    $('line').setAttribute('transform', 'rotate(' + (-e).toFixed(2) + ' 50 20)');
    $('read').textContent = isLevel(e) ? 'Level' : Math.abs(e).toFixed(1) + '°';
    $('read').className = 'big ' + (isLevel(e) ? 'ok' : '');
    const s = slopeOf(e);
    $('detail').textContent = isLevel(e) ? 'Within 0.3° of level.' : s.percent + '% slope: ' + s.perMetre + ' mm per metre, ' + s.perFoot + ' in per foot, ' + s.ratio + '.';
    $('say').dataset.v = sayOf(e);
  }
}
function onMotion(ev) {
  const g = ev.accelerationIncludingGravity; if (!g || g.x == null) return;
  seen = true; $('nosensor').hidden = true; $('start').hidden = true;
  last = { x: g.x * flip, y: g.y * flip, z: g.z * flip };
  requestAnimationFrame(draw);
}
async function start() {
  try {
    // iOS asks once, on a tap; elsewhere the reading just starts
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') { $('detail').textContent = 'Motion access was not allowed. Settings > Safari > Motion & Orientation Access turns it on.'; return; }
    }
  } catch (_) { /* older browsers: no permission step */ }
  addEventListener('devicemotion', onMotion);
  setTimeout(() => { if (!seen) $('nosensor').hidden = false; }, 1500);
}
$('start').addEventListener('click', start);
if (typeof DeviceMotionEvent === 'undefined' || typeof DeviceMotionEvent.requestPermission !== 'function') start(); else $('start').hidden = false;

$('zero').addEventListener('click', () => {
  if (!last) return;
  if (poseOf(last) === 'flat') { const t = flatTilt(last); zero.flat = { x: t.x, y: t.y }; } else zero.edge = edgeAngle(last);
  keep(); $('zeroed').textContent = 'Zeroed on this surface. Reset puts it back.';
});
$('reset').addEventListener('click', () => { zero = { flat: { x: 0, y: 0 }, edge: 0 }; keep(); $('zeroed').textContent = ''; });
$('hold').addEventListener('click', () => { held = !held; $('hold').textContent = held ? 'Release' : 'Hold reading'; $('hold').setAttribute('aria-pressed', String(held)); });
$('say').addEventListener('click', async () => {
  const v = $('say').dataset.v || ''; if (!v) return;
  try { await navigator.clipboard.writeText(v); $('say').textContent = 'Copied'; setTimeout(() => { $('say').textContent = 'Copy reading'; }, 1500); } catch (_) { $('say').textContent = v; }
});

// no sensor: the same answer from two measurements
function calc() {
  const a = angleOf($('rise').value, $('run').value);
  if (!Number.isFinite(a)) { $('calcout').textContent = 'Enter a rise and a run in the same unit.'; return; }
  const s = slopeOf(a); $('calcout').textContent = Math.abs(a).toFixed(2) + '°, a ' + s.percent + '% slope (' + s.perMetre + ' mm per metre, ' + s.perFoot + ' in per foot, ' + s.ratio + ').';
}
for (const id of ['rise', 'run']) $(id).addEventListener('input', calc);
const q = new URLSearchParams(location.search);
if (q.has('rise')) $('rise').value = q.get('rise'); if (q.has('run')) $('run').value = q.get('run');
calc();
mountRelated($('related'), '/lab/level/');

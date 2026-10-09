/**
 * sfx — the sounds of a real table, made on the spot with Web Audio (Adam, 2026-10-09: "capture the nostalgia of the
 * physical board"). No sound files: each sound is a short burst of noise and a tone shaped by a filter and a fade, a
 * little different every time, so ten marbles landing don't sound like one clip on repeat. Not a skill: the games
 * import it, so a page with no game loads none of it.
 *   clack(power, kind)  a piece landing: kind 'glass' (an Aggravation marble) or 'plastic' (a Sorry! pawn); power 0..1
 *   flip()              a card turned over
 *   rattle()            a die shaken and rolled out
 *   soundButton()       a small speaker button for a game's card: sound on/off, remembered in this browser
 * Quiet by default. Silent until you have touched the page (browsers block sound before that, so a bot's move before
 * your first tap simply makes none), and off under reduced motion unless you turn it on.
 */
const KEY = 'void.sfx';
let ac = null, out = null, noise = null, armed = false;
const last = {};

function pref() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
export function soundOn() { const p = pref(); return p === 'on' || (p !== 'off' && !reducedMotion()); }
function setSound(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {} }

// the audio context starts on the first touch or key press (never before: autoplay rules), then is reused
function arm() {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  const start = () => { ready(); document.removeEventListener('pointerdown', start, true); document.removeEventListener('keydown', start, true); };
  document.addEventListener('pointerdown', start, true); document.addEventListener('keydown', start, true);
}
function ready() {
  if (!ac) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { ac = new AC(); } catch (_) { return null; }
    out = ac.createGain(); out.gain.value = 0.32; out.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
arm();
// a sound may only start after the page has been touched, and not twice inside a few milliseconds (two pieces landing
// in the same frame make one clack)
function go(name, gapMs) {
  if (!soundOn() || !ac || ac.state !== 'running') return false;
  const now = ac.currentTime * 1000;
  if (last[name] && now - last[name] < gapMs) return false;
  last[name] = now; return true;
}
const jitter = (v, k) => v * (1 + (Math.random() * 2 - 1) * k);

function burst(t, { freq, q = 1, type = 'bandpass', dur, gain, offset = Math.random() * 0.8 }) {
  const src = ac.createBufferSource(); src.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out); src.start(t, offset, dur + 0.02);
}
function tone(t, { freq, type = 'sine', dur, gain, drop = 1 }) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}

/** a piece landing in its hole: a glass marble rings, a plastic pawn knocks; a longer move lands harder */
export function clack(power = 0.5, kind = 'glass') {
  if (!go('clack', 25)) return;
  const p = Math.max(0.15, Math.min(1, power)), t = ac.currentTime;
  if (kind === 'plastic') {
    burst(t, { freq: jitter(1500, 0.15), q: 2.2, dur: 0.045, gain: 0.55 * p });
    tone(t, { freq: jitter(720, 0.1), type: 'triangle', dur: 0.06, gain: 0.32 * p, drop: 0.82 });
  } else {
    burst(t, { freq: jitter(3600, 0.12), q: 3, dur: 0.03, gain: 0.5 * p });
    tone(t, { freq: jitter(2650, 0.06), dur: 0.12, gain: 0.16 * p, drop: 0.97 });
    tone(t, { freq: jitter(5300, 0.06), dur: 0.06, gain: 0.06 * p });
  }
}

/** a card turned over: the snap of its edge, then the soft slap as it lands face up */
export function flip() {
  if (!go('flip', 80)) return;
  const t = ac.currentTime;
  burst(t, { freq: jitter(5200, 0.1), type: 'highpass', q: 0.7, dur: 0.05, gain: 0.32 });
  burst(t + 0.07, { freq: jitter(1800, 0.15), q: 0.9, dur: 0.07, gain: 0.26 });
}

/** a die shaken and thrown: a few quick knocks spreading out, then it settles */
export function rattle() {
  if (!go('rattle', 200)) return;
  const t = ac.currentTime, n = 5 + Math.floor(Math.random() * 3);
  let at = 0;
  for (let i = 0; i < n; i++) {
    at += 0.035 + Math.random() * 0.05 + i * 0.012;
    burst(t + at, { freq: jitter(2600, 0.3), q: 4, dur: 0.025, gain: 0.3 * (1 - i / (n + 2)) });
  }
  burst(t + at + 0.05, { freq: jitter(900, 0.1), q: 1.5, dur: 0.06, gain: 0.22 });
}

/** the speaker button on a game's card */
export function soundButton() {
  if (typeof document === 'undefined') return null;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'sfx-btn howto-btn';
  // a drawn speaker: the cone, and sound waves when on or a cross when off
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round';
  const path = (d) => { const e = document.createElementNS(NS, 'path'); e.setAttribute('d', d); svg.appendChild(e); return e; };
  path('M4 9h4l5-4v14l-5-4H4z');
  const waves = path('M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'), cross = path('M17 9l5 6M22 9l-5 6');
  b.appendChild(svg);
  const show = () => { const on = soundOn(); waves.style.display = on ? '' : 'none'; cross.style.display = on ? 'none' : ''; b.title = on ? 'Sound on: tap to mute' : 'Sound off: tap to turn on'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', String(on)); };
  b.style.cssText = 'margin-left:0;padding:4px 8px;display:inline-flex;align-items:center';
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); setSound(!soundOn()); ready(); show(); if (soundOn()) clack(0.6, 'glass'); });
  show();
  return b;
}

/**
 * noise skill - white, pink and brown noise and a rain sound, made in the page with Web Audio (docs/GAPS.md rows 30 and 31, 2026-11-06:
 * "white noise" and "rain sounds" each gave an article). "white noise", "pink noise for 30 minutes", "brown noise", "noise machine",
 * "rain sounds", "rain sounds for sleep". The card has the four sounds, a play button, a volume slider and a sleep timer.
 * Nothing is fetched or recorded: each sound is a buffer of numbers worked out here. The rain is made from filtered noise and
 * random drops, and the card says so. No sound starts until the visitor presses play (browsers ask for that anyway).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }. Tests: tools/gaps-batch2.test.mjs.
 */

export const COLORS = ['white', 'pink', 'brown', 'rain'];
const LABEL = { white: 'White noise', pink: 'Pink noise', brown: 'Brown noise', rain: 'Rain' };

/** the sound and sleep timer an ask names: { color, minutes } or null. Pure. */
export function noiseOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 80) return null;
  if (/^(?:what|why|how|is|does|do|define|who)\b|\b(?:vs|versus|meaning|definition|film|movie|novel|book|band|song|lyrics|cast|trailer|forecast|tomorrow|today|radar|chance)\b/.test(t)) return null;
  let m = t.match(/^(?:please )?(?:(?:play|start|make|give me|open|turn on|put on) )?(?:some |a |an |the )?(?:(white|pink|brown|brownian|red) noise|noise machine|(?:white )?noise generator|sleep sounds?|(rain)(?: ?(?:sounds?|noise|sound effects?))|(?:the )?sound of (rain)|(rainfall|rain) ambien(?:ce|t))(?: (?:machine|generator|player))?(?: for (?:sleep|sleeping|focus|studying|work|baby|babies|a baby))?(?: for (\d{1,3}) ?(?:minutes?|mins?|hours?|hrs?))?(?: for (?:sleep|sleeping|focus|studying|work))?$/);
  if (!m) return null;
  const word = m[1] || (m[2] || m[3] || m[4] ? 'rain' : 'white');
  const color = word === 'brownian' || word === 'red' ? 'brown' : word;
  let minutes = 0;
  if (m[5]) { const n = +m[5]; minutes = /hours?|hrs?/.test(t.slice(t.lastIndexOf(m[5]))) ? n * 60 : n; if (minutes < 1 || minutes > 600) minutes = 0; }
  return { color, minutes };
}

/** a seeded random number source in [0, 1) (mulberry32), so a test hears the same sound twice. Pure. */
export function rngOf(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** n samples of the sound in [-1, 1]. White: each sample its own; pink: Paul Kellet's filter (power falls 3 dB an octave);
 *  brown: a leaky running sum (6 dB an octave); rain: soft pink noise with short decaying drops at random. Pure. */
export function fillNoise(color, n, rng = Math.random, rate = 44100) {
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, drop = 0, dropAmp = 0;
  const decay = Math.exp(-1 / (0.012 * rate)); // a drop fades in about 12 ms
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    let v;
    if (color === 'white') v = w * 0.5;
    else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; v = last * 3.5; }
    else {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; const p = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      if (color === 'pink') v = p;
      else { // rain: the pink bed, quieter, and a drop now and then (about 40 a second)
        if (rng() < 40 / rate) { drop = 1; dropAmp = 0.25 + rng() * 0.45; }
        drop *= decay;
        v = p * 0.55 + (rng() * 2 - 1) * drop * dropAmp;
      }
    }
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}

/** "29:59" for a count of seconds. Pure. */
export function clock(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); }

function run(text, api) {
  const q = noiseOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const btn = 'padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#e8e8e8;cursor:pointer;font:14px system-ui';
  const el = showPage((p) => {
    p.innerHTML = '<h2 class="nz-title">' + esc(LABEL[q.color]) + '</h2>'
      + '<div class="nz-kinds" role="group" aria-label="Sound" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">'
      + COLORS.map((c) => '<button type="button" class="nz-kind" data-color="' + c + '" aria-pressed="' + (c === q.color) + '" style="' + btn + '">' + esc(LABEL[c]) + '</button>').join('') + '</div>'
      + '<p><button type="button" class="nz-play" style="' + btn + ';background:#6d4aff;border-color:#6d4aff;color:#fff;font-weight:600">Play</button></p>'
      + '<label style="display:flex;gap:8px;align-items:center;margin:8px 0">Volume <input class="nz-vol" type="range" min="0" max="100" value="50" aria-label="Volume"></label>'
      + '<label style="display:flex;gap:8px;align-items:center;margin:8px 0">Stop after <select class="nz-timer" aria-label="Stop after">'
      + [0, 15, 30, 45, 60, 90, 120, 240, 480].concat(q.minutes && ![0, 15, 30, 45, 60, 90, 120, 240, 480].includes(q.minutes) ? [q.minutes] : []).sort((a, b) => a - b).map((n) => '<option value="' + n + '"' + (n === q.minutes ? ' selected' : '') + '>' + (n ? (n % 60 ? n + ' min' : n / 60 + (n === 60 ? ' hour' : ' hours')) : 'never') + '</option>').join('')
      + '</select> <span class="nz-left" aria-live="polite" style="opacity:.7"></span></label>'
      + '<p class="nz-note" style="color:#8a8a8a">' + esc(q.color === 'rain' ? 'This rain is made in your browser from filtered noise and random drops. It is not a recording.' : 'Made in your browser from random numbers, nothing is downloaded. White noise has the same power at every pitch, pink falls 3 dB an octave, brown 6 dB an octave.') + '</p>'
      + '<div class="src">Made on this device with Web Audio · nothing is recorded or sent</div>';
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c);
  const play = $('.nz-play'), vol = $('.nz-vol'), timer = $('.nz-timer'), left = $('.nz-left'), title = $('.nz-title'), note = $('.nz-note');
  let color = q.color, ctx = null, src = null, gain = null, endAt = 0, tick = null;
  const vGain = () => { const v = (vol ? +vol.value : 50) / 100; return v * v * 0.8; };
  const stop = () => { if (src) { try { src.stop(); } catch (_) {} src.disconnect(); src = null; } if (tick) { clearInterval(tick); tick = null; } if (play) play.textContent = 'Play'; if (left) left.textContent = ''; endAt = 0; };
  const start = () => {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { if (note) note.textContent = 'This browser has no Web Audio, so the sound cannot be made here.'; return; }
    if (!ctx) { ctx = new AC(); gain = ctx.createGain(); gain.connect(ctx.destination); }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    const secs = 6, buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
    buf.getChannelData(0).set(fillNoise(color, ctx.sampleRate * secs, Math.random, ctx.sampleRate));
    if (src) { try { src.stop(); } catch (_) {} src.disconnect(); }
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    let node = src;
    if (color === 'rain') { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; src.connect(lp); node = lp; }
    node.connect(gain); gain.gain.value = vGain(); src.start();
    if (play) play.textContent = 'Stop';
    const mins = timer ? +timer.value : 0; endAt = mins ? Date.now() + mins * 60000 : 0;
    if (tick) clearInterval(tick);
    tick = setInterval(() => {
      if (api._pageStill && !api._pageStill(el)) { stop(); if (ctx && ctx.close) ctx.close(); ctx = null; return; } // the card closed: the sound stops with it
      if (endAt) { const s = (endAt - Date.now()) / 1000; if (s <= 0) stop(); else if (left) left.textContent = clock(s) + ' left'; }
    }, 1000);
  };
  if (play) play.addEventListener('click', () => { if (src) stop(); else start(); });
  if (vol) vol.addEventListener('input', () => { if (gain) gain.gain.value = vGain(); });
  if (timer) timer.addEventListener('change', () => { if (src) { const mins = +timer.value; endAt = mins ? Date.now() + mins * 60000 : 0; if (!endAt && left) left.textContent = ''; } });
  if (el && el.querySelectorAll) for (const b of el.querySelectorAll('.nz-kind')) b.addEventListener('click', () => {
    color = b.dataset.color; for (const o of el.querySelectorAll('.nz-kind')) o.setAttribute('aria-pressed', String(o === b));
    if (title) title.textContent = LABEL[color];
    if (note) note.textContent = color === 'rain' ? 'This rain is made in your browser from filtered noise and random drops. It is not a recording.' : 'Made in your browser from random numbers, nothing is downloaded. White noise has the same power at every pitch, pink falls 3 dB an octave, brown 6 dB an octave.';
    if (src) { const keep = endAt; start(); endAt = keep; }
  });
  return 'noise';
}

export default {
  name: 'noise',
  examples: ['white noise', 'pink noise for 30 minutes', 'brown noise', 'noise machine', 'rain sounds', 'rain sounds for sleep', 'play white noise for 1 hour'],
  nearMisses: ['what is white noise', 'white noise movie', 'pink noise vs white noise', 'rain forecast', 'will it rain tomorrow', 'white noise meaning'],
  match(lower, text) { return !!noiseOf(text || lower); },
  run,
};

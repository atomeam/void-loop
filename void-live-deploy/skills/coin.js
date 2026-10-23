/**
 * coin skill: a coin flip that lands at once and looks like a coin (the tower's second rung, 2026-10-23; the scout's teardown of the coin
 * flip sites: a 3-second fake wait, ads, paragraphs of text, a clanky sound). "flip a coin", "heads or tails", "coin toss": a crisp CSS 3D
 * coin snaps to its face in a third of a second, the word under it, and a quiet tally for this visit (Heads 3 · Tails 1). Tap the coin to
 * flip again. "flip 5 coins" lays out five; "flip a coin 70% heads" weights it; "flip a euro", "a silver coin", "a bitcoin" change the face
 * (a currency sign, never a logo). A soft ring made in the browser, off until you turn it on. Fair: the device's crypto random, no network.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const N = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const STYLES = {
  gold: { face: 'radial-gradient(circle at 35% 30%,#fff2b3,#f4c542 40%,#b8860b 75%,#7a5a08)', ink: '#5a4106', rim: '#8a6a10', h: 'H', t: 'T' },
  silver: { face: 'radial-gradient(circle at 35% 30%,#ffffff,#d7dbe0 40%,#9aa1aa 75%,#5d636b)', ink: '#3b4047', rim: '#6b7178', h: 'H', t: 'T' },
  euro: { face: 'radial-gradient(circle at 50% 50%,#d7dbe0 0 46%,#f4c542 47% 100%)', ink: '#3b4047', rim: '#8a6a10', h: '€', t: '1' },
  bitcoin: { face: 'radial-gradient(circle at 35% 30%,#ffd29a,#f7931a 45%,#b8640a 80%)', ink: '#ffffff', rim: '#a85a0a', h: '₿', t: '₿' },
};
const STYLE_WORDS = { gold: 'gold', golden: 'gold', silver: 'silver', quarter: 'silver', dime: 'silver', nickel: 'silver', penny: 'gold', euro: 'euro', bitcoin: 'bitcoin', btc: 'bitcoin' };

/** what a coin ask wants: { n, p, style, for } or null. p is the chance of heads. Pure. */
export function coinOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/,?\s+please$/, '').replace(/^(?:can|could) you\s+|^please\s+/g, '').replace(/\s+/g, ' ').trim();
  if (/^heads or tails$|^(?:a )?coin (?:flip|toss)$|^toss up$/.test(t)) return { n: 1, p: 0.5, style: 'gold', for: '' };
  const m = /^(?:flip|toss)\s+(?:me\s+)?(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})?\s*(?:(gold|golden|silver|quarter|dime|nickel|penny|euro|bitcoin|btc)\s+)?(coins?|quarters?|dimes?|nickels?|pennies|penny|euros?|bitcoins?)(?:\s+(?:that(?:'s| is)\s+)?(\d{1,2})\s*%\s*heads|\s+weighted\s+(\d{1,2})\s*%?\s*(?:heads)?)?(?:\s+for\s+(.{1,60}))?(?:\s+heads or tails)?$/.exec(t)
    || /^(?:flip|toss)\s+(?:a\s+)?(weighted)\s+(coin)\s+(\d{1,2})\s*%\s*heads(?:\s+for\s+(.{1,60}))?$/.exec(t);
  if (!m) return null;
  if (m[1] === 'weighted') return { n: 1, p: +m[3] / 100, style: 'gold', for: m[4] || '' };
  const word = m[2] || m[3].replace(/s$/, '').replace(/^pennie$/, 'penny');
  const n = Math.min(20, Math.max(1, N[m[1]] || +m[1] || (/s$/.test(m[3]) && !/^(?:a|an|one)$/.test(m[1] || '') && m[1] ? 2 : 1)));
  const pct = m[4] || m[5];
  return { n, p: pct ? Math.min(99, Math.max(1, +pct)) / 100 : 0.5, style: STYLE_WORDS[word] || 'gold', for: m[6] || '' };
}

/** a fair or weighted flip from the device's crypto random (a uniform number in [0, 1)); true is heads. */
export function flip(p = 0.5, rand = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }) { return rand() < p; }

import { coinLine } from '../lib/tally.js';
const KEY = 'a2m.void.coin.v1'; // this visit's tally and the sound choice, in sessionStorage / localStorage
const tallyRead = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || '{}'); return { h: v.h | 0, t: v.t | 0 }; } catch (_) { return { h: 0, t: 0 }; } };
const tallyWrite = (v) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} };
const soundOn = () => { try { return localStorage.getItem(KEY + '.sound') === '1'; } catch (_) { return false; } };
/** a soft metal ring, made here (no sound file): two bell partials that fade in half a second. */
function ring() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = ring.ctx || (ring.ctx = new C()), now = ctx.currentTime;
    for (const [f, g] of [[2093, 0.05], [3136, 0.03]]) { const o = ctx.createOscillator(), v = ctx.createGain(); o.frequency.value = f; v.gain.setValueAtTime(g, now); v.gain.exponentialRampToValueAtTime(0.0001, now + 0.5); o.connect(v).connect(ctx.destination); o.start(now); o.stop(now + 0.52); }
  } catch (_) {}
}

const CSS = '<style>.vpage:has(.coin-row) .vc-art{display:none}.coin-row{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin:20px 0 8px;perspective:600px}'
  + '.coin{position:relative;width:var(--d);height:var(--d);transform-style:preserve-3d;cursor:pointer;border:0;padding:0;background:none;transition:transform .32s cubic-bezier(.2,1.5,.4,1)}'
  + '.coin .fc{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;font:900 calc(var(--d) * .42)/1 Georgia,serif;'
  + 'box-shadow:inset 0 0 0 calc(var(--d) * .045) var(--rim),inset 0 0 0 calc(var(--d) * .07) rgba(255,255,255,.35),0 6px 22px rgba(0,0,0,.45),0 0 26px rgba(255,214,102,.25)}'
  + '.coin .fc.t{transform:rotateY(180deg)}.coin-word{text-align:center;font:800 clamp(34px,7vw,56px)/1.1 system-ui,sans-serif;letter-spacing:.02em;margin:6px 0 2px}'
  + '.coin-tally{text-align:center;opacity:.7;font-variant-numeric:tabular-nums;margin:4px 0}.coin-tools{display:flex;gap:8px;justify-content:center;margin:6px 0}'
  + '.coin-tools button{font:inherit;font-size:12px;opacity:.75;background:transparent;color:inherit;border:1px solid currentColor;border-radius:999px;padding:2px 10px;cursor:pointer}'
  + '@media (prefers-reduced-motion:reduce){.coin{transition:none}}</style>';

function run(text, api) {
  const ask = coinOf(text);
  if (!ask) return 'none';
  const { showPage, esc } = api, st = STYLES[ask.style], d = ask.n === 1 ? 150 : ask.n <= 4 ? 96 : 64;
  let spins = 0;
  const el = showPage((card) => {
    card.innerHTML = CSS + '<h2>' + esc(ask.for ? 'Coin for ' + ask.for : ask.n > 1 ? ask.n + ' coins' : 'Coin') + '</h2>'
      + '<div class="coin-row"></div><div class="coin-word" aria-live="polite"></div><div class="coin-tally"></div><div class="coin-everyone" hidden></div>'
      + '<div class="coin-tools"><button type="button" class="coin-again">Flip again</button><button type="button" class="coin-sound"></button><button type="button" class="coin-reset">Reset tally</button></div>'
      + '<div class="src">' + (ask.p === 0.5 ? 'A fair flip' : 'Weighted ' + Math.round(ask.p * 100) + '% heads') + ' from this device’s secure random numbers, no network</div>';
  });
  if (!el || !el.querySelector) return 'coin';
  const row = el.querySelector('.coin-row'), word = el.querySelector('.coin-word'), tally = el.querySelector('.coin-tally'), snd = el.querySelector('.coin-sound');
  // everyone's flips (owner, 2026-10-23: the global counter): one quiet line from /api/tally (lib/tally.js: a closed list, integers back), hidden
  // until the first read works; each flip is one small POST per side; a 429 rests the posts for its Retry-After. Nothing from the server is drawn but numbers.
  const every = el.querySelector('.coin-everyone'); every.className += ' coin-tally'; let restUntil = 0;
  const showEvery = (j) => { const line = j && j.ok && j.counts ? coinLine(j.counts) : ''; if (line) { every.textContent = line; every.hidden = false; } };
  fetch('/api/tally?of=coin', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(showEvery).catch(() => {});
  const tell = (v, n) => { if (!n || Date.now() < restUntil) return; fetch('/api/tally', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ of: 'coin', v, n }) })
    .then((r) => { if (r.status === 429) { restUntil = Date.now() + 1000 * (Number(r.headers.get('retry-after')) || 60); return null; } return r.ok ? r.json() : null; }).then(showEvery).catch(() => {}); };
  const coins = Array.from({ length: ask.n }, () => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'coin'; b.style.setProperty('--d', d + 'px'); b.style.setProperty('--rim', st.rim);
    b.innerHTML = '<span class="fc h" style="background:' + st.face + ';color:' + st.ink + '">' + st.h + '</span><span class="fc t" style="background:' + st.face + ';color:' + st.ink + '">' + st.t + '</span>';
    row.appendChild(b); return b;
  });
  const showTally = (v) => { tally.textContent = 'Heads ' + v.h.toLocaleString('en') + ' · Tails ' + v.t.toLocaleString('en') + (v.h + v.t ? ' · ' + Math.round((100 * v.h) / (v.h + v.t)) + '% heads this visit' : ''); };
  const go = () => {
    spins += 2; // each flip turns every coin a full turn more, so it visibly flips, then lands on its face: a third of a second, no fake wait
    const res = coins.map((c) => { const h = flip(ask.p); c.style.transform = 'rotateY(' + (spins * 180 + (h ? 0 : 180)) + 'deg)'; c.setAttribute('aria-label', h ? 'Heads' : 'Tails'); return h; });
    const nh = res.filter(Boolean).length, v = tallyRead(); v.h += nh; v.t += res.length - nh; tallyWrite(v);
    tell('heads', nh); tell('tails', res.length - nh);
    word.textContent = ask.n === 1 ? (res[0] ? 'Heads' : 'Tails') : nh + ' heads, ' + (res.length - nh) + ' tails';
    showTally(v);
    if (soundOn()) ring();
    if (api.say) api.say(word.textContent + '.');
  };
  for (const c of coins) c.addEventListener('click', (e) => { e.stopPropagation(); go(); });
  el.querySelector('.coin-again').addEventListener('click', (e) => { e.stopPropagation(); go(); });
  el.querySelector('.coin-reset').addEventListener('click', (e) => { e.stopPropagation(); tallyWrite({ h: 0, t: 0 }); showTally({ h: 0, t: 0 }); });
  const label = () => { snd.textContent = soundOn() ? 'Sound on' : 'Sound off'; };
  snd.addEventListener('click', (e) => { e.stopPropagation(); try { localStorage.setItem(KEY + '.sound', soundOn() ? '0' : '1'); } catch (_) {} label(); if (soundOn()) ring(); });
  label(); go();
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin toss', 'flip 3 coins', 'flip a coin 70% heads', 'flip a euro', 'toss a coin for who pays', 'flip a weighted coin 60% heads'],
  nearMisses: ['what is a coin', 'how much is a coin worth', 'coin collecting', 'flip the card', 'bitcoin price'],
  coinOf,
  flip,
  match(lower, text) { return !!coinOf(text || lower); },
  run
};

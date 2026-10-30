/**
 * coin skill: a coin flip that lands at once and looks like a coin (the tower's second rung, 2026-10-23; the scout's teardown of the coin
 * flip sites: a 3-second fake wait, ads, paragraphs of text, a clanky sound). "flip a coin", "heads or tails", "coin toss": a crisp CSS 3D
 * coin snaps to its face in a third of a second, the word under it, and a quiet tally for this visit (Heads 3 · Tails 1). Tap the coin to
 * flip again. "flip 5 coins" lays out five; "flip a coin 70% heads" weights it; "flip a euro", "a silver coin", "a bitcoin" change the face
 * (a currency sign, never a logo). A soft ring made in the browser, off until you turn it on. Fair: the device's crypto random, no network.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * The card's full-page link (data-page) opens /flip/ on the same ask, and the page's own card (lib/flip-card.js) asks for the coin open on
 * it, so the card and the page lead to each other.
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
  if (/^heads or tails$|^coin toss$|^coin (?:flip|toss)$|^(?:a )?coin (?:flip|toss)$|^toss up$/.test(t)) return { n: 1, p: 0.5, style: 'gold', for: '' };
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
import { coinAsk, FAMOUS, findCoin, cleanMine, metalFace, METALS, MINE_KEY } from '../lib/coins.js';
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
  + '.coin-tally{text-align:center;opacity:.7;font-variant-numeric:tabular-nums;margin:4px 0}.coin-tally-name{font-weight:600;margin-right:4px}.coin-tools{display:flex;gap:8px;justify-content:center;margin:6px 0}'
  + '.coin-tools button{font:inherit;font-size:12px;opacity:.75;background:transparent;color:inherit;border:1px solid currentColor;border-radius:999px;padding:2px 10px;cursor:pointer}'
  + '@media (prefers-reduced-motion:reduce){.coin{transition:none}}</style>';

// a coin's two faces, drawn without ever putting a person's words into markup: { bg, ink, txt, img } a side
function paintFace(f, side) {
  f.textContent = side.img ? '' : side.txt || ''; f.style.color = side.ink || '#5a4106';
  // a photo that holds both faces (lib/coins.js `half`) is drawn twice as wide as the face and slid to its own half, so one face shows at a time
  const url = side.img ? 'url("' + String(side.img).replace(/["\\\n]/g, '') + '")' : '';
  f.style.background = side.img ? (side.half ? side.half + ' center / 200% 100% no-repeat ' : 'center / cover no-repeat ') + url + ', #222' : side.bg;
}

/** a photo (a URL this page may read, or a data URL) as a small JPEG data URL for the appraiser, or null. */
async function photoData(src, max = 768) {
  try {
    const blob = await (await fetch(src)).blob(), bmp = await createImageBitmap(blob), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch (_) { return null; }
}

// what's it worth (owner, 2026-10-24: the coin flip "ties into our coin appraisal"): the face goes to Verse's appraiser (/api/appraise, skills/appraise.js)
// with what the coin is, and the valuation shows on the card. A made coin with no photo has nothing to value and says so.
function worthButton(el, getImage, note) {
  const tools = el.querySelector('.coin-tools'), out = document.createElement('p'); out.className = 'coin-worth'; out.style.cssText = 'text-align:center;font-size:14px;margin:6px 0;white-space:pre-line';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'coin-appraise'; b.textContent = 'What’s it worth?';
  tools.appendChild(b); tools.after(out);
  b.addEventListener('click', async (e) => {
    e.stopPropagation(); b.disabled = true; out.textContent = 'Verse is looking at the coin…';
    const image = await getImage();
    if (!image) { out.textContent = 'There is no photo of this coin to value. Photograph a real coin and ask "what is this coin worth".'; b.disabled = false; return; }
    try {
      const r = await fetch('/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, note }) });
      const j = await r.json().catch(() => null);
      out.textContent = j && j.text ? j.text : r.status === 503 ? 'The appraiser is not switched on here.' : 'The appraiser could not answer just now.';
    } catch (_) { out.textContent = 'The appraiser could not answer just now.'; }
    b.disabled = false;
  });
}

/** the coin page on an ask, as a plain query the card frame takes (lib/card-frame.js pageOfCard), else the page itself. Pure. */
export function pageOfFlip(text) {
  const q = encodeURIComponent(String(text || '').trim().replace(/\s+/g, ' '));
  return /^[A-Za-z0-9_.%-]{1,180}$/.test(q) ? '/flip/?q=' + q : '/flip/';
}

function run(text, api) {
  const page = pageOfFlip(text), show = api.showPage;
  return runCoin(text, { ...api, showPage: (build) => show((card) => { build(card); if (card.dataset) card.dataset.page = page; }) });
}

function runCoin(text, api) {
  const more = coinAsk(text), plain = more ? null : coinOf(text);
  if (!more && !plain) return 'none';
  if (more && more.kind === 'make') return designer(api);
  if (more && more.kind === 'pick') return picker(api);
  if (more && more.kind === 'mine') {
    let mine = null; try { const v = JSON.parse(localStorage.getItem(MINE_KEY) || 'null'); if (v) mine = cleanMine(v); } catch (_) {}
    if (!mine) return designer(api, 'You have not made a coin yet: make one here, then say "flip my coin".');
    return flipCard(text, api, { n: 1, p: 0.5, for: more.for }, mineLook(mine));
  }
  if (more && more.kind === 'real') {
    const name = more.name.replace(/\b\w/g, (c) => c.toUpperCase());
    const look = { title: name, rim: '#8a6a10', h: { bg: metalFace('silver'), txt: '…', ink: '#3b4047' }, t: { bg: metalFace('silver'), txt: '…', ink: '#3b4047' }, src: 'Looking for the real ' + name + ' on Wikimedia Commons…', note: 'a ' + name + ' coin' };
    const el = flipCard(text, api, { n: 1, p: 0.5, for: more.for }, look, true);
    findCoin(more.name).then((c) => {
      const card = typeof el === 'object' && el && el.querySelector ? el : null; if (!card || !card.isConnected) return;
      const src = card.querySelector('.src');
      if (!c) { src.textContent = 'Wikimedia Commons has no photo of a "' + more.name + '" coin. Try its full name ("Athenian owl tetradrachm"), or flip a famous coin.'; card.querySelectorAll('.coin .fc').forEach((f) => { f.textContent = '?'; }); return; }
      card.querySelectorAll('.coin').forEach((b) => { paintFace(b.querySelector('.fc.h'), { img: c.heads.src, half: c.heads.half }); paintFace(b.querySelector('.fc.t'), { img: c.tails.src, half: c.tails.half }); });
      src.textContent = 'Heads is its obverse, tails its reverse: real photos from Wikimedia Commons (';
      const a1 = document.createElement('a'); a1.href = c.heads.page; a1.target = '_blank'; a1.rel = 'noopener'; a1.textContent = c.heads.title;
      src.append(a1); if (c.tails !== c.heads) { const a2 = document.createElement('a'); a2.href = c.tails.page; a2.target = '_blank'; a2.rel = 'noopener'; a2.textContent = c.tails.title; src.append(', ', a2); }
      src.append('). A fair flip from this device’s secure random numbers.');
      worthButton(card, () => photoData(c.heads.src), 'a ' + name + ' coin');
    }).catch(() => {});
    return 'coin';
  }
  return flipCard(text, api, plain, null);
}

/** a made coin's look. Pure. */
function mineLook(m) {
  const ink = METALS[m.metal][3];
  return { title: (m.rim || 'My coin') + (m.year ? ' · ' + m.year : ''), rim: METALS[m.metal][2], h: { bg: metalFace(m.metal), txt: m.heads, img: m.hImg, ink }, t: { bg: metalFace(m.metal), txt: m.tails, img: m.tImg, ink },
    src: 'Your own coin, kept on this device. A fair flip from this device’s secure random numbers.', mine: m };
}

// the picker: famous coins from 600 BC to now, one tap each, and a box for any other coin
function picker(api) {
  api.showPage((card) => {
    card.innerHTML = CSS + '<h2>Pick a coin to flip</h2><p class="coin-tally">Real coins, their real faces: heads is the obverse, tails the reverse.</p><div class="coin-picks"></div>'
      + '<form class="coin-any" style="display:flex;gap:8px;justify-content:center;margin:10px 0"><input name="q" maxlength="60" placeholder="Any coin ever struck: a 1909 penny, a Ptolemaic drachm…" style="flex:1;max-width:360px;font:inherit;padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit"><button type="submit" class="g-btn">Flip it</button></form>'
      + '<div class="coin-tools"><button type="button" class="coin-make">Make your own coin</button></div><div class="src">Photos from Wikimedia Commons</div>';
    const list = card.querySelector('.coin-picks'); list.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center';
    for (const [name, when] of FAMOUS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn coin-pick'; b.title = when; b.textContent = name; b.addEventListener('click', (e) => { e.stopPropagation(); api.stage.ask('flip a ' + name); }); list.appendChild(b); }
    const f = card.querySelector('.coin-any'), q = f.querySelector('input');
    q.addEventListener('keydown', (e) => e.stopPropagation());
    f.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); const v = q.value.trim(); if (v) api.stage.ask('flip a ' + v + (/\bcoin\b/i.test(v) ? '' : ' coin')); });
    card.querySelector('.coin-make').addEventListener('click', (e) => { e.stopPropagation(); api.stage.ask('create a coin'); });
  });
  return 'coin';
}

// the coin maker: metal, a word or emoji a side, the words around the rim, a year, a photo for either side (made small here, kept on this device)
function designer(api, hello) {
  let m = cleanMine(null); try { const v = JSON.parse(localStorage.getItem(MINE_KEY) || 'null'); if (v) m = cleanMine(v); } catch (_) {}
  api.showPage((card) => {
    card.innerHTML = CSS + '<h2>Make a coin</h2>' + (hello ? '<p class="coin-tally"></p>' : '') + '<div class="coin-row"></div>'
      + '<form class="coin-make-form" style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;max-width:420px;margin:8px auto;align-items:center">'
      + '<label for="cm-metal">Metal</label><select id="cm-metal" name="metal"></select>'
      + '<label for="cm-h">Heads</label><input id="cm-h" name="heads" maxlength="6"><label for="cm-t">Tails</label><input id="cm-t" name="tails" maxlength="6">'
      + '<label for="cm-rim">Around the rim</label><input id="cm-rim" name="rim" maxlength="40" placeholder="IN COFFEE WE TRUST"><label for="cm-y">Year</label><input id="cm-y" name="year" maxlength="4" inputmode="numeric">'
      + '<label for="cm-hi">Heads photo</label><input id="cm-hi" name="hImg" type="file" accept="image/*"><label for="cm-ti">Tails photo</label><input id="cm-ti" name="tImg" type="file" accept="image/*">'
      + '</form><div class="coin-tools"><button type="button" class="coin-save">Save and flip it</button><button type="button" class="coin-clear-photos">Clear photos</button></div>'
      + '<div class="src">Kept on this device only. A photo of a real coin can be valued: save it, flip it, then "What’s it worth?".</div>';
    if (hello) card.querySelector('.coin-tally').textContent = hello;
    const f = card.querySelector('form'), sel = f.querySelector('#cm-metal');
    for (const k of Object.keys(METALS)) { const o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); }
    sel.value = m.metal; f.heads.value = m.heads; f.tails.value = m.tails; f.rim.value = m.rim; f.year.value = m.year;
    const row = card.querySelector('.coin-row'), b = document.createElement('button'); b.type = 'button'; b.className = 'coin'; b.style.setProperty('--d', '120px');
    b.innerHTML = '<span class="fc h"></span><span class="fc t"></span>'; row.appendChild(b); let turned = 0; // void-review: ok (constant markup, faces painted by paintFace)
    const draw = () => { m = cleanMine({ ...m, metal: sel.value, heads: f.heads.value, tails: f.tails.value, rim: f.rim.value, year: f.year.value }); const l = mineLook(m); b.style.setProperty('--rim', l.rim); paintFace(b.querySelector('.fc.h'), l.h); paintFace(b.querySelector('.fc.t'), l.t); };
    b.addEventListener('click', (e) => { e.stopPropagation(); turned += 180; b.style.transform = 'rotateY(' + turned + 'deg)'; });
    f.addEventListener('keydown', (e) => e.stopPropagation()); f.addEventListener('input', draw); f.addEventListener('submit', (e) => e.preventDefault());
    for (const [inp, key] of [[f.hImg, 'hImg'], [f.tImg, 'tImg']]) inp.addEventListener('change', async () => { const file = inp.files && inp.files[0]; if (!file) return; const url = URL.createObjectURL(file); m[key] = (await photoData(url, 256)) || ''; URL.revokeObjectURL(url); draw(); });
    card.querySelector('.coin-clear-photos').addEventListener('click', (e) => { e.stopPropagation(); m.hImg = ''; m.tImg = ''; f.hImg.value = ''; f.tImg.value = ''; draw(); });
    card.querySelector('.coin-save').addEventListener('click', (e) => { e.stopPropagation(); draw(); try { localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (_) {} api.stage.ask('flip my coin'); });
    draw();
  });
  return 'coin';
}

function flipCard(text, api, ask, look, keepEl) {
  const { showPage, esc } = api, st = look ? null : STYLES[ask.style], d = ask.n === 1 ? 150 : ask.n <= 4 ? 96 : 64;
  let spins = 0;
  const el = showPage((card) => {
    card.innerHTML = CSS + '<h2>' + esc(ask.for ? (look ? look.title + ' for ' : 'Coin for ') + ask.for : look ? look.title : ask.n > 1 ? ask.n + ' coins' : 'Coin') + '</h2>'
      + '<div class="coin-row"></div><div class="coin-word" aria-live="polite"></div><div class="coin-tally"><span class="coin-tally-name">Flip counter</span><span class="coin-tally-n"></span></div><div class="coin-everyone" hidden></div>'
      + '<div class="coin-tools"><button type="button" class="coin-again">Flip again</button><button type="button" class="coin-sound"></button><button type="button" class="coin-reset">Reset tally</button></div>'
      + '<div class="src">' + (look ? esc(look.src) : (ask.p === 0.5 ? 'A fair flip' : 'Weighted ' + Math.round(ask.p * 100) + '% heads') + ' from this device’s secure random numbers, no network') + '</div>'
      // on the stage, the way to the coin's own page (/flip/) and what it adds there; the page itself needs no link to itself
      + '<div class="src">Tap the coin to flip it again — the animation is drawn live, and the result is shown under the coin.</div>'
      + (typeof location !== 'undefined' && /^\/flip\//.test(location.pathname) ? '' : '<p class="coin-full" style="text-align:center;font-size:13px;margin:8px 0"><a href="/flip/" style="color:inherit">The full coin flip page: Space or Enter flips again, a Share button, and it opens offline after one visit</a></p>');
  });
  if (!el || !el.querySelector) return 'coin';
  const row = el.querySelector('.coin-row'), word = el.querySelector('.coin-word'), tally = el.querySelector('.coin-tally'), snd = el.querySelector('.coin-sound');
  // everyone's flips (owner, 2026-10-23: the global counter): one quiet line from /api/tally (lib/tally.js: a closed list, integers back), hidden
  // until the first read works; each flip is one small POST per side; a 429 rests the posts for its Retry-After. Nothing from the server is drawn but numbers.
  const every = el.querySelector('.coin-everyone'); every.className += ' coin-tally'; let restUntil = 0;
  const showEvery = (j) => { const line = j && j.ok && j.counts ? coinLine(j.counts) : ''; if (line) { every.textContent = line; every.hidden = false; } };
  // one request on load, not two (speed, 2026-10-24): the first flip's POST answers with the counts, so there is no separate read; a POST that is
  // resting (429) reads them once instead
  const read = () => fetch('/api/tally?of=coin', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(showEvery).catch(() => {});
  let shown = false; const seen = (j) => { if (j && j.ok) shown = true; showEvery(j); };
  // the everyone-count is not what the page is for, so it does not compete with loading it (speed, 2026-10-24: /flip/ waited on this request, then
  // on the browser's quiet window, and lost the tower's speed aspect to justflipacoin.com): flips are gathered and sent together a moment after the
  // page is up, one POST per side, never one per flip
  let owed = { heads: 0, tails: 0 }, timer = 0;
  const send = (v, n) => fetch('/api/tally', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ of: 'coin', v, n }) })
    .then((r) => { if (r.status === 429) { restUntil = Date.now() + 1000 * (Number(r.headers.get('retry-after')) || 60); if (!shown) { shown = true; read(); } return null; } return r.ok ? r.json() : null; }).then(seen).catch(() => {});
  const flush = () => { timer = 0; const o = owed; owed = { heads: 0, tails: 0 };
    if (Date.now() < restUntil) { if (!shown) { shown = true; read(); } return; }
    for (const v of ['heads', 'tails']) if (o[v]) send(v, Math.min(20, o[v])); };
  const tell = (v, n) => { if (!n) return; owed[v] += n; if (!timer) timer = setTimeout(flush, 1200); };
  const coins = Array.from({ length: ask.n }, () => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'coin'; b.style.setProperty('--d', d + 'px'); b.style.setProperty('--rim', look ? look.rim : st.rim);
    b.innerHTML = '<span class="fc h"></span><span class="fc t"></span>'; // void-review: ok (constant markup, faces painted by paintFace)
    paintFace(b.querySelector('.fc.h'), look ? look.h : { bg: st.face, ink: st.ink, txt: st.h }); paintFace(b.querySelector('.fc.t'), look ? look.t : { bg: st.face, ink: st.ink, txt: st.t });
    row.appendChild(b); return b;
  });
  const showTally = (v) => { tally.querySelector('.coin-tally-n').textContent = 'Heads ' + v.h.toLocaleString('en') + ' · Tails ' + v.t.toLocaleString('en') + (v.h + v.t ? ' · ' + Math.round((100 * v.h) / (v.h + v.t)) + '% heads this visit' : ''); };
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
  if (look && look.mine) worthButton(el, async () => look.mine.hImg || look.mine.tImg || null, 'a coin, photographed by its owner' + (look.mine.rim ? ': ' + look.mine.rim : ''));
  return keepEl ? el : 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin toss', 'flip 3 coins', 'flip a coin 70% heads', 'flip a euro', 'toss a coin for who pays', 'flip a weighted coin 60% heads',
    'flip a Lydian stater', 'flip a Morgan dollar', 'flip a famous coin', 'create a coin', 'flip my coin'],
  nearMisses: ['what is a coin', 'how much is a coin worth', 'coin collecting', 'flip the card', 'bitcoin price', 'flip a pancake'],
  coinOf,
  flip,
  match(lower, text) { return !!(coinAsk(text || lower) || coinOf(text || lower)); },
  run
};

/**
 * rally skill: the saved cards binder and Verse Rally, the card game every Verse card plays in (owner, 2026-10-22: "make the answer cards
 * PLAYABLE", "a saved cards collection", "super fun and easy to learn"). "my cards", "saved cards", "my deck", "card binder" open the binder;
 * "play my cards", "card battle", "verse rally", "rally" open a match; "rally tutorial" / "how do i play rally" the guided first match;
 * "daily card challenge" today's match (the same for everyone on a UTC day). Rules and Verse's play: lib/rally-rules.js (pure). The cards:
 * lib/card-deck.js, the one card record every Verse card is noted in, on this device only. Verse's own deck is the Verse Book's skill pages
 * (/skills/guide.json): real names and real lines, so its cards are earned the same way yours are. Design notes: docs/CARD-GAME.md.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as R from '../lib/rally-rules.js';
import * as D from '../lib/card-deck.js';
import { rng, seedOf } from '../lib/game-kit.js';

const BINDER = /^(?:show |open |see )?(?:my |the )?(?:saved |collected |kept )?(?:cards?|deck|card binder|binder|card collection|collection of cards)(?: binder| collection)?$/;
const PLAY = /^(?:(?:let'?s |lets |i want to |wanna |can we )?play (?:my cards|my deck|rally|verse rally|a card battle|with my cards)|card battle|(?:verse )?rally|battle (?:my cards|with my cards)|card battle (?:with|against) (?:verse|you))$/;
const TUTOR = /^(?:rally tutorial|card battle tutorial|how (?:do i|do you|to) play (?:verse )?rally|teach me (?:verse )?rally|learn (?:verse )?rally)$/;
const DAILY = /^(?:(?:the |today'?s )?daily (?:card |rally )?challenge|rally daily|daily rally)$/;
export function rallyOf(text) {
  const l = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:my|saved) cards?$/.test(l) || (BINDER.test(l) && /\b(?:my|saved|collected|kept|binder|deck|collection)\b/.test(l))) return 'binder';
  if (TUTOR.test(l)) return 'tutorial'; if (DAILY.test(l)) return 'daily'; if (PLAY.test(l)) return 'play';
  return null;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HUE = { sky: 205, land: 120, life: 340, word: 275, number: 40 };
const GLYPH = { sky: '☾', land: '⛰', life: '❦', word: '✎', number: '∑' };
const CSS = [
  '.rally{--gold:#ffd27a}.rally .r-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}.rally button,.rally select,.rally input{font:inherit;font-size:14px;color:#ece8dc;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.22);border-radius:8px;padding:6px 10px;min-height:34px}',
  '.rally button:focus-visible,.rally input:focus-visible,.rally select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}.rally .on{border-color:var(--gold);color:#fff}',
  '.rally .r-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.rally .r-tools input{flex:1 1 160px;min-width:0}.rally .r-note{font-size:13px;color:#b9b4a6;margin:6px 0;overflow-wrap:anywhere}',
  '.rally details.r-item{border:1px solid hsl(var(--h) 40% 45% / .6);border-radius:10px;margin:6px 0;padding:6px 10px;background:hsl(var(--h) 30% 12% / .55)}.rally details.r-item summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;overflow-wrap:anywhere}',
  '.rally .r-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.5;color:#e4e0d4;margin:8px 0}.rally .r-meta{font-size:12px;color:#c4bfb0}.rally .r-acts{display:flex;flex-wrap:wrap;gap:6px}',
  '.rally .r-hand,.rally .r-row{display:flex;flex-wrap:wrap;gap:6px;min-height:64px;align-items:flex-start}.rally .r-lab{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b9b4a6;margin-top:8px;display:flex;justify-content:space-between;gap:8px}',
  '.rally .r-card{width:118px;min-height:92px;text-align:left;padding:6px 7px;border-radius:9px;border:1px solid hsl(var(--h) 60% 60%);background:linear-gradient(160deg,hsl(var(--h) 40% 20%),hsl(var(--h) 30% 10%));display:flex;flex-direction:column;gap:3px;position:relative;will-change:transform}',
  '.rally .r-card .n{font-size:12px;line-height:1.25;overflow-wrap:anywhere;color:#f3efe2}.rally .r-card .p{position:absolute;right:6px;top:4px;font-size:16px;font-weight:700;color:var(--gold)}.rally .r-card .t{font-size:11px;color:hsl(var(--h) 70% 80%)}.rally .r-card .a{font-size:10.5px;color:#d8d2c2}',
  '.rally .r-card .n{padding-right:22px}.rally .r-card.edge::after{content:"▲ +3";position:absolute;right:5px;bottom:4px;font-size:10px;color:#9be59b}.rally .r-card.in{animation:r-in .28s ease-out}@keyframes r-in{from{transform:translateY(24px) scale(.92);opacity:0}to{transform:none;opacity:1}}',
  '.rally .r-hand .r-card:hover{transform:translateY(-3px)}.rally .r-hand .r-card[disabled]{opacity:.55}.rally .r-score{font-size:22px;font-weight:700;color:var(--gold)}.rally .r-score.bump{animation:r-bump .3s}@keyframes r-bump{50%{transform:scale(1.25)}}',
  '.rally .r-hint{border:1px solid var(--gold);border-radius:10px;padding:8px 10px;margin:8px 0;font-size:14px;line-height:1.45;background:rgba(255,210,122,.08)}.rally .r-wheel{font-size:12.5px;color:#d8d2c2;margin:4px 0}',
  '.rally .r-log{font-size:12.5px;color:#c4bfb0;margin:6px 0;padding-left:18px}.rally .r-win{font-size:18px;font-weight:700;color:var(--gold);margin:8px 0}',
  '@media (prefers-reduced-motion:reduce){.rally .r-card.in,.rally .r-score.bump{animation:none}.rally .r-hand .r-card:hover{transform:none}}',
].join('');
const ui = (k) => { try { return localStorage.getItem('verse.rally.' + k); } catch (_) { return null; } };
const setUi = (k, v) => { try { localStorage.setItem('verse.rally.' + k, String(v)); } catch (_) {} };
let audio = null;
function blip(f, d = 0.08) { // a short tone; off when "sound off" is on
  if (ui('mute') === '1') return; try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; o.type = 'triangle'; g.gain.setValueAtTime(0.06, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d); o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {}
}
let bookP = null;
const exs = (e) => (Array.isArray(e) ? e : String(e || '').match(/'([^']+)'|"([^"]+)"/g) || []).map((x) => String(x).replace(/^['"]|['"]$/g, ''));
const TIER = { proven: 'rare', checked: 'uncommon', tested: 'common', experiment: 'common' }; // a Book skill's evidence rating, one step under an answer's own rarity scale
const bookCards = () => (bookP = bookP || fetch('/skills/guide.json').then((r) => (r.ok ? r.json() : null)).then((g) => (g && Array.isArray(g.pages) ? g.pages : []).filter((p) => p.kind === 'skill' && p.title && p.line).map((p) => R.cardFrom({ t: p.title, b: [p.line, ...exs(p.examples).map((e) => '- ' + e), p.flavor || ''].filter(Boolean).join('\n'), src: 0, rarity: TIER[p.tier] || '' }))).catch(() => []));
const tile = (c, extra = '') => '<span class="n">' + esc(c.name) + '</span><span class="p">' + (c.now != null ? c.now : c.power) + '</span><span class="t">' + GLYPH[c.type] + ' ' + R.TYPE_NAME[c.type] + (c.rarity && c.rarity !== 'common' ? ' · ' + esc(c.rarity) : '') + '</span>' + (c.ability ? '<span class="a">' + esc(R.ABILITIES[c.ability].split(':')[0]) + '</span>' : '') + extra;

function mountPage(el, mode, api) {
  if (!document.getElementById('rally-style')) { const st = document.createElement('style'); st.id = 'rally-style'; st.textContent = CSS; document.head.appendChild(st); }
  el.dataset.cardPlain = ''; el.dataset.noDeck = ''; el.classList.add('rally');
  el.innerHTML = '<h2>' + (mode === 'binder' ? 'My cards' : 'Verse Rally') + '</h2><div class="r-tabs" role="tablist"></div><div class="r-main"></div>';
  const tabs = el.querySelector('.r-tabs'), main = el.querySelector('.r-main');
  const TABS = [['binder', 'My cards'], ['play', 'Play'], ['tutorial', 'Learn (1 min)'], ['daily', 'Daily challenge']];
  const go = (m) => { mode = m; for (const b of tabs.children) { b.classList.toggle('on', b.dataset.m === m); b.setAttribute('aria-selected', String(b.dataset.m === m)); } el.querySelector('h2').textContent = m === 'binder' ? 'My cards' : 'Verse Rally'; (m === 'binder' ? binder : match)(m); };
  for (const [m, label] of TABS) { const b = document.createElement('button'); b.type = 'button'; b.dataset.m = m; b.setAttribute('role', 'tab'); b.textContent = label; b.addEventListener('click', () => go(m)); tabs.appendChild(b); }
  const f = { q: '', kind: '', sort: 'date', saved: false };
  function binder() {
    main.innerHTML = '<div class="r-tools"><input type="search" placeholder="search my cards" aria-label="search my cards"><select aria-label="kind"><option value="">every kind</option>' + D.KINDS.map((k) => '<option>' + k + '</option>').join('') + '</select><select aria-label="sort"><option value="date">newest</option><option value="name">name</option><option value="power">power</option></select><button type="button" class="r-sv" aria-pressed="false">saved only</button></div><div class="r-note"></div><div class="r-list"></div>';
    const [q, kind, sort] = main.querySelectorAll('input,select'), sv = main.querySelector('.r-sv'), note = main.querySelector('.r-note'), list = main.querySelector('.r-list');
    q.value = f.q; kind.value = f.kind; sort.value = f.sort; sv.classList.toggle('on', f.saved); sv.setAttribute('aria-pressed', String(f.saved));
    const draw = () => {
      const every = D.all(), rows = D.view(every, f), saved = every.filter((x) => x.saved).length;
      note.textContent = every.length ? every.length + ' card' + (every.length === 1 ? '' : 's') + ' collected on this device, ' + saved + ' saved. Every card you are shown is collected here and plays in Verse Rally. Showing ' + rows.length + '.' : 'No cards yet. Ask Verse anything: every answer card lands here and becomes playable. Tap ☆ save on a card to pin it.';
      list.innerHTML = rows.slice(0, 200).map((r) => { const p = D.playOf(r); return '<details class="r-item" style="--h:' + HUE[p.type] + '" data-id="' + esc(r.id) + '"><summary><b>' + esc(r.t) + '</b><span class="r-meta">' + esc(r.kind + (r.game ? ' · ' + r.game : '') + ' · ' + new Date(r.at || 0).toISOString().slice(0, 10)) + (r.saved ? ' · ★ saved' : '') + '</span><span class="r-meta">' + GLYPH[p.type] + ' ' + R.TYPE_NAME[p.type] + ' · power ' + p.power + (p.ability ? ' · ' + esc(R.ABILITIES[p.ability].split(':')[0]) : '') + '</span></summary>'
        + (r.k ? '<div class="r-meta">' + esc(r.k) + '</div>' : '') + '<div class="r-body">' + esc(r.b || '(no text)') + '</div>' + (p.ability ? '<div class="r-meta">' + esc(R.ABILITIES[p.ability]) + '</div>' : '')
        + '<div class="r-acts"><button type="button" data-a="open">open</button><button type="button" data-a="save">' + (r.saved ? 'unsave' : '☆ save') + '</button><button type="button" data-a="play">play with it</button><button type="button" data-a="del">remove</button></div></details>'; }).join('') + (rows.length > 200 ? '<div class="r-note">Showing the first 200 of ' + rows.length + '; search to narrow it.</div>' : '');
    };
    q.addEventListener('input', () => { f.q = q.value; draw(); }); kind.addEventListener('change', () => { f.kind = kind.value; draw(); }); sort.addEventListener('change', () => { f.sort = sort.value; draw(); });
    sv.addEventListener('click', () => { f.saved = !f.saved; sv.classList.toggle('on', f.saved); sv.setAttribute('aria-pressed', String(f.saved)); draw(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.closest('[data-id]').dataset.id, r = D.all().find((x) => x.id === id); if (!r) return;
      if (b.dataset.a === 'save') { D.setSaved(r, !r.saved); draw(); } else if (b.dataset.a === 'del') { D.remove(id); draw(); }
      else if (b.dataset.a === 'play') { pinned = id; go('play'); }
      else if (b.dataset.a === 'open' && api && api.showPage) api.showPage((p) => { p.dataset.cardKind = r.k || 'Answer'; p.innerHTML = '<h2>' + esc(r.t) + '</h2>' + String(r.b || '').split(/\n{2,}/).filter(Boolean).map((x) => '<p>' + esc(x) + '</p>').join('') + '<div class="src">from my cards, kept on this device</div>'; });
    });
    draw();
  }
  let pinned = null, s = null, tut = false;
  async function match(m) {
    tut = m === 'tutorial'; main.innerHTML = '<div class="r-note">shuffling…</div>';
    const book = await bookCards(), mine = D.all().map(D.playOf), pool = book.length ? book : [R.cardFrom({ t: 'Verse', b: 'Answers anything.' })];
    const today = new Date().toISOString().slice(0, 10), seed = m === 'daily' ? R.dailySeed(today) : tut ? 7 : (Date.now() >>> 0);
    const r = rng(seed), pickN = (list, n) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
    let you = mine.length >= 12 && !tut ? mine : mine.concat(pickN(pool, 12 - Math.min(12, mine.length))); // a new collection is topped up with starter cards from the Book
    if (pinned) { const pc = D.all().find((x) => x.id === pinned); if (pc) { const c = D.playOf(pc); you = [c, ...you.filter((x) => x.id !== c.id)]; } }
    if (m === 'daily') you = pickN(pool, 12); // the daily challenge: everyone gets the same two decks today
    const verse = pickN(pool.filter((c) => !you.some((y) => y.id === c.id)), 12);
    const level = tut ? 1 : m === 'daily' ? 3 : +(ui('level') || 2);
    s = R.newMatch(you, verse, seed, level);
    if (pinned) { const i = s.hand.you.findIndex((c) => c.id === you[0].id); if (i < 0) s.hand.you[0] = you[0]; pinned = null; }
    draw(true);
  }
  function hint() {
    if (!tut || !s) return '';
    const played = s.row.you.length, edge = s.hand.you.some((c) => R.landing(s, 'you', c).why.some((w) => /^Edge/.test(w)));
    if (s.over) return 'That is the whole game. Every answer Verse gives you becomes a card here, so your deck grows as you use Verse. Try Play next, or the Daily challenge.';
    if (s.round === 1 && played === 0) return 'Each card is an answer you got from Verse. The big number is its power. Tap a card in your hand to play it into your row.';
    if (edge && s.round === 1) return 'See the ▲ +3? Types beat each other in a wheel: Sky beats Land, Land beats Life, Life beats Word, Word beats Number, Number beats Sky. Play a card whose type beats Verse’s last card for +3.';
    if (R.score(s.row.you) > R.score(s.row.verse) && s.round === 1) return 'You are ahead. Tap Pass to stop playing this round. Your unplayed cards stay in your hand for the next rounds. Winning two rounds wins the game, so saving cards is the trick.';
    if (s.round >= 2) return 'Round ' + s.round + '. You drew two more cards. Win this round to take the game. Pass when you are far enough ahead, keep playing when behind.';
    return 'Your row adds up. Get bigger than Verse’s row, then pass.';
  }
  function draw(fresh) {
    const mineTurn = s.turn === 'you' && !s.over && !s.passed.you, a = R.score(s.row.you), b = R.score(s.row.verse);
    main.innerHTML = (tut || fresh ? '' : '') + '<div class="r-hint" aria-live="polite"' + (tut ? '' : ' hidden') + '>' + esc(hint()) + '</div>'
      + '<div class="r-wheel">Round ' + s.round + ' of 3 · rounds won: you ' + s.wins.you + ', Verse ' + s.wins.verse + ' · Verse plays ' + esc(R.LEVELS[s.level]) + ' · wheel: ☾Sky › ⛰Land › ❦Life › ✎Word › ∑Number › ☾Sky (+3)</div>'
      + '<div class="r-lab"><span>Verse' + (s.passed.verse ? ' · passed' : '') + ' · ' + s.hand.verse.length + ' in hand</span><span class="r-score" data-k="v">' + b + '</span></div><div class="r-row r-foe">' + s.row.verse.map((c, i) => '<div class="r-card' + (i === s.row.verse.length - 1 ? ' in' : '') + '" style="--h:' + HUE[c.type] + '">' + tile(c) + '</div>').join('') + '</div>'
      + '<div class="r-lab"><span>You' + (s.passed.you ? ' · passed' : '') + '</span><span class="r-score" data-k="y">' + a + '</span></div><div class="r-row r-me">' + s.row.you.map((c, i) => '<div class="r-card' + (i === s.row.you.length - 1 ? ' in' : '') + '" style="--h:' + HUE[c.type] + '">' + tile(c) + '</div>').join('') + '</div>'
      + '<div class="r-lab"><span>Your hand · tap a card to play it</span></div><div class="r-hand">' + s.hand.you.map((c) => { const l = R.landing(s, 'you', c); return '<button type="button" class="r-card' + (l.why.some((w) => /^Edge/.test(w)) ? ' edge' : '') + '" style="--h:' + HUE[c.type] + '" data-id="' + esc(c.id) + '"' + (mineTurn ? '' : ' disabled') + ' title="' + esc(c.name + ': ' + (c.ability ? R.ABILITIES[c.ability] : 'no ability') + (l.why.length ? '. Now: ' + l.why.join(', ') : '')) + '" aria-label="' + esc(c.name + ', ' + R.TYPE_NAME[c.type] + ', power ' + c.power + ', lands at ' + l.n + (c.ability ? ', ' + R.ABILITIES[c.ability] : '')) + '">' + tile(c) + '</button>'; }).join('') + '</div>'
      + '<div class="r-acts" style="margin-top:8px"><button type="button" class="r-pass"' + (mineTurn ? '' : ' disabled') + '>Pass</button><button type="button" class="r-new">New match</button><select class="r-lv" aria-label="Verse’s level">' + Object.entries(R.LEVELS).map(([k, v]) => '<option value="' + k + '"' + (+k === s.level ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select><button type="button" class="r-mute" aria-pressed="' + (ui('mute') === '1') + '">' + (ui('mute') === '1' ? 'sound off' : 'sound on') + '</button></div>'
      + (s.over ? '<div class="r-win">' + (s.over.winner === 'you' ? 'You win, ' : s.over.winner === 'verse' ? 'Verse wins, ' : 'A draw, ') + s.wins.you + ' rounds to ' + s.wins.verse + '.</div>' : '')
      + '<ol class="r-log">' + s.log.slice(-4).reverse().map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol>';
    for (const c of main.querySelectorAll('.r-hand .r-card')) c.addEventListener('click', () => act({ type: 'play', id: c.dataset.id }));
    main.querySelector('.r-pass').addEventListener('click', () => act({ type: 'pass' }));
    main.querySelector('.r-new').addEventListener('click', () => match(mode));
    main.querySelector('.r-lv').addEventListener('change', (e) => { setUi('level', e.target.value); s.level = +e.target.value; draw(); });
    main.querySelector('.r-mute').addEventListener('click', () => { setUi('mute', ui('mute') === '1' ? '0' : '1'); draw(); });
    if (s.over && !s.recorded) { s.recorded = true; blip(s.over.winner === 'you' ? 880 : 220, 0.3); if (mode === 'daily') setUi('daily', new Date().toISOString().slice(0, 10) + ':' + s.over.winner); }
  }
  let timer = null;
  function act(a) {
    try { s = R.apply(s, a); } catch (_) { return; } blip(a.type === 'pass' ? 330 : 520); draw(); verseTurn();
  }
  function verseTurn() {
    clearTimeout(timer); if (!s || s.over || s.turn !== 'verse') return;
    timer = setTimeout(() => { if (!el.isConnected) return; const m = R.verseMove(s); if (!m) return; s = R.apply(s, m); blip(m.type === 'pass' ? 260 : 440); draw(); const sc = main.querySelector('.r-score[data-k="v"]'); if (sc) sc.classList.add('bump'); verseTurn(); }, 520);
  }
  go(mode === 'binder' ? 'binder' : mode);
}

function run(text, api) {
  const mode = rallyOf(text) || 'binder';
  api.showPage((el) => mountPage(el, mode, api));
  return 'rally';
}

export default {
  name: 'rally',
  rallyOf,
  examples: ['play my cards', 'card battle', 'my cards', 'saved cards', 'my deck', 'card binder', 'verse rally', 'rally tutorial', 'daily card challenge'],
  nearMisses: ['play cards', 'card duel', 'my card was declined', 'my credit cards', 'rally car racing', 'pokemon cards price'],
  match(lower, text) { return !!rallyOf(text || lower); },
  run,
};

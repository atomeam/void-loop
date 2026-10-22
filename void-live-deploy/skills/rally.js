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
import { artSvg } from '../lib/card-art.js';
import * as F from '../lib/forge-duel.js';

const BINDER = /^(?:show |open |see )?(?:my |the )?(?:saved |collected |kept )?(?:cards?|deck|card binder|binder|card collection|collection of cards)(?: binder| collection)?$/;
const PLAY = /^(?:(?:let'?s |lets |i want to |wanna |can we )?play (?:my cards|my deck|rally|verse rally|a card battle|with my cards)|card battle|(?:verse )?rally|battle (?:my cards|with my cards)|card battle (?:with|against) (?:verse|you))$/;
const TUTOR = /^(?:rally tutorial|card battle tutorial|how (?:do i|do you|to) play (?:verse )?rally|teach me (?:verse )?rally|learn (?:verse )?rally)$/;
const LANES = /^(?:(?:let'?s |lets |i want to |wanna )?play )?(?:a |the )?(?:forge duel|three[- ]lane (?:duel|mode|game|rally)|lane duel|lanes mode)$/;
const FORGE = /^(?:forge a card|forge (?:a )?card from (?:this|text|my text)|make a (?:playable )?card from (?:this|this text|text|my text)|turn (?:this|text|my text) into a (?:playable )?card)(?:\s*[:\-]\s*([\s\S]{1,1200}))?$/;
const HELP = /^(?:(?:verse )?rally help|forge duel help|card game help|help with (?:the )?card game|how (?:do i|to) play (?:the )?forge duel|card game rules|rally rules|my (?:card game )?record|card game record)$/;
const DAILY = /^(?:(?:the |today'?s )?daily (?:card |rally )?challenge|rally daily|daily rally)$/;
export function rallyOf(text) {
  const l = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:my|saved) cards?$/.test(l) || (BINDER.test(l) && /\b(?:my|saved|collected|kept|binder|deck|collection)\b/.test(l))) return 'binder';
  if (LANES.test(l)) return 'lanes'; if (FORGE.test(l)) return 'forge'; if (HELP.test(l)) return 'help';
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
  '.rally .r-art{display:block;height:34px;margin:-2px -3px 2px;border-radius:6px;overflow:hidden;pointer-events:none}.rally .r-art svg{width:100%;height:100%;display:block}.rally .r-card .p{z-index:1;text-shadow:0 1px 3px #000}.rally .r-card .n{padding-right:4px}.rally .r-card.edge::after{content:"▲ +3";position:absolute;right:5px;bottom:4px;font-size:10px;color:#9be59b}.rally .r-card.in{animation:r-in .28s ease-out}@keyframes r-in{from{transform:translateY(24px) scale(.92);opacity:0}to{transform:none;opacity:1}}',
  '.rally .r-hand .r-card:hover{transform:translateY(-3px)}.rally .r-hand .r-card[disabled]{opacity:.55}.rally .r-score{font-size:22px;font-weight:700;color:var(--gold)}.rally .r-score.bump{animation:r-bump .3s}@keyframes r-bump{50%{transform:scale(1.25)}}',
  '.rally .r-hint{border:1px solid var(--gold);border-radius:10px;padding:8px 10px;margin:8px 0;font-size:14px;line-height:1.45;background:rgba(255,210,122,.08)}.rally .r-wheel{font-size:12.5px;color:#d8d2c2;margin:4px 0}',
  '.rally .r-log{font-size:12.5px;color:#c4bfb0;margin:6px 0;padding-left:18px}.rally .r-win{font-size:18px;font-weight:700;color:var(--gold);margin:8px 0}',
  '.rally .r-lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.rally .r-lane{display:flex;flex-direction:column;gap:4px;text-align:left;min-height:120px;padding:6px}.rally .r-lane.tgt{border-color:var(--gold)}.rally .r-lane .r-row{min-height:30px;gap:3px}.rally .r-mini{width:100%;min-height:0;padding:3px 5px}.rally .r-mini .n{font-size:11px}.rally .r-mini .p{font-size:12px;top:2px}.rally .r-bar{display:block;height:4px;border-radius:2px;background:linear-gradient(90deg,#e8a0a8 var(--w),#9be59b var(--w))}.rally .r-card.sel{outline:2px solid var(--gold);outline-offset:2px}',
  '.rally [hidden]{display:none!important}@media (max-width:520px){.rally .r-tabs{gap:4px}.rally .r-tabs button{font-size:12.5px;padding:4px 7px;min-height:30px}}.rally .r-pager{justify-content:center;align-items:center;margin-top:8px}@media (max-width:520px){.rally .r-hand .r-card,.rally .r-row>.r-card:not(.r-mini){width:calc(33.3% - 4px);min-height:0}.rally .r-art{height:22px}.rally .r-hand:not(.f-hand) .r-card .a{display:none}.rally .r-lane{min-height:90px}.rally .r-log li:nth-child(n+3){display:none}}',
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
const bookCards = () => (bookP = bookP || fetch('/skills/guide.json').then((r) => (r.ok ? r.json() : null)).then((g) => (g && Array.isArray(g.pages) ? g.pages : []).filter((p) => p.kind === 'skill' && p.title && p.line).map((p) => R.cardFrom({ spread: true, proven: p.tier === 'proven', t: p.title, b: [p.line, ...exs(p.examples).map((e) => '- ' + e), p.flavor || ''].filter(Boolean).join('\n'), src: 0, rarity: TIER[p.tier] || '' }))).catch(() => []));
// the card's own art in the match (the same plate its answer card draws, lib/card-art.js), drawn once per card and kept
const ARTS = new Map();
const artOf = (c) => { if (!ARTS.has(c.id)) { let svg = ''; try { svg = artSvg({ key: c.name, name: c.name, hue: HUE[c.type] }, { w: 120, h: 40 }); } catch (_) {} if (ARTS.size > 400) ARTS.clear(); ARTS.set(c.id, svg); } return ARTS.get(c.id); };
const tile = (c, extra = '') => '<span class="r-art" aria-hidden="true">' + artOf(c) + '</span><span class="n">' + esc(c.name) + '</span><span class="p">' + (c.now != null ? c.now : c.power) + '</span><span class="t">' + GLYPH[c.type] + ' ' + R.TYPE_NAME[c.type] + (c.rarity && c.rarity !== 'common' ? ' · ' + esc(c.rarity) : '') + '</span>' + (c.ability ? '<span class="a">' + esc(R.ABILITIES[c.ability].split(':')[0]) + '</span>' : '') + extra;

function mountPage(el, mode, api) {
  if (!document.getElementById('rally-style')) { const st = document.createElement('style'); st.id = 'rally-style'; st.textContent = CSS; document.head.appendChild(st); }
  el.dataset.cardPlain = ''; el.dataset.noDeck = ''; el.classList.add('rally');
  el.innerHTML = '<h2>' + (mode === 'binder' ? 'My cards' : 'Verse Rally') + '</h2><div class="r-tabs" role="tablist"></div><div class="r-main"></div>'; // void-review: ok: two fixed strings, no user text
  const tabs = el.querySelector('.r-tabs'), main = el.querySelector('.r-main');
  const TABS = [['binder', 'My cards'], ['play', 'Play'], ['lanes', 'Three lanes'], ['forge', 'Forge a card'], ['tutorial', 'Learn (1 min)'], ['daily', 'Daily challenge'], ['help', 'Help']];
  const go = (m) => { mode = m; for (const b of tabs.children) { b.classList.toggle('on', b.dataset.m === m); b.setAttribute('aria-selected', String(b.dataset.m === m)); } el.querySelector('h2').textContent = m === 'binder' ? 'My cards' : 'Verse Rally'; ({ binder, lanes: lanesTab, forge: forgeTab, help: helpTab }[m] || match)(m); };
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
  async function match(m, fresh) {
    tut = m === 'tutorial'; undo = [];
    const kept = !fresh && !tut && !pinned ? saved(m) : null; if (kept) { s = kept; draw(); verseTurn(); return; } // a reload resumes the same match, on the same turn
    main.innerHTML = '<div class="r-note">shuffling…</div>';
    const book = await bookCards(), mine = D.all().map(D.playOf), pool = book.length ? book : [R.cardFrom({ t: 'Verse', b: 'Answers anything.' })];
    const today = new Date().toISOString().slice(0, 10), seed = m === 'daily' ? R.dailySeed(today) : tut ? 7 : (Date.now() >>> 0);
    const r = rng(seed);
    let you = mine.length >= 12 && !tut ? mine : mine.concat(R.balancedPick(pool, 12 - Math.min(12, mine.length), r)); // a new collection is topped up with starter cards from the Book
    if (pinned) { const pc = D.all().find((x) => x.id === pinned); if (pc) { const c = D.playOf(pc); you = [c, ...you.filter((x) => x.id !== c.id)]; } }
    if (m === 'daily') you = R.balancedPick(pool, 12, r); // the daily challenge: everyone gets the same two decks today
    const verse = R.balancedPick(pool.filter((c) => !you.some((y) => y.id === c.id)), 12, r);
    const level = tut ? 1 : m === 'daily' ? 3 : +(ui('level') || 2);
    s = R.newMatch(you, verse, seed, level);
    if (pinned) { const i = s.hand.you.findIndex((c) => c.id === you[0].id); if (i < 0) s.hand.you[0] = you[0]; pinned = null; }
    keep(m);
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
      + '<div class="r-acts" style="margin-top:8px"><button type="button" class="r-pass"' + (mineTurn ? '' : ' disabled') + '>Pass</button><button type="button" class="r-undo"' + (undo.length && !s.over ? '' : ' disabled') + '>Undo</button><button type="button" class="r-new">New match</button><select class="r-lv" aria-label="Verse’s level">' + Object.entries(R.LEVELS).map(([k, v]) => '<option value="' + k + '"' + (+k === s.level ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select><button type="button" class="r-mute" aria-pressed="' + (ui('mute') === '1') + '">' + (ui('mute') === '1' ? 'sound off' : 'sound on') + '</button></div>'
      + (s.over ? '<div class="r-win">' + (s.over.winner === 'you' ? 'You win, ' : s.over.winner === 'verse' ? 'Verse wins, ' : 'A draw, ') + s.wins.you + ' rounds to ' + s.wins.verse + '.</div>' : '')
      + (s.over && s.over.winner === 'you' && !s.prize ? '<div class="r-note">You won: keep one of Verse’s cards.</div><div class="r-acts r-prize">' + verseCards().map((c) => '<button type="button" data-id="' + esc(c.id) + '">keep ' + esc(c.name) + '</button>').join('') + '</div>' : s.prize ? '<div class="r-note">Kept ' + esc(s.prize) + ': it is in My cards now.</div>' : '')
      + '<div class="r-note">' + esc(recordLine()) + '</div>'
      + '<ol class="r-log">' + s.log.slice(-4).reverse().map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol>';
    for (const c of main.querySelectorAll('.r-hand .r-card')) c.addEventListener('click', () => act({ type: 'play', id: c.dataset.id }));
    main.querySelector('.r-pass').addEventListener('click', () => act({ type: 'pass' }));
    main.querySelector('.r-new').addEventListener('click', () => match(mode, true));
    main.querySelector('.r-undo').addEventListener('click', () => { if (!undo.length) return; clearTimeout(timer); s = undo.pop(); keep(mode); draw(); });
    for (const b of main.querySelectorAll('.r-prize button')) b.addEventListener('click', () => { const c = verseCards().find((x) => x.id === b.dataset.id); if (!c) return; D.setSaved({ kind: 'game', game: 'Verse Rally', t: c.name, b: c.text || c.name, k: R.TYPE_NAME[c.type] + ' card won from Verse' }, true); s.prize = c.name; keep(mode); draw(); });
    main.querySelector('.r-lv').addEventListener('change', (e) => { setUi('level', e.target.value); s.level = +e.target.value; draw(); });
    main.querySelector('.r-mute').addEventListener('click', () => { setUi('mute', ui('mute') === '1' ? '0' : '1'); draw(); });
    if (s.over && !s.recorded) { s.recorded = true; tally('rally', s.over.winner); keep(mode); blip(s.over.winner === 'you' ? 880 : 220, 0.3); if (mode === 'daily') setUi('daily', new Date().toISOString().slice(0, 10) + ':' + s.over.winner); }
  }
  let timer = null;
  function act(a) {
    const before = s; try { s = R.apply(s, a); } catch (_) { return; } undo.push(before); if (undo.length > 20) undo.shift(); keep(mode); blip(a.type === 'pass' ? 330 : 520); draw(); verseTurn();
  }
  function verseTurn() {
    clearTimeout(timer); if (!s || s.over || s.turn !== 'verse') return;
    timer = setTimeout(() => { if (!el.isConnected) return; const m = R.verseMove(s); if (!m) return; s = R.apply(s, m); keep(mode); blip(m.type === 'pass' ? 260 : 440); draw(); const sc = main.querySelector('.r-score[data-k="v"]'); if (sc) sc.classList.add('bump'); verseTurn(); }, 520);
  }
  // save and resume: the match on the table is kept on this device after every move, per mode, and a reopened page carries on from it
  let undo = [];
  const saveKey = (m) => 'game.' + (m === 'daily' ? 'daily.' + new Date().toISOString().slice(0, 10) : m);
  function saved(m) { try { const j = JSON.parse(ui(saveKey(m)) || 'null'); return j && j.hand && j.row && !j.over ? j : null; } catch (_) { return null; } }
  function keep(m) { if (s && m !== 'tutorial') setUi(saveKey(m), JSON.stringify(s)); }
  const verseCards = () => { const seen = new Map(); for (const c of [...s.row.verse, ...s.hand.verse, ...s.deck.verse]) seen.set(c.id, c); return [...seen.values()].slice(0, 6); };

  // Three lanes: Forge Duel (lib/forge-duel.js), its cards forged from My cards' own text
  let L = null, Lsel = null, Lundo = [];
  const lget = () => { try { const j = JSON.parse(ui('lanes') || 'null'); return j && j.lanes && !j.over ? j : null; } catch (_) { return null; } };
  const lsave = () => setUi('lanes', JSON.stringify(L));
  const myForged = () => D.view(D.all(), {}).sort((a, b) => (b.saved - a.saved) || (b.at - a.at)).slice(0, 12).map((r) => F.forge(r.b && r.b.length > 8 ? r.b : r.t, r.t));
  function lprep() { const t = F.think(L, 'v', { ms: 60 }); L.read = { win: t.win, lane: t.lane, sims: t.sims }; if (F.leader(L.turn) === 'v') { L.log.push('Verse leads turn ' + L.turn + ' and plays first.'); for (const [u, l] of t.plan) F.play(L, 'v', u, l); L.vpending = []; } else L.vpending = t.plan; }
  function lanesTab(m, fresh) {
    L = !fresh && lget(); Lundo = []; Lsel = null;
    if (!L) { L = F.newState(myForged(), (Date.now() ^ F.fnv(String(Math.random()))) >>> 0); L.log.push('New duel. Verse shuffles its deck.'); lprep(); }
    else if (!L.vpending) lprep();
    lsave(); ldraw();
  }
  const mini = (c) => '<div class="r-card r-mini" style="--h:' + LHUE[c.type] + '" title="' + esc(c.title + ' · ' + c.type + ' · ' + c.ability + '\n' + c.text) + '"><span class="n">' + esc(c.title) + '</span><span class="p">' + c.pow + '</span></div>';
  function ldraw() {
    const T = F.totals(L), e = F.energy(L) - L.spent.p, read = L.read || { win: 0.5, lane: [0.5, 0.5, 0.5], sims: 0 };
    main.innerHTML = '<div class="r-wheel">Turn ' + L.turn + ' of ' + F.MAXT + ' · energy ' + e + ' · Verse holds ' + L.hand.v.length + ' · win two of three lanes. Verse played out ' + read.sims + ' practice games and rates its chances at ' + Math.round(read.win * 100) + '%.</div>'
      + '<div class="r-lanes">' + L.lanes.map((ln, i) => '<button type="button" class="r-lane' + (Lsel ? ' tgt' : '') + '" data-l="' + i + '"><span class="r-lab"><span>Lane ' + (i + 1) + '</span><span>Verse ' + T[i].v + ' · you ' + T[i].p + '</span></span><span class="r-row">' + ln.v.map(mini).join('') + '</span><span class="r-bar" style="--w:' + Math.round((read.lane[i] || 0.5) * 100) + '%"></span><span class="r-row">' + ln.p.map(mini).join('') + '</span></button>').join('') + '</div>'
      + '<div class="r-lab"><span>Your hand · tap a card, then a lane</span></div><div class="r-hand">' + L.hand.p.map((c) => '<button type="button" class="r-card' + (c.uid === Lsel ? ' sel' : '') + '" style="--h:' + LHUE[c.type] + '" data-u="' + esc(c.uid) + '"' + (c.cost > e || L.over ? ' disabled' : '') + ' aria-label="' + esc(c.title + ', ' + c.type + ', cost ' + c.cost + ', power ' + c.pow + ', ' + c.ability) + '"><span class="r-art" aria-hidden="true">' + artOf({ id: 'f' + c.id, name: c.title, type: FT[c.type] }) + '</span><span class="n">' + esc(c.title) + '</span><span class="p">' + c.pow + '</span><span class="t">' + esc(c.type + ' · cost ' + c.cost + ' · ' + c.rarity) + '</span><span class="a">' + esc(c.ability) + '</span></button>').join('') + '</div>'
      + '<div class="r-acts" style="margin-top:8px"><button type="button" class="l-undo"' + (Lundo.length ? '' : ' disabled') + '>Undo</button><button type="button" class="l-end"' + (L.over ? ' disabled' : '') + '>End turn</button><button type="button" class="l-new">New duel</button></div>'
      + (L.over ? lend() : '') + '<div class="r-note">' + esc(recordLine()) + '</div><ol class="r-log">' + L.log.slice(-4).reverse().map((t) => '<li>' + esc(t) + '</li>').join('') + '</ol>';
    for (const b of main.querySelectorAll('.r-hand .r-card')) b.addEventListener('click', () => { Lsel = Lsel === b.dataset.u ? null : b.dataset.u; ldraw(); });
    for (const b of main.querySelectorAll('.r-lane')) b.addEventListener('click', () => { if (!Lsel) return; const before = F.clone(L); if (F.play(L, 'p', Lsel, +b.dataset.l)) { Lundo.push(before); Lsel = null; blip(520); lsave(); ldraw(); } });
    main.querySelector('.l-undo').addEventListener('click', () => { if (Lundo.length) { L = Lundo.pop(); lsave(); ldraw(); } });
    main.querySelector('.l-new').addEventListener('click', () => lanesTab('lanes', true));
    main.querySelector('.l-end').addEventListener('click', () => { if (L.over) return; for (const [u, l] of L.vpending || []) F.play(L, 'v', u, l); Lundo = []; blip(440);
      if (L.turn >= F.MAXT) { L.over = true; const w = F.result(L).w; tally('lanes', w === 'p' ? 'you' : w === 'v' ? 'verse' : 'draw'); setUi('lanes', ''); ldraw(); return; }
      F.endTurn(L); L.log.push('Turn ' + L.turn + ' begins.'); lprep(); lsave(); ldraw(); });
    for (const b of main.querySelectorAll('.l-prize button')) b.addEventListener('click', () => { const c = L.lanes.flatMap((x) => x.v).find((x) => x.id === b.dataset.id); if (!c) return; D.setSaved({ kind: 'game', game: 'Forge Duel', t: c.title, b: c.text, k: c.type + ' card won from Verse' }, true); L.prize = c.title; ldraw(); });
  }
  function lend() {
    const r = F.result(L); let h = '<div class="r-win">' + (r.w === 'p' ? 'You win' : r.w === 'v' ? 'Verse wins' : 'A draw') + ': lanes ' + r.T.map((t, i) => (i + 1) + ' you ' + t.p + ' to ' + t.v).join(', ') + '.</div>';
    if (r.w === 'p' && !L.prize) { const u = [...new Map(L.lanes.flatMap((x) => x.v).map((c) => [c.id, c])).values()]; h += '<div class="r-note">Keep one of Verse’s cards:</div><div class="r-acts l-prize">' + u.map((c) => '<button type="button" data-id="' + esc(c.id) + '">keep ' + esc(c.title) + '</button>').join('') + '</div>'; }
    if (L.prize) h += '<div class="r-note">Kept ' + esc(L.prize) + ': it is in My cards now.</div>';
    return h;
  }
  // Forge a card: any pasted text becomes a card (both games' readings of it), saved to My cards and shareable
  function forgeTab() {
    main.innerHTML = '<div class="r-tools"><input class="f-t" type="text" maxlength="60" placeholder="title (optional)" aria-label="card title"></div><textarea class="f-x" rows="4" maxlength="1200" placeholder="paste any text: an answer, a quote, a note" aria-label="text to forge" style="width:100%;box-sizing:border-box;font:inherit;font-size:14px;color:#ece8dc;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.22);border-radius:8px;padding:8px"></textarea><div class="r-acts"><button type="button" class="f-save">save to My cards</button><button type="button" class="f-share">copy share link</button><span class="f-msg r-note"></span></div><div class="f-prev r-note" aria-live="polite"></div>';
    const t = main.querySelector('.f-t'), x = main.querySelector('.f-x'), pv = main.querySelector('.f-prev'), msg = main.querySelector('.f-msg');
    x.value = forgeText || ''; forgeText = '';
    const show = () => { const v = x.value.trim(); if (!v) { pv.textContent = 'Type or paste something to see its card.'; return; } const f = F.forge(v, t.value), r = R.cardFrom({ t: f.title, b: v });
      pv.innerHTML = '<div class="r-hand f-hand"><div class="r-card" style="--h:' + LHUE[f.type] + ';width:100%;max-width:340px"><span class="r-art" aria-hidden="true">' + artOf({ id: 'f' + f.id, name: f.title, type: FT[f.type] }) + '</span><span class="n">' + esc(f.title) + '</span><span class="p">' + f.power + '</span><span class="t">' + esc(f.type + ' · cost ' + f.cost + ' · ' + f.rarity) + '</span><span class="a">' + esc(f.ability) + '</span><span class="a">In Rally: ' + esc(R.TYPE_NAME[r.type] + ', power ' + r.power + (r.ability ? ', ' + R.ABILITIES[r.ability] : '')) + '</span><span class="r-body">' + esc(v) + '</span></div></div>'; };
    x.addEventListener('input', show); t.addEventListener('input', show); show();
    const rec = () => { const v = x.value.trim(), f = F.forge(v, t.value); return { kind: 'forged', t: f.title, k: f.type + ' · ' + f.rarity, b: v }; };
    main.querySelector('.f-save').addEventListener('click', () => { if (!x.value.trim()) { msg.textContent = 'Paste some text first.'; return; } D.setSaved(rec(), true); msg.textContent = 'Saved. It plays in both games now.'; });
    main.querySelector('.f-share').addEventListener('click', async () => { if (!x.value.trim()) return; try { const S = await import('../lib/card-share.js'); const r = rec(); await navigator.clipboard.writeText(S.linkOf({ t: r.t, k: r.k, b: r.b, src: [] }, location.origin)); msg.textContent = 'Link copied.'; } catch (_) { msg.textContent = 'Could not copy.'; } });
  }
  function helpTab() {
    main.innerHTML = '<div class="r-body">' + esc(['Verse Rally (Play, Learn, Daily challenge)', 'Best of three rounds. Take turns playing one card or passing; once you pass you are out of the round. When both have passed, the bigger row wins it. Cards you hold back carry to the next round; each side draws two between rounds.', 'Type wheel: Sky beats Land, Land beats Life, Life beats Word, Word beats Number, Number beats Sky. A card whose type beats the type of Verse’s latest card gets +3 (▲).', 'Abilities: ' + Object.values(R.ABILITIES).join(' · '), 'Levels: ' + Object.values(R.LEVELS).join(' · '), '', 'Three lanes (Forge Duel)', 'Six turns. Energy each turn is the turn number plus one. Tap a card, then a lane; up to four cards a side in a lane. Odd turns you lead; on even turns Verse’s plays land first. Win two of the three lanes. ' + Object.values(F.ABIL).join(' '), 'Verse plays out practice games from a fair view (it reshuffles your unseen cards) and shows its chances.', '', 'Both: Undo takes back your last move. A match is kept on this device and resumes where you left it. Win and you keep one of Verse’s cards. Every card you are shown, forge or win is in My cards and plays in both games.', '', recordLine()].join('\n')) + '</div>';
  }
  function recordLine() { const r = rec(); return 'Your record on this device: Rally ' + r.rally.w + ' won, ' + r.rally.l + ' lost, ' + r.rally.d + ' drawn · Three lanes ' + r.lanes.w + ' won, ' + r.lanes.l + ' lost, ' + r.lanes.d + ' drawn.'; }
  // no scrolling inside the page (owner: the book repaginates instead of scrolling; 2026-10-22: "the binder and game page scroll inside itself on
  // phones"): when the page holds more than its box, its blocks (each card in the binder, each part of the table) are dealt onto pages that fit,
  // with a pager; a hand card picked in Three lanes turns to the page with the lanes
  let pg = 0, fitting = false, raf = 0;
  const pager = document.createElement('div'); pager.className = 'r-pager r-acts';
  function blocks() { const out = []; for (const c of main.children) { if (c === pager) continue; if (c.classList.contains('r-list')) out.push(...c.children); else out.push(c); }
    let n = main.nextElementSibling; while (n) { out.push(n); n = n.nextElementSibling; } return out; } // the page's own card bar and source line go on the last page
  function fit() {
    fitting = true; const bs = blocks(); for (const b of bs) b.hidden = false; pager.remove();
    if (el.scrollHeight <= el.clientHeight + 1) { el.scrollTop = 0; fitting = false; obs.takeRecords(); return; }
    const top = main.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop, hs = bs.map((b) => b.getBoundingClientRect().height + 8);
    let pages, slack = 56;
    for (let tries = 0; tries < 4; tries++) { // deal, then check it really fits with the pager in place; tighten and deal again if not
      const avail = el.clientHeight - top - slack; pages = [[]]; let h = 0;
      bs.forEach((b, i) => { if (pages[pages.length - 1].length && h + hs[i] > avail) { pages.push([]); h = 0; } pages[pages.length - 1].push(b); h += hs[i]; });
      pages.forEach((p, i) => { for (const b of p) b.hidden = i !== Math.min(pg, pages.length - 1); }); main.appendChild(pager); pager.innerHTML = '<button type="button">‹</button>';
      const over = el.scrollHeight - el.clientHeight; pager.remove(); if (over <= 1) break; slack += over + 4;
    }
    if (want) { const i = pages.findIndex((p) => p.some((b) => b.matches && (b.matches(want) || b.querySelector(want)))); if (i >= 0) pg = i; want = ''; }
    pg = Math.max(0, Math.min(pg, pages.length - 1));
    pages.forEach((p, i) => { for (const b of p) b.hidden = i !== pg; });
    pager.innerHTML = '<button type="button" data-d="-1"' + (pg ? '' : ' disabled') + '>‹ back</button><span class="r-note">page ' + (pg + 1) + ' of ' + pages.length + '</span><button type="button" data-d="1"' + (pg < pages.length - 1 ? '' : ' disabled') + '>next ›</button>'; // void-review: ok: numbers and fixed strings only
    main.appendChild(pager); el.scrollTop = 0; fitting = false; obs.takeRecords();
  }
  let want = '';
  pager.addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; pg += +b.dataset.d; fit(); });
  const later = () => { if (fitting) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  const obs = new MutationObserver(later); obs.observe(el, { childList: true, subtree: true });
  main.addEventListener('toggle', later, true); addEventListener('resize', later);
  main.addEventListener('click', (e) => { if (e.target.closest('.r-hand .r-card') && main.querySelector('.r-lanes')) want = '.r-lanes'; if (e.target.closest('.r-lane')) want = '.r-hand'; }, true);
  tabs.addEventListener('click', () => { pg = 0; });
  go(mode === 'binder' ? 'binder' : mode);
}
let forgeText = '';
const LHUE = { Fact: 40, Idea: 275, Feeling: 340, Action: 120, Wonder: 205 }, FT = { Fact: 'number', Idea: 'word', Feeling: 'life', Action: 'land', Wonder: 'sky' };
const rec = () => { try { const j = JSON.parse(ui('record') || 'null'); if (j && j.rally && j.lanes) return j; } catch (_) {} return { rally: { w: 0, l: 0, d: 0 }, lanes: { w: 0, l: 0, d: 0 } }; };
function tally(game, winner) { const r = rec(); r[game][winner === 'you' ? 'w' : winner === 'verse' ? 'l' : 'd']++; setUi('record', JSON.stringify(r)); }

function run(text, api) {
  const mode = rallyOf(text) || 'binder';
  if (mode === 'forge') { const m = /[:\-]\s*([\s\S]{1,1200})$/.exec(String(text)); forgeText = m ? m[1].trim() : ''; }
  api.showPage((el) => mountPage(el, mode, api));
  return 'rally';
}

export default {
  name: 'rally',
  rallyOf,
  examples: ['play my cards', 'card battle', 'my cards', 'saved cards', 'my deck', 'card binder', 'verse rally', 'rally tutorial', 'daily card challenge', 'forge duel', 'three lane duel', 'forge a card', 'make a card from this text', 'card game help', 'my card game record'],
  nearMisses: ['play cards', 'card duel', 'my card was declined', 'my credit cards', 'rally car racing', 'pokemon cards price', 'forge a sword', 'make a card for my mom', 'help'],
  match(lower, text) { return !!rallyOf(text || lower); },
  run,
};

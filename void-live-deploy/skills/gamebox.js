/**
 * gamebox skill: the Game Box, every game and the table tools in one place.
 * Asked 2026-10-22 (owner: "dice, coins, random numbers, the magic 8-ball and cards should all live in the same box as the games"). "game box",
 * "games", "table tools", "all games" open one page with two halves:
 *   Games: every game Verse has, read from the Book (skills/guide.json, the games chapter, plus VoidQuest and the card games), each with the words
 *   that open it, so a new game appears here by itself.
 *   Table tools (lib/table-tools.js): dice of any count and sides with a 3D roll, a coin flip, a number picker, an answer orb (8-ball style,
 *   a random pick), a 52-card deck to shuffle and draw, a timer and a score keeper. Kept on this device (localStorage), nothing sent anywhere.
 * The box's dice are the games' dice: the Landlord's Game and VoidQuest roll with rollDice. The page's quick chance answers ("flip a coin",
 * "roll 2d6", "pick a number between 1 and 10", "magic 8 ball") still answer in one line and link here. "the 3D game shelf" stays "play a game".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as T from '../lib/table-tools.js';
import { fitPages } from '../lib/page-fit.js';

const OPEN = /^(?:(?:open|show(?: me)?|see)\s+)?(?:the\s+|my\s+)?(?:game\s*box|games\s+box|box\s+of\s+games|table\s+tools|games|all\s+(?:the\s+)?games|every\s+game|game\s+tools|dice\s+and\s+coins)$/;
const TOOL = /^(?:open\s+)?(?:the\s+)?(?:dice\s+roller|dice\s+tray|score\s*keeper|keep\s+score|card\s+deck|deck\s+of\s+cards|shuffle\s+(?:a|the)\s+deck|answer\s+orb)$/;
export const boxOf = (text) => { const l = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '); return OPEN.test(l) ? 'all' : TOOL.test(l) ? l.replace(/^open\s+|^the\s+/g, '') : null; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'verse.gamebox.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } };
const store = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };
const CSS = [
  '.gbox .gb-tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px;align-items:start}.gbox .gb-tools .gb-tool{margin:0}.gbox h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c9c3b2;margin:12px 0 6px}.gbox .gb-games{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}',
  '.gbox .gb-game{display:block;padding:8px 10px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:rgba(255,255,255,.04);color:#ece8dc;text-decoration:none;overflow-wrap:anywhere}.gbox .gb-game b{display:block;font-size:14px}.gbox .gb-game small{display:block;font-size:12px;color:#c4bfb0;line-height:1.35;margin-top:2px}',
  '.gbox .gb-game:hover,.gbox .gb-game:focus-visible{border-color:#ffd27a;outline:none}.gbox .gb-tool{border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:8px 10px;margin:6px 0;background:rgba(255,255,255,.03)}',
  '.gbox .gb-tool h4{margin:0 0 6px;font-size:14px;color:#f3efe2}.gbox .gb-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.gbox button,.gbox input{font:inherit;font-size:14px;color:#ece8dc;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.22);border-radius:8px;padding:6px 10px;min-height:34px}',
  '.gbox input{width:72px}.gbox input.wide{width:140px}.gbox button:focus-visible,.gbox input:focus-visible{outline:2px solid #ffd27a;outline-offset:2px}.gbox .gb-out{font-size:15px;color:#f3efe2;margin-top:6px;overflow-wrap:anywhere}.gbox .gb-big{font-size:26px;font-weight:600;color:#ffd27a}',
  // 3D dice: a real cube for six-sided dice (its face turns up), a spinning gem for any other number of sides
  '.gbox .gb-dice{display:flex;flex-wrap:wrap;gap:16px;padding:4px;margin:8px 0;perspective:420px}.gbox .cube{width:38px;height:38px;position:relative;transform-style:preserve-3d;transition:transform .9s cubic-bezier(.2,.7,.2,1)}',
  '.gbox .cube i{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:17px;color:#1a1420;background:linear-gradient(145deg,#fff4dc,#e9d6aa);border-radius:7px;box-shadow:inset 0 0 6px rgba(0,0,0,.25);backface-visibility:hidden}',
  '.gbox .cube i:nth-child(1){transform:translateZ(19px)}.gbox .cube i:nth-child(2){transform:rotateY(180deg) translateZ(19px)}.gbox .cube i:nth-child(3){transform:rotateY(90deg) translateZ(19px)}.gbox .cube i:nth-child(4){transform:rotateY(-90deg) translateZ(19px)}.gbox .cube i:nth-child(5){transform:rotateX(90deg) translateZ(19px)}.gbox .cube i:nth-child(6){transform:rotateX(-90deg) translateZ(19px)}',
  '.gbox .gem{width:40px;height:40px;display:grid;place-items:center;font-weight:700;color:#1a1420;background:linear-gradient(145deg,#d9c8ff,#9f86e8);clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%);animation:gb-spin .8s ease-out}',
  '@keyframes gb-spin{from{transform:rotate(-540deg) scale(.6)}to{transform:none}}.gbox .coin{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-weight:700;color:#3a2a08;background:radial-gradient(circle at 35% 30%,#fff1b8,#d9a93a);transition:transform .9s ease-out;transform-style:preserve-3d}',
  '.gbox .pcard{display:inline-grid;place-items:center;width:38px;height:52px;border-radius:6px;background:#f6f1e4;color:#1a1420;font-weight:700;margin:2px}.gbox .pcard.red{color:#b0182a}',
  '@media (prefers-reduced-motion:reduce){.gbox .cube,.gbox .coin{transition:none}.gbox .gem{animation:none}}.gbox [hidden]{display:none!important}',
].join('');
const FACE = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateY(180deg)', 3: 'rotateY(-90deg)', 4: 'rotateY(90deg)', 5: 'rotateX(-90deg)', 6: 'rotateX(90deg)' };
let bookP = null;
const games = () => (bookP = bookP || fetch('/skills/guide.json').then((r) => (r.ok ? r.json() : null)).then((g) => {
  const ex = (e) => (Array.isArray(e) ? e : String(e || '').match(/'([^']+)'|"([^"]+)"/g) || []).map((x) => String(x).replace(/^['"]|['"]$/g, ''));
  const pages = (g && g.pages) || [], out = [];
  for (const p of pages) if ((p.kind === 'game') || (p.kind === 'skill' && p.chapter === 'games')) { const say = ex(p.examples).find((x) => !/^(?:games|table tools|game box)$/i.test(x)) || p.title; out.push({ title: p.title, line: p.line || '', say }); }
  return out;
}).catch(() => []));
const EXTRA = [{ title: 'Three lanes', line: 'Forge Duel: six turns, three lanes, win two.', say: 'forge duel' }, { title: 'Forge a card', line: 'Paste any text and it becomes a playable card.', say: 'forge a card' }, { title: 'My cards', line: 'Every card you have been shown, saved, searchable and playable.', say: 'my cards' }, { title: 'The 3D game shelf', line: 'The board games as miniatures on one shelf.', say: 'play a game' }];

function mount(el, focus) {
  if (!document.getElementById('gbox-style')) { const s = document.createElement('style'); s.id = 'gbox-style'; s.textContent = CSS; document.head.appendChild(s); }
  el.dataset.cardPlain = ''; el.dataset.noDeck = ''; el.classList.add('gbox');
  const st = Object.assign({ dice: '2d6', lo: 1, hi: 100, deck: null, players: [], timer: 60 }, load()); if (!Array.isArray(st.deck)) st.deck = T.shuffle(T.newDeck());
  const save = () => store(st);
  el.innerHTML = '<h2>Game Box</h2><div class="gb-main"><p class="gb-out" style="margin:0">Every game Verse plays and the tools for a table, in one box. Tap a game to open it.</p>'
    + '<h3>Table tools</h3><div class="gb-tools" data-fit-list><div class="gb-tool" data-t="dice"><h4>Dice</h4><div class="gb-row"><input class="d-n" type="number" min="1" max="100" aria-label="how many dice"> dice with <input class="d-s" type="number" min="2" max="1000" aria-label="sides on each die"> sides <button type="button" class="d-go">Roll</button></div><div class="gb-dice" aria-live="polite"></div><div class="gb-out d-out"></div></div>'
    + '<div class="gb-tool" data-t="coin"><h4>Coin</h4><div class="gb-row"><div class="coin" aria-hidden="true">?</div><button type="button" class="c-go">Flip</button><span class="gb-out c-out" aria-live="polite"></span></div></div>'
    + '<div class="gb-tool" data-t="number"><h4>Number picker</h4><div class="gb-row">from <input class="n-lo" type="number" aria-label="lowest"> to <input class="n-hi" type="number" aria-label="highest"> <button type="button" class="n-go">Pick</button><span class="gb-big n-out" aria-live="polite"></span></div></div>'
    + '<div class="gb-tool" data-t="orb"><h4>Answer orb</h4><div class="gb-row"><input class="o-q wide" type="text" maxlength="140" placeholder="a yes-or-no question" aria-label="your question"><button type="button" class="o-go">Shake</button></div><div class="gb-out o-out" aria-live="polite"></div><div class="gb-out" style="font-size:12px;color:#b9b4a6">One of 20 traditional answers picked at random. It is not advice.</div></div>'
    + '<div class="gb-tool" data-t="deck"><h4>Card deck</h4><div class="gb-row"><button type="button" class="k-draw">Draw 1</button><button type="button" class="k-five">Draw 5</button><button type="button" class="k-shuf">Shuffle all 52</button><span class="gb-out k-left"></span></div><div class="gb-out k-out" aria-live="polite"></div></div>'
    + '<div class="gb-tool" data-t="timer"><h4>Timer</h4><div class="gb-row"><input class="t-in wide" type="text" aria-label="time, like 1:30 or 90 or 2m"><button type="button" class="t-go">Start</button><button type="button" class="t-stop">Pause</button><button type="button" class="t-reset">Reset</button><span class="gb-big t-out" aria-live="polite"></span></div></div>'
    + '<div class="gb-tool" data-t="score"><h4>Score keeper</h4><div class="gb-row"><input class="s-name wide" type="text" maxlength="30" placeholder="player name" aria-label="player name"><button type="button" class="s-add">Add player</button><button type="button" class="s-zero">Scores to 0</button></div><div class="s-list"></div></div></div>'
    + '<h3>Games</h3><div class="gb-games" data-fit-list><span class="gb-out">opening the shelf…</span></div></div>';
  const q = (s) => el.querySelector(s), main = q('.gb-main');
  // dice
  const [dn, ds] = [q('.d-n'), q('.d-s')], spec = T.diceSpec(st.dice); dn.value = spec.count; ds.value = spec.sides;
  q('.d-go').addEventListener('click', () => {
    const r = T.rollDice(dn.value, ds.value); st.dice = r.count + 'd' + r.sides; save(); const box = q('.gb-dice'); box.textContent = '';
    r.rolls.slice(0, 12).forEach((v, i) => { const d = document.createElement('div');
      if (r.sides === 6) { d.className = 'cube'; d.innerHTML = '<i>1</i><i>6</i><i>3</i><i>4</i><i>5</i><i>2</i>'; d.style.transform = 'rotateX(' + (720 + i * 90) + 'deg) rotateY(' + (540 + i * 90) + 'deg)'; box.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = FACE[v]; })); }
      else { d.className = 'gem'; d.textContent = String(v); box.appendChild(d); } });
    q('.d-out').textContent = r.count + 'd' + r.sides + ': ' + r.rolls.join(', ') + (r.count > 1 ? ' · total ' + r.total : '') + (r.count > 12 ? ' (the first 12 are drawn)' : '');
  });
  // coin
  let turns = 0; q('.c-go').addEventListener('click', () => { const f = T.flipCoin(), c = q('.coin'); turns += 5; c.style.transform = 'rotateY(' + (turns * 180 + (f === 'Tails' ? 180 : 0)) + 'deg)'; c.textContent = f[0]; q('.c-out').textContent = f; });
  // number picker
  q('.n-lo').value = st.lo; q('.n-hi').value = st.hi;
  q('.n-go').addEventListener('click', () => { st.lo = +q('.n-lo').value; st.hi = +q('.n-hi').value; save(); q('.n-out').textContent = String(T.pickNumber(st.lo, st.hi)); });
  // answer orb
  q('.o-go').addEventListener('click', () => { const qq = q('.o-q').value.trim(); q('.o-out').textContent = (qq ? '“' + qq + '” ' : '') + '→ ' + T.orb(); });
  // deck
  const deckDraw = (n) => { if (!st.deck.length) { q('.k-out').textContent = 'The deck is empty: shuffle all 52 to start again.'; return; } const r = T.draw(st.deck, n); st.deck = r.left; save();
    q('.k-out').innerHTML = r.drawn.map((c) => '<span class="pcard' + (/[♥♦]/.test(c) ? ' red' : '') + '">' + esc(c) + '</span>').join(''); left(); };
  const left = () => { q('.k-left').textContent = st.deck.length + ' left'; };
  q('.k-draw').addEventListener('click', () => deckDraw(1)); q('.k-five').addEventListener('click', () => deckDraw(5));
  q('.k-shuf').addEventListener('click', () => { st.deck = T.shuffle(T.newDeck()); save(); q('.k-out').textContent = 'Shuffled: 52 cards.'; left(); }); left();
  // timer
  let end = 0, rest = st.timer, tick = 0; q('.t-in').value = T.clock(st.timer); q('.t-out').textContent = T.clock(rest);
  const show = () => { if (!el.isConnected) { clearInterval(tick); return; } const s = end ? Math.max(0, (end - Date.now()) / 1000) : rest; q('.t-out').textContent = T.clock(Math.ceil(s)); if (end && s <= 0) { clearInterval(tick); end = 0; rest = 0; q('.t-out').textContent = 'Time!'; try { navigator.vibrate && navigator.vibrate(200); } catch (_) {} } };
  q('.t-go').addEventListener('click', () => { if (end) return; if (!rest) { rest = T.seconds(q('.t-in').value) || 60; st.timer = rest; save(); } end = Date.now() + rest * 1000; clearInterval(tick); tick = setInterval(show, 250); show(); });
  q('.t-stop').addEventListener('click', () => { if (!end) return; rest = Math.max(0, (end - Date.now()) / 1000); end = 0; clearInterval(tick); show(); });
  q('.t-reset').addEventListener('click', () => { end = 0; clearInterval(tick); rest = T.seconds(q('.t-in').value) || 60; st.timer = rest; save(); show(); });
  q('.t-in').addEventListener('change', () => { if (!end) { rest = T.seconds(q('.t-in').value) || rest; show(); } });
  // score keeper
  const players = () => { const L = q('.s-list'); L.textContent = ''; const lead = T.leader(st.players);
    st.players.forEach((p, i) => { const r = document.createElement('div'); r.className = 'gb-row'; r.style.margin = '4px 0';
      r.innerHTML = '<span style="min-width:110px;overflow-wrap:anywhere">' + esc(p.name) + (lead === p && st.players.length > 1 && p.score ? ' ★' : '') + '</span><b class="gb-big" style="font-size:20px;min-width:44px">' + p.score + '</b>';
      for (const by of [-1, 1, 5]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = (by > 0 ? '+' : '−') + Math.abs(by); b.setAttribute('aria-label', (by > 0 ? 'add ' : 'take ') + Math.abs(by) + ' for ' + p.name); b.addEventListener('click', () => { st.players = T.bump(st.players, i, by); save(); players(); }); r.appendChild(b); }
      L.appendChild(r); }); };
  q('.s-add').addEventListener('click', () => { st.players = T.addPlayer(st.players, q('.s-name').value); q('.s-name').value = ''; save(); players(); });
  q('.s-zero').addEventListener('click', () => { st.players = st.players.map((p) => ({ ...p, score: 0 })); save(); players(); }); players();
  // games
  games().then((list) => { const all = [...list, ...EXTRA], g = q('.gb-games'); g.innerHTML = all.map((x) => '<a href="#" class="gb-game" data-ask="' + esc(x.say) + '"><b>' + esc(x.title) + '</b><small>' + esc(x.line) + '</small><small>say “' + esc(x.say) + '”</small></a>').join('') || '<span class="gb-out">The games list could not be read just now; ask again.</span>'; });
  const fp = fitPages(el, main);
  if (focus && focus !== 'all') { const t = /dice/.test(focus) ? 'dice' : /score/.test(focus) ? 'score' : /deck|shuffle/.test(focus) ? 'deck' : /orb/.test(focus) ? 'orb' : ''; if (t) fp.want('[data-t="' + t + '"]'); }
}

function run(text, api) { const f = boxOf(text) || 'all'; api.showPage((el) => mount(el, f)); return 'gamebox'; }

export default {
  name: 'gamebox',
  boxOf,
  examples: ['game box', 'games', 'show me the games', 'table tools', 'open the game box', 'all games', 'dice roller', 'score keeper', 'shuffle a deck'],
  nearMisses: ['games on tv tonight', 'olympic games', 'box office', 'play a game', 'what games can you play'],
  match(lower, text) { return !!boxOf(text || lower); },
  run,
};

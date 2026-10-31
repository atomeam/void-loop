/**
 * about-skill skill - "tell me about the chess skill", "what is the forge skill", "how does your weather skill work": a card about any
 * skill of Verse's, from its own page of the book (asked by Verse: "Learn how to handle 'tell me about zorbleflux' (asked 156 times)";
 * the zorbleflux ask itself is answered by skills/zorbleflux.js, and "tell me about <a skill of mine>" used to go to Wikipedia and be
 * noted as a miss). The card: the skill's title, its one line (the module's own `about` text when it exports one), its example asks as
 * tap-to-ask chips, its family and tier (skills/families.json), related skills as chips and a "try it" button that asks the first
 * example. Wikipedia topics keep their route: "tell me about tokyo", "what is a black hole", "explain photosynthesis" never come here
 * (lib/about-skill.js resolveSkill: a bare one-word topic is the world's even when a skill shares the word). The book and the ratings
 * are fetched once per session, shared with the card frame (lib/card-frame.js loadStats), at idle time so a first visit is not slowed.
 * A game's card (chess, checkers, reversi) carries a Match History block (asked by Verse: "a 'Match History' table that pulls from my
 * recent game logs", an Elo or win rate against the owner): your record on this device and the last ten games, from a2m.void.games.v1
 * (lib/match-history.js); "chess match history", "my chess record", "my record against void" open it straight.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { parseAsk, resolveSkill, aboutOf } from '../lib/about-skill.js';
import { loadStats } from '../lib/card-frame.js';
import { historyAsk, historyHtml, summary, summaryLine, load as loadGames, GAMES, TITLES } from '../lib/match-history.js'; // a game's card carries your match history on this device (asked by Verse)

let stats = null; // { book, fam, deps } once read; until then only a named ask ("the chess skill") can be matched
let overlapsP = null; // tools/skill-overlap.json is not served today; when /skills/overlap.json is, its pairs come first in "related"
/** give the module the book and the ratings ({ book, fam }) without a fetch: the tests, and the page when it has them already. */
export function prime(s) { stats = s && typeof s === 'object' ? s : null; return stats; }
const load = () => loadStats().then((s) => { if (s && s.book) stats = s; return stats; }).catch(() => stats);
const overlaps = () => { overlapsP = overlapsP || fetch('/skills/overlap.json', { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); return overlapsP; };
if (typeof window !== 'undefined' && typeof document !== 'undefined') { // the browser: the book comes in once the page is idle (never before its own files)
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(load, { timeout: 4000 }) : setTimeout(load, 1500));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}

/** the skill module's own about text, when it exports one (`about` on its default export, or ABOUT / about as a named export) */
export function aboutText(mod) {
  if (!mod) return '';
  for (const v of [mod.default && mod.default.about, mod.ABOUT, mod.about]) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}

const CSS = '.about-skill .about-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}.about-skill .about-chip{font:inherit;font-size:13px;color:var(--fg);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:5px 12px;cursor:pointer}'
  + '.about-skill .about-chip:hover,.about-skill .about-chip:focus-visible{background:rgba(255,255,255,.12)}.about-skill .about-chip.rel{border-style:dashed}.about-skill .about-try{font:inherit;font-size:14px;color:#0b0b0b;background:var(--accent);border:0;border-radius:999px;padding:7px 16px;cursor:pointer;margin:2px 0 8px}'
  + '.about-skill .about-h{font-size:12px;color:var(--muted);margin:8px 0 2px;text-transform:uppercase;letter-spacing:.06em}'
  + '.about-skill .mh-sum{margin:2px 0 6px}.about-skill .mh-table{width:100%;border-collapse:collapse;font-size:13px;margin:2px 0 8px}.about-skill .mh-table th,.about-skill .mh-table td{text-align:left;padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.08)}'
  + '.about-skill .mh-table th{color:var(--muted);font-weight:normal;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.about-skill .mh-table td[data-result="win"]{color:#9fe08a}.about-skill .mh-table td[data-result="loss"]{color:#f0a4a4}';

/** the card's HTML for aboutOf's facts (a.history, when set, is a game's Match History block, already markup). Pure. */
export function cardHtml(a, esc) {
  const chip = (text, ask, cls) => '<button type="button" class="about-chip' + (cls ? ' ' + cls : '') + '" data-ask="' + esc(ask) + '">' + esc(text) + '</button>';
  return '<style>' + CSS + '</style><h2>' + esc(a.title) + '</h2>'
    + '<div class="sub">a skill of Verse’s' + (a.family ? ' · ' + esc(a.family.name) : '') + ' · ' + esc(a.tier) + (a.why ? ' (' + esc(a.why) + ')' : '') + '</div>'
    + (a.line ? '<p>' + esc(a.line) + '</p>' : '')
    + (a.history || '')
    + (a.examples.length ? '<div class="about-h">Ask it</div><div class="about-chips" data-role="examples">' + a.examples.map((e) => chip(e, e)).join('') + '</div>' : '')
    + (a.related.length ? '<div class="about-h">Related</div><div class="about-chips" data-role="related">' + a.related.map((r) => chip(r.title, r.ask, 'rel')).join('') + '</div>' : '')
    + '<button type="button" class="about-try" data-ask="' + esc(a.tryAsk) + '">Try it: ' + esc(a.tryAsk) + '</button>'
    + '<div class="src">Source: Verse’s own book (skills/guide.json) and skill ratings (skills/families.json) · as of ' + new Date().toISOString().slice(0, 7) + '</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const s = stats || await load();
  // "my chess record", "chess match history": the game's own card, opened for its Match History block (asked by Verse); the book's page when it has one
  const h = historyAsk(text), bookPage = (name) => (s && s.book && Array.isArray(s.book.pages) ? s.book.pages.find((p) => p && (p.kind === 'skill' || p.kind === 'game') && p.name === name) : null);
  const playAsk = h ? ['play ' + h.game] : []; // for a stand-in page when the book is not in; kept out of a literal list on the page object, since the book reads this file's first literal list of asks as this skill's own (lib/guide.js listOf)
  const page = h ? bookPage(h.game) || { kind: 'skill', name: h.game, title: TITLES[h.game], line: '', examples: playAsk, n: 0 } : s && s.book ? resolveSkill(text, s.book) : null;
  if (!page) { const q = parseAsk(text); api.say(q ? 'no skill called ' + q.topic + ' yet · "open the book" shows what I can do' : "couldn't"); return 'none'; }
  let about = '';
  try { const mod = await import('./' + page.name + '.js'); if (mod.default && typeof mod.default.ready === 'function') await mod.default.ready(); about = aboutText(mod); } catch (_) { /* a page with no module of its own (a family member, a game box): the page's line */ } // void-review: ok
  const a = aboutOf(page, s ? s.fam : null, await overlaps(), { book: s ? s.book : null, about });
  let sum = null;
  if (GAMES.includes(a.name)) { const log = loadGames(); sum = summary(log, { game: a.name }); a.history = historyHtml(esc, sum, log); } // a game's card: your record on this device
  showPage((el) => {
    el.classList.add('about-skill'); el.dataset.skillName = a.name;
    el.innerHTML = cardHtml(a, esc);
    el.querySelectorAll('button[data-ask]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); api.stage.ask(b.dataset.ask); }));
    // ▶ Replay on a chess game in the history steps through its moves with the engine's read of each (asked by Verse, lib/chess-replay.js)
    el.addEventListener('click', async (e) => {
      const b = e.target.closest && e.target.closest('.mh-replay'); if (!b) return; e.stopPropagation();
      const g = loadGames().find((x) => x.at === b.dataset.at && x.line); if (!g) return;
      const table = el.querySelector('.match-history'); let host = el.querySelector('.mh-replay-host');
      // under the history block, not inside it: the table scrolls sideways on a phone, and a panel inside it went with it
      if (!host) { host = document.createElement('div'); host.className = 'mh-replay-host'; host.tabIndex = -1; if (table) table.insertAdjacentElement('afterend', host); else el.appendChild(host); }
      const [R, { mountReplay }] = await Promise.all([import('./chess-rules.js'), import('../lib/chess-replay.js')]);
      mountReplay(host, R, g.line, esc); host.focus({ preventScroll: true });
      // the board's top comes into view: the nearest box that scrolls (the card, or the frame a look wraps it in) moves, the page never does
      let box = host.parentElement; while (box && box !== document.body && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
      if (box && box !== document.body) box.scrollTo({ top: box.scrollTop + host.getBoundingClientRect().top - box.getBoundingClientRect().top - 6, behavior: 'smooth' });
    });
  });
  api.say(h && sum ? a.title + ' · your record against Verse on this device: ' + summaryLine(sum) : a.title + (a.family ? ' · ' + a.family.name : '') + ' · ' + a.tier);
  return 'about-skill';
}

/** a self-test with a small book, no fetch (tools/skills-check.mjs runs it): the bare and tagged forms resolve, the world's questions do not */
export function suite() {
  const book = { chapters: [], pages: [
    { kind: 'skill', chapter: 'games', name: 'chess', title: 'Chess', line: 'A real wooden chess set on the stage', examples: ['play chess', 'chess'], n: 3 },
    { kind: 'skill', chapter: 'self', name: 'family-health', title: 'Family health', line: 'Every family of skills and its evidence', examples: ['family health'], n: 4 },
    { kind: 'skill', chapter: 'time', name: 'time', title: 'Time', line: 'The time where you are', examples: ['what time is it'], n: 5 },
  ] };
  const want = [['tell me about the chess skill', 'chess'], ['what is chess', null], ['what is the chess game', 'chess'], ['what is family health', 'family-health'], ['what is time', null],
    ['tell me about your time skill', 'time'], ['tell me about tokyo', null], ['what is a black hole', null], ['explain photosynthesis', null], ['tell me about yourself', null], ['what can you do', null]];
  for (const [ask, name] of want) { const p = resolveSkill(ask, book); if ((p ? p.name : null) !== name) return { ok: false, got: ask + ' -> ' + (p ? p.name : 'null') + ', wanted ' + name }; }
  return { ok: true, got: want.length + ' asks resolve as they should' };
}

export default {
  name: 'about-skill',
  examples: ['tell me about the chess skill', 'what is the forge skill', "what's the define skill", 'explain the guide skill', 'how does the deps skill work', 'how do i use the recipe skill', 'chess match history', 'my chess record', 'my record against void'],
  nearMisses: ['tell me about tokyo', 'what is a black hole', 'explain photosynthesis', 'define serendipity', 'tell me about yourself', 'what can you do', 'tell me about zorbleflux', 'what is a sim card', 'match history', 'chess rules', 'how good are you at chess'],
  // a named ask ("the chess skill", "your weather") is this skill's whatever the book says; a bare coined name ("what is family health") needs the book, read at idle;
  // "my chess record", "chess match history" open a game's card for its Match History block (lib/match-history.js historyAsk)
  match(lower, text) { if (historyAsk(text || lower)) return true; const q = parseAsk(text || lower); return !!q && (q.named || !!(stats && stats.book && resolveSkill(text || lower, stats.book))); },
  run,
  suite,
  prime,
};

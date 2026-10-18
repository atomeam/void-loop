/**
 * about-skill skill - "tell me about the chess skill", "what is the forge skill", "how does your weather skill work": a card about any
 * skill of V01D's, from its own page of the book (asked by Void: "Learn how to handle 'tell me about zorbleflux' (asked 156 times)";
 * the zorbleflux ask itself is answered by skills/zorbleflux.js, and "tell me about <a skill of mine>" used to go to Wikipedia and be
 * noted as a miss). The card: the skill's title, its one line (the module's own `about` text when it exports one), its example asks as
 * tap-to-ask chips, its family and tier (skills/families.json), related skills as chips and a "try it" button that asks the first
 * example. Wikipedia topics keep their route: "tell me about tokyo", "what is a black hole", "explain photosynthesis" never come here
 * (lib/about-skill.js resolveSkill: a bare one-word topic is the world's even when a skill shares the word). The book and the ratings
 * are fetched once per session, shared with the card frame (lib/card-frame.js loadStats), at idle time so a first visit is not slowed.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { parseAsk, resolveSkill, aboutOf } from '../lib/about-skill.js';
import { loadStats } from '../lib/card-frame.js';

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
  + '.about-skill .about-h{font-size:12px;color:var(--muted);margin:8px 0 2px;text-transform:uppercase;letter-spacing:.06em}';

/** the card's HTML for aboutOf's facts. Pure. */
export function cardHtml(a, esc) {
  const chip = (text, ask, cls) => '<button type="button" class="about-chip' + (cls ? ' ' + cls : '') + '" data-ask="' + esc(ask) + '">' + esc(text) + '</button>';
  return '<style>' + CSS + '</style><h2>' + esc(a.title) + '</h2>'
    + '<div class="sub">a skill of V01D’s' + (a.family ? ' · ' + esc(a.family.name) : '') + ' · ' + esc(a.tier) + (a.why ? ' (' + esc(a.why) + ')' : '') + '</div>'
    + (a.line ? '<p>' + esc(a.line) + '</p>' : '')
    + (a.examples.length ? '<div class="about-h">Ask it</div><div class="about-chips" data-role="examples">' + a.examples.map((e) => chip(e, e)).join('') + '</div>' : '')
    + (a.related.length ? '<div class="about-h">Related</div><div class="about-chips" data-role="related">' + a.related.map((r) => chip(r.title, r.ask, 'rel')).join('') + '</div>' : '')
    + '<button type="button" class="about-try" data-ask="' + esc(a.tryAsk) + '">Try it: ' + esc(a.tryAsk) + '</button>'
    + '<div class="src">Source: V01D’s own book (skills/guide.json) and skill ratings (skills/families.json) · as of ' + new Date().toISOString().slice(0, 7) + '</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const s = stats || await load();
  const page = s && s.book ? resolveSkill(text, s.book) : null;
  if (!page) { const q = parseAsk(text); api.say(q ? 'no skill called ' + q.topic + ' yet · "open the book" shows what I can do' : "couldn't"); return 'none'; }
  let about = '';
  try { about = aboutText(await import('./' + page.name + '.js')); } catch (_) { /* a page with no module of its own (a family member, a game box): the page's line */ } // void-review: ok
  const a = aboutOf(page, s.fam, await overlaps(), { book: s.book, about });
  showPage((el) => {
    el.classList.add('about-skill'); el.dataset.skillName = a.name;
    el.innerHTML = cardHtml(a, esc);
    el.querySelectorAll('button[data-ask]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); api.stage.ask(b.dataset.ask); }));
  });
  api.say(a.title + (a.family ? ' · ' + a.family.name : '') + ' · ' + a.tier);
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
  examples: ['tell me about the chess skill', 'what is the forge skill', "what's the define skill", 'explain the guide skill', 'how does the deps skill work', 'how do i use the recipe skill'],
  nearMisses: ['tell me about tokyo', 'what is a black hole', 'explain photosynthesis', 'define serendipity', 'tell me about yourself', 'what can you do', 'tell me about zorbleflux', 'what is a sim card'],
  // a named ask ("the chess skill", "your weather") is this skill's whatever the book says; a bare coined name ("what is family health") needs the book, read at idle
  match(lower, text) { const q = parseAsk(text || lower); return !!q && (q.named || !!(stats && stats.book && resolveSkill(text || lower, stats.book))); },
  run,
  suite,
  prime,
};

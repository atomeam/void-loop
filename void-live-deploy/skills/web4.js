/**
 * web4 skill — the four steps of the web, in Verse's plain words: Web 1 read, Web 2 write and share, Web 3 own, Web 4 ask and it appears. "what is web4", "are you web4", "web 1 2 3 4".
 * One card with the four steps as a ladder, a line each on what that step was and where to see it in Verse today, the honest sentence
 * that Web4 is the owner's name and nobody has defined it, and a tappable ask for each step. The words are lib/web4.js (also read by the
 * Book of Verse page, the tests and frontier #37). Asked for by the owner, 2026-10-16: "now Verse is Web4". Says nothing about blockchain, tokens or any crypto.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { LAYERS, HONEST, WHOSE } from '../lib/web4.js';

const WHEN = /^(?:(?:what(?:'s|s| is)|whats|explain|tell me about)\s+)?(?:are\s+you\s+)?(?:the\s+)?(?:web\s?4|web\s+(?:1\s*,?\s*2\s*,?\s*3\s*,?\s*(?:and\s+)?4|four))(?:\s+(?:is|means?))?(?:\s+(?:verse|v01d))?$/i;
const ALSO = /^(?:is\s+(?:v01d|(?:verse|void)|verse)\s+web\s?4|(?:v01d|(?:verse|void)|verse)\s+(?:is\s+)?web\s?4)$/i;

/** the ladder card's HTML: four stacked plates, the first at the bottom. Pure. */
export function web4Html(esc) {
  const plates = LAYERS.slice().reverse().map((l) => '<li class="w4-step w4-' + l.n + '" style="margin:0 0 8px;padding:8px 10px 8px ' + (8 + (l.n - 1) * 10) + 'px;border-left:3px solid rgba(255,255,255,' + (0.16 + l.n * 0.14).toFixed(2) + ');list-style:none">'
    + '<b>Web ' + l.n + ' · ' + esc(l.name) + '</b> <span class="sub" style="color:#8a8a8a">' + esc(l.did) + '</span>'
    + '<div style="margin:3px 0 4px">' + esc(l.line) + '</div>'
    + '<a href="#" data-ask="' + esc(l.where) + '">' + esc(l.label) + '</a></li>').join('');
  return '<h2>Web4</h2><ol class="w4-ladder" style="padding:0;margin:6px 0 10px;display:flex;flex-direction:column">' + plates + '</ol>'
    + '<p class="w4-honest"><b>' + esc(HONEST) + '</b> ' + esc(WHOSE) + '</p>'
    + '<div class="src">Source: Verse’s own pages, this site · as of 2026-10</div>';
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => { el.innerHTML = web4Html(esc); }); // void-review: ok: web4Html escapes every text field
  return 'web4';
}

export default {
  name: 'web4',
  examples: ['what is web4', 'are you web4', 'web 1 2 3 4', "what's web 4", 'web4', 'web 4', 'is v01d web4'],
  nearMisses: ['web design basics', 'html tutorial', 'what is web3', 'web 2.0 sites', 'web4 domains for sale', 'weber grill'],
  match(lower) { const t = String(lower).trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '); return WHEN.test(t) || ALSO.test(t); },
  run
};

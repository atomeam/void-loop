/**
 * ask-clipboard skill — "show my recent asks as a card", "ask clipboard", "re-run the third recent ask": a card of the last
 * ~12 asks made on this device, each one re-run with a tap (stageApi.ask). It reads the same store as skills/recent.js
 * (localStorage a2m.void.asks.v1); plain "recent asks" stays with that skill. Asked for by the owner (2026-10-18).
 * Nothing leaves the browser; the card appears only when asked for.
 */
import { recentAsks, KEPT_ASKS } from './recent.js';
import { tidy } from '../lib/stage-pack.js';

const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, last: 1, latest: 1, previous: 2 };
const NTH = '(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|last|latest|previous|\\d{1,2}(?:st|nd|rd|th)|(?:number|no\\.?|#)\\s*\\d{1,2})';

/** 'show' | { act:'rerun', n } | null for an ask. Pure. */
export function clipboardIntent(lower) {
  const l = tidy(lower).toLowerCase();
  if (/^(?:please\s+)?(?:(?:show|open|bring\s+up|give)\s+(?:me\s+)?(?:the\s+|my\s+)?)?(?:ask\s+clipboard|recent\s+asks?\s+(?:as\s+)?(?:a\s+)?card)(?:\s+please)?$/.test(l)) return 'show';
  if (/^(?:please\s+)?(?:show|open|bring\s+up|give)\s+(?:me\s+)?(?:my\s+)?(?:recent\s+)?asks\s+(?:as\s+)?(?:a\s+)?card$/.test(l)) return 'show';
  const m = new RegExp('^(?:please\\s+)?(?:re-?run|run\\s+again|redo|repeat|ask\\s+again)\\s+(?:the\\s+|my\\s+)?' + NTH + '\\s+(?:recent\\s+)?ask(?:\\s+again)?$').exec(l)
    || new RegExp('^(?:please\\s+)?(?:re-?run|redo|repeat)\\s+(?:my\\s+)?recent\\s+ask\\s+' + NTH + '$').exec(l);
  if (!m) return null;
  const w = m[1].replace(/^(?:number|no\.?|#)\s*/, '');
  const n = ORD[w] || parseInt(w, 10);
  return n >= 1 && n <= KEPT_ASKS ? { act: 'rerun', n } : null;
}

/** the asks to list: newest first, without the clipboard's own commands. Pure over the list. */
export const clipboardAsks = (asks) => (asks || []).filter((a) => !clipboardIntent(String(a).toLowerCase())).slice(0, KEPT_ASKS);

async function run(text, api) {
  const intent = clipboardIntent(String(text || '').toLowerCase());
  if (!intent) return 'none';
  const list = clipboardAsks(recentAsks(undefined, KEPT_ASKS));
  if (intent !== 'show') {
    const target = list[intent.n - 1];
    if (!target) { api.say(list.length ? 'only ' + list.length + ' recent ask' + (list.length === 1 ? '' : 's') + ' so far' : 'no recent asks yet'); return 'ask-clipboard'; }
    api.stage.ask(target);
    return 'ask-clipboard';
  }
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Ask clipboard</h2>'; });
  el.innerHTML = '<h2>Ask clipboard</h2>' + (list.length
    ? '<ol style="padding-left:1.4em;margin:.4em 0">' + list.map((a, i) => '<li style="margin:.3em 0"><button type="button" class="clip-run" data-n="' + (i + 1) + '" title="run this ask again" style="font:inherit;cursor:pointer;margin-right:.5em;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:1px 9px">run</button><span class="clip-text">' + esc(a) + '</span></li>').join('') + '</ol>'
    : '<p>Nothing yet. Asks you make stay in this browser, and show up here.</p>')
    + '<div class="src">The last ' + KEPT_ASKS + ' asks, saved only in this browser. Tap run to ask one again.</div>';
  el.querySelectorAll('button.clip-run').forEach((b) => b.addEventListener('click', () => { const t = list[+b.dataset.n - 1]; if (t) api.stage.ask(t); }));
  return 'ask-clipboard';
}

export default {
  name: 'ask-clipboard',
  examples: ['show my recent asks as a card', 'ask clipboard', 're-run the third recent ask'],
  nearMisses: ['recent asks', 'what did I ask', 'what is a clipboard'],
  clipboardIntent,
  match(lower) { return !!clipboardIntent(lower); },
  run,
};

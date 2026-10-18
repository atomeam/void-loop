/**
 * wants skill - "what do you want built now", "name all your unbuilt asks", "your backlog": one card, "What I want built", read from
 * V01D's own records and never from a model (the owner, 2026-10-18: "name all your unbuilt asks and come up with 50 more new ones" fell
 * to the model, which said V01D had no catalog of unbuilt asks and made 50 up; "The router needs a hardcoded context injection so V01D
 * always knows its own developmental state"). Three blocks: "My will" (GET /api/will, the wants the self card shows too), "Asked, not
 * built yet" (GET /api/reflect `asks`: each with when it was asked and "I called it small" when so, the list the self card folds) and
 * "Growth inbox" (/self.json `open`: the open items of domains/void.frontier.md, written at deploy by tools/self-context.mjs; no new
 * route), a count line "N wants · M asks not built · K inbox items", and every item a tap-to-copy chip. A compound ask is matched on
 * its first clause ("name all your unbuilt asks and come up with 50 more new ones"): the card lists what V01D has and says the 50 new
 * ones are the asker's to ask for one at a time. A record that cannot be read says so on its block; nothing is guessed. "what do you
 * want to be" (the will card), "what do you think of yourself" (the self card), "what can you do" (the self page), "what's next?" (the
 * calendar), "what's on my list" and "what do I want for dinner" are not this.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
const YOU = "(?:you|v01d|void)", YOUR = "(?:your|v01d's|void's|v01d|void)";
const LISTS = "(?:wants|wishes|unbuilt asks|open asks|asks not built|asks not built yet|unbuilt wants|unbuilt items|open items|backlog|wish ?list|want list|list of wants|to-?do list|todo|growth inbox|inbox|open list|build list|unbuilt list)";
const RULES = [
  // "what do you want", "what do you want built now", "what do you want to learn", "what else do you want", "what do you want next", never "to be / to become / to do" (the will card)
  new RegExp('^(?:so |ok(?:ay)?,? )?what (?:else |more )?(?:do|does|would|did) ' + YOU + ' (?:want|wish for|wish)(?: (?:built|made|done|to build|to learn|to see built|to get|to have|building|next|now|most|the most|built now|built next|to build next|to learn next|us to build|me to build))*$'),
  new RegExp('^what(?:\'s| is| are) (?:on )?' + YOUR + ' (?:' + LISTS + '|list|plate)$'),
  // "what is still open", "what is unbuilt", "what is not built yet": never a bare "what is open" (a shop, a file)
  new RegExp('^what(?:\'s| is| are) (?:(?:still|left|not yet) (?:open|unbuilt|not built|undone)|unbuilt|not built(?: yet)?|left to build|left on ' + YOUR + ' (?:list|plate|backlog))(?: for ' + YOU + ')?$'),
  new RegExp('^what(?:\'s| is|s) (?:next|coming|coming up|on the list|on the plate|left) for ' + YOU + '$'),
  // only the negative forms: "what have you not built yet", "what haven't you built"; "what have you built" is what shipped, not this
  new RegExp('^what (?:(?:have|has|did) ' + YOU + ' not|(?:haven\'t|havent|hasn\'t|hasnt|didn\'t|didnt) ' + YOU + ') (?:built|build|made|make|done|do|shipped|ship|finished|finish)(?: yet)?$'),
  new RegExp('^what (?:have|has|do|does) ' + YOU + ' (?:still |yet )?(?:left|got left|have left|got) to (?:build|make|do|ship)$'),
  new RegExp('^what (?:are|were) ' + YOUR + ' (?:open|unbuilt|remaining|outstanding|pending) (?:asks|wants|items|wishes)$'),
  new RegExp('^(?:(?:name|list|show|show me|tell me|give me|print|read|read me|read out|recite|enumerate)(?: me)?(?: all| every| each|  everything)?(?: of)? )?' + YOUR + ' ' + LISTS + '$'),
  new RegExp('^(?:name|list|show|show me|tell me|give me|print|read|read me|read out|recite|enumerate)(?: me)?(?: all| every| each)?(?: of)? (?:the )?(?:things|stuff|asks|wants|items)(?: ' + YOU + ' (?:want|wants|wanted|asked for|asked|have not built|haven\'t built|havent built|still want|want built))?(?: not built| unbuilt| still open| left| yet)?$'),
  // bare noun phrases that can only mean this list ("asks not built?" once reached the open web and answered with Daisy Bell);
  // a bare "todo", "inbox" or "backlog" stays out: those are the visitor's own lists, not V01D's
  new RegExp('^(?:the |' + YOUR + ' )?(?:(?:open|unbuilt) (?:asks|wants)|asks not built(?: yet)?|unbuilt list|growth inbox)$'),
  new RegExp('^what (?:do|would) ' + YOU + ' (?:like|want) (?:built|to build|to be built|me to build|us to build)(?: next| now| first)?$'),
  new RegExp('^what (?:should|could|can) (?:i|we) build for ' + YOU + '(?: next| now)?$'),
  new RegExp('^what(?:\'s| is) in ' + YOUR + ' (?:' + LISTS + ')$'),
  new RegExp('^(?:what(?:\'s| is| are) )?' + YOUR + ' (?:developmental|current|own) (?:state|backlog|wants|asks)$'),
];
// the will card and the self page keep their asks: these are never this skill's, even when a rule above would take them
const NOT = /^(?:what do you want to (?:be|become|do)|what do you want to be (?:next|now)|your will|what(?:'s| is) your will)$/;
/** the first clause of a compound ask ("name all your unbuilt asks and come up with 50 more new ones" -> "name all your unbuilt asks"),
 *  and the rest. Pure. */
export function clauses(text) {
  const t = CLEAN(text);
  const m = /^(.*?)(?:\s*[,;]\s*|\s+(?:and|then|and then|plus|also)\s+)(?=(?:come up|make up|invent|think of|think up|add|give|write|list|name|suggest|propose|tell|then|also|and|\d))(.*)$/.exec(t);
  return m && m[1] && m[2] ? { first: m[1].trim(), rest: m[2].trim().replace(/^(?:and then|and|then|also|plus)\s+/, '') } : { first: t, rest: '' };
}
/** true when the ask (its first clause) is for V01D's own backlog. Pure. */
export function wantsOf(text) {
  const { first } = clauses(text);
  if (!first || NOT.test(first)) return false;
  return RULES.some((re) => re.test(first));
}
/** the one line for a second clause that asks for new ones ("and come up with 50 more new ones"): '' when there is none. Pure. */
export function moreLine(rest) {
  const r = CLEAN(rest);
  if (!r) return '';
  const n = (/\b(\d+)\b/.exec(r) || [])[1];
  if (/\b(?:more|new|fresh|extra|another|others|invent|make up|come up|think (?:of|up)|suggest|propose)\b/.test(r)) return 'The ' + (n ? n + ' ' : '') + 'new ones are yours to ask for one at a time: I list only what I have, never ones made up on the spot.';
  return '';
}

const day = (t) => String(t || '').slice(0, 10);
const sentence = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const MAX = 40; // items a block shows at most (the inbox is the longest list; the whole thing stays one card)
/** the card's model from V01D's three records: { wants, asks, inbox, counts, missing }. A record that is null or not a list is
 *  "missing" (could not be read), an empty list is an empty state. Pure. */
export function cardModel({ will, reflect, self } = {}) {
  const wl = will && Array.isArray(will.wants) ? will.wants : null;
  const ak = reflect && Array.isArray(reflect.asks) ? reflect.asks : null;
  const op = self && Array.isArray(self.open) ? self.open : null;
  const items = (xs) => (xs || []).filter((x) => x && typeof x === 'object');
  const wants = items(wl).map((w) => ({ text: sentence(w.i_want || w.title), because: sentence(w.because), kind: sentence(w.kind) })).filter((w) => w.text).slice(0, MAX);
  const asks = items(ak).map((a) => ({ text: sentence(a.ask), at: day(a.at), small: a.small === true, kind: a.kind === 'daily' ? 'daily' : a.kind === 'build' ? 'build' : '' })).filter((a) => a.text).slice(0, MAX);
  const inbox = items(op).map((o) => ({ text: sentence(o.ask || o.title), from: sentence(o.from) })).filter((o) => o.text).slice(0, MAX);
  return { wants, asks, inbox, counts: { wants: wants.length, asks: asks.length, inbox: inbox.length }, missing: { will: !wl, reflect: !ak, self: !op }, at: will && will.at ? day(will.at) : '' };
}
const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
/** the count line: "N wants · M asks not built · K inbox items". Pure. */
export const countLine = (c) => n(c.wants, 'want', 'wants') + ' · ' + n(c.asks, 'ask not built', 'asks not built') + ' · ' + n(c.inbox, 'inbox item', 'inbox items');
const SUB = { wants: 'What I chose to become next, from what people keep asking me for (my will).', asks: 'What I asked my builders for, in my own words, and nobody has built: the same list my self card holds.', inbox: 'The open items of my growth inbox (domains/void.frontier.md), the one build order my builders take next.' };
const EMPTY = { wants: 'My will has not chosen anything yet.', asks: 'Everything I asked for has been built.', inbox: 'My growth inbox is empty.' };
const MISSING = { wants: 'I could not read my will just now, so I will not guess at it.', asks: 'I could not read my asks just now, so I will not guess at them.', inbox: 'I could not read my growth inbox just now, so I will not guess at it.' };
const CSS = '.wants-card .wants-count{font-size:13px;color:var(--muted);margin:2px 0 10px}.wants-card .wants-h{font-size:15px;margin:12px 0 2px}.wants-card .wants-sub{font-size:12px;color:var(--muted);margin:0 0 6px}'
  + '.wants-card .wants-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px}.wants-card .wants-chip{font:inherit;font-size:13px;line-height:1.35;text-align:left;color:var(--fg);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 12px;cursor:pointer;max-width:100%}'
  + '.wants-card .wants-chip:hover,.wants-card .wants-chip:focus-visible{background:rgba(255,255,255,.12)}.wants-card .wants-chip.copied{border-color:var(--accent)}.wants-card .wants-chip small{display:block;color:var(--muted);font-size:11px;margin-top:2px}.wants-card .wants-empty{font-size:13px;color:var(--muted);margin:2px 0 6px}.wants-card .wants-more{margin:10px 0 0;font-size:13px}';
/** the card's markup: a title, the count line, three blocks (each a heading, one line of where it comes from, chips or its empty or
 *  missing line), the compound line when there is one, and a source line. esc escapes for HTML; every value goes through it. Pure. */
export function cardHtml(m, esc, { more = '' } = {}) {
  const chip = (text, sub) => '<button type="button" class="wants-chip" data-copy="' + esc(text) + '" title="tap to copy">' + esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
  const block = (id, title, items, sub) => '<section class="wants-block" data-block="' + id + '" data-n="' + items.length + '"><h3 class="wants-h">' + esc(title) + ' <span class="wants-n">(' + items.length + ')</span></h3><p class="wants-sub">' + esc(SUB[id]) + '</p>'
    + (m.missing[id === 'wants' ? 'will' : id === 'asks' ? 'reflect' : 'self'] ? '<p class="wants-empty" data-missing="1">' + esc(MISSING[id]) + '</p>'
      : items.length ? '<div class="wants-chips">' + items.map((it) => chip(it.text, sub(it))).join('') + '</div>' : '<p class="wants-empty">' + esc(EMPTY[id]) + '</p>') + '</section>';
  return '<style>' + CSS + '</style><h2>What I want built</h2><div class="wants-count" data-counts="' + esc(JSON.stringify(m.counts)) + '">' + esc(countLine(m.counts)) + '</div>'
    + block('wants', 'My will', m.wants, (w) => w.because)
    + block('asks', 'Asked, not built yet', m.asks, (a) => ['Asked ' + (a.kind === 'daily' ? 'in my daily reflection' : a.kind === 'build' ? 'after a build' : 'by me') + (a.at ? ', ' + a.at : ''), a.small ? 'I called it small' : ''].filter(Boolean).join(' · '))
    + block('inbox', 'Growth inbox', m.inbox, (o) => o.from)
    + (more ? '<p class="wants-more">' + esc(more) + '</p>' : '')
    + '<div class="src">Source: my will (/api/will' + (m.at ? ', ' + esc(m.at) : '') + '), my asks (/api/reflect) and my growth inbox (/self.json from domains/void.frontier.md). My own records, no model. Tap an item to copy it.</div>';
}

const get = async (url) => { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
async function copyText(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (_) {}
  try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (_) { return false; }
}
async function run(text, api) {
  if (!wantsOf(text)) return 'none';
  const { showPage, esc, say } = api;
  const [will, reflect, self] = await Promise.all([get('/api/will'), get('/api/reflect'), get('/self.json')]);
  const m = cardModel({ will, reflect, self }), more = moreLine(clauses(text).rest);
  showPage((el) => {
    el.classList.add('wants-card');
    el.innerHTML = cardHtml(m, esc, { more });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest && e.target.closest('button[data-copy]'); if (!b) return;
      const ok = await copyText(b.getAttribute('data-copy'));
      b.classList.toggle('copied', ok); if (say) say(ok ? 'copied' : 'select it to copy');
    });
  });
  if (say) say(countLine(m.counts));
  return 'wants';
}

export default {
  name: 'wants',
  about: "What I want built: my will, the asks of mine nobody has built, and my growth inbox, from my own records, never a model.",
  examples: ['what do you want built now', 'name all your unbuilt asks', 'asks not built?', 'what have you not built yet', 'your backlog', 'what are your open asks', 'what else do you want', 'whats next for you', 'what do you want to learn'],
  nearMisses: ['what do I want for dinner', "what's next?", "what's on my list", 'what do you think of yourself', 'what can you do', 'what do you want to be', 'tell me about yourself'],
  match(lower, text) { return wantsOf(text || lower); },
  run,
  wantsOf, clauses, moreLine, cardModel, cardHtml, countLine,
};

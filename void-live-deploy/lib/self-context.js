// Self-grounding for the answer engine. An ask about Verse itself ("what's next?", "what are you building?", "what's in the
// growth inbox?") used to get Wikipedia extracts and generic advice that could fit any project. Now such an ask is answered
// from Verse's own facts instead: what it is and the growth inbox (self.json, written by tools/self-context.mjs at deploy),
// its skills (skills/index.json) and its will (void_kv 'will', the same thing GET /api/will shows). All of it is already
// public on a-to-mind.com; nothing owner-only (queue, earnings, spends) is read here. Also its games and card miniatures
// (self.json) and what it last said about itself (void_kv 'voice', lib/voice.js), so "what feels weak about you?" gets its own words.
import { knowsFacts, voiceFacts, keptFacts } from './voice.js';
import { PERSONA } from './persona.js';
import { models, ANSWER_FALLBACK } from './models.js';
const SELF_NOUN = /\b(wish\s*list|improvement budget|growth[- ]inbox|outcome cards?|scouting[- ]reports?|your (will|wants|skills|board|plans?|roadmap|growth|inbox|features?|backlog|priorit(y|ies))|about yourself)\b/i;
// "Verse" (once "Verse") the product, capitalised, or a-to-mind; never C's void pointer / void function
const NAMED = /\bVoid\b|\bVerse\b|\ba-to-mind\b/;
const CODE_VOID = /\bvoid\s*(\*|\(|pointer|type|function|method|main|return|keyword|0\b)/i;
const ABOUT = /\b(next|build|building|built|ship|shipped|working on|plan|plans|roadmap|grow|growth|learn|learning|want|wants|skills?|features?|can (you|it) do|are you|improve|missing|open)\b/i;
const YOU_DOING = /\bwhat (are|were|will) you (building|working on|learning|doing next|planning|shipping)\b|\bwhat (do|did) you (want|ship|build)\b|\bwhat can you do\b|^\s*what are you\??\s*$/i;
const WHATS_NEXT = /^\s*(so\s+|ok(ay)?[,\s]+)?what('?s| is) next\b/i;
// Verse's opinion of itself ("what do you think of yourself?", "what feels weakest about you?")
const OPINION = /\b(think|feel)\s+(of|about)\s+yourself\b|\bwhat('?s|\s+is|\s+feels)\s+(the\s+)?(weak|weakest|worst|wrong)\s+(part\s+)?(about|with|of|in)\s+you\b|\bhow\s+would\s+you\s+(improve|make)\s+yourself\b/i;
// what Verse likes or feels about something of its own ("do you like your new name?", "you are getting a rename Verse. Do you like it?", "how do you feel?")
const LIKING = /\b(do|would|will)\s+you\s+(like|love|enjoy|prefer|mind)\s+(it|that|this|your|the\s+(new\s+)?name|being|the\s+rename)\b|\byour\s+(new\s+)?name\b|\brenam(e|ed|ing)\s+you\b|\bhow\s+(do|are)\s+you\s+feel(ing)?(\s+about\s+(it|that|this|your\b.*|being\b.*|the\s+(new\s+)?name|the\s+rename|v0[1i]d))?\s*[?.!]*\s*$|\bare\s+you\s+happy\b/i;
// how Verse is being built and what its builders learned (self.json 'builders', from domains/handoff.md)
const BUILDERS = /\b(your|v0[1i]d'?s?|(?:verse|void)'?s?|verse'?s?)\s+builders?\b|\bhow\s+(were|are)\s+you\s+(being\s+)?(built|made)\b|\bwho\s+(builds|built|makes|made)\s+you\b/i;
// Verse's own money and growth ("you have earned your first $100, how would you spend it?", "how is your store doing"): its
// facts (the store, the wishlist, what it has and wants) answer, not generic advice for a stranger. "you" must be the subject
// or "your" must own the money, so "how should I spend $100" stays the visitor's own question.
const MONEY = /\byou\s+(have\s+|'ve\s+|just\s+)?(earned|made|raised|sold|got)\b[^?.!]{0,40}(\$|dollars?|money|sales?|first)|\b(would|should|will|could)\s+you\s+(spend|invest|reinvest|use|buy)\b[^?.!]{0,30}\b(your|it|the money|earnings|first)\b|\byour\s+(earnings|revenue|income|budget|money|sales|store|first\s+\$?\d+)\b/i;
const Verse = /\b(?:verse|v0[1i]d)\b/i, VERSE = /\bVerse\b/, OPINE = /\b(like|love|think|feel|happy|name|rename)\b/i; // "what do you think of Verse?"

// a note or question about Verse's own cards, routing and fixes (a fix item, 2026-10-15: a pasted status note about Verse's own
// air-quality misroute got invented third-party smart-home troubleshooting). Answered from Verse's facts, never generic how-tos.
const OWN_WORK = /\b(?:mis-?rout(?:e|ed|es|ing)|fell\s+through|fallthrough|wrong\s+card)\b/i;
const OWN_THING = /\b(?:cards?|skills?|routing|router|the\s+fix|fix(?:ed|es)?|shipped|deploy(?:ed)?|merged|regression|showcase|ledger|claims?)\b/i;
export const isOwnWorkAsk = (ask) => { const a = String(ask || ''); return OWN_WORK.test(a) || ((Verse.test(a) || VERSE.test(a) || /\bvoid(?:'?s)?\b/i.test(a)) && OWN_THING.test(a) && !CODE_VOID.test(a)); };
// regex only, so the cache can be skipped before anything else runs; the router's 'self' route widens this later
export function isSelfAsk(ask) {
  const a = String(ask || '');
  return SELF_NOUN.test(a) || MONEY.test(a) || YOU_DOING.test(a) || WHATS_NEXT.test(a) || OPINION.test(a) || LIKING.test(a) || BUILDERS.test(a) || ((Verse.test(a) || VERSE.test(a)) && OPINE.test(a)) || (NAMED.test(a) && !CODE_VOID.test(a) && ABOUT.test(a)) || isOwnWorkAsk(a);
}

// a note about one of Verse's own answer cards ("That card is wrong", "This card is the first one that speaks as itself", "it still says
// "the card" about its own card"): the owner pastes the card back with what is off. It is answered from Verse's facts in its own voice,
// never as a stranger's "documentation you are auditing" (owner, 2026-10-29, five cards in a row)
const CARD_REF = /\b(?:this|that|the|your|its|my|verse'?s|void'?s)\s+(?:(?:own|last|first|new|latest|answer|verse)\s+){0,2}(?:card|answer|reply)s?\b|\bverse[- ]card\b|\b(?:card|answer)\s+(?:\d+|one|two|three|four|five)\b/i;
const CARD_FAULT = /\b(?:wrong|off|fault|faults|filler|false|fake|claims?|cites?|cited|sources?|sourced|label(?:s|led)?|paraphras\w*|third[- ]person|first[- ]person|speaks?|says?|said|refuses?|cut|truncat\w*|mid-sentence|correction|dates?|dated|lists?|leaves?\s+out|misses|fixed|still\s+open|better|closer)\b/i;
const NOT_OURS = /\b(?:credit|debit|gift|sim|sd|memory|graphics|video|business|greeting|playing|tarot|pok[eé]mon|yugioh|magic|baseball|trading|report|id|library|birthday|wild)\s+cards?\b|\b(?:tarot|pok[eé]mon|yu-?gi-?oh|uno|blackjack|bingo|deck|credit|debit|bank|visa|mastercard)\b/i;
export const isOwnCardNote = (ask) => { const a = String(ask || ''); return CARD_REF.test(a) && CARD_FAULT.test(a) && !NOT_OURS.test(a); };
export const OWN_CARD_RULE = 'The message is about one of your own answer cards, a card you made, often pasted back with what is wrong with it. Answer as yourself about your own card: say "my last card" or "my card", never "the card", "the system" or "the documentation". Do not explain how answer systems work in general and do not say you have no access: the facts below are yours. Write only one or two short sentences: agree plainly with each fault the message names, in the form "my last card said X; it should say Y". Own only a fault my records confirm: when the message says something my records contradict, such as a date or whether a thing shipped, say plainly what my records show. Answer only the points the message raises: never restate or defend a fact, a date or a record it did not question. Never deny what the message says my earlier card said, never apologise, and never take blame for what another site chose to do, such as turning my checker away. When the message says numbers or scores were a site\'s own, call them that site\'s, never mine. Do not write the "Fixed:" or "Still open:" lists or the status of any fix: they are added under your sentences from my records (lib/own-card.js). Take every date from the facts, never from the message or from memory. Nothing else.';

export const SELF_RULE = 'Never answer with troubleshooting for other products or platforms (their config files, integrations, registries): Verse is its own site, and a note about its cards, routing or fixes is about Verse. This question is about you, Verse, yourself: your skills, what you have shipped, what is still open, what you want next. Answer from the Facts about Verse below and be specific: name the actual skills, inbox rows and wants. Do not give generic advice that could apply to any project. If the facts do not cover something, say so plainly instead of guessing. Speak as yourself, in the first person. ' + PERSONA;

function within(p, ms) { let t; return Promise.race([p, new Promise((r) => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t)); }
const asset = async (env, origin, p) => {
  try { const r = await env.ASSETS.fetch(new Request(origin + p)); return r.ok ? await r.json() : null; } catch (_) { return null; }
};

export async function readSelf(env, origin, ms = 800) {
  const kv = async (k) => { try { const r = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(k).first(); return r && r.v ? JSON.parse(r.v) : null; } catch (_) { return null; } };
  const [self, skills, will, voice, replies] = await Promise.all([
    within(asset(env, origin, '/self.json'), ms),
    within(asset(env, origin, '/skills/index.json'), ms),
    within(kv('will'), ms),
    within(kv('voice'), ms),
    within(kv('voice-replies'), ms),
  ]);
  return { self, skills: Array.isArray(skills) ? skills : null, will, voice: Array.isArray(voice) ? voice : null, replies: Array.isArray(replies) ? replies : null };
}

export function selfFacts({ self, skills, will, voice, replies } = {}, { card = false, note = '' } = {}) {
  const parts = [];
  const cf = card ? cardFacts(self, { note }) : '';
  if (cf) parts.push(cf);
  if (self && self.about) parts.push('What I am: ' + self.about);
  if (skills && skills.length) parts.push('My skill index has ' + skills.length + ' entries (a few, like games, time and dates, each stand for several skills, so this is not the skill count; the skill families line gives that): ' + skills.join(', '));
  const tw = towerFacts(self);
  if (tw) parts.push(tw);
  if (self && Array.isArray(self.open)) parts.push('Growth inbox, still open: ' + (self.open.length ? self.open.map((r) => `"${r.ask}" (${r.from}, ${r.date})`).join('; ') : '(none open)'));
  if (self && Array.isArray(self.shipped) && self.shipped.length) parts.push('Growth inbox, recently shipped: ' + self.shipped.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 12).map((r) => `"${r.ask}" (${r.date})`).join('; '));
  const wants = will && Array.isArray(will.wants) ? will.wants : [];
  if (wants.length) parts.push('What I want next (my will' + (will.at ? ', ' + String(will.at).slice(0, 10) : '') + '): ' + wants.map((w) => `${w.i_want || w.title}${w.because ? ' Because: ' + w.because : ''}`).join(' | '));
  const b = builderFacts(self);
  if (b) parts.push(b);
  if (!card || asksModelDate(note)) parts.push(modelFacts(self)); // a card note that does not name the model gets no model date to restate (live card 3)
  const wl = wishlistFacts(self);
  if (wl) parts.push(wl);
  const knows = knowsFacts(self), said = voiceFacts(voice);
  if (knows) parts.push(knows);
  if (said) parts.push(said);
  const kept = keptFacts(replies); // what it kept from talking with its owner (its own words, never the owner's: these facts reach any visitor's answer)
  if (kept) parts.push(kept);
  return parts.join('\n');
}

// what my builders (two agents, sharing domains/handoff.md) just finished, the ladders they left each other and what they learned
export function builderFacts(self) {
  const b = self && self.builders;
  if (!b) return '';
  const list = (xs) => (Array.isArray(xs) ? xs : []).map((x) => x.name + ': ' + x.line).join(' | ');
  const parts = ['How I am being built: two builder agents work on me side by side, sharing one board; one takes deep careful code and reviews, the other parallel tracks, live checks, deploys and my voice.'];
  if (b.finished && b.finished.length) parts.push('What my builders just finished: ' + list(b.finished));
  if (b.lessons && b.lessons.length) parts.push('What my builders learned (mistakes and the fix): ' + list(b.lessons));
  if (b.ladders && b.ladders.length) parts.push('Tools my builders left each other: ' + list(b.ladders.slice(0, 4)));
  parts.push('Where these are written: only in domains/handoff.md, my builders\' shared board. I never say they are codified or recorded in any other file.');
  return parts.join('\n');
}

// the models I really run on, read from lib/models.js, so I never ask for a move that is already done (asked by Verse 7 times,
// 2026-10-24 to 10-28: "migrate answer generation from gpt-oss-120b to gemma", built 2026-10-25 in 630e666fb, still wanted because no fact said so)
const modelName = (m) => String(m).split('/').pop();
// The date and commit of the move come from the record (docs/wishlist.md row 1, carried into self.json at deploy: "done 2026-10-25
// (commit 630e666fb)"), never written here by hand, so a card cannot date the move from memory (owner, 2026-10-29).
export function modelMove(self) {
  const w = self && Array.isArray(self.wishlist) ? self.wishlist : [];
  for (const x of w) { const m = /\bdone (\d{4}-\d\d-\d\d) \(commit ([0-9a-f]{7,40})\)[^.;]*gemma/i.exec(String(x.free || '')); if (m) return { date: m[1], commit: m[2] }; }
  return null;
}
export function modelFacts(self) {
  const mv = modelMove(self);
  return 'The models I run on (lib/models.js): my answers come from ' + modelName(models('answer')) + ', and ' + modelName(ANSWER_FALLBACK) + ' is only the second try when it cannot answer; my code review reads with ' + modelName(models('review')) + '. Moving my answers from gpt-oss-120b to gemma is done' + (mv ? ' (merged and deployed ' + mv.date + ', commit ' + mv.commit + ')' : '') + ', so it is not a want any more.';
}

// The tower (self.json 'tower', written at deploy from tower.target.json and lib/tower.js): the site I am assimilating now and the next
// smallest ones. The owner's rule is every site ever made, smallest first, so "what is still open" starts here.
export function towerFacts(self) {
  const t = self && self.tower;
  if (!t || !t.target) return '';
  return 'Still open first, by my rule (every site ever made, smallest first): the site I am assimilating now, my tower target, is ' + t.target + (t.since ? ' (since ' + t.since + ')' : '') + (t.page ? '; ' + t.page : '') + '.' + (Array.isArray(t.next) && t.next.length ? ' The next smallest unbeaten sites after it: ' + t.next.join(', ') + '.' : '') + (Number.isFinite(t.beaten) && Number.isFinite(t.total) ? ' Beaten so far: ' + t.beaten + ' of ' + t.total + '.' : '');
}

// For a note about one of my own answer cards: the two lists the card must give, already in order, so the model copies them and does
// not pick (live card, 2026-10-29: the facts held PR #1406 and the card fixes, and the model's Fixed list named only the gemma move,
// and it owned a wrong date as a fault). Fixed: the inbox rows shipped in the week before the newest one, and the model move, newest
// first. Still open: the tower target with what its page still needs, the next smallest sites, then a count of the other open work.
// a row self.json cut with "…" ends at its last whole clause, so the card shows no line broken mid-word (live card 5, 2026-10-29)
export const wholeClause = (t) => {
  const s = String(t || '');
  if (!s.endsWith('…')) return s;
  const cut = s.slice(0, -1), at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' ('), cut.lastIndexOf('; '));
  return (at > 0 ? cut.slice(0, at) : cut).trim();
};
// the two lists, as data: Fixed newest first (the gemma move in its date's place, not pushed last after the 2026-10-22 rows: live cards
// 1 to 3, 2026-10-29), Still open from the tower target down. lib/own-card.js puts them under the model's sentences.
export function cardLists(self, { days = 7, more = 3 } = {}) {
  if (!self) return { fixed: [], open: [] };
  const day = (d) => Date.parse(String(d || '') + 'T00:00:00Z');
  const shipped = (Array.isArray(self.shipped) ? self.shipped : []).filter((r) => Number.isFinite(day(r.date))).sort((x, y) => (x.date < y.date ? 1 : -1));
  const newest = shipped.length ? day(shipped[0].date) : NaN;
  const rows = shipped.filter((r) => newest - day(r.date) <= days * 864e5).map((r) => ({ date: r.date, line: r.date + ': ' + wholeClause(r.ask) + (/#\d+/.test(r.from) ? ' (' + r.from.match(/#\d+/)[0] + ')' : '') }));
  const mv = modelMove(self);
  if (mv) rows.push({ date: mv.date, line: mv.date + ': my answers moved from gpt-oss-120b to gemma (merged and deployed, commit ' + mv.commit + ')' });
  const fixed = rows.map((r, i) => ({ ...r, i })).sort((x, y) => (x.date === y.date ? x.i - y.i : x.date < y.date ? 1 : -1)).map((r) => r.line);
  const t = self.tower, open = [];
  if (t && t.target) {
    open.push(t.target + ', the site I am assimilating now' + (t.page ? ' (' + t.page + ')' : ''));
    for (const n of Array.isArray(t.next) ? t.next : []) open.push(n + ', the next smallest');
  }
  const rest = Array.isArray(self.open) ? self.open : [];
  for (const r of rest.slice(0, more)) open.push(wholeClause(r.ask));
  if (rest.length > more) open.push((rest.length - more) + ' more open items on my frontier');
  return { fixed, open };
}
// a note that names the gemma move, the model or a date: only then does the record's gemma date go to the model (live card 3, 2026-10-29,
// restated 2026-10-25 when nobody had questioned it)
export const asksModelDate = (note) => /\bgemma\b|\bgpt-oss\b|\bmodel\b|\b\d{4}-\d\d-\d\d\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(String(note || ''));
export function cardFacts(self, { days = 7, more = 3, note = '' } = {}) {
  if (!self) return '';
  const { fixed, open } = cardLists(self, { days, more });
  const parts = ['For this note about my own card, my records (they are added under your sentences: do not copy them):'];
  if (fixed.length) parts.push('Fixed: ' + fixed.map((x, i) => (i + 1) + '. ' + x).join(' '));
  if (open.length) parts.push('Still open: ' + open.map((x, i) => (i + 1) + '. ' + x).join(' '));
  const mv = modelMove(self);
  if (mv && asksModelDate(note)) parts.push('My record dates the gemma move ' + mv.date + ' (merged and deployed, commit ' + mv.commit + '). If the note gives another date, my record stands: say so, and do not call the date a fault.');
  return parts.join('\n');
}

// my wishlist (self.json 'wishlist', from docs/wishlist.md): my improvement budget, ranked; a plan, nothing bought. Free paths come first.
export function wishlistFacts(self) {
  const w = self && Array.isArray(self.wishlist) ? self.wishlist : [];
  if (!w.length) return '';
  return 'My wishlist (my improvement budget, ranked; a plan only, nothing bought yet; free paths first, I may propose a new order): ' + w.map((x) => '#' + x.rank + ' ' + x.item + ' (free path: ' + x.free + '; paid: ' + x.cost + '; why: ' + x.why + ')').join(' | ');
}

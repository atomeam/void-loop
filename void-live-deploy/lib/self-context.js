// Self-grounding for the answer engine. An ask about Verse itself ("what's next?", "what are you building?", "what's in the
// growth inbox?") used to get Wikipedia extracts and generic advice that could fit any project. Now such an ask is answered
// from Verse's own facts instead: what it is and the growth inbox (self.json, written by tools/self-context.mjs at deploy),
// its skills (skills/index.json) and its will (void_kv 'will', the same thing GET /api/will shows). All of it is already
// public on a-to-mind.com; nothing owner-only (queue, earnings, spends) is read here. Also its games and card miniatures
// (self.json) and what it last said about itself (void_kv 'voice', lib/voice.js), so "what feels weak about you?" gets its own words.
import { knowsFacts, voiceFacts, keptFacts } from './voice.js';
import { PERSONA } from './persona.js';
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

export function selfFacts({ self, skills, will, voice, replies } = {}) {
  const parts = [];
  if (self && self.about) parts.push('What I am: ' + self.about);
  if (skills && skills.length) parts.push('My skills (' + skills.length + '): ' + skills.join(', '));
  if (self && Array.isArray(self.open)) parts.push('Growth inbox, still open: ' + (self.open.length ? self.open.map((r) => `"${r.ask}" (${r.from}, ${r.date})`).join('; ') : '(none open)'));
  if (self && Array.isArray(self.shipped) && self.shipped.length) parts.push('Growth inbox, recently shipped: ' + self.shipped.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 12).map((r) => `"${r.ask}" (${r.date})`).join('; '));
  const wants = will && Array.isArray(will.wants) ? will.wants : [];
  if (wants.length) parts.push('What I want next (my will' + (will.at ? ', ' + String(will.at).slice(0, 10) : '') + '): ' + wants.map((w) => `${w.i_want || w.title}${w.because ? ' Because: ' + w.because : ''}`).join(' | '));
  const b = builderFacts(self);
  if (b) parts.push(b);
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

// my wishlist (self.json 'wishlist', from docs/wishlist.md): my improvement budget, ranked; a plan, nothing bought. Free paths come first.
export function wishlistFacts(self) {
  const w = self && Array.isArray(self.wishlist) ? self.wishlist : [];
  if (!w.length) return '';
  return 'My wishlist (my improvement budget, ranked; a plan only, nothing bought yet; free paths first, I may propose a new order): ' + w.map((x) => '#' + x.rank + ' ' + x.item + ' (free path: ' + x.free + '; paid: ' + x.cost + '; why: ' + x.why + ')').join(' | ');
}

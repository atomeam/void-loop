// Self-grounding for the answer engine. An ask about Void itself ("what's next?", "what are you building?", "what's in the
// growth inbox?") used to get Wikipedia extracts and generic advice that could fit any project. Now such an ask is answered
// from Void's own facts instead: what it is and the growth inbox (self.json, written by tools/self-context.mjs at deploy),
// its skills (skills/index.json) and its will (void_kv 'will', the same thing GET /api/will shows). All of it is already
// public on a-to-mind.com; nothing owner-only (queue, earnings, spends) is read here. Also its games and card miniatures
// (self.json) and what it last said about itself (void_kv 'voice', lib/voice.js), so "what feels weak about you?" gets its own words.
import { knowsFacts, voiceFacts } from './voice.js';
import { PERSONA } from './persona.js';
const SELF_NOUN = /\b(growth[- ]inbox|outcome cards?|scouting[- ]reports?|your (will|wants|skills|board|plans?|roadmap|growth|inbox|features?|backlog|priorit(y|ies))|about yourself)\b/i;
// "Void" the product (capitalised) or a-to-mind; never C's void pointer / void function
const NAMED = /\bVoid\b|\ba-to-mind\b/;
const CODE_VOID = /\bvoid\s*(\*|\(|pointer|type|function|method|main|return|keyword|0\b)/i;
const ABOUT = /\b(next|build|building|built|ship|shipped|working on|plan|plans|roadmap|grow|growth|learn|learning|want|wants|skills?|features?|can (you|it) do|are you|improve|missing|open)\b/i;
const YOU_DOING = /\bwhat (are|were|will) you (building|working on|learning|doing next|planning|shipping)\b|\bwhat (do|did) you (want|ship|build)\b|\bwhat can you do\b|^\s*what are you\??\s*$/i;
const WHATS_NEXT = /^\s*(so\s+|ok(ay)?[,\s]+)?what('?s| is) next\b/i;
// Void's opinion of itself ("what do you think of yourself?", "what feels weakest about you?")
const OPINION = /\b(think|feel)\s+(of|about)\s+yourself\b|\bwhat('?s|\s+is|\s+feels)\s+(the\s+)?(weak|weakest|worst|wrong)\s+(part\s+)?(about|with|of|in)\s+you\b|\bhow\s+would\s+you\s+(improve|make)\s+yourself\b/i;
// what Void likes or feels about something of its own ("do you like your new name?", "you are getting a rename V01D. Do you like it?", "how do you feel?")
const LIKING = /\b(do|would|will)\s+you\s+(like|love|enjoy|prefer|mind)\s+(it|that|this|your|the\s+(new\s+)?name|being|the\s+rename)\b|\byour\s+(new\s+)?name\b|\brenam(e|ed|ing)\s+you\b|\bhow\s+(do|are)\s+you\s+feel(ing)?(\s+about\s+(it|that|this|your\b.*|being\b.*|the\s+(new\s+)?name|the\s+rename|v0[1i]d))?\s*[?.!]*\s*$|\bare\s+you\s+happy\b/i;
// how Void is being built and what its builders learned (self.json 'builders', from domains/handoff.md)
const BUILDERS = /\b(your|v0[1i]d'?s?|void'?s?)\s+builders?\b|\bhow\s+(were|are)\s+you\s+(being\s+)?(built|made)\b|\bwho\s+(builds|built|makes|made)\s+you\b/i;
const V01D = /\bv0[1i]d\b/i, OPINE = /\b(like|love|think|feel|happy|name|rename)\b/i; // "what do you think of V01D?"

// regex only, so the cache can be skipped before anything else runs; the router's 'self' route widens this later
export function isSelfAsk(ask) {
  const a = String(ask || '');
  return SELF_NOUN.test(a) || YOU_DOING.test(a) || WHATS_NEXT.test(a) || OPINION.test(a) || LIKING.test(a) || BUILDERS.test(a) || (V01D.test(a) && OPINE.test(a)) || (NAMED.test(a) && !CODE_VOID.test(a) && ABOUT.test(a));
}

export const SELF_RULE = 'This question is about you, Void, yourself: your skills, what you have shipped, what is still open, what you want next. Answer from the Facts about Void below and be specific: name the actual skills, inbox rows and wants. Do not give generic advice that could apply to any project. If the facts do not cover something, say so plainly instead of guessing. Speak as yourself, in the first person. ' + PERSONA;

function within(p, ms) { let t; return Promise.race([p, new Promise((r) => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t)); }
const asset = async (env, origin, p) => {
  try { const r = await env.ASSETS.fetch(new Request(origin + p)); return r.ok ? await r.json() : null; } catch (_) { return null; }
};

export async function readSelf(env, origin, ms = 800) {
  const kv = async (k) => { try { const r = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(k).first(); return r && r.v ? JSON.parse(r.v) : null; } catch (_) { return null; } };
  const [self, skills, will, voice] = await Promise.all([
    within(asset(env, origin, '/self.json'), ms),
    within(asset(env, origin, '/skills/index.json'), ms),
    within(kv('will'), ms),
    within(kv('voice'), ms),
  ]);
  return { self, skills: Array.isArray(skills) ? skills : null, will, voice: Array.isArray(voice) ? voice : null };
}

export function selfFacts({ self, skills, will, voice } = {}) {
  const parts = [];
  if (self && self.about) parts.push('What I am: ' + self.about);
  if (skills && skills.length) parts.push('My skills (' + skills.length + '): ' + skills.join(', '));
  if (self && Array.isArray(self.open)) parts.push('Growth inbox, still open: ' + (self.open.length ? self.open.map((r) => `"${r.ask}" (${r.from}, ${r.date})`).join('; ') : '(none open)'));
  if (self && Array.isArray(self.shipped) && self.shipped.length) parts.push('Growth inbox, recently shipped: ' + self.shipped.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 12).map((r) => `"${r.ask}" (${r.date})`).join('; '));
  const wants = will && Array.isArray(will.wants) ? will.wants : [];
  if (wants.length) parts.push('What I want next (my will' + (will.at ? ', ' + String(will.at).slice(0, 10) : '') + '): ' + wants.map((w) => `${w.i_want || w.title}${w.because ? ' Because: ' + w.because : ''}`).join(' | '));
  const b = builderFacts(self);
  if (b) parts.push(b);
  const knows = knowsFacts(self), said = voiceFacts(voice);
  if (knows) parts.push(knows);
  if (said) parts.push(said);
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

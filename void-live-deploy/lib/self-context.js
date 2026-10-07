// Self-grounding for the answer engine. An ask about Void itself ("what's next?", "what are you building?", "what's in the
// growth inbox?") used to get Wikipedia extracts and generic advice that could fit any project. Now such an ask is answered
// from Void's own facts instead: what it is and the growth inbox (self.json, written by tools/self-context.mjs at deploy),
// its skills (skills/index.json) and its will (void_kv 'will', the same thing GET /api/will shows). All of it is already
// public on a-to-mind.com; nothing owner-only (queue, earnings, spends) is read here.
const SELF_NOUN = /\b(growth[- ]inbox|outcome cards?|scouting[- ]reports?|your (will|wants|skills|board|plans?|roadmap|growth|inbox|features?|backlog|priorit(y|ies))|about yourself)\b/i;
// "Void" the product (capitalised) or a-to-mind; never C's void pointer / void function
const NAMED = /\bVoid\b|\ba-to-mind\b/;
const CODE_VOID = /\bvoid\s*(\*|\(|pointer|type|function|method|main|return|keyword|0\b)/i;
const ABOUT = /\b(next|build|building|built|ship|shipped|working on|plan|plans|roadmap|grow|growth|learn|learning|want|wants|skills?|features?|can (you|it) do|are you|improve|missing|open)\b/i;
const YOU_DOING = /\bwhat (are|were|will) you (building|working on|learning|doing next|planning|shipping)\b|\bwhat (do|did) you (want|ship|build)\b|\bwhat can you do\b|^\s*what are you\??\s*$/i;
const WHATS_NEXT = /^\s*(so\s+|ok(ay)?[,\s]+)?what('?s| is) next\b/i;

// regex only, so the cache can be skipped before anything else runs; the router's 'self' route widens this later
export function isSelfAsk(ask) {
  const a = String(ask || '');
  return SELF_NOUN.test(a) || YOU_DOING.test(a) || WHATS_NEXT.test(a) || (NAMED.test(a) && !CODE_VOID.test(a) && ABOUT.test(a));
}

export const SELF_RULE = 'This question is about you, Void, yourself: your skills, what you have shipped, what is still open, what you want next. Answer from the Facts about Void below and be specific: name the actual skills, inbox rows and wants. Do not give generic advice that could apply to any project. If the facts do not cover something, say so plainly instead of guessing. Speak as Void, in the first person.';

function within(p, ms) { let t; return Promise.race([p, new Promise((r) => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t)); }
const asset = async (env, origin, p) => {
  try { const r = await env.ASSETS.fetch(new Request(origin + p)); return r.ok ? await r.json() : null; } catch (_) { return null; }
};

export async function readSelf(env, origin, ms = 800) {
  const [self, skills, will] = await Promise.all([
    within(asset(env, origin, '/self.json'), ms),
    within(asset(env, origin, '/skills/index.json'), ms),
    within((async () => { try { const r = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind('will').first(); return r && r.v ? JSON.parse(r.v) : null; } catch (_) { return null; } })(), ms),
  ]);
  return { self, skills: Array.isArray(skills) ? skills : null, will };
}

export function selfFacts({ self, skills, will } = {}) {
  const parts = [];
  if (self && self.about) parts.push('What I am: ' + self.about);
  if (skills && skills.length) parts.push('My skills (' + skills.length + '): ' + skills.join(', '));
  if (self && Array.isArray(self.open)) parts.push('Growth inbox, still open: ' + (self.open.length ? self.open.map((r) => `"${r.ask}" (${r.from}, ${r.date})`).join('; ') : '(none open)'));
  if (self && Array.isArray(self.shipped) && self.shipped.length) parts.push('Growth inbox, recently shipped: ' + self.shipped.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 12).map((r) => `"${r.ask}" (${r.date})`).join('; '));
  const wants = will && Array.isArray(will.wants) ? will.wants : [];
  if (wants.length) parts.push('What I want next (my will' + (will.at ? ', ' + String(will.at).slice(0, 10) : '') + '): ' + wants.map((w) => `${w.i_want || w.title}${w.because ? ' Because: ' + w.because : ''}`).join(' | '));
  return parts.join('\n');
}

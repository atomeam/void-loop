// about-skill - the pure half of "tell me about <a skill of Verse's>" (asked by Verse: "Learn how to handle 'tell me about zorbleflux'
// (asked 156 times)"; the zorbleflux ask itself is answered by skills/zorbleflux.js, this is the gap behind it: "tell me about the
// chess skill" went to Wikipedia and was noted as a miss). An ask of the shape "tell me about X", "what is X", "what's X",
// "explain X", "how does X work", "how do i use X" is about a skill when X resolves to a page of Verse's own book (skills/guide.json,
// pageFor in skills/guide.js: by name, title or one of its examples). Wikipedia topics keep their route: a bare one-word X
// ("what is time", "tell me about music") stays a world question even when a skill shares the word; X resolves bare only when it is
// a coined name (two words or a hyphen: "what is family health") and exactly a name, title or example; naming it ("the chess
// skill", "your weather skill", "v01d's forge") resolves any page of the book, partial titles too. No DOM, no fetch:
// tools/about-skill.test.mjs.
//
//   parseAsk(text)                     -> { topic, named } or null
//   resolveSkill(text, book)           -> the book's page or null
//   aboutOf(page, families, overlaps, { book, about })  -> { name, title, line, examples, family, tier, why, related, tryAsk }
import { pageFor } from '../skills/guide.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
const LEAD = /^(?:please\s+)?/;
const PHRASES = [
  /^tell me (?:all )?about (.+)$/,
  /^what(?: is|'s|s| are) (.+)$/,
  /^explain (.+)$/,
  /^describe (.+)$/,
  /^how does (.+?) work$/,
  /^how do (?:i|you|we) use (.+)$/,
  /^how to use (.+)$/,
];
const OWN = /^(?:(?:the|a|an)\s+)?(?:(?:your|(?:verse|v01d)'?s?|(?:verse|void)'?s?|its)\s+)/; // "your chess", "v01d's forge": named as Verse's own
const MARK = /\s+(?:skill|ability|feature)$/; // "the chess skill": the one Verse has, not the thing in the world
const TAG = /\s+(?:card|game|tool|thing|page)$/; // "the weather card", "the chess game": Verse's if it has exactly that, else the world's ("a sim card")

/** the X of an about-ask and how it was pointed at Verse: { topic, named, tagged } or null when the ask has another shape.
 *  named: "your X", "v01d's X", "the X skill"; tagged: "the X card", "the X game". Pure. */
export function parseAsk(text) {
  const t = CLEAN(text).replace(LEAD, '');
  if (!t) return null;
  let raw = '';
  for (const re of PHRASES) { const m = re.exec(t); if (m) { raw = m[1].trim(); break; } }
  if (!raw) return null;
  let named = OWN.test(raw), tagged = false;
  raw = raw.replace(OWN, '').replace(/^(?:the|a|an)\s+/, '').trim();
  if (MARK.test(raw)) { named = true; raw = raw.replace(MARK, ''); } else if (TAG.test(raw)) { tagged = true; raw = raw.replace(TAG, ''); }
  raw = raw.replace(/^(?:the|a|an)\s+/, '').trim();
  if (!raw || /^(?:you|yourself|v01d|void|verse|it|this|that|me|myself)$/.test(raw)) return null;
  return { topic: raw, named, tagged };
}

const coined = (topic) => /[- ]/.test(topic);
const exactly = (page, topic) => page.name === topic || page.name === topic.replace(/ /g, '-') || String(page.title || '').toLowerCase() === topic
  || (page.examples || []).some((e) => String(e).toLowerCase() === topic);

/** the book's page the ask is about, or null: a skill (or a game box) by name, title or example. Named ("the chess skill", "your
 *  weather") takes any page the book finds, partial titles too; tagged ("the chess game") and bare asks take an exact name, title or
 *  example only, and a bare one must be a coined name (two words or a hyphen), so "what is time" stays a world question. Pure. */
export function resolveSkill(text, book) {
  const q = parseAsk(text);
  if (!q || !book || !Array.isArray(book.pages)) return null;
  const isOne = (p) => p && (p.kind === 'skill' || p.kind === 'game');
  const n = pageFor(book, q.topic);
  let page = n ? book.pages.find((p) => p && p.n === n) : null;
  if (!isOne(page)) page = book.pages.find((p) => isOne(p) && exactly(p, q.topic)) || null; // a skill a chapter shadows ("make", "sky"): pageFor opens the chapter
  if (!page) return null;
  if (q.named) return page;
  if (!exactly(page, q.topic)) return null;
  return q.tagged || coined(q.topic) ? page : null;
}

const famOf = (families, name) => {
  for (const f of (families && Array.isArray(families.families) ? families.families : [])) {
    const s = (f.skills || []).find((x) => x && x.name === name);
    if (s) return { family: { id: f.id, name: f.name, for: f.for || '' }, skill: s, members: (f.skills || []).map((x) => x.name) };
  }
  return { family: null, skill: null, members: [] };
};
const titleOf = (book, name) => { const p = book && Array.isArray(book.pages) ? book.pages.find((x) => x && (x.kind === 'skill' || x.kind === 'game') && x.name === name) : null; return p ? p.title : String(name).replace(/-/g, ' '); };

/** the card's facts for a page: its title, one line (the module's own `about` text first, else the page's), 3 to 6 example asks, its
 *  family and tier, and related skills (overlap pairs from tools/skill-overlap.json first, then the same family), each a chip. Pure. */
export function aboutOf(page, families, overlaps, { book = null, about = '' } = {}) {
  const name = page.name, { family, skill, members } = famOf(families, name);
  const examples = (page.examples || []).map(String).filter(Boolean).slice(0, 6);
  const rel = [];
  const pairs = overlaps && Array.isArray(overlaps.pairs) ? overlaps.pairs : Array.isArray(overlaps) ? overlaps : [];
  for (const pr of pairs) { const [a, b] = String(pr).split('~'); if (a === name && b) rel.push({ name: b, via: 'overlap' }); else if (b === name && a) rel.push({ name: a, via: 'overlap' }); }
  for (const m of members) if (m !== name && !rel.some((r) => r.name === m)) rel.push({ name: m, via: 'family' });
  const related = rel.slice(0, 6).map((r) => ({ ...r, title: titleOf(book, r.name), ask: 'tell me about the ' + r.name + ' skill' }));
  return {
    name, title: page.title || name, line: String(about || page.line || '').trim(), examples,
    family: family, tier: skill ? skill.tier : page.tier || 'experiment', why: skill ? String(skill.why || '') : String(page.why || ''),
    related, tryAsk: examples[0] || (page.game && page.game.ask) || name,
  };
}

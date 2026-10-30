// The book: everything Verse can do, as a strategy guide you flip through (the owner, 2026-10-16: "a book you could flip
// through that contains everything so you don't have to search ... like a BradyGames or Prima strategy guide").
// Pure functions only, shared by the generator (tools/guide.mjs writes skills/guide.json) and the reader (skills/guide.js draws
// it). Nothing here is a hand-written list: the chapters are skills/families.json's families in its order, the pages are every
// skill in skills/index.json (a family skill opened into its members), the games are skills/rack.js GAMES, the miniatures are
// the files in skills/mini/, and each page's one line is the first sentence of its skill's own header comment.
// tools/guide.test.mjs checks each piece; tools/checks.mjs fails when guide.json is stale, so a new skill can never be missing.

import { rulesOf, rulePages, RULES_ID, RULES_NAME, RULES_FOR } from './rule-registry.js';

export const TIERS = ['experiment', 'tested', 'checked', 'proven'];
/** what each rating word means, in plain words (tools/families.mjs: ratings are earned from evidence, never claimed) */
export const TIER_MEANING = {
  proven: 'its own test, the browser suite and real asks all check it',
  checked: 'two kinds of evidence check it',
  tested: 'one kind of evidence checks it',
  experiment: 'nothing checks it yet',
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the header comment of a skill file, as its lines with the comment marks removed. Pure. */
export function headerLines(src) {
  const m = /^\s*\/\*\*?([\s\S]*?)\*\//.exec(String(src || ''));
  if (!m) return [];
  return m[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean);
}
/** the header comment as one paragraph. Pure. */
export function headerOf(src) { return headerLines(src).join(' '); }

// a builder's note in parentheses: a file, a PR, a date, a frontier or plan number, who asked
const NOTE = /\s*\((?:[^()]*(?:\/|\.js|\.mjs|\.md|#\d|20\d\d-\d\d|owner|Adam|asked by|PR |plan item|frontier|row \d|step \d|Next #|no key|pure)[^()]*)\)/gi;
const tidy = (t) => String(t).replace(/\s*Contract:\s*\{[^}]*\}\.?/g, ' ').replace(/\s*api:\s*\{[^}]*\}\.?/g, ' ').replace(NOTE, '').replace(/\s+/g, ' ').trim();
/** the first sentence of a tidied paragraph: a full stop before a capital, or any full stop past 40 letters. Pure. */
function firstSentence(t) {
  const re = /[.!?](?=\s+(?:[A-Z"“'(]|$))|[.!?](?=\s)/g; let m;
  while ((m = re.exec(t))) { if (m.index < 40 && !/(?=\s+(?:[A-Z"“'(]|$))/.test(t.slice(m.index + 1))) continue; if (/\b(?:e\.g|i\.e|vs|etc)$/.test(t.slice(0, m.index))) continue; return t.slice(0, m.index + 1); }
  return t;
}

/** the one line a page says about a skill: the first sentence of its header after the skill's name. Pure.
 *  "weather skill — Open-Meteo, no key" -> "Open-Meteo, no key"; "sky — "sky", ...: the stage becomes ..." keeps the whole sentence.
 *  A line that is only a frontier number or a quoted ask carries the next sentence with it, so the page still says what the skill does. */
export function oneLine(src, name) {
  const lines = headerLines(src);
  if (!lines.length) return '';
  // the lines up to the first that ends a sentence, or that the next line does not continue (it starts with a capital or a quote)
  const sentences = []; let cur = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], next = lines[i + 1] || '';
    cur = (cur ? cur + ' ' : '') + l;
    if (/[.!?]["”)]?$/.test(l) || !next || (!/[,;:(—–-]$/.test(l) && /^(?:[A-Z"“]|Contract:|api:)/.test(next))) { sentences.push(cur); cur = ''; if (sentences.length >= 3) break; }
  }
  if (cur) sentences.push(cur);
  let h = tidy(sentences[0] || '');
  if (!h) return '';
  // what the file is for, after its own name ("tide skill — ...", "tide - ...", "tide: ...", "tide skill: ...")
  const n = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = new RegExp('^(?:the\\s+)?' + n + '(?:\\s+(?:skill|miniature))?(?:\\s*[—–-]+\\s*|\\s*:\\s*|\\s+)', 'i');
  if (lead.test(h)) h = h.replace(lead, ''); else h = h.replace(/^(?:the\s+)?[a-z0-9-]+\s+(?:skill|miniature)\s*(?:[—–-]+|:)\s*/i, '');
  h = h.replace(/^(?:Miniature\s*[—–-]+\s*|(?:Card|Page)'s miniature:\s*)/i, ''); // a miniature's header starts with what it is
  h = h.replace(/^made with tools\/new-skill\.mjs[^.]*\.\s*/, ''); // the scaffold's own line says nothing yet
  h = h.replace(/^(?:Board Next|Next|Frontier|frontier|plan item|assimilate row)\s*#?\d+(?:'s)?(?:\s*\([^)]*\))?(?:,?\s+(?:first|second|third|sky)?\s*(?:piece|PR [A-Z]))?\s*[:,.]?\s*/, ''); // a build-order number
  h = h.replace(/^(?:Learning|Explainer)\.[a-z0-9-]+,?\s*(?:frontier #\d+)?:?\s*/, '');
  let line = firstSentence(h);
  // a line that is only a quoted ask, a number or a few words says nothing yet: take the next sentence with it
  const after = tidy(h.slice(line.length)), rest = firstSentence(after || tidy(sentences[1] || ''));
  line = line.replace(/^[\s:,.;]+/, '');
  if ((line.split(/\s+/).length < 5 || /^"[^"]*"\.?$/.test(line.trim())) && rest && !/^(?:Contract|api):/.test(rest)) line = line ? line.replace(/[.;:,]+$/, '') + ': ' + rest.charAt(0).toLowerCase() + rest.slice(1) : rest;
  line = line.replace(/:\s*frontier #\d+'s (?:first|second|third) piece\.?$/, '');
  if (line.length > 170) { const semi = line.indexOf(';', 60); if (semi > 0 && semi < 170) line = line.slice(0, semi); }
  // the whole line, never cut (owner, 2026-10-21)
  if ((line.match(/\(/g) || []).length > (line.match(/\)/g) || []).length) line = line.slice(0, line.lastIndexOf('(')); // a note cut in half
  line = line.trim().replace(/\s+[-–—]\s*$/, '').replace(/[.;:,]+$/, '');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** the asks a header quotes ("make a clock"), for a skill whose examples list is empty. Pure. */
export function asksInHeader(src) {
  return Array.from(headerOf(src).matchAll(/"([^"\n]{3,60})"/g)).map((m) => m[1]).filter((a) => /^[a-z0-9]/.test(a) && !/https?:|…|\.\.\.|\.js/.test(a));
}

/** a skill file's examples or nearMisses, read from its text the way functions/tools.json.js does on the server. Pure. */
export function listOf(src, field = 'examples') {
  const m = new RegExp(field + '\\s*:\\s*\\[([^\\]]*)\\]').exec(String(src || ''));
  if (!m) return [];
  return Array.from(m[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)).map((x) => (x[1] ?? x[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
}

/** the members of a family skill (lib/skill-family.js names them on a `parts:` line), or null for a plain skill. Pure. */
export function partsOf(src) {
  const m = /^\s*\*\s*parts:\s*\[([^\]]*)\]/m.exec(String(src || ''));
  return m ? Array.from(m[1].matchAll(/'([a-z0-9-]+)'/g)).map((x) => x[1]) : null;
}

/** the boxed games on the rack, read from skills/rack.js's GAMES text: [{ id, title, ask, color, ink, motif }]. Pure. */
export function gamesOf(rackSrc) {
  const m = /export const GAMES = \[([\s\S]*?)\n\];/.exec(String(rackSrc || ''));
  if (!m) return [];
  const out = [];
  for (const row of m[1].matchAll(/\{([^}]*)\}/g)) {
    const g = {};
    for (const kv of row[1].matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) g[kv[1]] = kv[2].replace(/\\'/g, "'");
    if (g.id) out.push(g);
  }
  return out;
}

/** the "card miniatures that ship today" table of docs/miniatures.md: kind -> { card, what }. Pure. */
export function miniDocOf(md) {
  const out = {};
  for (const line of String(md || '').split('\n')) {
    const m = /^\|\s*((?:`[a-z0-9-]+`(?:,\s*)?)+)\s*\|\s*([^|]*)\|\s*([^|]*)\|/.exec(line);
    if (!m) continue;
    for (const k of m[1].matchAll(/`([a-z0-9-]+)`/g)) out[k[1]] = { card: m[2].trim(), what: m[3].trim() };
  }
  return out;
}

/** which skill mounts a miniature kind (stageApi.miniature(el, 'kind', …)): kind -> skill name, first in index order. Pure. */
export function miniOwners(names, read) {
  const out = {};
  for (const n of names) {
    const src = read(n);
    for (const m of String(src || '').matchAll(/miniature\(\s*[^,()]+,\s*'([a-z0-9-]+)'/g)) if (!out[m[1]]) out[m[1]] = n;
  }
  return out;
}

const NAMED = { 'mind-field-mode': 'Mind Field', 'tilt-arena-mode': 'Tilt Arena', 'doodle-mind': 'Doodle Mind', 'echo-field': 'Echo Field', 'resonant-membrane': 'Resonant Membrane', 'gaze-chase': 'Gaze Chase', 'gpu-swarm': 'GPU Swarm', 'hand-arena': 'Hand Arena' }; // a family's front page carries the family's own name (owner, 2026-10-21: "make them all easier to find")
const title = (s) => NAMED[s] || String(s || '').replace(/-/g, ' ').replace(/\bv01d\b/gi, 'verse').replace(/^./, (c) => c.toUpperCase()); // a file named v01d-fixes is the Verse fixes card to a reader (owner, 2026-10-18)

// Flavor text (asked by Verse, 2026-10-16: "Generate unique, short 'flavor text' strings for every proven skill in the Book of Verse
// to enhance the Skyrim-like immersion"): one line of lore under a proven skill's title, the way a Skyrim book opens with an
// epigraph. Never invented facts: each line is cut from the skill's own evidence (how many real asks proved it, what checks
// it) and its family, chosen by the skill's name so the same skill always carries the same line and no two neighbours match.
const LORE = [
  (f, n) => (n ? 'Proven ' + n + ' times over by those who asked, and kept among the ' + f + '.' : 'Proven by those who asked, and kept among the ' + f + '.'),
  (f, n) => 'Of the ' + f + '; set down here after it answered true' + (n ? ' ' + n + ' times' : '') + '.',
  (f, n) => (n ? 'Asked ' + n + ' times in earnest, and never once left unanswered.' : 'Asked in earnest, and never once left unanswered.'),
  (f) => 'An old art of the ' + f + ', tested each day before the sun is up.',
  (f, n) => 'Written by the hands that use it; ' + (n ? n + ' real askings stand behind this page.' : 'real askings stand behind this page.'),
  (f) => 'Of all the ' + f + ', this one is trusted enough to be taught.',
  (f, n) => (n ? n + ' who came with a need went away with an answer. The page is theirs.' : 'Those who came with a need went away with an answer. The page is theirs.'),
  (f) => 'Checked by its own test, by the suite, and by strangers: the three witnesses of the ' + f + '.',
  (f, n) => 'Not a boast but a record' + (n ? ': ' + n + ' askings, each one answered.' : ': every asking answered.'),
  (f) => 'Keep this page; the ' + f + ' are built on it.',
  (f, n) => 'Earned, not claimed' + (n ? ', over ' + n + ' real askings.' : ', over many real askings.'),
  (f) => 'Among the ' + f + ' it is the one a traveller is told to ask for first.',
];
const TAILS = ['', ' So it is written.', ' Ask, and see.', ' Turn the page when you are done.', ' Let the stage be the proof.', ' It has not failed a reader yet.', ' The void remembers each asking.', ' Say the words below and it answers.'];
/** the epigraph for a proven skill's page: short, unique to its name, cut from its evidence; `taken` (a Set of lines already in the
 *  book) keeps every line in the book different. '' for anything not proven. Pure. */
export function flavorOf(name, familyName, why, tier, taken = new Set()) {
  if (tier !== 'proven') return '';
  const n = (/(\d+) real asks?/.exec(String(why || '')) || [])[1] || '';
  const f = String(familyName || 'arts').toLowerCase().replace(/^the /, '') || 'arts';
  const s = seedOf(name);
  for (let i = 0; i < LORE.length * TAILS.length; i++) {
    const line = LORE[(s + i) % LORE.length](f, n ? Number(n) : 0) + TAILS[((s >>> 8) + Math.floor(i / LORE.length)) % TAILS.length];
    if (!taken.has(line)) { taken.add(line); return line; }
  }
  // every lore line and tail is in the book already (many proven skills with no asks counted share the same few): the skill's own name keeps it unique
  const line = LORE[s % LORE.length](f, n ? Number(n) : 0) + ' This is the page of ' + name + '.';
  taken.add(line);
  return line;
}

/**
 * The whole book from the site's own data. Pure.
 *   names     skills/index.json, in order
 *   read      (name) -> the text of skills/<name>.js ('' when there is none)
 *   families  skills/families.json
 *   games     gamesOf(skills/rack.js)
 *   minis     the kinds in skills/mini/ (file names without .js)
 *   readMini  (kind) -> the text of skills/mini/<kind>.js ('' when there is none): its header's first sentence is the page's line
 *   miniDoc   miniDocOf(docs/miniatures.md): the line when the file's header has none
 *   core      the page's own built-in asks ([{ name, description, examples }], functions/tools.json.js CORE)
 * Returns { chapters, pages, index, totals, unplaced }: every member skill on exactly one page, in the family that holds it.
 */
/** a skill page glows when families.json says more than 9 in 10 of the benchmark asks routed to it passed (asked by Verse: a 'proven' glow on the book page, success_rate > 0.9). Pure. */
export const GLOW_ABOVE = 0.9;
export const glows = (rate) => typeof rate === 'number' && rate > GLOW_ABOVE && rate <= 1;
export function compose({ names = [], read = () => '', families = { families: [] }, games = [], minis = [], readMini = () => '', miniDoc = {}, core = [] }) {
  // a family skill (time, dates, games) opens into its members; each member is a page
  const members = names.flatMap((n) => partsOf(read(n)) || [n]);
  const rated = {}; for (const f of families.families || []) for (const s of f.skills || []) rated[s.name] = { ...s, family: f.id };
  const pages = [], chapters = [], lore = new Set();
  const page = (p) => { p.n = pages.length + 1; pages.push(p); return p; };
  const chapter = (c) => { c.from = pages.length + 1; chapters.push(c); return c; };
  const skillPage = (name, chap) => {
    const src = read(name), r = rated[name] || {}, fam = (families.families || []).find((f) => f.id === chap) || {};
    const flavor = flavorOf(name, fam.name, r.why, r.tier, lore);
    return page({ kind: 'skill', chapter: chap, name, title: title(name === 'place' ? 'map' : name), line: oneLine(src, name) || 'A skill of Verse.',
      examples: (listOf(src, 'examples').length ? listOf(src, 'examples') : asksInHeader(src)).slice(0, 3), tier: r.tier || 'experiment', why: r.why || 'nothing checks it yet', ...(flavor ? { flavor } : {}), ...(glows(r.success_rate) ? { glow: Math.round(r.success_rate * 1000) / 10 } : {}) });
  };
  // front matter
  const front = chapter({ id: 'front', name: 'Start here', kind: 'front' });
  page({ kind: 'cover', chapter: 'front', title: 'The Book of Verse', line: 'Everything Verse can do, one page each, nothing left out.' });
  // the first asks over two pages (owner, 2026-10-21: the book cut the bottom of this page): the welcome and the first half, then the rest and the store
  const coreAll = core.map((t) => ({ name: t.name, line: t.description, examples: (t.examples || []).slice(0, 3) })), half = Math.ceil(coreAll.length / 2);
  if (coreAll.length > 3) { page({ kind: 'how', chapter: 'front', title: 'How to ask', part: 1, core: coreAll.slice(0, half) }); page({ kind: 'how', chapter: 'front', title: 'More to ask', part: 2, core: coreAll.slice(half) }); }
  else page({ kind: 'how', chapter: 'front', title: 'How to ask', core: coreAll });
  page({ kind: 'legend', chapter: 'front', title: 'How to read a page' });
  page({ kind: 'toc', chapter: 'front', title: 'Contents' });
  front.to = pages.length;
  // one chapter per family, in families.json's order; the games family is the games chapter, with the rack's boxes on it
  const placed = new Set();
  for (const f of families.families || []) {
    const isGames = f.id === 'games';
    const chap = chapter({ id: f.id, name: f.name, for: f.for, kind: isGames ? 'games' : 'family', count: f.count || {} });
    page({ kind: 'opener', chapter: f.id, title: f.name, line: f.for, skills: (f.skills || []).map((s) => s.name) });
    for (const s of f.skills || []) {
      if (!members.includes(s.name) || placed.has(s.name)) continue;
      const p = skillPage(s.name, f.id); placed.add(s.name);
      // a boxed game wears its box's name (the rack's Verse-brand titles: Star Marbles, Back to Start) and opens with its box's ask
      if (isGames) { const g = games.find((x) => x.id === s.name); if (g) { p.game = { title: g.title, ask: g.ask, color: g.color, ink: g.ink, motif: g.motif }; p.title = g.title; if (!p.examples.includes(g.ask)) p.examples = [g.ask, ...p.examples].slice(0, 3); } }
    }
    if (isGames) for (const g of games) if (!placed.has(g.id) && !pages.some((p) => p.game && p.game.title === g.title)) { // a boxed game that is not its own skill (VoidQuest lives in the Landlord's Game) still gets a page
      page({ kind: 'game', chapter: f.id, name: g.id, title: g.title, line: 'A boxed game on the rack: say “' + g.ask + '” and the board stands in the void.', examples: [g.ask, 'games'], game: { title: g.title, ask: g.ask, color: g.color, ink: g.ink, motif: g.motif } });
    }
    chap.to = pages.length;
  }
  // the 3D miniatures, one page each, in file order
  const mchap = chapter({ id: 'minis', name: '3D miniatures', for: 'the small 3D things cards carry: a clock whose hands keep time, a board you play on', kind: 'minis' });
  page({ kind: 'opener', chapter: 'minis', title: '3D miniatures', line: mchap.for, skills: minis.slice() });
  const owners = miniOwners(members, read);
  for (const k of minis) {
    const d = miniDoc[k] || {}, owner = members.includes(k) ? k : owners[k] || ''; // the skill of the same name, else the first that mounts this kind
    const ownerPage = owner ? pages.find((p) => p.kind === 'skill' && p.name === owner) : null;
    const ex = ownerPage ? ownerPage.examples.slice(0, 2) : (d.card ? Array.from(d.card.matchAll(/"([^"]+)"/g)).map((x) => x[1]).slice(0, 2) : []);
    const own = oneLine(readMini(k), k), doc = d.what && !/^see above/i.test(d.what) ? d.what.replace(/\s*;.*$/, '') : '';
    page({ kind: 'mini', chapter: 'minis', name: k, title: title(k), line: own || doc || (owner ? 'The 3D version of the ' + title(owner === 'place' ? 'map' : owner).toLowerCase() + ' card.' : 'A 3D thing a card carries.'),
      card: owner ? title(owner === 'place' ? 'map' : owner) : (d.card ? d.card.replace(/\s*\(.*$/, '') : ''), examples: ex, owner: owner || undefined, ownerPage: ownerPage ? ownerPage.n : undefined });
  }
  mchap.to = pages.length;
  // the rule registry (asked by Verse): every active router rule, each skill in routing order (index.json), as an illuminated entry
  const rchap = chapter({ id: RULES_ID, name: RULES_NAME, for: RULES_FOR, kind: 'rules' });
  const rules = rulesOf(names, (n) => { const src = read(n); return listOf(src, 'examples').length ? listOf(src, 'examples') : asksInHeader(src); });
  page({ kind: 'opener', chapter: RULES_ID, title: RULES_NAME, line: RULES_FOR, skills: names.slice() });
  for (const rp of rulePages(rules)) page(rp);
  rchap.to = pages.length;
  // the index at the back: every skill page and game page, A to Z, 36 to a page
  // a boxed game is listed under its box name and under its skill's own name (Back to Start, and Sorry), so either finds it
  const entries = pages.filter((p) => p.kind === 'skill' || p.kind === 'game' || p.kind === 'mini').flatMap((p) => [{ name: p.kind === 'mini' ? p.title + ' (3D)' : p.title, page: p.n }, ...(p.kind === 'skill' && p.game && p.title !== title(p.name) ? [{ name: title(p.name), page: p.n }] : [])]).sort((a, b) => a.name.localeCompare(b.name));
  const ichap = chapter({ id: 'index', name: 'Index', kind: 'index' });
  for (let i = 0; i < entries.length; i += 36) page({ kind: 'index', chapter: 'index', title: 'Index ' + entries[i].name.charAt(0).toUpperCase() + '–' + entries[Math.min(i + 35, entries.length - 1)].name.charAt(0).toUpperCase(), entries: entries.slice(i, i + 36) });
  ichap.to = pages.length;
  const totals = { pages: pages.length, chapters: chapters.length, skills: pages.filter((p) => p.kind === 'skill').length, games: pages.filter((p) => p.game).length, minis: minis.length };
  return { chapters, pages, index: entries, totals, unplaced: members.filter((n) => !placed.has(n)) };
}

/** the spread a page sits on: the cover alone on the right, then pairs (2,3), (4,5), … Pure. */
export function spreadOf(n) { return Math.floor(n / 2); }
/** the pages of a spread: [left, right] page numbers (0 = none). Pure. */
export function pagesOfSpread(k, total) { const l = k * 2, r = k * 2 + 1; return [l >= 1 && l <= total ? l : 0, r >= 1 && r <= total ? r : 0]; }

// ---- visuals: every page gets a glyph drawn from its chapter's motif and its own name, inline SVG, no image files ----

/** a small stable number from a name (FNV-1a), so a skill's glyph is the same on every visit. Pure. */
export function seedOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

const HUES = { front: 230, make: 28, games: 345, sky: 205, time: 48, numbers: 150, body: 2, words: 265, life: 95, stage: 190, self: 250, minis: 320, index: 230 };
/** the hue a chapter is drawn in; a family not named here gets one from its id. Pure. */
export function hueOf(chapter) { return chapter in HUES ? HUES[chapter] : seedOf(chapter) % 360; }

const motifs = {
  front: () => '<path d="M12 10h30a4 4 0 0 1 4 4v40H16a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M46 14h30a4 4 0 0 1 4 4v36H46" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M20 22h18M20 30h18M52 22h18M52 30h18M52 38h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
  make: (r) => '<path d="M44 12l26 15v30L44 72 18 57V27z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M18 27l26 15 26-15M44 42v30" fill="none" stroke="currentColor" stroke-width="2.4"/>' + dots(r, 3, 30, 22, 28, 20),
  games: (r) => { let s = ''; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) s += '<rect x="' + (18 + x * 13) + '" y="' + (16 + y * 13) + '" width="13" height="13" fill="currentColor" opacity=".55"/>'; return s + '<rect x="18" y="16" width="52" height="52" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="' + (24.5 + (r % 4) * 13) + '" cy="' + (22.5 + ((r >> 2) % 4) * 13) + '" r="5" fill="currentColor"/>'; },
  sky: (r) => '<circle cx="36" cy="30" r="11" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M36 12v5M36 43v5M18 30h5M49 30h5M23 17l4 4M45 39l4 4M23 43l4-4M45 21l4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M30 64h32a8 8 0 0 0 0-16 11 11 0 0 0-21-3 8 8 0 0 0-11 7 6 6 0 0 0 0 12z" fill="none" stroke="currentColor" stroke-width="2.4"/>' + dots(r, 4, 56, 10, 26, 14),
  time: (r) => '<circle cx="44" cy="42" r="26" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M44 22v20l' + (8 + (r % 7)) + ' ' + (6 + ((r >> 3) % 6)) + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="44" cy="42" r="2.4" fill="currentColor"/>' + '<path d="M44 18v3M68 42h-3M44 66v-3M20 42h3" stroke="currentColor" stroke-width="2.2"/>',
  numbers: (r) => '<rect x="20" y="14" width="48" height="58" rx="6" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="27" y="21" width="34" height="12" rx="2" fill="currentColor" opacity=".5"/>' + [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => '<circle cx="' + (31 + x * 13) + '" cy="' + (44 + y * 10) + '" r="2.8" fill="currentColor" opacity="' + (((r >> (x + y * 3)) & 1) ? '.95' : '.45') + '"/>')).join(''),
  body: () => '<path d="M44 68S16 50 16 32a14 14 0 0 1 28-6 14 14 0 0 1 28 6c0 18-28 36-28 36z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M22 40h10l4-8 6 16 5-10 4 4h15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  words: (r) => '<path d="M16 18h56v34H40l-14 12V52H16z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' + [0, 1, 2].map((i) => '<path d="M26 ' + (28 + i * 8) + 'h' + (18 + ((r >> (i * 3)) % 18)) + '" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>').join(''),
  life: (r) => '<path d="M44 70S24 48 24 34a20 20 0 0 1 40 0c0 14-20 36-20 36z" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="44" cy="34" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/>' + dots(r, 3, 10, 56, 68, 14),
  stage: (r) => '<rect x="14" y="20" width="60" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="' + (20 + (r % 10)) + '" y="28" width="22" height="14" rx="3" fill="currentColor" opacity=".55"/><rect x="' + (48 - ((r >> 4) % 8)) + '" y="46" width="18" height="10" rx="3" fill="currentColor" opacity=".35"/>',
  self: (r) => '<path d="M44 12l28 16v28L44 72 16 56V28z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M44 12l-6 30 6 30M44 12l9 20-9 40M16 28l22 14M72 28L53 32" stroke="currentColor" stroke-width="1.6" opacity=".7"/>' + dots(r, 2, 8, 8, 72, 12),
  minis: (r) => '<path d="M44 14l24 14v28L44 70 20 56V28z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 28l24 14 24-14M44 42v28" fill="none" stroke="currentColor" stroke-width="2.4"/><ellipse cx="44" cy="74" rx="' + (18 + (r % 8)) + '" ry="4" fill="currentColor" opacity=".3"/>',
  index: () => '<path d="M18 14h52v60H18z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M26 26h24M26 36h30M26 46h20M26 56h28" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>',
};
function dots(r, n, x0, y0, w, h) { let s = ''; for (let i = 0; i < n; i++) s += '<circle cx="' + (x0 + ((r >> (i * 5)) % w)) + '" cy="' + (y0 + ((r >> (i * 5 + 2)) % h)) + '" r="1.8" fill="currentColor" opacity=".8"/>'; return s; }

// the games' own motifs, after the rack's box covers (skills/mini/rack.js motif): what is inside the box, in lines
const gameMotifs = {
  chess: () => { let s = ''; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s += '<rect x="' + (18 + x * 13) + '" y="' + (16 + y * 13) + '" width="13" height="13" fill="' + ((x + y) % 2 ? '#5a3418' : '#f1dcb4') + '"/>'; return s + '<text x="37" y="36" font-size="18" text-anchor="middle" fill="#111">♞</text><text x="63" y="62" font-size="18" text-anchor="middle" fill="#fff">♛</text>'; },
  checkers: () => { let s = ''; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s += '<rect x="' + (18 + x * 13) + '" y="' + (16 + y * 13) + '" width="13" height="13" fill="' + ((x + y) % 2 ? '#5a3418' : '#f1dcb4') + '"/>'; return s + '<circle cx="37.5" cy="22.5" r="4.8" fill="#8f2d22"/><circle cx="50.5" cy="61.5" r="4.8" fill="#e9d8b5"/><circle cx="63.5" cy="22.5" r="4.8" fill="#8f2d22"/>'; },
  go: () => { let s = '<rect x="16" y="14" width="56" height="56" fill="#e2b56a"/>'; for (let i = 0; i < 5; i++) s += '<path d="M' + (22 + i * 11) + ' 20v44M22 ' + (20 + i * 11) + 'h44" stroke="#2b1a0a" stroke-width="1.2"/>'; for (const [a, b, w] of [[1, 1, 0], [2, 2, 1], [2, 1, 0], [3, 2, 1], [1, 3, 1]]) s += '<circle cx="' + (22 + a * 11) + '" cy="' + (20 + b * 11) + '" r="4.6" fill="' + (w ? '#f4f1ea' : '#16171b') + '"/>'; return s; },
  othello: () => '<rect x="16" y="14" width="56" height="56" fill="#1f7445"/>' + [[1, 1, 0], [2, 1, 1], [1, 2, 1], [2, 2, 0]].map(([c, r, w]) => '<circle cx="' + (16 + 14 * (c + 0.5)) + '" cy="' + (14 + 14 * (r + 0.5)) + '" r="5.5" fill="' + (w ? '#f2efe8' : '#151619') + '"/>').join(''),
  tictactoe: () => '<path d="M34 14v56M54 14v56M16 32h56M16 52h56" stroke="#fff6e6" stroke-width="3" stroke-linecap="round"/><path d="M20 18l10 10M30 18L20 28" stroke="#fff6e6" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="42" r="6" fill="none" stroke="#fff6e6" stroke-width="3"/>',
  mancala: () => '<rect x="12" y="26" width="64" height="32" rx="8" fill="#8a5a2c"/>' + [0, 1, 2, 3].flatMap((i) => [0, 1].map((r) => '<circle cx="' + (24 + i * 14) + '" cy="' + (35 + r * 14) + '" r="4.5" fill="#5b3716"/>')).join(''),
  connect4: () => { let s = '<rect x="12" y="16" width="64" height="52" rx="4" fill="#2b5fd9"/>'; const f = { 38: '#e0303e', 37: '#f2c230', 31: '#e0303e', 39: '#f2c230', 30: '#f2c230', 24: '#e0303e' }; for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) s += '<circle cx="' + (16.5 + c * 9.1) + '" cy="' + (20.5 + r * 8.6) + '" r="3.2" fill="' + (f[r * 7 + c] || '#0d1a33') + '"/>'; return s; },
  fireworks: () => ['#e2453c', '#efc23a', '#3fae5a', '#3d7fe0', '#eceae4'].map((col, k) => { const bx = 44 + (k - 2) * 11, by = 36 + (k % 2) * 12; let s = ''; for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; s += '<path d="M' + (bx + Math.cos(t) * 2).toFixed(1) + ' ' + (by + Math.sin(t) * 2).toFixed(1) + 'L' + (bx + Math.cos(t) * 7).toFixed(1) + ' ' + (by + Math.sin(t) * 7).toFixed(1) + '" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round"/>'; } return s; }).join(''),
  poker: () => '<circle cx="58" cy="58" r="9" fill="#c0262b" stroke="#f4f1ea" stroke-width="2"/><g transform="rotate(-10 36 40)"><rect x="24" y="22" width="24" height="34" rx="3" fill="#fbfaf5"/><text x="36" y="44" font-size="12" text-anchor="middle" fill="#111">A♠</text></g><g transform="rotate(10 52 40)"><rect x="40" y="22" width="24" height="34" rx="3" fill="#fbfaf5"/><text x="52" y="44" font-size="12" text-anchor="middle" fill="#c0262b">K♥</text></g>',
  battleship: () => { let s = '<rect x="16" y="14" width="56" height="56" fill="#2a7fae"/>'; for (let k = 1; k < 6; k++) s += '<path d="M' + (16 + k * 9.33) + ' 14v56M16 ' + (14 + k * 9.33) + 'h56" stroke="rgba(220,240,255,.6)" stroke-width="1"/>'; return s + '<rect x="22" y="38" width="36" height="8" rx="4" fill="#9aa4ab"/><circle cx="58" cy="28" r="3" fill="#d8302b"/><circle cx="30" cy="56" r="3" fill="#f4f4f0"/>'; },
  monopoly: () => '<rect x="16" y="14" width="56" height="56" fill="#eef4ea"/><rect x="27" y="25" width="34" height="34" fill="#cfe2c8"/>' + ['#8a5a3c', '#9fd3ef', '#d9559c', '#f08a2c'].map((c, k) => '<rect x="' + (18 + k * 13.5) + '" y="16" width="11" height="4" fill="' + c + '"/>').join('') + ['#d9353a', '#f2d23a', '#2f9b57', '#1f4fa8'].map((c, k) => '<rect x="' + (18 + k * 13.5) + '" y="64" width="11" height="4" fill="' + c + '"/>').join('') + '<circle cx="50" cy="42" r="4" fill="#7b6cff"/><circle cx="38" cy="42" r="4" fill="#e9e4d8"/>',
  aggravation: () => { let s = '<circle cx="44" cy="42" r="28" fill="#f3ead6"/>'; for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; s += '<circle cx="' + (44 + Math.cos(t) * 22).toFixed(1) + '" cy="' + (42 + Math.sin(t) * 22).toFixed(1) + '" r="2.4" fill="#5a3418"/>'; } return s + '<circle cx="44" cy="42" r="5" fill="#2f5fa8"/><circle cx="30" cy="30" r="5" fill="#c8202c"/><circle cx="58" cy="54" r="5" fill="#2f9b57"/>'; },
  ringer: () => { let s = '<rect x="10" y="10" width="68" height="66" fill="#b08a5a"/><circle cx="44" cy="43" r="27" fill="none" stroke="#f3eedf" stroke-width="2" stroke-dasharray="4 3"/>'; for (const [x, y] of [[44, 43], [36, 43], [52, 43], [44, 35], [44, 51], [28, 43], [60, 43], [44, 27], [44, 59]]) s += '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="#4fa3c9" stroke="#fff" stroke-width=".8"/>'; return s; },
};

/** the glyph for a page: an inline SVG string, drawn from its chapter's motif and its own name. Pure. */
export function glyphSvg(p, size = 88) {
  const name = p.name || p.title || '', r = seedOf(name);
  let inner, hue = hueOf(p.chapter), style = '';
  if (p.game && gameMotifs[p.game.motif]) { inner = gameMotifs[p.game.motif](r); style = 'background:' + esc(p.game.color) + ';border-radius:10px;'; }
  else {
    const m = motifs[p.chapter] || motifs[p.kind === 'skill' ? 'stage' : 'front'];
    inner = (m || motifs.front)(r);
  }
  return '<svg class="gglyph" viewBox="0 0 88 88" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(name) + '" style="color:hsl(' + hue + ' 70% 72%);' + (p.glow ? 'filter:drop-shadow(0 0 7px hsl(' + hue + ' 90% 62%));' : '') + style + '"' + (p.glow ? ' data-glow="' + p.glow + '"' : '') + '>' + inner + '</svg>';
}

/** a chapter opener's visual: a composition of its pages' glyphs, as many as fit. Pure. */
export function openerSvg(opener, book, n = 12) {
  const items = (opener.skills || []).map((name) => book.pages.find((p) => (p.kind === 'skill' || p.kind === 'mini' || p.kind === 'game') && p.name === name)).filter(Boolean).slice(0, n);
  return '<div class="gopener">' + items.map((p) => '<a href="#" class="gjump" data-page="' + p.n + '" title="' + esc(p.title) + '">' + glyphSvg(p, 44) + '</a>').join('') + '</div>';
}

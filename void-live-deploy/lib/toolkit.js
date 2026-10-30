/**
 * toolkit: what ties Verse's tool pages together (owner, 2026-10-24: "a lot of these tools can be linked together and made easily usable everywhere
 * on the site, like being able to customize colors and linking the random names to the wheel ... you make the connections yourself"). Three things:
 *   1. one accent colour for every tool page, picked once on /color/ and kept on this device (accent());
 *   2. which tools belong together and why (RELATED), drawn as a "Use with" row at the foot of each page (mountRelated());
 *   3. hand-offs that carry what is on the page into the next tool (the people's names onto the wheel, a colour into a gradient, a text's speaking
 *      time into a countdown): each page passes its own as { label, href: () => url }, worked out when pressed, so they carry what is there now.
 * Nothing leaves the device. Pure except accent(), setAccent() and mountRelated(). Tests: tools/toolkit.test.mjs.
 */
import { SITE_PAGES, PDF_SITES, KANBAN_SITES, SELF_SITES, PDF_ASK, KANBAN_ASK, pdfToolOf } from './tool-sites.js';
import { flightAskOf } from './flight-sites.js';
import { jobAskOf } from './job-sites.js';
import { converterAskOf } from './converter-ask.js';
import { brainFullAsk } from './brain-ask.js';
export const ACCENT_KEY = 'a2m.void.accent.v1';

export const TOOLS = Object.freeze({
  '/photos/': 'Photo tools',
  '/color/': 'Colour codes', '/gradient/': 'Gradient', '/wheel/': 'Wheel of names', '/random-user/': 'Made-up people', '/random/': 'Random number',
  '/ledger/': 'Repo activity ledger',
  '/flip/': 'Coin flip', '/stopwatch/': 'Stopwatch and timer', '/word-count/': 'Word counter', '/base-converter/': 'Base converter',
  '/password-strength/': 'Password strength', '/resize-image/': 'Resize an image', '/convert/': 'Unit converter', '/calculator/': 'Calculator', '/calculators/': 'Formula calculators', '/time/': 'Time zones', '/base64/': 'Base64', '/stl/': 'STL checker',
  '/password/': 'Password generator', '/weather/': 'Weather', '/translate/': 'Translate', '/recipes/': 'Recipes', '/markets/': 'Markets', '/podcasts/': 'Podcasts', '/scores/': 'Scores', '/sports/': 'Sports', '/fantasy/': 'Fantasy tools', '/calendar/': 'Calendar', '/notes/': 'Notes', '/generators/': 'Generators', '/boards/': 'Boards', '/fanfic/': 'Fan fiction', '/team/': 'Team chat', '/learn-to-draw/': 'Learn to draw', '/brain/': 'Verse Brain', '/converter/': 'File converter', '/rap/': 'Verse raps', '/news/': 'News', '/music/': 'Music tools', '/metronome/': 'Metronome', '/piano/': 'Piano', '/tuner/': 'Tuner', '/bpm/': 'BPM counter', '/chords/': 'Chords and scales', '/image/': 'AI image generator', '/emojis/': 'Emoji counts', '/emoji-combos/': 'Emoji combos', '/g/': 'Snippet / Note in a link', '/tools/': 'Every tool',
  // the PDF and Kanban floors: the leader's page and a page for each site of its lane (lib/tool-sites.js)
  ...Object.fromEntries(SITE_PAGES.map((p) => [p.path, p.name])),
});
// pages /tools/ lists that TOOLS does not (no "Use with" row reaches them yet): the Tools page and its stage card list them both, from here
export const MORE_PAGES = Object.freeze([['/prizes/', 'Prize wheel & payout odds'], ['/is-it/christmas', 'Is it…?'], ['/code-review/', 'Code review'], ['/fix/', 'Fix a broken automation'],
  ['/books/', 'Bookshelf'], ['/films/', 'Films'], ['/obituaries/', 'Obituaries and lineage'], ['/cpan/', 'CPAN Testers studio'], ['/identity/', 'Identity studio'],
  ['/hosting/', 'Hosting sizer: traffic, queue and uptime'], ['/lab/', 'Lab experiments']].map(Object.freeze));
/** every page /tools/ lists, as [href, label]: TOOLS, then MORE_PAGES, without /tools/ itself. Pure. */
export const allTools = () => [...Object.entries(TOOLS), ...MORE_PAGES.filter(([p]) => !Object.hasOwn(TOOLS, p))].filter(([p]) => p !== '/tools/');
// the tools that go with each one, closest first: colours with colours, ways of picking at random with each other, words with timing them
// each PDF page leads to its sisters; each Kanban page to the others; the leaders reach the tools that go with them
const sisters = (list, p) => list.map((x) => x.path).filter((x) => x !== p);
const SITE_RELATED = Object.fromEntries([...PDF_SITES.map((p) => [p.path, p.path === '/pdf/' ? [...sisters(PDF_SITES, p.path).slice(0, 2), '/resize-image/', '/word-count/'] : ['/pdf/', ...sisters(PDF_SITES, p.path).filter((x) => x !== '/pdf/').slice(0, 2), '/resize-image/']]),
  ...KANBAN_SITES.map((p) => [p.path, p.path === '/kanban/' ? [...sisters(KANBAN_SITES, p.path).slice(0, 2), '/calendar/', '/notes/', '/stopwatch/'] : ['/kanban/', ...sisters(KANBAN_SITES, p.path).filter((x) => x !== '/kanban/').slice(0, 2), '/calendar/']])]);
const HAND_RELATED = Object.freeze({
  ...SITE_RELATED,
  '/photos/': ['/resize-image/', '/color/', '/convert/'],
  '/color/': ['/gradient/', '/wheel/', '/base-converter/'],
  '/gradient/': ['/color/', '/wheel/'],
  '/wheel/': ['/random/', '/random-user/', '/flip/', '/gradient/', '/color/'],
  '/random-user/': ['/wheel/', '/random/', '/password-strength/'],
  '/random/': ['/wheel/', '/flip/', '/random-user/', '/base-converter/'],
  '/flip/': ['/wheel/', '/random/'],
  '/stopwatch/': ['/word-count/', '/time/'],
  '/word-count/': ['/stopwatch/', '/fanfic/'],
  '/base-converter/': ['/convert/', '/color/', '/random/', '/calculator/'],
  '/convert/': ['/base-converter/', '/stopwatch/', '/calculator/'],
  '/password-strength/': ['/password/', '/random-user/'],
  '/password/': ['/password-strength/', '/random/', '/random-user/'],
  '/resize-image/': ['/color/'],
  '/calculator/': ['/base-converter/', '/convert/', '/random/', '/calculators/'],
  '/calculators/': ['/calculator/', '/convert/', '/base-converter/'],
  '/time/': ['/stopwatch/', '/weather/'],
  '/weather/': ['/time/', '/stopwatch/'],
  '/translate/': ['/word-count/', '/time/', '/notes/'],
  '/recipes/': ['/stopwatch/', '/convert/', '/translate/'],
  '/scores/': ['/sports/', '/time/', '/calendar/'],
  '/sports/': ['/scores/', '/calendar/', '/time/'],
  '/fantasy/': ['/scores/', '/sports/', '/calculator/'],
  '/podcasts/': ['/stopwatch/', '/translate/', '/word-count/'],
  '/calendar/': ['/time/', '/stopwatch/', '/weather/'],
  '/markets/': ['/convert/', '/calculator/', '/time/'],
  '/generators/': ['/image/', '/random/', '/flip/', '/wheel/'],
  '/image/': ['/generators/', '/resize-image/', '/color/'],
  '/notes/': ['/word-count/', '/translate/', '/calendar/', '/fanfic/', '/rap/'],
  '/base64/': ['/word-count/', '/base-converter/', '/g/', '/emojis/'],
  '/boards/': ['/fanfic/', '/resize-image/', '/translate/', '/notes/'],
  '/fanfic/': ['/generators/', '/word-count/', '/translate/', '/boards/'],
  '/team/': ['/kanban/', '/notes/', '/ledger/', '/boards/'],
  '/learn-to-draw/': ['/stopwatch/', '/color/', '/resize-image/', '/notes/'],
  '/brain/': ['/piano/', '/tuner/', '/notes/', '/rap/', '/learn-to-draw/'],
  '/converter/': ['/photos/', '/pdf/', '/convert/', '/resize-image/'],
  '/news/': ['/translate/', '/notes/', '/weather/'],
  '/music/': ['/metronome/', '/piano/', '/tuner/', '/bpm/', '/chords/', '/rap/'],
  '/rap/': ['/music/', '/metronome/', '/word-count/', '/translate/'],
  '/metronome/': ['/bpm/', '/tuner/', '/piano/', '/stopwatch/', '/rap/'],
  '/piano/': ['/chords/', '/metronome/', '/tuner/'],
  '/tuner/': ['/piano/', '/chords/', '/metronome/'],
  '/bpm/': ['/metronome/', '/stopwatch/', '/piano/'],
  '/chords/': ['/piano/', '/tuner/', '/metronome/'],
  // the flights pages (owner, 2026-10-26): the hub reaches each tool; each tool its closest sisters, the weather and the clocks
  '/flights/': ['/flights/time/', '/flights/trip/', '/flights/co2/', '/weather/', '/time/'],
  '/flights/trip/': ['/flights/', '/calendar/', '/flights/time/', '/time/'],
  '/flights/airports/': ['/flights/', '/flights/distance/', '/flights/routes/', '/time/'],
  '/flights/time/': ['/flights/distance/', '/time/', '/flights/trip/', '/flights/'],
  '/flights/distance/': ['/flights/map/', '/flights/time/', '/flights/co2/', '/convert/'],
  '/flights/map/': ['/flights/distance/', '/flights/airports/', '/flights/'],
  '/flights/co2/': ['/flights/distance/', '/flights/', '/convert/'],
  '/flights/routes/': ['/flights/', '/flights/airports/', '/weather/'],
  // the jobs pages (owner, 2026-10-26): the hub reaches each lane page; each lane page the hub and its closest sisters
  '/jobs/': ['/jobs/alerts/', '/jobs/salary/', '/jobs/europe/', '/jobs/companies/', '/calendar/'],
  '/jobs/regions/': ['/jobs/', '/jobs/europe/', '/jobs/alerts/', '/time/'],
  '/jobs/alerts/': ['/jobs/', '/jobs/categories/', '/jobs/tags/'],
  '/jobs/europe/': ['/jobs/', '/jobs/regions/', '/translate/'],
  '/jobs/salary/': ['/jobs/', '/calculator/', '/jobs/tags/', '/convert/'],
  '/jobs/categories/': ['/jobs/', '/jobs/tags/', '/jobs/companies/'],
  '/jobs/tags/': ['/jobs/', '/jobs/categories/', '/jobs/salary/'],
  '/jobs/companies/': ['/jobs/', '/jobs/categories/', '/jobs/alerts/'],
  // the repo activity ledger (owner, 2026-10-28): a Kanban board and notes to plan from what it lists, the calendar for its dates
  '/ledger/': ['/kanban/', '/team/', '/notes/', '/calendar/', '/g/'],
  // the STL checker (asked by Verse): a part's size in other units, and the arithmetic of a print
  '/stl/': ['/convert/', '/calculator/', '/calculators/'],
  // emoji counts (2026-10-30, wired into the kit): an emoji's bytes in Base64, its length in words and characters, its name in another language,
  // and a snippet to carry it in
  '/emojis/': ['/emoji-combos/', '/word-count/', '/base64/', '/translate/'],
  // emoji combos (2026-10-30, against emojicombos.com): single emoji counted, what was collected counted or encoded, or kept as a snippet
  '/emoji-combos/': ['/emojis/', '/word-count/', '/base64/', '/g/'],
  // the snippet in a link (/g/, the gist): its text in Base64, counted, kept as a note, or the repo it came from listed issue by issue
  '/g/': ['/base64/', '/word-count/', '/notes/', '/ledger/'],
  '/tools/': ['/color/', '/wheel/', '/calculator/'],
});
// a page Verse built by itself (lib/self-sites.js) goes with its family's page first, then the tools that page goes with
export const RELATED = Object.freeze({ ...HAND_RELATED, ...Object.fromEntries(SELF_SITES.filter((r) => HAND_RELATED[r.base]).map((r) => [r.path, [r.base, ...HAND_RELATED[r.base]].slice(0, 4)])) });
// the ask that opens each page's own card on the stage, the other way round from the card's "Open the full page" link (owner, 2026-10-25:
// "why are you not linking the cards to the pages?" then "and vice versa"): each was asked on the stage and answered by the skill that links back
const HAND_CARD_ASK = Object.freeze({
  '/photos/': 'edit a photo',
  '/color/': 'color #ff5733', '/gradient/': 'gradient from red to blue', '/wheel/': 'spin the wheel with ann, bob and cat', '/random-user/': 'fake name generator',
  '/random/': 'random number between 1 and 100', '/flip/': 'flip a coin', '/stopwatch/': 'start a stopwatch', '/word-count/': 'count words in the quick brown fox',
  '/base-converter/': 'convert 255 to binary', '/password-strength/': 'how secure is my password', '/stl/': 'check my stl file', '/resize-image/': 'resize an image', '/convert/': 'unit converter',
  '/calculator/': '17% of 240', '/calculators/': 'pipe surface area calculator', '/time/': 'time in tokyo', '/base64/': 'base64 encode hello', '/password/': 'generate a password', '/weather/': 'weather in boston',
  '/translate/': 'translate hello to spanish', '/recipes/': 'recipe for pancakes', '/markets/': 'crypto prices', '/podcasts/': 'podcasts about history', '/scores/': 'nba scores', '/sports/': 'browse sports', '/fantasy/': 'fantasy tools', '/calendar/': 'my calendar', '/tools/': 'what tools do you have',
  '/notes/': 'make a notepad', '/generators/': 'fantasy name generator', '/boards/': 'image boards', '/fanfic/': 'fan fiction', '/team/': 'team chat', '/learn-to-draw/': 'sketch pad', '/brain/': 'verse brain', '/converter/': 'file converter', '/rap/': 'write me a rap about pizza', '/news/': 'news today', '/music/': 'music tools', '/metronome/': 'metronome 120 bpm', '/piano/': 'online piano', '/tuner/': 'guitar tuner', '/bpm/': 'bpm counter', '/chords/': 'am7 chord', '/image/': 'draw a cartoon cat', '/ledger/': 'look at atomeam/void-loop', '/emojis/': 'random emoji', '/emoji-combos/': 'cat emoji combos', '/g/': 'https://github.com/atomeam/void-loop/blob/main/README.md', ...Object.fromEntries(SITE_PAGES.map((p) => [p.path, p.card])),
});
// a self-built page opens its family's card on the stage
export const CARD_ASK = Object.freeze({ ...HAND_CARD_ASK, ...Object.fromEntries(SELF_SITES.filter((r) => HAND_CARD_ASK[r.base]).map((r) => [r.path, HAND_CARD_ASK[r.base]])) });
/** the stage link that opens a page's card ('/?q=...'), or '' for a page with none. Pure. */
export const cardLinkOf = (path) => (CARD_ASK[path] ? '/?q=' + encodeURIComponent(CARD_ASK[path]) : '');
/** the related tools of a page as [{ href, label }], closest first; unknown pages get none. Pure. */
export const relatedOf = (path) => (RELATED[path] || []).filter((p) => TOOLS[p]).map((href) => ({ href, label: TOOLS[href] }));

/** a colour written as #rrggbb (3 or 6 hex digits, with or without #), or null. Pure. */
export function hexOf(text) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(text || '').trim()); if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]; return '#' + h.toLowerCase();
}
/** the text colour that reads on a background, by WCAG contrast: '#ffffff' or '#111111'. Pure. */
export function inkOn(hex) {
  const h = hexOf(hex); if (!h) return '#ffffff';
  const L = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2], white = 1.05 / (lum + 0.05), dark = (lum + 0.05) / (0.0056 + 0.05); // #111 is 0.0056
  return white >= dark ? '#ffffff' : '#111111';
}

const store = () => { try { return globalThis.localStorage || null; } catch (_) { return null; } };
/** the accent picked on this device, or null; put on the page (--accent, and --on-accent for text on it) when there is one. */
export function accent(root = globalThis.document && document.documentElement) {
  let h = null; try { const s = store(); h = s ? hexOf(s.getItem(ACCENT_KEY)) : null; } catch (_) {}
  if (h && root && root.style) { root.style.setProperty('--accent', h); root.style.setProperty('--on-accent', inkOn(h)); }
  return h;
}
/** keep a colour as every tool's accent (null puts back each page's own); true when kept. */
export function setAccent(hex, root = globalThis.document && document.documentElement) {
  const s = store(); const h = hex === null ? null : hexOf(hex); if (hex !== null && !h) return false;
  try { if (!s) return false; if (h) s.setItem(ACCENT_KEY, h); else s.removeItem(ACCENT_KEY); } catch (_) { return false; }
  if (root && root.style) { if (h) accent(root); else { root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); } }
  return true;
}

// one palette for every tool that paints with several colours (owner, 2026-10-24: "even the colors on the wheel can use the tools"): set from a
// colour's shades on /color/ or from along a gradient on /gradient/, worn by the wheel's slices; kept on this device
export const PALETTE_KEY = 'a2m.void.palette.v1';
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexFrom = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** n colours along gradient stops [{ color: '#rrggbb', pos: 0..100 }], ends included. Pure. */
export function along(stops, n = 8) {
  const st = (stops || []).map((s) => ({ c: hexOf(s.color), pos: +s.pos })).filter((s) => s.c && Number.isFinite(s.pos)).sort((a, b) => a.pos - b.pos);
  if (!st.length) return []; if (st.length === 1) return Array(n).fill(st[0].c);
  return Array.from({ length: n }, (_, i) => { const p = st[0].pos + (st[st.length - 1].pos - st[0].pos) * (n > 1 ? i / (n - 1) : 0);
    let k = 0; while (k < st.length - 2 && p > st[k + 1].pos) k++;
    const a = st[k], b = st[k + 1], t = b.pos > a.pos ? Math.max(0, Math.min(1, (p - a.pos) / (b.pos - a.pos))) : 0, A = rgbOf(a.c), B = rgbOf(b.c);
    return hexFrom(A.map((v, j) => v + (B[j] - v) * t)); });
}
/** n shades of one colour, from deep to light, the colour itself among them. Pure. */
export function shadesOf(hex, n = 8) {
  const h = hexOf(hex); if (!h) return []; const c = rgbOf(h);
  return Array.from({ length: n }, (_, i) => { const t = n > 1 ? i / (n - 1) : 0.5, k = t * 2 - 1; // -1 deep .. +1 light
    return hexFrom(c.map((v) => (k < 0 ? v * (1 + k * 0.6) : v + (255 - v) * k * 0.6))); });
}
/** the palette kept on this device: 2 to 24 colours, or null. */
export function paletteOf() { try { const s = store(); const l = s ? JSON.parse(s.getItem(PALETTE_KEY) || 'null') : null; const v = Array.isArray(l) ? l.map(hexOf).filter(Boolean) : []; return v.length >= 2 ? v.slice(0, 24) : null; } catch (_) { return null; } }
/** keep a palette for every tool (null puts back each tool's own colours); true when kept. */
export function setPalette(list) {
  const s = store(); if (!s) return false; const v = list === null ? null : (list || []).map(hexOf).filter(Boolean).slice(0, 24);
  if (v && v.length < 2) return false;
  try { if (v) s.setItem(PALETTE_KEY, JSON.stringify(v)); else s.removeItem(PALETTE_KEY); return true; } catch (_) { return false; }
}

// one ask bar on every tool page (owner, 2026-10-25: the tools "usable together"): what is typed goes to the tool that does it, with the ask in its
// link, so "100 c to f" on the coin page opens the converter converted; an ask no tool takes goes to the stage, which answers anything. Pure.
const NUM = String.raw`-?\d[\d.,/]*(?:\s+\d+/\d+)?`;
const ROUTES = [
  // Verse Brain full screen (owner, 2026-10-30: "verse brain needs a full screen"): 'full screen brain', 'open verse brain' open /brain/ (lib/brain-ask.js)
  [{ exec: (t) => (brainFullAsk(t) ? [t] : null) }, () => '/brain/'],
  // the drawing course (2026-10-29, assimilates wheelroot.com): 'learn to draw', 'drawing course', 'drawing lessons', 'drawing exercises' open /learn-to-draw/
  // the file converter (2026-10-29, assimilates onlineconverter.com): 'mp4 to mp3', 'epub to txt', 'cut mp3', 'merge audio', 'file converter' open /converter/
  // with the ask; a picture or PDF ask stays with the photo and PDF tools, a unit with the unit converter (lib/converter-ask.js)
  [{ exec: (t) => (converterAskOf(t) ? [t] : null) }, (m, t) => converterAskOf(t)],
  [/\b(?:learn(?:ing)? (?:how )?to draw|drawing (?:course|lessons?|exercises?|drills?|fundamentals|basics|for beginners)|how to draw for beginners)\b/, () => '/learn-to-draw/'],
  // flights (owner, 2026-10-26): 'flights to lisbon', 'cheap flights', 'flight time london new york', 'distance london to new york', 'airport codes', 'layover calculator' open the flights page that does it, with the places in the link (lib/flight-sites.js)
  [{ exec: (t) => (flightAskOf(t) ? [t] : null) }, (m, t) => flightAskOf(t)],
  // jobs (owner, 2026-10-26): 'job search', 'remote jobs', 'job alerts', 'jobs in germany', 'remote companies hiring' open the jobs page that does it (lib/job-sites.js)
  [{ exec: (t) => (jobAskOf(t) ? [t] : null) }, (m, t) => jobAskOf(t)],
  // pdf and kanban: 'merge pdf', 'jpg to pdf', 'compress pdf', 'pdf tools' open that tool; 'kanban board' opens the board ('ask questions about a pdf' stays with the stage's PDF card)
  [PDF_ASK, (m, t) => '/pdf/' + (pdfToolOf(t) ? '?tool=' + pdfToolOf(t) : '')],
  [KANBAN_ASK, () => '/kanban/'],
  // podcasts: 'search podcasts', 'podcasts about history', 'top podcasts', 'podcast charts', 'podcast player' (the plain 'podcast' and 'play the podcast' stay with Verse's own show on the stage)
  [/^(?:search |find |browse )?podcasts? (?:about|on|for) (.+)$|^(?:search|find) (?:for )?(?:a )?podcasts?(?: (?:about|on|for) )?(.*)$/i, (m) => '/podcasts/' + (m[1] || m[2] ? '?q=' + encodeURIComponent((m[1] || m[2]).trim()) : '')],
  [/^(?:top |best |popular )?podcasts$|^podcast (?:charts?|player|directory|app)$/i, () => '/podcasts/'],
  // calendar: 'add dentist tomorrow 3pm to my calendar', 'remind me to call mum tomorrow 6pm', 'my calendar', "what's on tomorrow", 'my week'
  [/^(?:add|put) (.+?) (?:to|on|in) (?:my |the )?(?:calendar|verse|void)$|^(?:calendar|schedule|new event)[:,] (.+)$|^remind me (?:to |about |of )?(.+)$/i, (m) => '/calendar/?q=' + encodeURIComponent(m[1] || m[2] || m[3])],
  // generators: 'fantasy name', 'name generator', 'writing prompt', 'band name generator'
  [/^(?:random |a )?(fantasy name|town name|band name|pet name|username|writing prompt|story prompt|superpower|haiku|villain plot|book title|album title|business name|potion name|planet name|side quest|superhero name)s?(?: generator| ideas?)?$|^(?:random )?name generator$/i, (m) => '/generators/?g=' + ({ 'fantasy name': 'fantasy-names', 'town name': 'town-names', 'band name': 'band-names', 'pet name': 'pet-names', username: 'usernames', 'writing prompt': 'writing-prompts', 'story prompt': 'story-prompts', superpower: 'superpowers', haiku: 'haiku', 'villain plot': 'villain-plots', 'book title': 'book-titles', 'album title': 'album-titles', 'business name': 'business-names', 'potion name': 'potion-names', 'planet name': 'planet-names', 'side quest': 'side-quests', 'superhero name': 'superhero-names' }[(m[1] || 'fantasy name').toLowerCase()] || 'fantasy-names')],
  // fan fiction: 'fan fiction', 'fanfic archive', 'post a story', 'my writing room'
  [/^(?:the |a |open )?(?:fan ?fic(?:tion)?|fanfics?)(?: archive| stories| site)?$|^(?:post|publish|share) (?:a |my )?(?:fan ?fic(?:tion)?|story|chapter)$/i, () => '/fanfic/'],
  [/^(?:my |the |open (?:the |my )?)?writing room$/i, () => '/fanfic/?v=room'],
  // the team chat: 'team chat', 'open the team chat', 'agent workspace', 'slack alternative', 'my agents'
  [/^(?:the |a |open (?:the |my )?|my )?(?:team ?chat|team workspace|agents? (?:chat|workspace)|chat (?:for|with) (?:my |the )?agents|slack alternative)$|^(?:my|the) agents$/i, () => '/team/'],
  // boards: 'image boards', 'text boards', 'the chans', '/tech/', 'make a board'
  [/^(?:make|create|start|new) (?:a |an |my own )?(?:image |text )?board$/i, () => '/boards/?new=1'],
  [/^\/([a-z0-9]{1,10})\/$/i, (m) => '/boards/?b=' + m[1].toLowerCase()],
  [/^(?:the |open (?:the )?)?(?:image ?boards?|text ?boards?|chans?|imageboards?|boards)$/i, () => '/boards/'],
  // image: 'ai image generator', 'text to image', 'generate an image of a fox in snow', 'ai art of a castle'; 'make a random generator' opens the editor
  [/^(?:free )?(?:ai )?(?:image|picture|art) generator$|^text to (?:image|picture)$|^(?:ai art|ai image|ai picture)$/i, () => '/image/'],
  [/^(?:generate|create|make) (?:an? )?(?:ai )?(?:image|picture|photo|art) (?:of|showing) (.+)$|^ai (?:art|image|picture) of (.+)$/i, (m) => '/image/?' + new URLSearchParams({ prompt: m[1] || m[2], go: '1' })],
  [/^(?:make|create|write|build) (?:a |my own |your own )?(?:random )?generator$|^(?:perchance|generator editor|list generator)$/i, () => '/generators/make/'],
  // music: 'metronome 120 bpm', '90 bpm 6/8 metronome', 'online piano', 'guitar tuner', 'tap tempo', 'bpm counter', 'am7 chord', 'c major scale', 'chord finder'
  [/^(?:an? |the |online |free )*metronome(?: (?:at|for))?\s*(\d{2,3})\s*(?:bpm)?(?: (\d{1,2}\/\d{1,2}))?$|^(\d{2,3})\s*bpm\s*(?:(\d{1,2}\/\d{1,2})\s*)?metronome$/i, (m) => '/metronome/?bpm=' + (m[1] || m[3]) + (m[2] || m[4] ? '&sig=' + encodeURIComponent(m[2] || m[4]) : '')],
  [/^(?:an? |the |online |free |open )*(?:metronome|click track|beat keeper)(?: online)?$/i, () => '/metronome/'],
  [/^(?:an? |the |online |free |virtual |play )*(?:piano|keyboard piano|virtual keyboard)(?: online)?$/i, () => '/piano/'],
  [/^(?:an? |the |online |free |chromatic |instrument )*(?:guitar |bass |ukulele |violin |cello )?tuner(?: online)?$|^tune (?:my |a |the )?(?:guitar|bass|ukulele|violin|cello)$/i, () => '/tuner/'],
  [/^(?:tap tempo|tap bpm|bpm counter|bpm tapper|bpm finder|find (?:the )?bpm|what(?:'s| is) the bpm)$/i, () => '/bpm/'],
  [/^(?:an? |the )*(?:chord|chords|scale|scales) (?:finder|chart|dictionary|identifier)$|^circle of fifths$/i, () => '/chords/'],
  [/^([a-g][#b]?(?:m|maj7|m7|7|dim|dim7|aug|sus2|sus4|add9|m7b5|maj9|9|6|m6|5)?) chord$/i, (m) => '/chords/?chord=' + encodeURIComponent(m[1][0].toUpperCase() + m[1].slice(1))],
  [/^([a-g][#b]?)\s+(major|minor|dorian|mixolydian|lydian|phrygian|blues|pentatonic)\s+scale$/i, (m) => '/chords/?scale=' + encodeURIComponent(m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2])],
  // news: 'news page', 'my news', 'saved news' (plain 'news today' and 'tech news' stay the cards on the stage, whose link opens this page)
  [/^(?:the |open )?news (?:page|app|reader)$/i, () => '/news/'],
  [/^my news$/i, () => '/news/?sec=my'],
  [/^saved (?:news|stories|headlines)$/i, () => '/news/?sec=saved'],
  // notes: 'note: buy milk', 'note: Shopping list - milk, eggs, bread', 'new note', 'my notes'
  [/^(?:(?:new|add|make|create) )?note[:,] ?(.+)$/i, (m) => '/notes/?q=' + encodeURIComponent(m[1])],
  [/^(?:new note|my notes|(?:open )?(?:my )?notes)$/i, () => '/notes/'],
  [/^(?:my |the |open (?:my |the )?)?calendar$|^(?:my )?(?:agenda|schedule|events)$/i, () => '/calendar/'],
  [/^what(?:'s| is| do i have) on (today|tomorrow|this week|next week)\??$|^(?:my )?(?:day|schedule|agenda|events|plans) (?:for )?(today|tomorrow|this week|next week)$|^(?:my|this) (week)$/i, (m) => '/calendar/?show=' + (m[1] || m[2] || m[3]).replace(/\s+/g, '-')],
  // scores: 'nba scores', 'premier league table', 'bundesliga results', 'f1 standings', 'live scores' (the league's page for today; a table for standings/table)
  [/^(?:live |today'?s? )?(premier league|epl|english premier league|la ?liga|bundesliga|serie a|ligue 1|mls|champions league|ucl|nba|nfl|mlb|nhl|f1|formula 1|formula one) (?:live )?(scores?|results?|fixtures|games|matches|standings?|table|schedule)$|^(?:live )?(scores?|sports scores)$/i,
    (m) => { const a = (m[1] || '').toLowerCase().replace(/\s+/g, ''), id = ({ premierleague: 'epl', englishpremierleague: 'epl', laliga: 'laliga', seriea: 'seriea', ligue1: 'ligue1', championsleague: 'ucl', formula1: 'f1', formulaone: 'f1' })[a] || a; return '/scores/' + (id ? '?league=' + id + (/stand|table/i.test(m[2] || '') ? '&tab=standings' : '') : ''); }],
  // markets: 'aapl stock price', 'stock price of apple', 'tesla stock', 'stock market', 'markets'
  [/^(?:the )?(?:stock |share )?(?:price|quote|chart) (?:of|for) (.+)$|^(.+?) (?:stock|shares?|share price|stock price|stock quote|stock chart)$/i, (m) => '/markets/?s=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:the )?(?:stock market|markets|stocks|finance)$/i, () => '/markets/'],
  // recipes: 'pancake recipe', 'recipe for pancakes', 'how do I make pancakes', 'how to cook rice'; and by what is in the fridge, 'what can I make with eggs, spinach'
  [/^what (?:can|could|should) (?:i|we) (?:make|cook|bake) (?:with|from|using) (.+)$|^recipes? (?:with|using|from) (.+)$/i, (m) => '/recipes/?i=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:(?:an? |the )?(?:easy |simple |quick |best |homemade )?recipes? for (.+)|(.+?) recipes?|how (?:do|would|can) (?:i|you|we) (?:make|cook|bake) (.+)|how to (?:make|cook|bake) (.+))$/i, (m) => '/recipes/?q=' + encodeURIComponent(m[1] || m[2] || m[3] || m[4])],
  // translate: 'translate hello to spanish', 'how do you say thank you in japanese', 'good morning in french' (the code from lib/translate-langs.js's names, a few common ones here)
  [/^(?:please\s+)?translate\s+(.+?)\s+(?:to|into|in)\s+([a-z]+(?:\s+[a-z]+)?)$|^how\s+(?:do|would)\s+(?:you|i|we)\s+say\s+(.+?)\s+in\s+([a-z]+(?:\s+[a-z]+)?)$/i, (m) => '/translate/?q=' + encodeURIComponent(m[1] || m[3]) + '&to=' + encodeURIComponent((m[2] || m[4]).toLowerCase())],
  [/^(?:what(?:'s| is) the )?weather(?: (?:in|for|at) (.+))?$|^forecast(?: (?:in|for) (.+))?$/i, (m) => '/weather/' + (m[1] || m[2] ? '?q=' + encodeURIComponent(m[1] || m[2]) : '')],
  [/^(?:what )?time (?:is it )?in (.+)$|^(.+) time$/i, (m) => '/time/?q=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:is it|is today) (.+)$/i, (m) => '/is-it/' + encodeURIComponent(m[1].toLowerCase().replace(/[?!.]+$/, '').trim().replace(/\s+/g, '-'))],
  [/^(?:flip|toss) (?:a )?coins?$|^coin ?flip$|^heads or tails$/i, () => '/flip/'],
  [/^(?:spin (?:the |a )?)?wheel(?: of names)?$|^pick (?:a |one )?(?:name|winner)$/i, () => '/wheel/'],
  [/^(?:a |one |some )?(?:random|fake|made-?up) (?:users?|people|persons?|names?)$|^(\d+) (?:random|fake|made-?up) (?:users?|people)$/i, (m) => '/random-user/' + (m[1] ? '?n=' + m[1] : '')],
  [/^(?:a )?random number(?: (?:between|from) (\d+) (?:and|to) (\d+))?$|^(?:roll|dice|d\d+)$/i, () => '/random/'],
  [/^(?:a |an? )?(?:strong )?(?:password|passphrase)(?: of (\d+)(?: characters| letters)?)?$|^(?:generate|make|new) (?:a |me a )?(?:strong )?(?:password|passphrase)(?: of (\d+))?$/i, (m) => '/password/' + (m[1] || m[2] ? '?len=' + (m[1] || m[2]) : '')],
  // the STL checker (asked by Verse): 'check my stl file', 'is my stl watertight', 'stl checker'; the file itself is picked on the page, never put in a link
  [/^(?:(?:check|verify|test|inspect|validate) (?:my |an? |the |this )?stl(?: file)?(?: for (?:holes|errors|problems))?|is (?:my |the |this |an? )?stl(?: file)? (?:watertight|manifold|printable|ok|okay)|stl (?:file )?(?:checker|check|validator|verifier|watertight(?:ness)?(?: check(?:er)?)?)|(?:my )?stl watertight)$/i, () => '/stl/'],
  [/^(?:how (?:strong|secure|safe) is|check(?: the)? (?:password|strength of)) (.+)$/i, () => '/password-strength/'], // the typed password never goes in an address: the page asks for it
  [/^(?:base64 )?decode (.+)$|^(.+) from base64$/i, (m) => '/base64/?mode=decode&t=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:base64 )?encode (.+)$|^(.+) (?:to|in|as) base64$/i, (m) => '/base64/?t=' + encodeURIComponent(m[1] || m[2])],
  [/^(?:0x[0-9a-f]+|0b[01]+|\d+) (?:in|to|as) (binary|hex(?:adecimal)?|octal|decimal|base \d+)$/i, (m, t) => { const v = t.split(/\s/)[0], b = /^bin/i.test(m[1]) ? 2 : /^hex/i.test(m[1]) ? 16 : /^oct/i.test(m[1]) ? 8 : /^dec/i.test(m[1]) ? 10 : +m[1].replace(/\D/g, ''); return '/base-converter/?v=' + encodeURIComponent(v) + '&b=' + b; }],
  [/^#?[0-9a-f]{6}$|^#?[0-9a-f]{3}$|^rgba?\(.+\)$|^hsla?\(.+\)$/i, (m, t) => '/color/?c=' + encodeURIComponent(t.replace(/^#/, ''))],
  [/^(?:a )?gradient(?: from (.+))?$/i, () => '/gradient/'],
  // photo tools: 'compress image', 'crop photo', 'convert png to webp', 'view exif', 'strip exif', 'squoosh' (lib/photo-ask.js); a sized ask stays with the resizer below
  [/^(?:please )?(?:strip|remove|clean|scrub) (?:the )?(?:exif|metadata|gps|location)(?: (?:from|off|of|in) (?:an? |my |the |this )?(?:photo|picture|image|pic|jpe?g|png)s?)?$|^(?:exif|metadata) (?:stripper|remover|cleaner)$/i, () => '/photos/?tab=info'],
  [/^(?:please )?(?:compress|optimi[sz]e|convert|crop|rotate|flip|edit|annotate) (?:an? |my |the |this )?(?:image|photo|picture|pic|jpe?g|png|webp|avif)s?(?: (?:to|into) (?:jpe?g|png|webp|avif))?$|^(?:png|jpe?g|webp|avif) to (?:png|jpe?g|webp|avif)$|^(?:photo|image) (?:editor|compressor)$/i, (m, t) => '/photos/' + (/^(?:please )?(?:crop|rotate|flip)/i.test(t) ? '?tab=crop' : '')],
  [/^(?:view |see |check )?(?:the )?(?:exif|metadata)(?: viewer| of (?:an? |my |the )?(?:photo|picture|image))?$/i, () => '/photos/exif/'],
  [/^(squoosh|tinypng|photopea|iloveimg)$/i, (m) => '/photos/' + m[1].toLowerCase() + '/'],
  [/^(?:resize|shrink|crop) (?:an? |my |the )?(?:image|photo|picture|signature)(?: to (.+))?$/i, () => '/resize-image/'],
  [/^(?:count (?:the )?words(?: in)?|how many words(?: in)?|word count(?: of)?) (.+)$/i, (m) => '/word-count/?t=' + encodeURIComponent(m[1])],
  [/^(?:start (?:a )?)?(?:stopwatch|timer|countdown)(?: (?:for|of) (.+))?$|^(\d+ ?(?:min(?:ute)?s?|sec(?:ond)?s?|hours?)) timer$/i, (m) => '/stopwatch/' + (m[1] || m[2] ? '?t=' + encodeURIComponent(m[1] || m[2]) : '')],
  [new RegExp('^(?:convert )?' + NUM + '\\s*[a-zµ°/²³]+\\s+(?:to|in|into|as)\\s+[a-zµ°/²³]+$', 'i'), (m, t) => '/convert/?q=' + encodeURIComponent(t)],
  [/^(?:what is |what's |calculate |calc )?[-\d.(][\d\s.,+\-*×÷/^%()!πe]*(?:\s*(?:of|percent of)\s*[\d.]+)?$/i, (m, t) => '/calculator/?q=' + encodeURIComponent(t.replace(/^(?:what is |what's |calculate |calc )/i, ''))],
];
// a tool's own name opens that tool (2026-10-30: 'word count' on the ask bar opened Wikipedia's article on the stage, and 'pdf', 'photo tools' and
// 'code review' a stage answer, not the page): its name as /tools/ lists it, or its address in words ('/word-count/' is 'word count'), with an
// 'open' or 'the' before it or 'tool' or 'page' after it. A plain word the stage answers itself stays with the stage, whose card links the page:
// 'verse brain' (skills/verse-brain.js), 'news' (the headlines card), 'time' (the clock), 'flip' (the coin), 'rap' (a rap), and words that say too little.
const STAGE_KEEPS = new Set(['verse brain', 'brain', 'news', 'time', 'random', 'flip', 'rap', 'color', 'convert', 'music', 'image', 'team', 'identity', 'fix']);
const STAGE_KEEPS_JOINED = new Set([...STAGE_KEEPS].map((k) => k.replace(/ /g, '')));
const plainName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let toolNames = null;
function toolNamed(t) {
  if (!toolNames) {
    toolNames = new Map();
    // a name run together ('wordcount', as typed into an address) counts too, from five letters up
    for (const [p, label] of allTools()) for (const w of [plainName(label), plainName(p)]) for (const k of [w, w.replace(/ /g, '')]) if (k.length > (k === w ? 2 : 4) && !toolNames.has(k)) toolNames.set(k, p);
  }
  const n = plainName(t).replace(/^(?:open |show |go to )?(?:the |my |a |an )?/, '');
  for (const k of [n, n.replace(/ (?:tool|page|app)$/, '')]) if (!STAGE_KEEPS.has(k) && !STAGE_KEEPS_JOINED.has(k) && toolNames.has(k)) return toolNames.get(k);
  return null;
}
/** the tool a missing address, or the words asked there, names ('/wordcount', '/password-generator/', '/search/?q=word+count'), as { href, label },
 * or null. For the 404 page (2026-10-30): a typed address one letter or one dash off a tool led to a page with nothing on it. Pure. */
export function toolNear(pathname, q) {
  let path = String(pathname || ''); try { path = decodeURIComponent(path); } catch { /* a broken escape stays as typed */ }
  const segs = path.replace(/\.html?$/i, '').split('/').map(plainName).filter(Boolean);
  for (const words of [String(q || '').trim(), segs.join(' '), segs[segs.length - 1] || '', segs[0] || '']) {
    if (!words) continue;
    const to = toolNamed(words);
    if (to) return { href: to, label: (allTools().find(([p]) => p === to) || [to, to])[1] };
  }
  return null;
}
/** where an ask goes: the tool's link with the ask in it, the tool a name names, or the stage for anything else. Pure. */
export function routeAsk(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim();
  if (!t) return '';
  for (const [re, to] of ROUTES) { const m = re.exec(t); if (m) return to(m, t); }
  return toolNamed(t) || '/?q=' + encodeURIComponent(t);
}

/** the "Use with" row: this page's hand-offs (carrying what is on it), then its related tools, then the accent it wears. card, when a page
 *  gives it, answers the stage ask for what is on the page now (the colour page: 'color #f5be3d'), so its own card opens on that, not the example. */
export function mountRelated(el, path, handoffs = [], { card = null } = {}) {
  if (!el) return;
  const d = el.ownerDocument, a = (href, text, cls) => { const x = d.createElement('a'); x.href = href; x.textContent = text; if (cls) x.className = cls; return x; };
  const row = d.createElement('div'); row.className = 'tk-row';
  const aims = []; // every link that carries what is on the page: aimed now, again after anything the page does, and when pointed at or pressed
  { const c = cardLinkOf(path); if (c) { // first: the page's own card (owner, 2026-10-25: "and vice versa")
    const x = a(c, 'See it as a card on the stage →', 'tk-card'), aim = () => { let q = ''; try { q = card ? String(card() || '').trim() : ''; } catch (_) { /* the page's own problem: keep the example */ } x.href = q ? '/?q=' + encodeURIComponent(q) : c; };
    // so a hover already shows the card for what is on the page (owner via the team, 2026-10-29: the link follows the colour live)
    if (card) { aim(); aims.push(aim); for (const ev of ['pointerenter', 'pointerdown', 'focus', 'click']) x.addEventListener(ev, aim); }
    row.append(x);
  } }
  for (const h of handoffs) {
    if (h.run) { const b = d.createElement('button'); b.type = 'button'; b.className = 'tk-hand'; b.textContent = h.label; b.addEventListener('click', () => { const said = h.run(); if (said) { b.textContent = said; setTimeout(() => { b.textContent = h.label; }, 1600); } }); row.append(b); continue; }
    // a hand-off link carries the page's value in its href from the start, so a hover, a long press or a copied link goes there too, not to "#";
    // with nothing on the page to carry yet it reads as off. href is only read, so it must not write; what a press writes goes in go
    const x = a('#', h.label, 'tk-hand'), aim = () => { let u = null; try { u = h.href() || null; } catch (_) { /* nothing to carry */ } x.href = u || '#'; x.setAttribute('aria-disabled', u ? 'false' : 'true'); return u; };
    aim(); aims.push(aim); for (const ev of ['pointerenter', 'pointerdown', 'focus']) x.addEventListener(ev, aim);
    x.addEventListener('click', (e) => { const u = aim(); let ok = !!u; if (ok && h.go) try { ok = h.go() !== false; } catch (_) { ok = false; } if (!ok) e.preventDefault(); }); row.append(x);
  }
  if (aims.length) { const all = () => { for (const f of aims) f(); };
    // tk:card: a page that changes with no event of its own (a forecast that comes back) says so: d.dispatchEvent(new Event('tk:card'))
    if (d.addEventListener) for (const ev of ['input', 'change', 'click', 'pointerup', 'keyup', 'tk:card']) d.addEventListener(ev, all);
    if (d.defaultView && d.defaultView.addEventListener) for (const ev of ['hashchange', 'popstate']) d.defaultView.addEventListener(ev, all);
  }
  for (const r of relatedOf(path)) row.append(a(r.href, r.label));
  if (path !== '/tools/') row.append(a('/tools/', 'All tools')); // the kit's own page (owner, 2026-10-25: "link them all so they are all usable together")
  const h = accent(); const sw = a('/color/' + (h ? '?c=' + h.slice(1) : ''), h ? 'Accent ' + h : 'Pick an accent colour', 'tk-accent');
  sw.title = 'The colour every Verse tool wears on this device: pick it on the colour page'; row.append(sw);
  const label = d.createElement('span'); label.className = 'tk-label'; label.textContent = 'Use with';
  // the ask bar: any ask, to the tool that does it
  const form = d.createElement('form'); form.className = 'tk-ask'; const inp = d.createElement('input'); inp.type = 'search'; inp.placeholder = 'Ask any tool: 100 c to f, flip a coin, weather in boston'; inp.setAttribute('aria-label', 'Ask any tool'); inp.autocomplete = 'off';
  form.append(inp); form.addEventListener('submit', (e) => {
    e.preventDefault(); const to = routeAsk(inp.value); if (!to) return;
    // Verse Brain hears it next time it runs (lib/brain-host.js): kept on this device only, never sent, and never an owner key
    if (!/^\s*(?:unlock\s*)+\S{16,}/i.test(inp.value)) try { const ls = d.defaultView.localStorage, k = 'a2m.brain.heard.v1', q = JSON.parse(ls.getItem(k) || '[]'); q.push({ text: inp.value.trim().slice(0, 120), from: path, to, at: Date.now() }); ls.setItem(k, JSON.stringify(q.slice(-24))); } catch (_) { /* no storage: the ask still goes */ }
    d.defaultView.location.href = to;
  });
  const style = d.createElement('style');
  style.textContent = '.tk-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:14px 0 4px;font-size:13px}.tk-label{color:var(--soft,var(--muted,#888))}'
    + '.tk-row a,.tk-row button{font:inherit;background:transparent;cursor:pointer;display:inline-flex;align-items:center;min-height:40px;padding:4px 12px;border:1px solid var(--line,#8884);border-radius:999px;color:inherit;text-decoration:none}'
    + '.tk-ask{margin:14px 0 0}.tk-ask input{font:inherit;width:100%;box-sizing:border-box;min-height:40px;padding:6px 12px;border:1px solid var(--line,#8884);border-radius:999px;background:transparent;color:inherit}.tk-ask input:focus{outline:2px solid var(--accent,#6d4aff);outline-offset:1px}'
    + '.tk-row .tk-hand,.tk-row a.tk-card{border-color:var(--accent,#6d4aff)}.tk-row a.tk-card{font-weight:600}.tk-row a[aria-disabled="true"]{opacity:.5;cursor:default}.tk-row a.tk-accent::before{content:"";width:12px;height:12px;border-radius:50%;margin-right:6px;background:var(--accent,#6d4aff)}';
  row.prepend(label); el.replaceChildren(style, form, row);
}

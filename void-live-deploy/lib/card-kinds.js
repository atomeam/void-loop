// What an answer IS (owner, 2026-10-16: "the answer cards are more than that: What's New Pussycat is a movie and a song; they should have a
// bigger status than just Answer"). An encyclopedia answer's card is typed by what its source says it is: a Film, a Song, a Person, a Place,
// a Creature, a Band, a Book, a Show, a Game, an Organisation, a Concept, and a name that is several things at once carries all of them
// ("Film · Song"). The type comes from the short description Wikipedia gives each page ("1965 film by Clive Donner") and, for a name with
// sister pages, from their titles ("What's New Pussycat? (song)"). Pure here; fetchAlso() is the one network call. Work in progress by design:
// every kind below is a seed Verse grows (frontier #32).

/** [kind, test, chapter for its glyph and colour] in the order they are tried */
export const KINDS = [
  ['Character', /\b(?:fictional character|cartoon character|animated character|comic(?:s)? character|video game character|action figure|puppet character|mascot|character (?:in|from|of))\b/i, 'games'],
  ['Episode', /\b(?:television episode|tv episode|episode of)\b/i, 'stage'],
  ['Myth', /\b(?:deity|god of|goddess of|mythological|legendary (?:creature|figure)|folkloric|saint)\b/i, 'self'],
  ['Film', /\b(?:films?|movies?|screenplay|animated feature|documentary)\b/i, 'stage'],
  ['Show', /\b(?:television|tv series|tv show|sitcom|web series|miniseries|anime|cartoon series)\b/i, 'stage'],
  ['Album', /\balbum\b/i, 'words'],
  ['Song', /\b(?:songs?|single by|hit by|ballad)\b/i, 'words'],
  ['Band', /\b(?:band|musical group|boy group|girl group|rock group|duo)\b/i, 'words'],
  ['Card', /\b(?:trading card|collectible card|playing card|tarot card|pok[eé]mon (?:species|card)|magic: the gathering card|yu-gi-oh! card)\b/i, 'games'],
  ['Game', /\b(?:video game|board game|card game|tabletop game|role-playing game|game series)\b/i, 'games'],
  ['Book', /\b(?:novel|novella|poem|short story|play by|comic book|manga|book by|memoir|textbook)\b/i, 'words'],
  ['Place', /\b(?:residence|palace|building|bridge|tower|landmark|monument|museum|castle|stadium|skyscraper|cathedral|church|temple|airport|railway station|fortress|dam|canal)\b/i, 'sky'], // a landmark before a person: "residence of the president" is the White House
  ['Person', /\((?:born|b\.)\s|\(\d{3,4}\s*[–-]\s*\d{2,4}\)|\b(?:actor|actress|singer|songwriter|musician|rapper|politician|writer|author|novelist|poet|playwright|scientist|mathematician|physicist|chemist|biologist|philosopher|artist|painter|sculptor|director|comedian|footballer|athlete|player|inventor|engineer|president|king|queen|emperor|explorer|economist|composer|conductor|astronaut|businessman|businesswoman|entrepreneur|activist|journalist|presenter|model|chef|boxer|racing driver|coach)\b/i, 'self'],
  ['Food', /\b(?:dish|dessert|cuisine|juice|drink|liquid extract|beverage|cocktail|pastry|sauce|cheese|bread|soup|sandwich|snack|candy|confection|stew)\b/i, 'life'],
  ['Creature', /\b(?:species|genus|family of|big cat|cat|whale|shark|lizard|snake|primate|ape|wolf|bear|mammal|bird|fish|reptile|amphibian|insect|animal|breed|subspecies|domesticated|plant|tree|flower|fungus|bacterium|virus|dinosaur)\b/i, 'life'],
  ['Place', /\b(?:city|town|village|country|capital|river|mountain|island|state|county|province|region|lake|ocean|sea|desert|valley|peninsula|archipelago|national park|reefs?|islands?|coast|bay|strait|gulf|plateau|waterfall|glacier|volcano|neighbourhood|municipality|continent|district)\b/i, 'sky'],
  ['Vehicle', /\b(?:automobile|car model|aircraft|airliner|locomotive|motorcycle|spacecraft|rocket|vehicle|smartphone|gadget|operating system|programming language|software)\b/i, 'make'],
  ['Team', /\b(?:football club|sports? team|basketball team|baseball team|cricket team|hockey team|national team)\b/i, 'time'],
  ['Concept', /\b(?:theory|theorem|equation|chemical element|particle|physical law|principle|chess opening|mathematical|syndrome|disease)\b/i, 'index'],
  ['Organisation', /\b(?:company|corporation|organi[sz]ation|university|institution|agency|association|political party|nonprofit|brand|manufacturer|retailer|school|team|club|league)\b/i, 'time'],
  ['Event', /\b(?:war|battle|festival|election|treaty|disaster|revolution|championship|tournament|olympics|massacre|conference|protest|uprising)\b/i, 'time'],
  ['Idea', /./, 'index'],
];
const WORD = { card: 'Card', 'trading card': 'Card', film: 'Film', movie: 'Film', song: 'Song', single: 'Song', album: 'Album', band: 'Band', 'tv series': 'Show', 'tv show': 'Show', 'television series': 'Show', novel: 'Book', book: 'Book', play: 'Book', poem: 'Book', 'video game': 'Game', game: 'Game', musical: 'Show', manga: 'Book', 'comic book': 'Book', company: 'Organisation', band_: 'Band', ep: 'Album', mixtape: 'Album', soundtrack: 'Album', 'film series': 'Film', 'tv episode': 'Show', episode: 'Show' };

/** { kind, chapter, detail }: what a page's short description says it is, with its year and maker when it says them. Pure. */
export function kindOf(description, extract = '') {
  const d = String(description || ''), text = d + ' ' + String(extract || '').slice(0, 160);
  const specific = KINDS.slice(0, -1); // the last row (Idea) matches anything: it is the fallback, not a reading of the description
  const hit = specific.find(([, re]) => re.test(d)) || specific.find(([, re]) => re.test(text)) || KINDS[KINDS.length - 1];
  const year = (/\b(1[5-9]\d\d|20\d\d)\b/.exec(d) || [])[1] || '';
  const by = (/\bby ([A-Z][^,;()]{2,40})/.exec(d) || [])[1] || '';
  return { kind: hit[0], chapter: hit[2], detail: [year, by].filter(Boolean).join(' · ') };
}
/** What a source's one-line description adds to the card's header line (owner, 2026-10-18: the header said "Film - 2009 - Olatunde Osunsanmi" and the line
 *  under it said "2009 science fiction thriller film directed by Olatunde Osunsanmi"). The year, the name after "by" and the kind word the header already
 *  carries are dropped; what is left (the genre, the country) is the new part, or '' when the line adds nothing. Pure. */
export function newInSub(description, header) {
  const d = String(description || '').replace(/\s+/g, ' ').trim(), h = String(header || '').toLowerCase(); if (!d || !h) return d;
  const [kinds, ...rest] = h.split(' \u2014 '), detail = rest.join(' '), hasWord = (w) => new RegExp('(?:^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])').test(detail);
  let t = d.replace(/\b(?:directed |written |created |produced |composed |performed |sung |recorded |painted |founded |developed )?by ([A-Z][^,;()]{2,40})/g, (m, name) => (detail.includes(name.trim().toLowerCase()) ? ' ' : m));
  t = t.replace(/\b(1[5-9]\d\d|20\d\d)\b/g, (m) => (hasWord(m) ? ' ' : m));
  // a year the header holds leaves its parenthesis behind: "(born 1963)" goes whole, not "(born )"; "(1795–1821)" keeps the
  // year the header lacks as "(died 1821)", not "( –1821)" (2026-10-29: Michael Jordan's card read "American basketball player (born )")
  t = t.replace(/\(\s*(?:born|b\.)\s*\)/gi, ' ').replace(/\(\s*[\u2013-]\s*(\d{3,4})\s*\)/g, '(died $1)').replace(/\(\s*[\u2013-]?\s*\)/g, ' ');
  for (const k of kinds.split(' \u00b7 ').map((x) => x.trim()).filter(Boolean)) t = t.replace(new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b', 'gi'), ' ');
  const left = t.replace(/\b(?:a|an|the|of|and|in|by|directed|written|from|is|was)\b/gi, ' ').replace(/[\s,;:.\u2013\u2014-]+/g, ' ').trim();
  if (!/[A-Za-z]{2}/.test(left)) return '';
  t = t.replace(/\s+/g, ' ').replace(/^(?:an?|the)\s+/i, '').replace(/[\s,;:.\u2013\u2014-]+$/, '').replace(/^[\s,;:.\u2013\u2014-]+/, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}
/** Does a heading inside an answer only repeat the card's title (owner, 2026-10-18: "Show me the Site Test card" over "Site Test Card (Visa)")? The ask's
 *  lead-in words ("show me", "what is") and a trailing parenthesis are ignored; it repeats when every word of the heading is already in the title. Pure. */
export function repeatsTitle(title, heading) {
  const words = (x, paren) => String(x || '').toLowerCase().replace(paren ? /\([^)]*\)/g : /$^/, ' ').replace(/[^a-z0-9\u00c0-\uffff]+/g, ' ').split(' ').filter(Boolean);
  const stop = new Set(['show', 'me', 'the', 'a', 'an', 'what', 'is', 'are', 'whats', 'tell', 'about', 'of', 'to', 'please', 'give', 'find']);
  const t = new Set(words(title, true).filter((w) => !stop.has(w))), h = words(heading, true).filter((w) => !stop.has(w));
  return h.length > 0 && h.every((w) => t.has(w));
}
/** the kind a parenthetical word names ("song", "TV series"), or '' */
export const kindOfWord = (w) => WORD[String(w || '').trim().toLowerCase()] || '';
/** the other kinds a name is, from the titles of its sister pages: "What's New Pussycat? (song)" -> Song. Pure. */
export function alsoFrom(titles, title) {
  const base = String(title || '').replace(/\s*\([^)]*\)\s*$/, '').toLowerCase(), out = [];
  for (const t of titles || []) {
    const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(String(t || '')); if (!m || m[1].trim().toLowerCase() !== base) continue;
    const words = m[2].toLowerCase().replace(/^\d{4}\s+/, '').replace(/^(?:[a-z]+ )?(?:american|british|french|italian|korean|japanese|german|spanish|indian)\s+/, '');
    const k = kindOfWord(words) || kindOfWord(words.split(' ').slice(-1)[0]) || kindOfWord(words.split(' ').slice(-2).join(' '));
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
/** the type line's words: "Film · Song" with the first's detail after a dash. Pure. */
export function typeWords(primary, also = [], detail = '') {
  const kinds = [primary, ...(also || []).filter((k) => k !== primary)];
  return kinds.join(' · ') + (detail ? ' — ' + detail : '');
}
/** one search for sister pages' titles; resolves [] on any failure */
export function fetchAlso(title) {
  const base = String(title || '').replace(/\s*\([^)]*\)\s*$/, '');
  return fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=10&format=json&origin=*&srsearch=' + encodeURIComponent('intitle:"' + base.replace(/"/g, '') + '"'))
    .then((r) => r.json()).then((j) => alsoFrom((((j || {}).query || {}).search || []).map((x) => x.title), title)).catch(() => []);
}

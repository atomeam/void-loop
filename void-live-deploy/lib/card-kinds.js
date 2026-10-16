// What an answer IS (owner, 2026-10-16: "the answer cards are more than that: What's New Pussycat is a movie and a song; they should have a
// bigger status than just Answer"). An encyclopedia answer's card is typed by what its source says it is: a Film, a Song, a Person, a Place,
// a Creature, a Band, a Book, a Show, a Game, an Organisation, a Concept, and a name that is several things at once carries all of them
// ("Film · Song"). The type comes from the short description Wikipedia gives each page ("1965 film by Clive Donner") and, for a name with
// sister pages, from their titles ("What's New Pussycat? (song)"). Pure here; fetchAlso() is the one network call. Work in progress by design:
// every kind below is a seed V01D grows (frontier #32).

/** [kind, test, chapter for its glyph and colour] in the order they are tried */
export const KINDS = [
  ['Film', /\b(?:films?|movies?|screenplay|animated feature|documentary)\b/i, 'stage'],
  ['Show', /\b(?:television|tv series|tv show|sitcom|web series|miniseries|anime|cartoon series)\b/i, 'stage'],
  ['Album', /\balbum\b/i, 'words'],
  ['Song', /\b(?:songs?|single by|hit by|ballad)\b/i, 'words'],
  ['Band', /\b(?:band|musical group|boy group|girl group|rock group|duo)\b/i, 'words'],
  ['Game', /\b(?:video game|board game|card game|tabletop game|role-playing game|game series)\b/i, 'games'],
  ['Book', /\b(?:novel|novella|poem|short story|play by|comic book|manga|book by|memoir|textbook)\b/i, 'words'],
  ['Person', /\((?:born|b\.)\s|\(\d{3,4}\s*[–-]\s*\d{2,4}\)|\b(?:actor|actress|singer|songwriter|musician|rapper|politician|writer|author|novelist|poet|playwright|scientist|mathematician|physicist|chemist|biologist|philosopher|artist|painter|sculptor|director|comedian|footballer|athlete|player|inventor|engineer|president|king|queen|emperor|explorer|economist|composer|conductor|astronaut|businessman|businesswoman|entrepreneur|activist|journalist|presenter|model|chef|boxer|racing driver|coach)\b/i, 'self'],
  ['Place', /\b(?:city|town|village|country|capital|river|mountain|island|state|county|province|region|lake|ocean|sea|desert|valley|peninsula|archipelago|national park|neighbourhood|municipality|continent|district)\b/i, 'sky'],
  ['Creature', /\b(?:species|genus|family of|mammal|bird|fish|reptile|amphibian|insect|animal|breed|subspecies|domesticated|plant|tree|flower|fungus|bacterium|virus|dinosaur)\b/i, 'life'],
  ['Organisation', /\b(?:company|corporation|organi[sz]ation|university|institution|agency|association|political party|nonprofit|brand|manufacturer|retailer|school|team|club|league)\b/i, 'time'],
  ['Event', /\b(?:war|battle|festival|election|treaty|disaster|revolution|championship|tournament|olympics|massacre|conference|protest|uprising)\b/i, 'time'],
  ['Idea', /./, 'index'],
];
const WORD = { film: 'Film', movie: 'Film', song: 'Song', single: 'Song', album: 'Album', band: 'Band', 'tv series': 'Show', 'tv show': 'Show', 'television series': 'Show', novel: 'Book', book: 'Book', play: 'Book', poem: 'Book', 'video game': 'Game', game: 'Game', musical: 'Show', manga: 'Book', 'comic book': 'Book', company: 'Organisation', band_: 'Band', ep: 'Album', mixtape: 'Album', soundtrack: 'Album', 'film series': 'Film', 'tv episode': 'Show', episode: 'Show' };

/** { kind, chapter, detail }: what a page's short description says it is, with its year and maker when it says them. Pure. */
export function kindOf(description, extract = '') {
  const d = String(description || ''), text = d + ' ' + String(extract || '').slice(0, 160);
  const hit = KINDS.find(([, re]) => re.test(d)) || KINDS.find(([, re]) => re.test(text)) || KINDS[KINDS.length - 1];
  const year = (/\b(1[5-9]\d\d|20\d\d)\b/.exec(d) || [])[1] || '';
  const by = (/\bby ([A-Z][^,;()]{2,40})/.exec(d) || [])[1] || '';
  return { kind: hit[0], chapter: hit[2], detail: [year, by].filter(Boolean).join(' · ') };
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

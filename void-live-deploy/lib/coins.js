// Every coin, for skills/coin.js (owner, 2026-10-24: "coin flip should have a choice of any ever discovered coin as well as create a coin and it
// ties into our coin appraisal"). Real coins come from Wikimedia Commons (no key, open to any page: origin=*): the coin's obverse photo is heads,
// its reverse is tails, and the photo's own Commons page is linked. A coin a person makes is kept on this device only. Pure where it can be.

// coin names: a word on this list makes "flip a <name>" a real coin, not a plain one
const NAMES = 'stater|drachma|drachm|tetradrachm|didrachm|obol|denarius|denarii|aureus|sestertius|solidus|follis|antoninianus|siliqua|dinar|dirham|florin|ducat|'
  + 'doubloon|escudo|real|reales|piece of eight|thaler|taler|groschen|guilder|gulden|crown|sovereign|guinea|shilling|farthing|groat|noble|angel|'
  + 'dollar|half dollar|eagle|double eagle|half eagle|cent|penny|nickel|dime|quarter|peso|franc|mark|pfennig|lira|rouble|ruble|kopek|rupee|mohur|anna|'
  + 'yen|sen|koban|oban|mon|yuan|cash coin|tael|won|krugerrand|maple leaf|panda|britannia|kangaroo|philharmonic|libertad|napoleon|louis d.or|écu|ecu|'
  + 'shekel|tetradrachm|stater|daric|siglos|token|medal|medallion|coin';
const REAL = new RegExp('^(?:flip|toss)\\s+(?:me\\s+)?(?:an?|the|one|my)?\\s*(.{2,60}?\\b(?:' + NAMES + ')s?\\b.{0,30}?)(?:\\s+for\\s+(.{1,60}))?$', 'i');
// a plain coin's own words stay with the plain coin ("flip a coin", "flip a silver coin", "flip a euro", "flip 3 quarters")
const PLAIN = /^(?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+)?(?:(?:gold|golden|silver|quarter|dime|nickel|penny|euro|bitcoin|btc)\s+)?(?:coins?|quarters?|dimes?|nickels?|pennies|penny|euros?|bitcoins?)$/i;

/** the coin ask beyond a plain flip: { kind: 'real', name, for } | { kind: 'pick' } | { kind: 'make' } | { kind: 'mine', for } | null. Pure. */
export function coinAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (/^(?:create|make|design|mint|forge)\s+(?:me\s+)?(?:a|an|my|my own|your own|a new|our)?\s*(?:own\s+)?(?:custom\s+)?coin$|^coin (?:maker|designer|creator)$/.test(t)) return { kind: 'make' };
  if (/^(?:flip|toss)\s+(?:a|an|any)\s+(?:famous|historic|historical|ancient|old|real|rare|random)\s+coin$|^(?:which|what) coins can (?:i|you) flip$|^(?:pick|choose) a coin(?: to flip)?$|^every coin$/.test(t)) return { kind: 'pick' };
  let m = /^(?:flip|toss)\s+my\s+(?:own\s+)?coin(?:\s+for\s+(.{1,60}))?$/.exec(t);
  if (m) return { kind: 'mine', for: m[1] || '' };
  m = REAL.exec(t);
  if (!m) return null;
  const name = m[1].replace(/^(?:a|an|the)\s+/, '').trim();
  if (PLAIN.test(name) || /^(?:gold|golden|silver|weighted|fair|real|random)\s+coin$/.test(name)) return null;
  return { kind: 'real', name, for: m[2] || '' };
}

/** a few coins from across history, for the picker (any other coin can be typed: Commons has photos of almost every coin ever struck) */
export const FAMOUS = [
  ['Lydian stater', 'the first coins, about 600 BC'], ['Athenian owl tetradrachm', 'Athens, 5th century BC'], ['Alexander the Great tetradrachm', 'about 330 BC'],
  ['Ides of March denarius', 'Brutus, 42 BC'], ['Roman aureus', 'the Roman gold coin'], ['Byzantine solidus', 'gold for seven centuries'],
  ['Chinese cash coin', 'round with a square hole'], ['Florentine florin', 'Florence, 1252'], ['Venetian ducat', 'Venice, 1284'],
  ['Spanish dollar', 'the piece of eight'], ['Brasher doubloon', 'New York, 1787'], ['1804 silver dollar', 'the king of American coins'],
  ['British sovereign', 'since 1817'], ['Morgan dollar', 'United States, 1878'], ['Buffalo nickel', 'United States, 1913'],
  ['1933 double eagle', 'the most valuable coin sold'], ['Lincoln cent', 'United States, since 1909'], ['Krugerrand', 'South Africa, 1967'],
  ['Canadian gold maple leaf', 'Canada, 1979'], ['One euro coin', 'since 2002'],
];

const API = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=360&gsrsearch=';
/** the Commons search address for one side of a coin. Pure. */
export const sideUrl = (name, side) => API + encodeURIComponent(name + ' ' + side + ' coin filetype:bitmap');
/** the best photo in a Commons answer: a JPEG or PNG thumbnail, the one whose title names the side first. Pure. */
export function pickPhoto(json, side) {
  const pages = Object.values((json && json.query && json.query.pages) || {}).filter((p) => p.imageinfo && p.imageinfo[0] && /image\/(?:jpeg|png)/.test(p.imageinfo[0].mime || '') && p.imageinfo[0].thumburl);
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  const named = pages.find((p) => new RegExp(side === 'obverse' ? 'obv|avers|front|heads' : 'rev|back|tails', 'i').test(p.title));
  const p = named || pages[0];
  // a photo much wider than tall holds both faces side by side (most Commons coin photos do): each face then shows its own half
  const i = p && p.imageinfo[0], wide = !!(i && i.width > 0 && i.height > 0 && i.width / i.height >= 1.6);
  return p ? { src: i.thumburl, page: i.descriptionurl || ('https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title)), title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), wide } : null;
}
/** both sides of a coin from Commons: { heads, tails } (tails falls back to the heads photo when no reverse is found), or null. */
export async function findCoin(name, get = (u) => fetch(u).then((r) => r.json())) {
  let [o, r] = await Promise.all([get(sideUrl(name, 'obverse')).catch(() => null), get(sideUrl(name, 'reverse')).catch(() => null)]);
  let heads = pickPhoto(o, 'obverse') || pickPhoto(r, 'obverse');
  // a coin whose photos never say obverse, reverse or coin (the Canadian Gold Maple Leaf): its name alone, the side read from the file names
  if (!heads) { const plain = await get(API + encodeURIComponent(name + ' filetype:bitmap')).catch(() => null); heads = pickPhoto(plain, 'obverse'); if (heads) r = r || plain; if (heads && !pickPhoto(r, 'reverse')) r = plain; }
  if (!heads) return null;
  let tails = pickPhoto(r, 'reverse'); if (!tails || tails.src === heads.src) tails = pickPhoto(o, 'reverse');
  const own = tails && tails.src !== heads.src;
  // one photo for both: a wide one is cut in half (obverse left, reverse right); a narrow one shows the same face twice, as it always did
  const h = { ...heads, half: heads.wide ? 'left' : null }, t = own ? { ...tails, half: tails.wide ? 'right' : null } : { ...heads, half: heads.wide ? 'right' : null };
  return { heads: h, tails: t };
}

// a coin a person makes: its metal, a short word or emoji on each side, the words around the rim, and maybe a photo for a side (kept small)
export const METALS = { gold: ['#fff2b3', '#f4c542', '#b8860b', '#5a4106'], silver: ['#ffffff', '#d7dbe0', '#9aa1aa', '#3b4047'], copper: ['#ffd1b3', '#d9824b', '#8a4a22', '#4a220c'],
  bronze: ['#f3dfb0', '#c49a52', '#7c5a24', '#3e2c0c'], rose: ['#ffe3ea', '#f2a6b8', '#b5657a', '#5a2232'], black: ['#9aa1aa', '#3b4047', '#15181c', '#e6e6e6'] };
export const MINE_KEY = 'a2m.void.coin.mine.v1';
/** a made coin cleaned to what may be kept: known metal, at most 6 characters a side, 40 around the rim, photos only as small data URLs. Pure. */
export function cleanMine(c) {
  const s = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  const img = (v) => (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(String(v || '')) && String(v).length < 120000 ? String(v) : '');
  return { metal: METALS[c && c.metal] ? c.metal : 'gold', heads: s(c && c.heads, 6) || 'H', tails: s(c && c.tails, 6) || 'T', rim: s(c && c.rim, 40), year: s(c && c.year, 4), hImg: img(c && c.hImg), tImg: img(c && c.tImg) };
}
/** a metal's face as a CSS background. Pure. */
export const metalFace = (m) => { const c = METALS[m] || METALS.gold; return 'radial-gradient(circle at 35% 30%,' + c[0] + ',' + c[1] + ' 40%,' + c[2] + ' 75%,' + c[3] + ')'; };

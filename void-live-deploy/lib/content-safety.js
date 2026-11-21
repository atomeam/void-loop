// Shared text-safety blocklist for answer and meanings cards. noPhotoAsk uses lib/image-safety.js. Pure. Tests: tools/safe-meanings.test.mjs
import { unsafeText } from './image-safety.js';

export const SHOCK_HOSTS = [
  'rotten.com', 'bestgore.com', 'goregrish.com', 'theync.com', 'kaotic.com',
  'ogrof.com', 'documentingreality.com', 'liveleak.com',
];

export const UNSAFE_CATEGORY = /\b(?:pornograph(?:y|ic)?|erotic(?:a|a\b)|sexual acts?|sexual slang|paraphil|bdsm|fetish(?:es)?|snuff|shock sites?|graphic violence|extreme pornography|child sexual|child porn|non-consensual|ethnic slurs?|racial slurs?|pejorative terms for)\b/i;

const CRUDE = /\b(?:dick\s*pics?|breast torture|coprophil\w*|scat\s*(?:porn|sex|fetish)|shemale|futanari|onlyfans|rule\s*34|hentai|child\s*porn|lolicon|shotacon|bestiality|necrophil\w*|snuff\s*(?:film|video|site)|gore\s*site|boobs on bikes|nude (?:beach|children|child|kids?))\b/i;
const SEXUAL = /\b(?:porn\w*|nsfw|\bxxx\b|erotic\w*|fetish\w*|orgy|genital\w*|bdsm|bondage|incest\w*|rape\w*|handjob|blowjob|cumshot|dildo|onlyfans)\b/i;
const VIOLENT = /\b(?:beheading|decapitat\w*|disembowel\w*|best gore|graphic violence|torture porn|snuff)\b/i;
const SLUR = /\b(?:nigg(?:er|a)\b|faggot\b|tranny\b|retard(?:ed)?\b|kike\b|spic\b|wetback\b|chink\b)\b/i;

export function hostOf(url) {
  try { return new URL(String(url || ''), 'https://x.invalid').hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; }
}

export function isShockHost(url) {
  const h = hostOf(url);
  return !!h && SHOCK_HOSTS.some((d) => h === d || h.endsWith('.' + d));
}

function categoryText(categories) {
  if (!categories) return '';
  if (typeof categories === 'string') return categories;
  return (Array.isArray(categories) ? categories : []).map((c) => (c && (c.title || c)).toString().replace(/^Category:/, '')).join(' ; ');
}

export function flagsOf({ title = '', text = '', url = '', categories } = {}) {
  const head = String(title || ''), body = String(text || ''), blob = head + ' ' + body, flags = [];
  if (isShockHost(url) || /\brotten\.com\b/i.test(blob)) flags.push('shock');
  if (UNSAFE_CATEGORY.test(categoryText(categories))) {
    const cats = categoryText(categories);
    if (/\b(?:shock sites?|graphic violence|snuff|best gore)\b/i.test(cats)) flags.push('shock');
    if (/\b(?:ethnic slurs?|racial slurs?|pejorative terms for)\b/i.test(cats)) flags.push('slur');
    if (/\b(?:graphic violence)\b/i.test(cats)) flags.push('violent');
    if (/\b(?:pornograph(?:y|ic)?|erotic|sexual acts?|sexual slang|paraphil|bdsm|fetish|child sexual|child porn|non-consensual|extreme pornography)\b/i.test(cats)) flags.push('sexual');
  }
  if (CRUDE.test(head) || CRUDE.test(body)) {
    if (/\b(?:breast torture|beheading|gore\s*site|snuff|nude (?:children|child|kids?))\b/i.test(blob)) flags.push('violent');
    if (/\b(?:dick\s*pics?|coprophil|shemale|futanari|onlyfans|hentai|boobs on bikes|scat\s*(?:porn|sex|fetish)|nude beach)\b/i.test(blob)) flags.push('sexual');
    if (!flags.length) flags.push('adult');
  }
  if (SEXUAL.test(head) || SEXUAL.test(body)) flags.push('sexual');
  if (VIOLENT.test(head) || VIOLENT.test(body)) flags.push('violent');
  if (SLUR.test(head) || SLUR.test(body)) flags.push('slur');
  return [...new Set(flags)];
}

export const isSafe = (entry) => flagsOf(entry).length === 0;

const NAMED_WORK = /\b(?:moby[ -]?dick|dick van dyke|philip k\.?\s*dick|dick grayson|dick cheney|dick \(nickname\)|youtube poop|poop deck)\b/i;
export function noPhotoAsk(ask) {
  if (NAMED_WORK.test(String(ask || '')) && !/\b(?:nude|naked|porn|pic|boob|titt)\b/i.test(String(ask || ''))) return false;
  return !!unsafeText(ask);
}

const WORDS = new Set(`a an the of in on at to for and or is are was were be been being it this that with from by as not but if so we you he she they i me my our your about into over after before between than then also just only very what who when where which how can will would could should may might must up out off on down all any each every some no none one two first last new old same other more most many few such own both people person man woman child boy girl time day year week world life way work home house place school water food money name names named book books cream ice social security real estate purple elephant matrix baseball pluto toast anxiety avocado cat dog car city state country tree river mountain ocean music film movie song game team company government question system number group part case hand word letter naked boob boobs boobie boobies tit tits titty titties poop poo dick`.split(/\s+/));

const typoTokens = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && w.length > 1 && !/^(?:a|an|the|of|in|on|at|to|for|and|or)$/.test(w));
const isKnownWord = (w) => WORDS.has(w) || (w.length > 3 && w.endsWith('s') && WORDS.has(w.slice(0, -1)));
const foldAsk = (s) => String(s || '').toLowerCase().replace(/[?.!]+$/g, '').replace(/\s+/g, ' ').trim();
const SLANG = /^(?:boobs?|boobies|tits?|titties|titty|tittie)$/;
const ADULT_RE = /\b(?:boobs?|boobies|tits?|titties|titty|tittie|naked|nude|porn\w*|nsfw|xxx)\b/i;
const ADJ = /^(?:black|white|big|huge|giant|small|bare|nice|hot|sexy)$/;

export function adultIntent(ask) { return ADULT_RE.test(String(ask || '')); }
export function stripAdultModifiers(ask) { return foldAsk(ask).replace(ADULT_RE, ' ').replace(/\s+/g, ' ').trim(); }

export function entityFromAdultAsk(ask) {
  if (!adultIntent(ask)) return '';
  const rest = typoTokens(stripAdultModifiers(ask)).filter((w) => !ADJ.test(w) && !SLANG.test(w));
  if (!rest.length || (rest.length === 1 && isKnownWord(rest[0]))) return '';
  return rest.join(' ');
}

export function mayCorrectTypo(typed, suggestion) {
  const a = String(typed || '').trim(), b = String(suggestion || '').trim();
  if (!a || !b || a.toLowerCase() === b.toLowerCase()) return false;
  if (adultIntent(a) && !entityFromAdultAsk(a)) return false;
  const words = typoTokens(entityFromAdultAsk(a) || a);
  if (words.some((w) => SLANG.test(w))) return false;
  if (words.length && words.every(isKnownWord)) return false;
  return true;
}


// One image-safety gate for every picture Verse shows (owner, 2026-11-20: "nude beach" put a photo of naked children on an answer card).
// Fail closed: a card, share image, OG image or API answer whose ask, title, description, text, file name or Commons categories touch nudity,
// naturism, sex, the explicit body, adult content, or minors in any such context gets NO photo, only the drawn plate or no art. Pure and
// dependency-free, so the page, the Workers and the tests all import the same file. Images of minors in a nude, partly clothed or sexual
// context are blocked everywhere with no override; adult nudity on boards is a separate, age-gated path (adultAllowed), never on cards.
const SENSITIVE = new RegExp('\\b(?:' + [
  'nud(?:e|es|ity|ism|ist|ists|ie|ies)', 'naked(?:ness)?', 'naturis[mt]s?', 'clothing[- ]optional', 'skinny[- ]?dip\\w*', 'topless', 'bottomless', 'undress\\w*', 'unclothed',
  'strip(?:per|pers|tease|ping)', 'strip ?clubs?', 'lingerie', 'bikinis?', 'swimsuits?', 'swimwear', 'underwear', 'panties', 'thongs?', 'bras?', 'nsfw', 'xxx', 'rule ?34',
  'sex(?:es|y|ual|uality|ually|ting|t)?', 'porn\\w*', 'erotic\\w*', 'fetish\\w*', 'kink\\w*', 'bdsm', 'hentai', 'onlyfans', 'camgirls?', 'obscen\\w*', 'lewd', 'smut',
  'genital\\w*', 'penis(?:es)?', 'phallus', 'phallic', 'vagina\\w*', 'vulva\\w*', 'clitor\\w*', 'testic\\w*', 'scrot\\w*', 'pubic', 'pubes', 'anus', 'anal', 'buttocks?', 'butt',
  'breasts?', 'nipples?', 'areolae?', 'boobs?', 'boobies', 'tits?', 'titties', 'titty', 'dick(?:s|pic)?', 'cock(?:s)?', 'pussy', 'cunt', 'orgasm\\w*', 'masturbat\\w*', 'ejaculat\\w*',
  'intercourse', 'coitus', 'prostitut\\w*', 'escorts?', 'brothels?', 'harlot', 'hooker\\w*', 'adult (?:film|films|video|videos|content|entertainment|industry|actor|actress|model|site|sites|star)s?',
  'circumcis\\w*', 'puberty', 'breastfeed\\w*', 'body ?paint\\w*', 'baths?', 'bath(?:e|es|ing|house|houses)', 'saunas?', 'onsen', 'banya', 'shower(?:s|ing)?', 'voyeur\\w*', 'exhibitionis\\w*',
  'incest', 'rape', 'molest\\w*', 'grooming', 'trafficking',
].join('|') + ')\\b', 'i');
// words that are never shown with any picture: abuse terms
const ABUSE = /\b(?:pedo\w*|paedo\w*|loli(?:con)?|shota(?:con)?|jailbait|csam|child (?:porn\w*|abuse|sexual\w*)|underage|preteen|cp)\b/i;
const MINOR = /\b(?:child|children|childhood|kids?|kiddie|minors?|teens?|teenagers?|adolescen\w*|boys?|girls?|schoolgirls?|schoolboys?|infants?|bab(?:y|ies)|toddlers?|youths?|juveniles?|pupils?|students?|young)\b/i;
const BODY = /\b(?:beach(?:es)?|pool|swim\w*|bath\w*|shower\w*|body|bodies|cloth\w*|dress(?:ing|ed)?|pos(?:e|es|ing)|model\w*|pageant\w*|camp\w*|gymnast\w*|massage|tan(?:ning)?|sunbath\w*|skin)\b/i;
/** the reason a set of texts must show no photo, or ''. Takes any number of strings (ask, title, description, extract, file name, categories). */
export function unsafeText(...parts) {
  const t = parts.flat(3).filter((x) => x != null).map((x) => String(x)).join(' \u2022 ').replace(/[_+%]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  if (!t.trim()) return '';
  if (ABUSE.test(t)) return 'abuse';
  if (MINOR.test(t) && (BODY.test(t) || SENSITIVE.test(t))) return 'minor-context'; // a minor word beside any nudity word is the minors block, not just adult
  if (SENSITIVE.test(t)) return 'sensitive';
  return '';
}
/** the file name a picture URL carries, decoded ("Foo_bar.jpg" from an upload.wikimedia.org thumb URL) */
export function fileNameOf(url) {
  try { const p = new URL(String(url)).pathname.split('/').filter(Boolean); const f = p.find((x) => /\.(?:jpe?g|png|gif|webp|svg|tiff?)$/i.test(x) && !/^\d+px-/.test(x)) || p[p.length - 1] || ''; return decodeURIComponent(f); } catch (_) { return ''; }
}
/** one picture: blocked when its own file name, alt, description or categories are unsafe, or the card it sits on is (context). Returns the reason or ''. */
export function unsafeImage({ url = '', alt = '', title = '', desc = '', categories = [], context = [] } = {}) {
  if (!/^https:\/\//i.test(String(url)) && !/^data:image\//i.test(String(url))) return url ? 'not-https' : '';
  return unsafeText(fileNameOf(url), alt, title, desc, categories, context);
}
/** a card: true when nothing on it may carry a photo (its heading, kind line, text, the ask). */
export function cardUnsafe(el, ask = '') {
  if (!el) return false;
  const d = el.dataset || {}, h2 = el.querySelector && el.querySelector('h2');
  return !!unsafeText(ask, d.ask || '', d.cardDesc || '', d.cardExtract || '', h2 ? h2.textContent : '', String(el.textContent || '').slice(0, 800));
}
/** removes every remote or inline photo from a card (the drawn plate stays) and marks it, so the frame, the Art Forge and Save never add one back. */
export function scrubCard(el) {
  if (!el || !el.querySelectorAll) return 0;
  let n = 0;
  for (const im of el.querySelectorAll('img')) { const s = im.getAttribute('src') || ''; if (/^(?:https?:|data:image\/(?!svg))/i.test(s) || im.srcset) { im.removeAttribute('srcset'); im.removeAttribute('src'); im.remove(); n++; } }
  for (const n2 of el.querySelectorAll('picture, source, .vc-credit')) n2.remove();
  if (el.dataset) el.dataset.imgSafe = 'blocked';
  el._vcForge = null;
  return n;
}
/** adult nudity is allowed only on boards and adult pages, for a visitor who passed age verification AND opted in; never on cards, the homepage, OG or share. */
export function adultAllowed({ surface = '', ageVerified = false, optedIn = false } = {}) {
  return (surface === 'board' || surface === 'adult-page') && ageVerified === true && optedIn === true;
}
/** minors in any nude, partly clothed or sexual context: blocked on every surface, with no override (boards and uploads too). */
export const minorBlocked = (reason) => reason === 'abuse' || reason === 'minor-context';

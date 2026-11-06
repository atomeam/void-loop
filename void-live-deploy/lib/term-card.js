// A term card (owner, 2026-11-06, the Treasury card: "also treasury should lead us to our treasury"; "its ok for our terms to include outside
// same name sources and definitions too"). A knowledge card about a word is laid out in this order:
//   1. Verse's own page for the term, when there is one: its link and one line of its live state, read from what that page itself serves
//      (a page names its live data with <meta name="verse-state" content="/api/x /x/found.json">). No data read: the link alone.
//   2. the outside meanings of the same name, each its own labelled sense with its own cited source (Wikipedia's "X is either:" lead is
//      two senses, never one glued paragraph).
//   3. the picture and Verse's take sit under the one sense they match; a sense with no matching picture gets none, a take that is
//      grounded in no sense (or in Verse's own page) is not shown.
// Pure, except termPage(), which is handed its fetch. void.html's article card calls these; lib/card-frame.js reads data-card-adds.
import { PAGE_PATHS, addsLine } from './card-frame.js';
import { sharedWords, singular, words } from '../skills/take.js';

export { singular };
/** a term as Verse files it: lower case, trimmed, no "(disambiguation)" or other bracket, the last word singular. Pure. */
export function normTerm(t) {
  const w = words(String(t || '').replace(/\([^)]*\)/g, ' '));
  if (!w.length) return '';
  w[w.length - 1] = singular(w[w.length - 1]);
  return w.join(' ');
}
/** the page slugs a term could be: "Treasury" -> ['treasury'], "Word counts" -> ['word-count']. At most three words. Pure. */
export const slugsOf = (t) => { const n = normTerm(t); return n && n.split(' ').length <= 3 ? [n.replace(/ /g, '-')] : []; };

/** the paths of Verse's own pages the term could lead to, in order: a listed page whose name is the term (lib/card-frame.js PAGE_PATHS,
 *  the list every skill card already links from), then a page whose slug is the term. Pure. pages: { href: label }. */
export function candidatePages(title, pages = PAGE_PATHS) {
  const n = normTerm(title); if (!n) return [];
  const out = [];
  for (const [href, label] of Object.entries(pages || {})) {
    const slug = (/^\/([a-z0-9-]+)\/$/.exec(href) || [])[1] || '';
    if (normTerm(label) === n || (slug && normTerm(slug.replace(/-/g, ' ')) === n)) out.push(href);
  }
  for (const s of slugsOf(title)) out.push('/' + s + '/');
  return [...new Set(out)];
}
/** what a fetched page says about itself, or null when it is not that Verse page: its canonical link must be the path asked for (a 404 page or a
 *  redirect elsewhere is not a match). { href, name, about, state: [same-site paths, at most 2] }. Pure. */
export function pageFromHtml(html, href, origin = 'https://a-to-mind.com') {
  const h = String(html || ''); if (!h || !/^\/[a-z0-9/-]*\/$/.test(String(href || ''))) return null;
  const canon = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(h) || /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(h);
  if (!canon) return null;
  let path = ''; try { path = new URL(canon[1], origin).pathname; } catch (_) { return null; }
  if (path !== href) return null;
  const unent = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const title = unent((/<title>([^<]{1,200})<\/title>/i.exec(h) || [])[1] || '').replace(/\s*[·|]\s*Verse\s*$/i, '').trim();
  const meta = (name) => unent((new RegExp('<meta[^>]+name=["\']' + name + '["\'][^>]*content=(["\'])(.*?)\\1', 'i').exec(h) || [])[2] || '');
  const state = meta('verse-state').split(/\s+/).filter((p) => /^\/(?!\/)[A-Za-z0-9/_.-]{1,120}$/.test(p)).slice(0, 2);
  return { href, name: title || href, about: meta('description').slice(0, 300), state };
}
const usd = (c) => '$' + (Math.abs(c) / 100).toFixed(2);
const day = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''; };
/** one short line of a page's live state, only from the numbers its own data holds: a balance (balance_cents), counts (counts: { name: n }),
 *  and the newest as_of. '' when none of them is there: the card then shows the link alone, never a made-up figure. Pure. */
export function stateLine(datas) {
  const parts = []; let asOf = '';
  for (const d of Array.isArray(datas) ? datas : [datas]) {
    if (!d || typeof d !== 'object' || d.error) continue;
    if (Number.isFinite(d.balance_cents)) parts.push('balance ' + (d.balance_cents < 0 ? '-' : '') + usd(d.balance_cents));
    if (d.counts && typeof d.counts === 'object') for (const [k, v] of Object.entries(d.counts).filter(([, v]) => Number.isFinite(v)).slice(0, 3)) parts.push(v + ' ' + k.replace(/_/g, ' '));
    if (typeof d.as_of === 'string' && Date.parse(d.as_of) > Date.parse(asOf || 0)) asOf = d.as_of;
  }
  if (!parts.length) return '';
  return parts.join(', ') + (asOf ? ' (as of ' + day(asOf) + ')' : '');
}
/** Verse's own page for a term, read live: { href, name, about, line } or null. getText(path) -> html or '', getJson(path) -> object or null.
 *  Never throws. */
export async function termPage(title, getText, getJson) {
  for (const href of candidatePages(title)) {
    let p = null; try { p = pageFromHtml(await getText(href), href); } catch (_) { p = null; }
    if (!p) continue;
    let datas = []; try { datas = await Promise.all(p.state.map((u) => Promise.resolve(getJson(u)).catch(() => null))); } catch (_) { datas = []; }
    return { href: p.href, name: p.name, about: p.about, line: stateLine(datas) };
  }
  return null;
}

/** "either:a" -> "either: a": a colon glued to the next word gets its space back (Wikipedia's text extract drops it before a list). Times,
 *  verses and links keep theirs. Pure. */
export const fixColons = (s) => String(s == null ? '' : s).replace(/([A-Za-zÀ-ɏ]):(?=[A-Za-zÀ-ɏ])/g, '$1: ');
/** a lead split into what it says: { intro, senses, paras }. "A treasury is either:" followed by list items (the text extract joins them with
 *  line breaks) is an intro and two senses; a lead with no such list is its paragraphs and no senses. Pure. */
export function leadParts(extract) {
  const lines = fixColons(extract).split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const first = lines[0] || '', at = first.indexOf(': ');
  if (lines.length >= 2 && at > 0 && at < 160) {
    const intro = first.slice(0, at + 1), head = first.slice(at + 2).trim();
    const senses = [head, ...lines.slice(1)].map((s) => s.replace(/[;,]\s*(?:or|and)?\s*$/i, '').trim()).filter(Boolean);
    if (senses.length >= 2) return { intro, senses, paras: [] };
  }
  return { intro: '', senses: [], paras: lines };
}
const GENERIC_FILE = new Set(['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif', 'tif', 'tiff', 'file', 'image', 'img', 'photo', 'picture', 'crop', 'cropped', 'edit', 'edited', 'dsc', 'img', 'front', 'view', 'side', 'the', 'and', 'from', 'with', 'original', 'version', 'restored', 'restoration', 'retouched', 'thumb', 'commons', 'wiki']);
/** the words of an image file's name, from its URL (".../thumb/a/ab/Treasury_Casino.jpg/640px-Treasury_Casino.jpg" -> treasury, casino). Pure. */
export function fileWords(src) {
  let name = String(src || '').split('?')[0].split('/').pop() || '';
  try { name = decodeURIComponent(name); } catch (_) {}
  name = name.replace(/^\d+px-/, '').replace(/\.[a-z0-9]{2,5}$/i, '');
  return words(name).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !GENERIC_FILE.has(w)).map(singular);
}
/** whether a picture is of what the card is about. No: the lead lists several senses (a picture can be of one of them at most, and it
 *  belongs to none in particular), or the file's name holds words and none of them is in the title or the lead (the Brisbane building on a
 *  card about the idea of a treasury). A file name with no words is not judged. own: the picture was taken from the article's own photos
 *  (lib/page-picture.js, which leaves out its logos, icons, flags and maps), so it is of the subject by where it comes from and its file
 *  name, which names the scene ("Seoul concert" on the K-pop card, owner, 2026-10-17), is not judged; the senses rule still holds. Pure. */
export function imageFits({ title = '', extract = '', src = '', own = false } = {}) {
  if (!/^https:\/\//.test(String(src || ''))) return false;
  if (leadParts(extract).senses.length >= 2) return false;
  if (own) return true;
  const fw = fileWords(src); if (!fw.length) return true;
  const known = new Set([...words(title), ...words(extract)].map(singular));
  return fw.some((w) => known.has(w));
}
/** where Verse's take belongs: the key of the ground (a sense, or Verse's own page) it shares the most content words with, at least two that
 *  are not the term itself; null when it is grounded in none (the take is then not shown). grounds: [{ key, text }]. Pure. */
export function bindTake(take, grounds, title = '') {
  let best = null, most = 1;
  for (const g of grounds || []) { const n = sharedWords(take, g && g.text, title); if (n > most) { most = n; best = g.key; } }
  return best;
}
/** the Adds to Verse line: what this card filed, from what it holds, or '' (the line is then left off). Pure. */
export function addsFor({ title = '', desc = '', senses = [], source = 'Wikipedia', page = null } = {}) {
  const term = normTerm(title); if (!term) return '';
  const lead = page && page.href ? 'Links the term ' + term + ' to Verse’s own page, ' + page.name + ' (' + page.href + ')' : '';
  // the senses are named only when the whole line fits, so the line never ends inside one of them; else it gives their number and source
  const listed = 'The term ' + term + ', in ' + senses.length + ' senses from ' + source + ': ' + senses.map((x) => x.replace(/[.;,]+$/, '')).join('; ') + '.';
  const outside = senses.length >= 2 ? (listed.length <= 240 ? listed : 'The term ' + term + ', in ' + senses.length + ' senses from ' + source + '.') : desc ? 'The term ' + term + ', in ' + source + '’s sense: ' + desc.charAt(0).toLowerCase() + desc.slice(1).replace(/\.$/, '') + '.' : '';
  if (lead) return addsLine(lead + (outside ? ', then ' + (senses.length >= 2 ? senses.length + ' senses from ' + source : source + '’s sense') : '') + '.');
  return outside ? addsLine(outside) : '';
}
/** Verse's own page block, first on the card: the link and its live line (or the link alone), and a slot for a take grounded in it. Pure. */
export function verseHtml(esc, page, asks = []) {
  if (!page && !(asks || []).length) return '';
  return '<div class="vt-verse" data-term-verse="1"><div class="vt-label">On Verse</div>'
    + (page ? '<a class="vt-page" href="' + esc(page.href) + '">' + esc(page.name) + ' →</a>' + (page.line ? '<div class="vt-state">' + esc(page.line) + '</div>' : '') : '')
    + (asks || []).map((x) => '<a href="#" data-ask="' + esc(x.ask) + '" style="display:inline-block;margin:2px 10px 2px 0">' + esc(x.label) + ' →</a>').join('')
    + '<div class="take-slot" data-sense="verse"></div></div>';
}
/** the outside senses, each its own labelled block with its own cited source and a slot for its take. Pure. */
export function sensesHtml(esc, { intro = '', senses = [], source = 'Wikipedia', url = '' } = {}) {
  if (senses.length < 2) return '';
  const cite = url ? '<div class="vt-cite" data-share-skip>Source: <a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(source) + '</a></div>' : '';
  return (intro ? '<p class="vt-intro">' + esc(intro) + '</p>' : '')
    + senses.map((s, i) => '<div class="vt-sense" data-sense="' + i + '"><div class="vt-label">Sense ' + (i + 1) + ' · ' + esc(source) + '</div><p>' + esc(s) + '</p><div class="take-slot" data-sense="' + i + '"></div>' + cite + '</div>').join('');
}
export const TERM_CSS = '.vt-verse,.vt-sense{margin:8px 0 10px;padding:6px 0 6px 10px;border-left:2px solid rgba(255,255,255,.14)}.vt-verse{border-left-color:var(--accent,#8ea2ff)}.vt-label{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c7d2ff;margin-bottom:3px}.vt-page{font-weight:600}.vt-state,.vt-cite{font-size:12.5px;color:#a9afc4;margin-top:2px}.vt-sense p{margin:0 0 4px}';

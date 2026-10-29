/**
 * wiki-look: what a subject really looks like, from Wikipedia (owner, 2026-10-24: the cartoon of "dimebag darrel" was a made-up guitarist, because a text
 * model describes a person from memory, and a wrong memory is drawn faithfully; "make sure it corrects the spelling too"). For a typed name:
 *   1. Wikipedia's own search finds the page (it forgives a misspelling), and its title is the usual spelling;
 *   2. the page's summary gives its lead photo (Wikimedia's own image hosts only, a small thumbnail);
 *   3. the vision model describes that photo in plain visual words (functions/api/card-art.js), and the cartoon is drawn from the description.
 * The page is used only when its title is the same name as the one asked (spellingOf: a third of the letters at most, the same words), so
 * "zorblax" never becomes whatever page Wikipedia ranks first. Fixed hosts, no key; a photo is read for one description and dropped, never stored; only
 * the description (words) reaches the painter. Every step has a timeout and any failure gives null, so the cartoon falls back to the text model's look.
 * Tests: tools/wiki-look.test.mjs.
 */
import { spellingOf } from './art-rules.js';

const WIKI = 'https://en.wikipedia.org';
const IMG_HOST = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//; // Wikimedia's own image hosts (2026-10-24: Commons now answers thumburl on thumb.wikimedia.org)
export const MAX_PHOTO = 600000; // bytes of the thumbnail we will read
const UA = { 'user-agent': 'Verse/1 (https://a-to-mind.com; reads a Wikipedia page summary and its lead photo once per cartoon)', accept: 'application/json' };

const plainTitle = (t) => String(t || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
const withTimeout = (get, url, opts, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return get(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t)); };

/** the Wikipedia page a typed name means: { title, usual } (usual: the name as it is usually spelled, '' when the page's name is not the asked one), or null. */
export async function pageFor(asked, get = fetch, why = []) {
  const q = String(asked || '').replace(/[^\p{L}\p{N} '.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (q.length < 2) { why.push('name too short'); return null; }
  try {
    const r = await withTimeout(get, WIKI + '/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=' + encodeURIComponent(q), { headers: UA }, 5000);
    if (!r.ok) { why.push('search ' + r.status); return null; } const j = await r.json(), hit = j && j.query && j.query.search && j.query.search[0];
    if (!hit || !hit.title) { why.push('no search hit'); return null; }
    const usual = spellingOf(q, plainTitle(hit.title)); // the same name, near enough letter for letter
    if (!usual) why.push('top page "' + String(hit.title).replace(/[^A-Za-z0-9 .,'-]/g, ' ').slice(0, 40) + '" is not that name');
    return usual ? { title: String(hit.title), usual } : null;
  } catch (e) { why.push('search error ' + String((e && e.message) || e).replace(/[^A-Za-z0-9 .:-]/g, ' ').slice(0, 40)); return null; }
}

/** the free photo Wikidata names for an item (its P18 image, a Wikimedia Commons file): the address of a 320 px version of it on Wikimedia's image hosts, or ''. */
async function commonsPhoto(item, get, why) {
  if (!/^Q\d{1,12}$/.test(String(item || ''))) { why.push('no wikidata item'); return ''; }
  try {
    const r = await withTimeout(get, 'https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&property=P18&entity=' + item, { headers: UA }, 5000);
    if (!r.ok) { why.push('wikidata ' + r.status); return ''; } const j = await r.json(), file = j && j.claims && j.claims.P18 && j.claims.P18[0] && j.claims.P18[0].mainsnak && j.claims.P18[0].mainsnak.datavalue && j.claims.P18[0].mainsnak.datavalue.value;
    if (!file || typeof file !== 'string' || file.length > 200 || !/\.(?:jpe?g|png|webp)$/i.test(file)) { why.push(file ? 'wikidata image is not a jpeg, png or webp' : 'no wikidata image'); return ''; }
    // the direct 320 px address from Commons' own API (not Special:FilePath, whose redirect a Worker may not report the end of)
    const c = await withTimeout(get, 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=320&titles=' + encodeURIComponent('File:' + file), { headers: UA }, 5000);
    if (!c.ok) { why.push('commons ' + c.status); return ''; } const cj = await c.json(), pages = cj && cj.query && cj.query.pages, page = pages && Object.values(pages)[0], info = page && page.imageinfo && page.imageinfo[0];
    // Commons may write the address protocol-relative ("//upload...") or as http (2026-10-24: a real thumburl failed the https check, so the photo was lost)
    const url = String((info && (info.thumburl || info.url)) || '').replace(/^\/\//, 'https://').replace(/^http:\/\//, 'https://');
    if (!url || !IMG_HOST.test(url)) { why.push('commons gave no Wikimedia address for "' + file.replace(/[^A-Za-z0-9 .,'()_-]/g, ' ').slice(0, 50) + '": ' + (url ? 'it gave ' + url.replace(/[^A-Za-z0-9:/._-]/g, ' ').slice(0, 50) : 'none')); return ''; }
    return url;
  } catch (e) { why.push('wikidata error ' + String((e && e.message) || e).replace(/[^A-Za-z0-9 .:-]/g, ' ').slice(0, 40)); return ''; }
}

/** the page's lead photo as a data URL, with the page's one-line description: { img, description, usual }, or null (no page, a disambiguation, no photo, a photo off Wikimedia or too big). */
export async function leadPhoto(asked, get = fetch, why = []) {
  const page = await pageFor(asked, get, why); if (!page) return null;
  try {
    const r = await withTimeout(get, WIKI + '/api/rest_v1/page/summary/' + encodeURIComponent(page.title.replace(/ /g, '_')), { headers: UA }, 5000);
    if (!r.ok) { why.push('summary ' + r.status); return null; } const s = await r.json();
    if (!s || s.type !== 'standard') { why.push('page type ' + String(s && s.type).slice(0, 20)); return null; }
    // English Wikipedia leaves non-free (fair-use) photos out of its page images, which is most photos of a person who has died or is not free-licensed: then the
    // Wikidata image (P18), always a free Commons file, is the next source
    let src = s.thumbnail && s.thumbnail.source;
    if (src) src = String(src).replace(/^\/\//, 'https://').replace(/^http:\/\//, 'https://');
    if (!src || !IMG_HOST.test(src)) { src = await commonsPhoto(s.wikibase_item, get, why); if (!src) { why.push('no free photo'); return null; } }
    const p = await withTimeout(get, src, { headers: { 'user-agent': UA['user-agent'] } }, 6000);
    const ct = String((p.headers && p.headers.get && p.headers.get('content-type')) || '').split(';')[0].trim().toLowerCase();
    if (!p.ok || !/^image\/(?:jpeg|png|webp)$/.test(ct)) { why.push('photo ' + p.status + ' ' + ct.slice(0, 20)); return null; }
    const buf = new Uint8Array(await p.arrayBuffer()); if (!buf.length || buf.length > MAX_PHOTO) { why.push('photo size ' + buf.length); return null; }
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { img: 'data:' + ct + ';base64,' + btoa(bin), description: String(s.description || '').replace(/[^A-Za-z0-9 ,.'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), usual: page.usual };
  } catch (e) { why.push('photo error ' + String((e && e.message) || e).replace(/[^A-Za-z0-9 .:-]/g, ' ').slice(0, 40)); return null; }
}

/** what the vision model is asked about the photo. It sees the picture; nothing a person typed goes with it. */
export const PHOTO_ASK = 'Describe what is in this photo so an illustrator who cannot see it can draw a cartoon of the same subject and anyone who knows the subject recognises it. '
  + 'In at most 55 words, plain visual words only: for a person their age, build, hair (length, curl, colour), facial hair (shape, and its colour if dyed), face, glasses, and their clothes piece by piece; '
  + 'the exact shape and colour of anything held or worn (an instrument, a necklace, a hat); for anything else its shape, colours and parts. '
  + 'No names, no brands, no words or letters, no background. One line only.';

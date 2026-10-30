// Real pictures for the daily art helper (owner, 2026-10-26: "no like actual pictures of the games"), the rules half; functions/api/daily-art.js fetches and keeps.
// What may be shown, in this order, and what never is:
//   1. an official embed: a YouTube video the page names, shown through YouTube's own embed with its credit, only when YouTube's oEmbed says the video belongs to
//      an official channel on the list below (nothing copied, nothing proxied). X and Instagram need their own scripts on our pages, which the page security policy
//      does not allow, so they are not used.
//   2. an openly licensed photo from Wikimedia Commons, then Openverse: ONLY CC0, CC BY and CC BY-SA (a non-commercial, no-derivatives, public-domain-mark or
//      unstated licence is refused), with the author, the licence and its link and the source page kept with it, shown under the picture and never dropped; only
//      resized (the sources' own thumbnails), never edited. A picture whose words suggest children, schools or youth sport, or that has nothing to do with sport,
//      is refused (a heuristic: the report link and the owner's delete are the backstop).
//   3. TheSportsDB's event picture, linked through (never stored), credited "Image: TheSportsDB": OFF until the owner sets THESPORTSDB_KEY after reading its terms.
//   4. otherwise the Verse illustration (lib/daily-art.js), labelled "Illustration by Verse".
// Agency and league sites are never fetched. The label is always the true source, never "Verse photo". Pure. Tests: tools/daily-photo.test.mjs.
import { SEXUAL, HATE } from './art-rules.js';
import { refusalOf } from './image-gen.js';
import { hash, REPORT_MAIL, LABEL } from './daily-art.js';

export const MAX_BYTES = 330000, ID_RE = /^[a-f0-9]{12}$/, YT_RE = /^[A-Za-z0-9_-]{11}$/;
/** the web addresses the route may fetch from, and no others (the three APIs, their image hosts, and YouTube's oEmbed). */
export const HOSTS = Object.freeze({ commons: 'commons.wikimedia.org', commonsImages: 'upload.wikimedia.org', openverse: 'api.openverse.org', sportsdb: 'www.thesportsdb.com', youtube: 'www.youtube.com' });
export const UA = 'Verse/1.0 (https://a-to-mind.com; atom@a-to-mind.com)';

/** a typed event line (teams, venue, event) cut to what a search needs: letters, digits, spaces and . ' & -, 80 characters; '' when nothing is left. Pure. */
export const cleanQuery = (v) => String(v == null ? '' : v).normalize('NFKC').replace(/[^\p{L}\p{N} .'&-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
/** why a query is not searched: '' or a reason (rude words, a request for real people as such). Pure. */
export function queryProblem(q) {
  const t = cleanQuery(q); if (t.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return 'too short';
  if (SEXUAL.test(t.toLowerCase()) || HATE.test(t.toLowerCase())) return 'unsuitable';
  const r = refusalOf(t, '', 'none'); return r && r !== 'person' ? r : (r === 'person' ? 'person' : '');
}
const tokens = (q) => [...new Set((String(q).toLowerCase().match(/\p{L}{4,}/gu) || []))].slice(0, 8);

// ---- the licence filter ----
/** whether a licence is one we may show, and its canonical name and address: { ok, code: 'cc0'|'by'|'by-sa', name, url } or { ok: false, why }. `version` fills one a
 *  source gives apart from the name. Pure. */
export function licenceOf(raw, version = '') {
  const s = String(raw == null ? '' : raw).toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return { ok: false, why: 'no licence stated' };
  if (/(^|[ -])(NC|ND)([ -]|$)/.test(s)) return { ok: false, why: 'a non-commercial or no-derivatives licence: ' + s.slice(0, 30) };
  if (/^(?:CC[ -]?0(?:[ -]1\.0)?(?: UNIVERSAL)?|CC-ZERO)$/.test(s)) return { ok: true, code: 'cc0', name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  let m = /^CC[ -]BY[ -]SA(?:[ -](\d\.\d))?(?:[ -]([A-Z]{2,3}))?$/.exec(s), code = 'by-sa', label = 'CC BY-SA';
  if (!m) { m = /^CC[ -]BY(?:[ -](\d\.\d))?(?:[ -]([A-Z]{2,3}))?$/.exec(s); code = 'by'; label = 'CC BY'; }
  if (!m) return { ok: false, why: 'not CC0, CC BY or CC BY-SA: ' + s.slice(0, 30) };
  const v = m[1] || String(version || ''); if (!/^\d\.\d$/.test(v)) return { ok: false, why: 'no licence version' };
  const port = m[2] ? m[2].toLowerCase() : '';
  return { ok: true, code, name: label + ' ' + v + (port ? ' ' + port.toUpperCase() : ''), url: 'https://creativecommons.org/licenses/' + code + '/' + v + '/' + (port ? port + '/' : '') };
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** html from a source's metadata field as plain text (tags out, entities decoded, cut). Pure. */
export const stripHtml = (h, max = 160) => String(h == null ? '' : h).replace(/<[^>]*>/g, ' ').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : ' '; } return ENT[e.toLowerCase()] || ' '; }).replace(/\s+/g, ' ').trim().slice(0, max);
const httpsUrl = (u) => { try { const x = new URL(String(u).startsWith('//') ? 'https:' + u : String(u)); return x.protocol === 'https:' ? x.href : ''; } catch (_) { return ''; } };
const dayIn = (v) => { const t = stripHtml(v, 60), m = /(\d{4})[-:/](\d{2})[-:/](\d{2})/.exec(t); return m ? m[1] + '-' + m[2] + '-' + m[3] : (/\b((?:19|20)\d{2})\b/.exec(t) || [])[1] || ''; };

// ---- the context filter: sport, and not children ----
export const SPORT = /\b(?:sports?|games?|match(?:es)?|stadium|stadion|arena|ballpark|pitch|court|rink|football|soccer|basketball|baseball|hockey|tennis|golf|cricket|rugby|racing|race|grand prix|formula|league|cup|championship|tournament|team|club|fc|nba|nfl|mlb|nhl|mls|ncaa|uefa|fifa|olympics?|athletics?|player|players|goal|circuit|boxing|mma|ufc)\b/i;
export const BLOCK = /\b(?:child|children|kids?|boys?|girls?|youth|junior|juniors|schoolboys?|schoolgirls?|schools?|infant|baby|toddler|students?|minors?|teens?|teenagers?|under[- ]?1\d|u[- ]?1\d|academy|little league|pee[- ]?wee|cadets?|nude|naked)\b/i;
/** whether a picture's own words (title, description, tags, categories) are about sport and not about children or anything rude: { ok, why }. Pure. */
export function contextOk(text, q = '', sportKnown = false) {
  const t = String(text || '').toLowerCase();
  if (BLOCK.test(t) || SEXUAL.test(t) || HATE.test(t)) return { ok: false, why: 'its words suggest children, a school or something unsuitable' };
  if (!sportKnown && !SPORT.test(t)) return { ok: false, why: 'its words are not about sport' }; // a sports database's events are about sport by what they are
  const tk = tokens(q); if (tk.length && !tk.some((w) => t.includes(w))) return { ok: false, why: 'nothing in its words matches the search' };
  return { ok: true, why: '' };
}

// ---- reading what the sources return ----
/** Wikimedia Commons' query result (generator=search, prop=imageinfo with extmetadata and a thumbnail) as candidates. Pure. */
export function parseCommons(j) {
  const pages = (j && j.query && j.query.pages) || {}, out = [];
  for (const p of Object.values(pages)) {
    const ii = p && p.imageinfo && p.imageinfo[0]; if (!ii || !/^image\/(?:jpeg|png)$/.test(ii.mime || '')) continue;
    const m = ii.extmetadata || {}, v = (k) => (m[k] && m[k].value != null ? m[k].value : ''), artist = v('Artist');
    const href = /href=["']([^"']+)["']/i.exec(String(artist)), thumb = httpsUrl(ii.thumburl || '');
    if (!thumb || !/^(?:upload|thumb)\.wikimedia\.org$/.test(new URL(thumb).hostname)) continue;
    if (/^true$/i.test(stripHtml(v('NonFree'), 10)) || /personality/i.test(stripHtml(v('Restrictions'), 80))) { out.push({ source: 'commons', rejected: 'marked non-free or with personality rights', title: String(p.title || '') }); continue; }
    out.push({ source: 'commons', title: stripHtml(v('ObjectName') || String(p.title || '').replace(/^File:/, ''), 120), thumb, width: ii.thumbwidth || 0, height: ii.thumbheight || 0,
      author: stripHtml(artist, 100), authorUrl: href ? httpsUrl(href[1]) : '', licenceRaw: stripHtml(v('LicenseShortName'), 40), sourcePage: httpsUrl(ii.descriptionurl || ''), taken: dayIn(v('DateTimeOriginal') || v('DateTime')),
      text: [v('ObjectName'), v('ImageDescription'), v('Categories'), p.title].map((x) => stripHtml(x, 400)).join(' | ') });
  }
  return out;
}
/** Openverse's image search result as candidates (its own thumbnail address only). Pure. */
export function parseOpenverse(j) {
  const out = [];
  for (const r of ((j && j.results) || [])) {
    const thumb = httpsUrl(r.thumbnail || ''); if (!thumb || new URL(thumb).hostname !== HOSTS.openverse) continue;
    const code = String(r.license || '').toLowerCase(), raw = code === 'cc0' ? 'CC0 1.0' : code === 'by' ? 'CC BY ' + (r.license_version || '') : code === 'by-sa' ? 'CC BY-SA ' + (r.license_version || '') : 'CC ' + code.toUpperCase();
    const src = String(r.source || r.provider || '').replace(/[^a-z0-9_ -]/gi, '').slice(0, 30);
    out.push({ source: 'openverse', provider: src ? src.charAt(0).toUpperCase() + src.slice(1) : '', title: stripHtml(r.title || '', 120), thumb, width: r.width || 0, height: r.height || 0, author: stripHtml(r.creator || '', 100), authorUrl: httpsUrl(r.creator_url || ''),
      licenceRaw: raw, sourcePage: httpsUrl(r.foreign_landing_url || ''), taken: '', mature: !!r.mature, text: [r.title, (r.tags || []).map((t) => t && t.name).join(' ')].map((x) => stripHtml(x, 400)).join(' | ') });
  }
  return out;
}
/** TheSportsDB's event search result as link-through candidates (never stored). Pure. */
export function parseSportsDb(j) {
  const out = [];
  for (const e of ((j && j.event) || (j && j.events) || [])) {
    const link = httpsUrl(e && (e.strThumb || e.strPoster || e.strBanner) || ''); if (!link) continue;
    const host = new URL(link).hostname; if (!/^(?:r2\.|www\.)?thesportsdb\.com$/.test(host)) continue;
    out.push({ source: 'thesportsdb', title: stripHtml(e.strEvent || '', 120), link, taken: /^\d{4}-\d{2}-\d{2}$/.test(e.dateEvent || '') ? e.dateEvent : '', sourcePage: e.idEvent ? 'https://www.thesportsdb.com/event/' + String(e.idEvent).replace(/\D/g, '').slice(0, 12) : 'https://www.thesportsdb.com/', author: '', text: stripHtml(e.strEvent, 200) });
  }
  return out;
}

/** Flickr's licence ids we accept, and nothing else (ids from memory, NOT checked against flickr.photos.licenses.getInfo: the owner's diag lists what Flickr says they are):
 *  4 CC BY 2.0, 5 CC BY-SA 2.0, 9 CC0 1.0, 11 CC BY 4.0, 12 CC BY-SA 4.0. Public Domain Mark (10), "no known copyright" (7), US government (8), NC, ND and all rights reserved are left out. */
export const FLICKR_LICENCES = Object.freeze({ 4: 'CC BY 2.0', 5: 'CC BY-SA 2.0', 9: 'CC0 1.0', 11: 'CC BY 4.0', 12: 'CC BY-SA 4.0' });
/** Flickr's photos.search answer (extras: license, owner_name, date_taken, tags, description, url_c, url_l) as link-through candidates (its static address, never stored). Pure. */
export function parseFlickr(j) {
  const out = [];
  for (const p of ((j && j.photos && j.photos.photo) || [])) {
    const id = String(p.id || '').replace(/\D/g, ''), owner = String(p.owner || '').replace(/[^A-Za-z0-9@_-]/g, '');
    const link = httpsUrl(p.url_c || p.url_l || ''); if (!id || !owner || !link) continue;
    if (!/^(?:live|farm\d+|c\d+)\.staticflickr\.com$/.test(new URL(link).hostname)) continue;
    const lic = FLICKR_LICENCES[Number(p.license)];
    out.push({ source: 'flickr', title: stripHtml(p.title || '', 120), link, width: Number(p.width_c || p.width_l) || 0, height: Number(p.height_c || p.height_l) || 0, author: stripHtml(p.ownername || '', 100), authorUrl: 'https://www.flickr.com/people/' + owner + '/',
      licenceRaw: lic || 'licence id ' + String(p.license).replace(/\D/g, '') + ' not accepted', sourcePage: 'https://www.flickr.com/photos/' + owner + '/' + id, taken: dayIn(p.datetaken || ''),
      text: [p.title, p.tags, p.description && p.description._content].map((x) => stripHtml(x, 400)).join(' | ') });
  }
  return out;
}
/** sorted keepers and the refusals with their reasons: licence, attribution, context and the owner's blocked pages are all checked here, for every source. `blocked` is a
 *  Set of hash(sourcePage). Link-through candidates (TheSportsDB) skip the licence rule and are credited as theirs. Pure. */
export function filterCandidates(cands, { q = '', date = '', blocked = new Set() } = {}) {
  const ok = [], rejected = [];
  for (const c of cands || []) {
    const no = (why) => rejected.push({ title: c.title || '', source: c.source, why });
    if (c.rejected) { no(c.rejected); continue; }
    if (c.mature) { no('marked mature'); continue; }
    if (c.sourcePage && blocked.has(hash(c.sourcePage))) { no('taken down by the owner'); continue; }
    if (c.source !== 'thesportsdb') {
      const lic = licenceOf(c.licenceRaw); if (!lic.ok) { no(lic.why); continue; }
      const cand = { ...c, lic }; if (!attributionOk(cand)) { no('no author, licence or source page to credit'); continue; }
      const cx = contextOk(c.text, q); if (!cx.ok) { no(cx.why); continue; }
      ok.push({ ...cand, score: scoreOf(cand, q, date) });
    } else { const cx = contextOk(c.text, q, true); if (!cx.ok) { no(cx.why); continue; } ok.push({ ...c, lic: null, score: scoreOf(c, q, date) }); }
  }
  ok.sort((a, b) => b.score - a.score);
  return { ok, rejected };
}
/** whether a candidate can be credited in full: the licence and its link, the source page, and an author (unless it is CC0). Pure. */
export function attributionOk(c) {
  if (!c || !c.lic || !c.lic.ok || !c.lic.name || !c.lic.url || !c.sourcePage) return false;
  return c.lic.code === 'cc0' || !!c.author;
}
function scoreOf(c, q, date) {
  const t = String(c.text || '').toLowerCase(); let s = tokens(q).filter((w) => t.includes(w)).length * 10;
  if (date && c.taken === date) s += 100;
  const y = parseInt(String(c.taken).slice(0, 4), 10), now = new Date().getUTCFullYear(); if (y) s += y >= now - 1 ? 20 : y >= now - 3 ? 10 : 0;
  if (c.width >= 800) s += 5; return s;
}
/** a short id for a picture (the first 12 hex digits of its source page's hash, twice) used by reports and the owner's delete. Pure. */
export const photoId = (sourcePage) => (hash(sourcePage).toString(16).padStart(8, '0') + hash('p|' + sourcePage).toString(16).padStart(8, '0')).slice(0, 12);

// ---- the credit line ----
const where = (c) => (c.source === 'commons' ? 'Wikimedia Commons' : c.source === 'flickr' ? 'Flickr' : 'Openverse' + (c.provider ? ' (' + c.provider + ')' : ''));
/** the true credit under a picture, as segments [{ t, href? }]: "Photo: <author>, CC BY 4.0, via Wikimedia Commons", when it was taken and whether it is from this game,
 *  and the report link. Throws when a photo cannot be credited in full: a photo is never shown without it. Pure. */
export function creditFor(c, { date = '', id = '' } = {}) {
  if (c.source === 'thesportsdb') return [{ t: 'Image: ' }, { t: 'TheSportsDB', href: 'https://www.thesportsdb.com/' }, { t: ' · ' }, { t: 'Report or request removal', href: reportHref(id) }];
  if (!attributionOk(c)) throw new Error('a photo needs its author, licence and source page');
  const seg = [{ t: 'Photo: ' }, c.author ? (c.authorUrl ? { t: c.author, href: c.authorUrl } : { t: c.author }) : { t: 'author not stated' }, { t: ', ' }, { t: c.lic.name, href: c.lic.url }, { t: ', via ' }, { t: where(c), href: c.sourcePage }];
  const fromGame = !!(c.taken && date && c.taken === date);
  seg.push({ t: ' · ' + (c.taken ? 'taken ' + c.taken : 'date not stated') + (fromGame ? ' (this game)' : ' (an archive photo, not necessarily from this game)') });
  seg.push({ t: ' · ' }, { t: 'Report or request removal', href: reportHref(id) });
  return seg;
}
export const reportHref = (id) => 'mailto:' + REPORT_MAIL + '?subject=' + encodeURIComponent('Photo report ' + (id || '')) ;
export const illustrationCredit = () => [{ t: LABEL }];

// ---- official embeds ----
/** the official YouTube channels a league's highlights may come from: the end of the channel's address (its handle). From memory and NOT checked against the live site:
 *  anything not matching is refused, so a wrong entry only means no embed; the owner can add more with DAILY_ART_CHANNELS (comma separated, e.g. "/@nfl,/@somechannel"). */
export const OFFICIAL_CHANNELS = Object.freeze({
  nfl: ['/@nfl'], nba: ['/@nba'], wnba: ['/@wnba'], mlb: ['/@mlb'], nhl: ['/@nhl'], epl: ['/@premierleague'], laliga: ['/@laliga'], seriea: ['/@seriea'], bundesliga: ['/@bundesliga'],
  ligue1: ['/@ligue1ubereats', '/@ligue1'], mls: ['/@mls'], ucl: ['/@uefa', '/@uefachampionsleague'], ncaaf: ['/@ncaa'], ncaab: ['/@ncaa'], f1: ['/@formula1'],
  tennis: ['/@atptour', '/@wta', '/@wimbledon', '/@usopen', '/@rolandgarros', '/@australianopen'], golf: ['/@pgatour', '/@lpga'], cricket: ['/@icc'], rugby: ['/@worldrugby'], ufc: ['/@ufc'], olympics: ['/@olympics'],
});
/** whether a channel address belongs to the allow-list of a key (plus any extras): the address's path must END with an entry, ignoring case and a trailing slash. Pure. */
export function officialChannel(authorUrl, key, extra = '') {
  let u; try { u = new URL(String(authorUrl)); } catch (_) { return false; }
  if (u.protocol !== 'https:' || !/^(?:www\.|m\.)?youtube\.com$/.test(u.hostname)) return false;
  const path = decodeURIComponent(u.pathname).toLowerCase().replace(/\/+$/, '');
  const list = [...(OFFICIAL_CHANNELS[key] || (key === 'all' ? Object.values(OFFICIAL_CHANNELS).flat() : [])), ...String(extra || '').toLowerCase().split(',').map((s) => s.trim()).filter((s) => /^\/@?[a-z0-9_.-]{2,40}$/.test(s))];
  return list.some((e) => path === e);
}
/** YouTube's oEmbed answer for a video, checked against the key's official channels: { ok, id, title, author, authorUrl, src } or { ok: false, why }. The iframe address is made
 *  here from the video id; the answer's own html is never used. Pure. */
export function embedOf(j, id, key, extra = '') {
  if (!YT_RE.test(String(id || ''))) return { ok: false, why: 'not a video id' };
  if (!j || typeof j !== 'object' || !j.author_url) return { ok: false, why: 'no answer from the video host (embedding may be off)' };
  if (!officialChannel(j.author_url, key, extra)) return { ok: false, why: 'not from an official channel on the list' };
  const author = stripHtml(j.author_name || '', 80), title = stripHtml(j.title || '', 140), authorUrl = httpsUrl(j.author_url);
  return { ok: true, id, title, author, authorUrl, src: 'https://www.youtube-nocookie.com/embed/' + id, watch: 'https://www.youtube.com/watch?v=' + id,
    credit: [{ t: 'Video: ' }, { t: title || 'highlights', href: 'https://www.youtube.com/watch?v=' + id }, { t: ' · ' }, { t: author, href: authorUrl }, { t: ' on YouTube' }] };
}

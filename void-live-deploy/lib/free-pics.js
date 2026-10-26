// One registry of free, properly licensed picture sources (owner, 2026-10-26: "dont forget to find free pics"): real pictures for sports and for the cards, with a drawing as the
// fallback the caller keeps. No imports (Pages Functions, pages and the probe all load it). Pure parsers + one fetching function; the fetch, the cap and the cache are passed in.
//   import { findPictures } from '/lib/free-pics.js';   findPictures('epl', { kind: 'sport', date: '2026-10-25', max: 3, env, fetch, cap, cache })
//   -> [{ url, thumb, width, height, alt, creditHtmlSafeParts:{author,title,licence,licenceUrl,source,sourceUrl}, credit:{same, raw text}, licence, archive, source, hotlink }]
// RULES (docs/free-pics.md has the evidence and the dates):
//   - closed queries only: the subject is a key on SUBJECTS (a league, a sport), a word on GENERIC, or text the caller took from a fetched answer (`fromAnswer: true`). A visitor's own
//     words are never passed on: anything else returns [] without a request.
//   - licences: CC0, public domain, CC BY, CC BY-SA, and a source's own open-access licence (Pexels, Pixabay, Unsplash). NC, ND, unknown and "all rights reserved" are refused.
//   - a source without its key is skipped; each source has its own timeout; a 429 puts the source to rest; a global daily cap (lib/daily-cap.js, passed as `cap`) and an edge cache.
//   - refused: children and youth sport, sponsor/logo categories, "personality rights" marks, mature, no author/source page to credit, stock sources for named people or teams.
// Keys (GitHub and Cloudflare secrets only): PEXELS_API_KEY, PIXABAY_API_KEY, UNSPLASH_ACCESS_KEY, SMITHSONIAN_API_KEY (api.data.gov), EUROPEANA_API_KEY, FLICKR_API_KEY (+ FREE_PICS_FLICKR_COMMERCIAL=1),
//   OPENVERSE_CLIENT_ID + OPENVERSE_CLIENT_SECRET. Switches: FREE_PICS_OFF=1 (all), FREE_PICS_<ID>=0 (one source, e.g. FREE_PICS_LOC=0), FREE_PICS_DAY (global cap, default 400).
// Tests: tools/free-pics.test.mjs. Probe: tools/free-pics-probe.mjs. Playbook: docs/playbooks/free-pics.md.
export const UA = 'Verse/1.0 (https://a-to-mind.com; atom@a-to-mind.com)';
export const ALL_LICENCES = Object.freeze(['cc0', 'pd', 'by', 'by-sa', 'open-access']);
const AIC_IIIF = 'https://www.artic.edu/iiif/2';

// ---- the closed lists ----
export const SUBJECTS = Object.freeze({
  all: 'sport', nfl: 'American football', nba: 'basketball', wnba: 'basketball women', mlb: 'baseball', nhl: 'ice hockey', epl: 'Premier League football', laliga: 'La Liga football',
  seriea: 'Serie A football', bundesliga: 'Bundesliga football', ligue1: 'Ligue 1 football', mls: 'soccer stadium', ucl: 'Champions League football', ncaaf: 'college football',
  ncaab: 'college basketball', f1: 'Formula One racing', tennis: 'tennis', golf: 'golf', cricket: 'cricket', rugby: 'rugby', ufc: 'mixed martial arts', olympics: 'Olympic Games',
});
export const GENERIC = Object.freeze(['football', 'soccer', 'stadium', 'baseball', 'basketball', 'hockey', 'tennis', 'golf', 'cricket', 'rugby', 'boxing', 'cycling', 'swimming', 'athletics', 'marathon', 'skiing', 'sailing',
  'volleyball', 'handball', 'racing', 'motorsport', 'gymnastics', 'rowing', 'wrestling', 'Wembley', 'Old Trafford', 'Camp Nou', 'Yankee Stadium', 'Fenway Park', 'Wimbledon', 'Olympic Games', 'trophy', 'mountain', 'ocean', 'forest', 'city skyline',
  'moon', 'Mars', 'galaxy', 'nebula', 'space shuttle', 'eclipse', 'lion', 'elephant', 'dog', 'cat', 'bird', 'horse', 'painting', 'landscape painting', 'sculpture']);
const generic = new Set(GENERIC.map((s) => s.toLowerCase()));
/** the text to search for a subject, or '' when the subject is not on a closed list (and the caller did not take it from a fetched answer). Pure. */
export function resolveSubject(subject, { fromAnswer = false } = {}) {
  const raw = String(subject == null ? '' : subject).normalize('NFKC').replace(/[^\p{L}\p{N} .'&-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60), k = raw.toLowerCase();
  if (raw.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return '';
  if (Object.prototype.hasOwnProperty.call(SUBJECTS, k)) return SUBJECTS[k];
  if (generic.has(k)) return raw;
  if (fromAnswer && !RUDE.test(k)) return raw;
  return '';
}

// ---- the rights heuristics ----
const RUDE = /\b(?:nude|naked|porn\w*|sex\w*|erotic|fetish|gore|corpse|nazi|swastika|slur)\b/i;
export const BLOCK = /\b(?:child|children|kids?|boys?|girls?|youth|junior|juniors|schoolboys?|schoolgirls?|schools?|infant|baby|toddler|students?|minors?|teens?|teenagers?|under[- ]?1\d|u[- ]?1\d|academy|little league|pee[- ]?wee|cadets?)\b/i;
export const SPONSOR = /\b(?:logos?|sponsors?|sponsored|sponsorship|advertis\w*|billboards?|trademark|branding|merchandise|jersey sponsor)\b/i;
export const SPORT = /\b(?:sports?|games?|match(?:es)?|stadium|stadion|arena|ballpark|pitch|court|rink|football|soccer|basketball|baseball|hockey|tennis|golf|cricket|rugby|racing|race|grand prix|formula|league|cup|championship|tournament|team|club|fc|nba|nfl|mlb|nhl|olympic\w*|athlet\w*|player|boxing|cycling|swimm\w*|marathon|wrestling|fight|ufc|mma|trophy|gymnast\w*|volleyball|handball|skiing|rowing|sailing)\b/i;
const NAMED = new Set(['player', 'person', 'team', 'event']); // kinds that name people or clubs: stock sources are not used for these
const STRICT = new Set(['commons', 'openverse', 'flickr', 'archive', 'loc', 'europeana']); // sources whose words are free text: the picture's words must match the search

// ---- small helpers ----
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const stripHtml = (h, max = 160) => String(h == null ? '' : h).replace(/<[^>]*>/g, ' ').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : ' '; } return ENT[e.toLowerCase()] || ' ';
}).replace(/\s+/g, ' ').trim().slice(0, max);
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const httpsUrl = (u) => { try { const x = new URL(String(u).startsWith('//') ? 'https:' + u : String(u)); return x.protocol === 'https:' ? x.href : ''; } catch (_) { return ''; } };
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const first = (v) => { const a = arr(v); return a.length ? a[0] : ''; };
const dayIn = (v) => { const t = stripHtml(v, 60), m = /(\d{4})[-:/](\d{2})[-:/](\d{2})/.exec(t); return m ? m[1] + '-' + m[2] + '-' + m[3] : (/\b((?:1[5-9]|20)\d{2})\b/.exec(t) || [])[1] || ''; };
const toks = (q) => [...new Set(String(q).toLowerCase().match(/\p{L}{4,}/gu) || [])].slice(0, 8);
const host = (u) => { try { return new URL(u).hostname; } catch (_) { return ''; } };

// ---- the licence filter ----
/** { ok, code: 'cc0'|'pd'|'by'|'by-sa'|'open-access', name, url } or { ok: false, why }. `raw` is the source's own words, `url` its licence address (the better evidence), `own` a source's own
 *  open-access licence ({ name, url }) which is accepted only when the source says so. NC, ND, unknown and "all rights reserved" are refused. Pure. */
export function licenceOf(raw, { version = '', url = '', own = null } = {}) {
  const u = String(url || '').toLowerCase(), s = String(raw == null ? '' : raw).toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (own) return { ok: true, code: 'open-access', name: own.name, url: own.url };
  if (/\/by-(?:nc|nd)/.test(u) || /(^|[ -])(NC|ND)([ -]|$)/.test(s)) return { ok: false, why: 'a non-commercial or no-derivatives licence: ' + (s || u).slice(0, 40) };
  if (/creativecommons\.org\/publicdomain\/zero/.test(u) || /^(?:CC[ -]?0(?:[ -]1\.0)?(?: UNIVERSAL)?|CC-ZERO)$/.test(s)) return { ok: true, code: 'cc0', name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  if (/creativecommons\.org\/publicdomain\/mark/.test(u) || /^(?:PDM|PUBLIC DOMAIN(?: MARK)?(?: 1\.0)?|PD(?:[ -].*)?|NO KNOWN COPYRIGHT.*|US GOVERNMENT WORK|NASA.*PUBLIC DOMAIN)$/.test(s)) return { ok: true, code: 'pd', name: 'Public domain', url: httpsUrl(url) || 'https://creativecommons.org/publicdomain/mark/1.0/' };
  let m = /creativecommons\.org\/licenses\/(by-sa|by)\/(\d\.\d)(?:\/([a-z]{2,3}))?/.exec(u), code = m && m[1], v = m && m[2], port = m && m[3];
  if (!m) { const n = /^CC[ -]BY(?:[ -](SA))?(?:[ -](\d\.\d))?(?:[ -]([A-Z]{2,3}))?$/.exec(s); if (!n) return { ok: false, why: s || u ? 'not an open licence: ' + (s || u).slice(0, 40) : 'no licence stated' }; code = n[1] ? 'by-sa' : 'by'; v = n[2] || String(version || ''); port = n[3] ? n[3].toLowerCase() : ''; }
  if (!/^\d\.\d$/.test(v || '')) return { ok: false, why: 'no licence version' };
  return { ok: true, code, name: (code === 'by' ? 'CC BY ' : 'CC BY-SA ') + v + (port ? ' ' + port.toUpperCase() : ''), url: 'https://creativecommons.org/licenses/' + code + '/' + v + '/' + (port ? port + '/' : '') };
}
const OPEN = {
  pexels: { name: 'Pexels License', url: 'https://www.pexels.com/license/' },
  pixabay: { name: 'Pixabay Content License', url: 'https://pixabay.com/service/license-summary/' },
  unsplash: { name: 'Unsplash License', url: 'https://unsplash.com/license' },
};

// ---- the sources: request(q, ctx) -> { url, headers? }, parse(json, ctx) -> candidates ----
const cand = (o) => ({ title: '', thumb: '', url: '', width: 0, height: 0, author: '', authorUrl: '', licRaw: '', licVersion: '', licUrl: '', own: null, sourcePage: '', taken: '', text: '', mature: false, rejected: '', ...o });
const enc = encodeURIComponent;
const keyOf = (env, name) => String((env && env[name]) || '').trim();
const flagOff = (env, id) => /^(0|false|no|off)$/i.test(String((env && env['FREE_PICS_' + id.toUpperCase()]) || '').trim());

export const SOURCES = {
  commons: {
    name: 'Wikimedia Commons', home: 'https://commons.wikimedia.org/', goods: ['sport', 'place', 'person', 'history', 'animal'], hosts: /^(?:upload|thumb)\.wikimedia\.org$/, perDay: 600, hotlink: true, mime: 'jpeg',
    request: (q) => ({ url: 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' + enc(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1024&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|ImageDescription|DateTimeOriginal|DateTime|Categories|ObjectName|NonFree|Restrictions' }),
    parse(j) {
      const out = [];
      for (const p of Object.values((j && j.query && j.query.pages) || {})) {
        const ii = p && p.imageinfo && p.imageinfo[0]; if (!ii || !/^image\/(?:jpeg|png)$/.test(ii.mime || '')) continue;
        const m = ii.extmetadata || {}, v = (k) => (m[k] && m[k].value != null ? m[k].value : ''), href = /href=["']([^"']+)["']/i.exec(String(v('Artist')));
        const c = cand({ title: stripHtml(v('ObjectName') || String(p.title || '').replace(/^File:/, ''), 120), thumb: httpsUrl(ii.thumburl || ''), url: httpsUrl(ii.thumburl || ''), width: ii.thumbwidth || 0, height: ii.thumbheight || 0,
          author: stripHtml(v('Artist'), 100), authorUrl: href ? httpsUrl(href[1]) : '', licRaw: stripHtml(v('LicenseShortName'), 40), licUrl: httpsUrl(stripHtml(v('LicenseUrl'), 200)), sourcePage: httpsUrl(ii.descriptionurl || ''), taken: dayIn(v('DateTimeOriginal') || v('DateTime')),
          text: [v('ObjectName'), v('ImageDescription'), v('Categories'), p.title].map((x) => stripHtml(x, 400)).join(' | ') });
        if (/^true$/i.test(stripHtml(v('NonFree'), 10)) || /personality/i.test(stripHtml(v('Restrictions'), 80))) c.rejected = 'marked non-free or with personality rights';
        out.push(c);
      }
      return out;
    },
  },
  openverse: {
    name: 'Openverse', home: 'https://openverse.org/', goods: ['sport', 'place', 'person', 'history', 'animal', 'art'], hosts: /^api\.openverse\.(?:org|engineering)$/, perDay: 300, hotlink: true, mime: 'any',
    async request(q, ctx) { const t = await ctx.openverseToken(); return { url: 'https://api.openverse.org/v1/images/?q=' + enc(q) + '&license=cc0,pdm,by,by-sa&category=photograph&mature=false&page_size=10', headers: t ? { authorization: 'Bearer ' + t } : {} }; },
    parse(j) {
      return ((j && j.results) || []).map((r) => cand({ title: stripHtml(r.title, 120), thumb: httpsUrl(r.thumbnail || ''), url: httpsUrl(r.thumbnail || ''), width: r.width || 0, height: r.height || 0, author: stripHtml(r.creator, 100), authorUrl: httpsUrl(r.creator_url || ''),
        licRaw: r.license === 'pdm' ? 'PDM' : r.license === 'cc0' ? 'CC0' : 'CC ' + String(r.license || '').toUpperCase(), licVersion: r.license_version || '', licUrl: httpsUrl(r.license_url || ''), sourcePage: httpsUrl(r.foreign_landing_url || ''),
        mature: !!r.mature, text: [r.title, (r.tags || []).map((t) => t && t.name).join(' '), r.source].map((x) => stripHtml(x, 300)).join(' | '), provider: String(r.source || r.provider || '').replace(/[^a-z0-9_ -]/gi, '').slice(0, 30) }));
    },
  },
  nasa: {
    name: 'NASA Image and Video Library', home: 'https://images.nasa.gov/', goods: ['space', 'place', 'history', 'science'], hosts: /^images-assets\.nasa\.gov$/, perDay: 300, hotlink: true,
    request: (q) => ({ url: 'https://images-api.nasa.gov/search?media_type=image&page_size=10&q=' + enc(q) }),
    parse(j) {
      const out = [];
      for (const it of arr(j && j.collection && j.collection.items)) {
        const d = (it.data && it.data[0]) || {}, l = arr(it.links).find((x) => x && x.rel === 'preview') || arr(it.links)[0] || {}, th = httpsUrl(l.href || ''); if (!th || !d.nasa_id) continue;
        const text = [d.title, d.description, arr(d.keywords).join(' ')].map((x) => stripHtml(x, 500)).join(' | ');
        out.push(cand({ title: stripHtml(d.title, 120), thumb: th, url: th.replace('~thumb.', '~medium.'), author: stripHtml(d.secondary_creator || d.photographer || 'NASA', 80), licRaw: 'PUBLIC DOMAIN', licUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
          sourcePage: 'https://images.nasa.gov/details/' + String(d.nasa_id).replace(/[^A-Za-z0-9_.-]/g, ''), taken: dayIn(d.date_created), text,
          rejected: /copyright|courtesy of|©/i.test(text) ? 'NASA marks third-party material or a copyright' : '' }));
      }
      return out;
    },
  },
  loc: {
    name: 'Library of Congress', home: 'https://www.loc.gov/free-to-use/', goods: ['sport', 'history', 'place', 'person'], hosts: /^(?:tile|cdn|www)\.loc\.gov$/, perDay: 150, perMinute: 6, ttl: 2 * 86400, hotlink: true, // official: 20 requests a minute for the JSON API, over it blocks the caller for an hour
   
    request: (q) => ({ url: 'https://www.loc.gov/photos/?fo=json&c=10&fa=' + enc('online-format:image') + '&q=' + enc(q) }),
    parse(j) {
      const out = [];
      for (const r of (arr(j && j.results).length ? arr(j && j.results) : arr(j && j.content && j.content.results))) {
        const nohash = (u) => String(u).replace(/#.*$/, ''), up = (u) => httpsUrl(String(u || '').replace(/^http:/, 'https:')), dims = (u) => { const m = /#h=(\d+)&w=(\d+)/.exec(String(u)); return m ? { h: +m[1], w: +m[2] } : { h: 0, w: 0 }; };
        const raw = arr(r.image_url).filter((u) => /\.(?:jpe?g|png)(?:#|$)/i.test(String(u))), imgs = raw.map((u) => up(nohash(u))).filter(Boolean), th = imgs[0] || '', id = up(r.id || r.url || ''); if (!th || !id) continue;
        const rights = JSON.stringify([r.rights, r.rights_advisory, r.rights_information, r.item && r.item.rights_advisory, r.item && r.item.rights, r.item && r.item.rights_information].filter(Boolean)).slice(0, 800);
        if (r.access_restricted === true || (r.item && r.item.access_restricted === true)) continue;
        const open = /no known restrictions|no known copyright|public domain|free to use and reuse/i.test(rights + JSON.stringify(r.partof || ''));
        const by = arr(r.contributor_names || r.contributor || (r.item && r.item.contributor_names)).map((x) => stripHtml(x, 60)).filter(Boolean)[0] || '';
        out.push(cand({ title: stripHtml(first(r.title), 120), thumb: th, url: imgs[Math.min(imgs.length - 1, 2)] || th, width: dims(raw[Math.min(raw.length - 1, 2)]).w, height: dims(raw[Math.min(raw.length - 1, 2)]).h, author: by.replace(/\b\w/g, (m) => m.toUpperCase()), licRaw: open ? 'PUBLIC DOMAIN' : '', licUrl: open ? 'https://www.loc.gov/rr/print/res/rights.html' : '', sourcePage: id.replace(/\?.*$/, ''),
          taken: dayIn(first(r.date) || ''), text: [r.title, r.description, arr(r.subject).join(' '), arr(r.subject_headings).join(' '), arr(r.original_format).join(' ')].map((x) => stripHtml(Array.isArray(x) ? x.join(' ') : x, 400)).join(' | '),
          rejected: open ? '' : 'no "no known restrictions" statement' }));
      }
      return out;
    },
  },
  met: {
    name: 'The Met Collection', home: 'https://www.metmuseum.org/art/collection', goods: ['art', 'history', 'place', 'animal'], hosts: /^images\.metmuseum\.org$/, perDay: 200, hotlink: true,
    // v1.1/search is the owner's note (the legacy /v1/search retired 1 Oct 2026): UNVERIFIED, so it is asked first and the legacy address is the fallback; the probe records which answered.
    request: (q) => ({ url: 'https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&isPublicDomain=true&limit=100&offset=0&q=' + enc(q),
      fallback: 'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=' + enc(q) }),
    parse: () => [],
    async expand(j, ctx) {
      const out = [];
      for (const id of arr(j && j.objectIDs).slice(0, 3)) {
        await new Promise((r) => setTimeout(r, ctx.polite || 0)); const o = await ctx.getJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + Number(id)); if (!o || !o.objectID || o.isPublicDomain !== true) continue;
        out.push(cand({ title: stripHtml(o.title, 120), thumb: httpsUrl(o.primaryImageSmall || ''), url: httpsUrl(o.primaryImageSmall || ''), author: stripHtml(o.artistDisplayName || o.culture || 'The Met', 100), authorUrl: '', licRaw: 'CC0',
          sourcePage: httpsUrl(o.objectURL || ''), taken: dayIn(o.objectDate || ''), text: [o.title, o.objectName, o.classification, o.tags && arr(o.tags).map((t) => t && t.term).join(' ')].map((x) => stripHtml(x, 300)).join(' | ') }));
      }
      return out;
    },
  },
  aic: {
    name: 'Art Institute of Chicago', home: 'https://www.artic.edu/open-access', goods: ['art', 'history'], hosts: /^www\.artic\.edu$/, perDay: 200, hotlink: true,
    request: (q) => ({ url: 'https://api.artic.edu/api/v1/artworks/search?limit=10&query[term][is_public_domain]=true&fields=id,title,image_id,artist_title,artist_display,date_display,thumbnail,is_public_domain&q=' + enc(q), headers: { 'AIC-User-Agent': UA } }),
    parse(j) {
      const iiif = httpsUrl((j && j.config && j.config.iiif_url) || AIC_IIIF) || AIC_IIIF;
      return arr(j && j.data).filter((a) => a && a.image_id).map((a) => cand({ title: stripHtml(a.title, 120), thumb: iiif + '/' + encodeURIComponent(a.image_id) + '/full/400,/0/default.jpg', url: iiif + '/' + encodeURIComponent(a.image_id) + '/full/843,/0/default.jpg',
        width: (a.thumbnail && a.thumbnail.width) || 0, height: (a.thumbnail && a.thumbnail.height) || 0, author: stripHtml(a.artist_title || a.artist_display, 100).split(/[,(\n]/)[0].trim() || 'Art Institute of Chicago', licRaw: a.is_public_domain === true ? 'CC0' : '',
        sourcePage: 'https://www.artic.edu/artworks/' + Number(a.id), taken: dayIn(a.date_display), text: [a.title, a.artist_display, a.thumbnail && a.thumbnail.alt_text].map((x) => stripHtml(x, 300)).join(' | ') }));
    },
  },
  cleveland: {
    name: 'Cleveland Museum of Art', home: 'https://www.clevelandart.org/open-access', goods: ['art', 'history'], hosts: /^openaccess-cdn\.clevelandart\.org$/, perDay: 200, hotlink: true,
    request: (q) => ({ url: 'https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=10&q=' + enc(q) }),
    parse(j) {
      return arr(j && j.data).filter((a) => a && a.images && a.images.web && a.images.web.url).map((a) => cand({ title: stripHtml(a.title, 120), thumb: httpsUrl(a.images.web.url), url: httpsUrl(a.images.web.url), width: Number(a.images.web.width) || 0, height: Number(a.images.web.height) || 0,
        author: stripHtml((arr(a.creators)[0] || {}).description || 'Cleveland Museum of Art', 100).split(/[(,]/)[0].trim(), licRaw: /cc0/i.test(a.share_license_status || '') ? 'CC0' : String(a.share_license_status || ''),
        sourcePage: httpsUrl(a.url || ''), taken: dayIn(a.creation_date || ''), text: [a.title, a.type, a.department].map((x) => stripHtml(x, 200)).join(' | ') }));
    },
  },
  smithsonian: {
    name: 'Smithsonian Open Access', home: 'https://www.si.edu/openaccess', key: 'SMITHSONIAN_API_KEY', goods: ['history', 'sport', 'science', 'place', 'animal', 'art'], hosts: /^(?:ids\.si\.edu|collections\.si\.edu|[a-z0-9.-]+\.si\.edu)$/, perDay: 300, hotlink: true,
    request: (q, ctx) => ({ url: 'https://api.si.edu/openaccess/api/v1.0/search?rows=10&api_key=' + enc(keyOf(ctx.env, 'SMITHSONIAN_API_KEY')) + '&q=' + enc(q + ' AND online_media_type:"Images" AND media_usage:"CC0"') }),
    parse(j) {
      const out = [];
      for (const r of arr(j && j.response && j.response.rows)) {
        const dn = (r.content && r.content.descriptiveNonRepeating) || {}, med = arr(dn.online_media && dn.online_media.media).find((m) => m && /image/i.test(m.type || '') && m.usage && /cc0/i.test(m.usage.access || ''));
        if (!med) continue; const fr = (r.content && r.content.freetext) || {}, th = httpsUrl(med.thumbnail || med.content || '');
        out.push(cand({ title: stripHtml(r.title || (dn.title && dn.title.content), 120), thumb: th, url: httpsUrl(med.content || '') || th, author: stripHtml((arr(fr.name)[0] || {}).content || dn.data_source || 'Smithsonian Institution', 100), licRaw: 'CC0',
          sourcePage: httpsUrl(dn.record_link || '') || ('https://www.si.edu/object/' + enc(r.id || '')), taken: dayIn((arr(fr.date)[0] || {}).content || ''), text: [r.title, arr(fr.topic).map((t) => t && t.content).join(' '), arr(fr.objectType).map((t) => t && t.content).join(' ')].map((x) => stripHtml(x, 300)).join(' | ') }));
      }
      return out;
    },
  },
  europeana: {
    name: 'Europeana', home: 'https://www.europeana.eu/', key: 'EUROPEANA_API_KEY', goods: ['history', 'place', 'art', 'sport', 'person'], hosts: /^api\.europeana\.eu$/, perDay: 300, hotlink: true,
    request: (q, ctx) => ({ url: 'https://api.europeana.eu/record/v2/search.json?rows=10&profile=standard&reusability=open&media=true&thumbnail=true&qf=TYPE:IMAGE&wskey=' + enc(keyOf(ctx.env, 'EUROPEANA_API_KEY')) + '&query=' + enc(q) }),
    parse(j) {
      return arr(j && j.items).filter((i) => i && i.edmPreview).map((i) => cand({ title: stripHtml(first(i.title), 120), thumb: httpsUrl(first(i.edmPreview)), url: httpsUrl(first(i.edmPreview)), author: stripHtml(first(i.dcCreator) || first(i.dataProvider), 100),
        licUrl: String(first(i.rights)).replace(/^http:/, 'https:'), licRaw: '', sourcePage: httpsUrl(first(i.edmIsShownAt)) || httpsUrl(i.guid || ''), taken: dayIn(first(i.year) || ''), text: [first(i.title), arr(i.dcDescription).join(' '), arr(i.dcSubject).join(' ')].map((x) => stripHtml(x, 300)).join(' | ') }));
    },
  },
  flickr: {
    name: 'Flickr', home: 'https://www.flickr.com/', key: 'FLICKR_API_KEY', needs: 'FREE_PICS_FLICKR_COMMERCIAL', goods: ['sport', 'place', 'person', 'animal', 'history'], hosts: /^(?:live|farm\d+|c\d+)\.staticflickr\.com$/, perDay: 300, hotlink: true,
    request: (q, ctx) => ({ url: 'https://api.flickr.com/services/rest/?method=flickr.photos.search&format=json&nojsoncallback=1&safe_search=1&content_type=1&media=photos&sort=relevance&per_page=10&license=4,5,7,8,9,10,11,12&api_key=' + enc(keyOf(ctx.env, 'FLICKR_API_KEY')) + '&text=' + enc(q) + '&extras=' + enc('license,owner_name,date_taken,tags,description,url_c,url_l') }),
    parse(j) {
      const L = { 4: 'CC BY 2.0', 5: 'CC BY-SA 2.0', 7: 'NO KNOWN COPYRIGHT', 8: 'US GOVERNMENT WORK', 9: 'CC0 1.0', 10: 'PDM', 11: 'CC BY 4.0', 12: 'CC BY-SA 4.0' }, out = [];
      for (const p of arr(j && j.photos && j.photos.photo)) {
        const id = String(p.id || '').replace(/\D/g, ''), owner = String(p.owner || '').replace(/[^A-Za-z0-9@_-]/g, ''), th = httpsUrl(p.url_c || p.url_l || ''); if (!id || !owner || !th) continue;
        out.push(cand({ title: stripHtml(p.title, 120), thumb: th, url: th, width: Number(p.width_c || p.width_l) || 0, height: Number(p.height_c || p.height_l) || 0, author: stripHtml(p.ownername, 100), authorUrl: 'https://www.flickr.com/people/' + owner + '/',
          licRaw: L[Number(p.license)] || 'licence id ' + String(p.license).replace(/\D/g, '') + ' not accepted', sourcePage: 'https://www.flickr.com/photos/' + owner + '/' + id, taken: dayIn(p.datetaken || ''), text: [p.title, p.tags, p.description && p.description._content].map((x) => stripHtml(x, 300)).join(' | ') }));
      }
      return out;
    },
  },
  pexels: {
    name: 'Pexels', home: 'https://www.pexels.com/', key: 'PEXELS_API_KEY', stock: true, goods: ['sport', 'place', 'animal', 'generic'], hosts: /^images\.pexels\.com$/, perDay: 500, hotlink: true,
    request: (q, ctx) => ({ url: 'https://api.pexels.com/v1/search?per_page=10&orientation=landscape&query=' + enc(q), headers: { authorization: keyOf(ctx.env, 'PEXELS_API_KEY') } }),
    parse(j) {
      return arr(j && j.photos).map((p) => cand({ title: stripHtml(p.alt || 'Photo', 120), thumb: httpsUrl(p.src && (p.src.medium || p.src.large)), url: httpsUrl(p.src && (p.src.large || p.src.medium)), width: p.width || 0, height: p.height || 0, author: stripHtml(p.photographer, 100),
        authorUrl: httpsUrl(p.photographer_url || ''), own: OPEN.pexels, sourcePage: httpsUrl(p.url || ''), text: stripHtml(p.alt, 300) }));
    },
  },
  pixabay: {
    name: 'Pixabay', home: 'https://pixabay.com/', key: 'PIXABAY_API_KEY', stock: true, goods: ['sport', 'place', 'animal', 'generic'], hosts: /^pixabay\.com$/, perDay: 500, hotlink: false,
    request: (q, ctx) => ({ url: 'https://pixabay.com/api/?image_type=photo&safe_search=true&per_page=10&orientation=horizontal&key=' + enc(keyOf(ctx.env, 'PIXABAY_API_KEY')) + '&q=' + enc(q) }),
    parse(j) {
      return arr(j && j.hits).map((p) => cand({ title: stripHtml(p.tags, 120), thumb: httpsUrl(p.webformatURL || p.previewURL), url: httpsUrl(p.webformatURL || p.previewURL), width: p.webformatWidth || 0, height: p.webformatHeight || 0, author: stripHtml(p.user, 100),
        authorUrl: p.user_id ? 'https://pixabay.com/users/' + enc(String(p.user || 'user')) + '-' + Number(p.user_id) + '/' : '', own: OPEN.pixabay, sourcePage: httpsUrl(p.pageURL || ''), text: stripHtml(p.tags, 300) }));
    },
  },
  unsplash: {
    name: 'Unsplash', home: 'https://unsplash.com/', key: 'UNSPLASH_ACCESS_KEY', stock: true, goods: ['sport', 'place', 'animal', 'generic'], hosts: /^images\.unsplash\.com$/, perDay: 40, hotlink: true,
    request: (q, ctx) => ({ url: 'https://api.unsplash.com/search/photos?per_page=10&orientation=landscape&query=' + enc(q), headers: { authorization: 'Client-ID ' + keyOf(ctx.env, 'UNSPLASH_ACCESS_KEY'), 'accept-version': 'v1' } }),
    parse(j) {
      const utm = '?utm_source=verse&utm_medium=referral';
      return arr(j && j.results).map((p) => cand({ title: stripHtml(p.alt_description || p.description || 'Photo', 120), thumb: httpsUrl(p.urls && p.urls.small), url: httpsUrl(p.urls && p.urls.regular), width: p.width || 0, height: p.height || 0, author: stripHtml(p.user && p.user.name, 100),
        authorUrl: httpsUrl(p.user && p.user.links && p.user.links.html) ? httpsUrl(p.user.links.html) + utm : '', own: OPEN.unsplash, sourcePage: httpsUrl(p.links && p.links.html) ? httpsUrl(p.links.html) + utm : '', text: stripHtml((p.alt_description || '') + ' ' + (p.description || ''), 300), track: httpsUrl(p.links && p.links.download_location) }));
    },
  },
  archive: {
    name: 'Internet Archive', home: 'https://archive.org/', goods: ['history', 'sport', 'art'], hosts: /^archive\.org$/, perDay: 150, hotlink: true,
    request: (q) => ({ url: 'https://archive.org/advancedsearch.php?output=json&rows=10&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=licenseurl&fl[]=date&fl[]=subject&q=' + enc('(' + q + ') AND mediatype:image AND licenseurl:(*creativecommons.org*)') }),
    parse(j) {
      return arr(j && j.response && j.response.docs).filter((d) => d && /^[A-Za-z0-9._-]{3,100}$/.test(d.identifier || '')).map((d) => cand({ title: stripHtml(first(d.title), 120), thumb: 'https://archive.org/services/img/' + d.identifier, url: 'https://archive.org/services/img/' + d.identifier,
        author: stripHtml(first(d.creator), 100), licUrl: String(first(d.licenseurl)).replace(/^http:/, 'https:'), sourcePage: 'https://archive.org/details/' + d.identifier, taken: dayIn(first(d.date)), text: [first(d.title), arr(d.subject).join(' ')].map((x) => stripHtml(x, 300)).join(' | ') }));
    },
  },
};
/** the order each kind of picture asks the sources in (keyless first, stock last). */
export const ORDER = Object.freeze({
  sport: ['commons', 'loc', 'openverse', 'europeana', 'smithsonian', 'flickr', 'archive', 'pexels', 'pixabay', 'unsplash'],
  place: ['commons', 'openverse', 'nasa', 'europeana', 'smithsonian', 'flickr', 'pexels', 'pixabay', 'unsplash'],
  space: ['nasa', 'commons', 'smithsonian', 'openverse'],
  art: ['met', 'aic', 'cleveland', 'smithsonian', 'europeana', 'commons', 'openverse'],
  animal: ['commons', 'smithsonian', 'openverse', 'pexels', 'pixabay', 'unsplash', 'flickr'],
  history: ['loc', 'commons', 'smithsonian', 'europeana', 'archive', 'openverse'],
  person: ['commons', 'loc', 'openverse', 'smithsonian', 'europeana'],
});
const KIND_ORDER = { sport: 'sport', league: 'sport', player: 'person', person: 'person', team: 'sport', event: 'sport', venue: 'sport', place: 'place', space: 'space', art: 'art', animal: 'animal', history: 'history' };
export const orderFor = (kind) => ORDER[KIND_ORDER[kind] || 'sport'];

/** whether a source is switched on for this env: its key is set (and, for Flickr, the commercial-key switch), and no FREE_PICS_OFF / FREE_PICS_<ID>=0. Pure. */
export function sourceState(id, env) {
  const s = SOURCES[id]; if (!s) return { on: false, why: 'unknown source' };
  if (/^(1|true|yes|on)$/i.test(keyOf(env, 'FREE_PICS_OFF'))) return { on: false, why: 'FREE_PICS_OFF is set' };
  if (flagOff(env, id)) return { on: false, why: 'FREE_PICS_' + id.toUpperCase() + '=0' };
  if (s.key && !keyOf(env, s.key)) return { on: false, why: 'needs ' + s.key };
  if (s.needs && !/^(1|true|yes|on)$/i.test(keyOf(env, s.needs))) return { on: false, why: 'needs ' + s.needs + '=1 (a free Flickr key is non-commercial; set it once a commercial key is approved)' };
  return { on: true, why: '' };
}

// ---- judging candidates ----
/** keepers (with licence, credit and score) and refusals with their reasons. ctx: { sourceId, q, kind, date, licences, blocked(Set of sourcePage) }. Pure. */
export function judge(cands, ctx) {
  const s = SOURCES[ctx.sourceId], ok = [], rejected = [], allowed = new Set(ctx.licences && ctx.licences.length ? ctx.licences : ALL_LICENCES);
  for (const c of cands || []) {
    const no = (why) => rejected.push({ title: c.title || '', source: ctx.sourceId, why });
    if (c.rejected) { no(c.rejected); continue; }
    const th = httpsUrl(c.thumb); if (!th || !s.hosts.test(host(th))) { no('no picture on the source\'s own image host'); continue; }
    if (c.mature) { no('marked mature'); continue; }
    if (ctx.blocked && c.sourcePage && ctx.blocked.has(c.sourcePage)) { no('taken down by the owner'); continue; }
    const lic = licenceOf(c.licRaw, { version: c.licVersion, url: c.licUrl, own: c.own }); if (!lic.ok) { no(lic.why); continue; }
    if (!allowed.has(lic.code)) { no('licence ' + lic.name + ' is not in the allowed list'); continue; }
    if (!c.sourcePage || (!c.author && lic.code !== 'cc0' && lic.code !== 'pd')) { no('no author or source page to credit'); continue; }
    const t = c.text + ' ' + c.title;
    if (BLOCK.test(t) || RUDE.test(t)) { no('its words suggest children, a school or something unsuitable'); continue; }
    if (SPONSOR.test(t)) { no('a logo, sponsor or advertising category'); continue; }
    if (STRICT.has(ctx.sourceId)) {
      if (KIND_ORDER[ctx.kind] === 'sport' && !SPORT.test(t)) { no('its words are not about sport'); continue; }
      const tk = toks(ctx.q); if (tk.length && !tk.some((w) => t.toLowerCase().includes(w))) { no('nothing in its words matches the search'); continue; }
    }
    let score = toks(ctx.q).filter((w) => t.toLowerCase().includes(w)).length * 10; if (ctx.date && c.taken === ctx.date) score += 100; if (c.width >= 800) score += 5;
    ok.push({ ...c, lic, score });
  }
  ok.sort((a, b) => b.score - a.score);
  return { ok, rejected };
}

// ---- the credit ----
/** the credit as plain text parts and as HTML-escaped parts (https addresses only). Pure. */
export function creditOf(c, sourceId, date = '') {
  const s = SOURCES[sourceId], raw = { author: c.author || '', title: c.title || '', licence: c.lic.name, licenceUrl: c.lic.url, source: s.name + (c.provider ? ' (' + c.provider + ')' : ''), sourceUrl: c.sourcePage || s.home };
  const safe = {}; for (const k of Object.keys(raw)) safe[k] = /Url$/.test(k) ? esc(httpsUrl(raw[k])) : esc(raw[k]);
  return { raw, safe };
}
/** the credit line as segments [{ t, href? }] for pages that build text nodes: "Photo: author, licence, via source · taken ... (an archive picture)". Pure. */
export function creditSegments(p) {
  const c = p.credit, seg = [{ t: 'Photo: ' }, c.author ? (p.authorUrl ? { t: c.author, href: p.authorUrl } : { t: c.author }) : { t: 'author not stated' }, { t: ', ' }, { t: c.licence, href: c.licenceUrl }, { t: ', via ' }, { t: c.source, href: c.sourceUrl }];
  seg.push({ t: ' · ' + (p.taken ? 'taken ' + p.taken : 'date not stated') + (p.archive ? ' (an archive picture, not necessarily from this game)' : ' (this game)') });
  return seg;
}
/** the credit line as safe HTML (every part escaped, links https only, rel and target set). Pure. */
export function creditHtml(p) {
  const s = p.creditHtmlSafeParts, a = (h, t) => (h ? '<a href="' + h + '" rel="noopener noreferrer" target="_blank">' + t + '</a>' : t);
  return 'Photo: ' + (s.author || 'author not stated') + ', ' + a(s.licenceUrl, s.licence) + ', via ' + a(s.sourceUrl, s.source) + ' · ' + (p.taken ? 'taken ' + esc(p.taken) : 'date not stated') + (p.archive ? ' (an archive picture)' : '');
}

// ---- fetching ----
export class Limited extends Error { constructor(src, retry) { super(src + ' answered 429'); this.status = 429; this.retry = retry; } }
const redactWith = (secrets) => (s) => { let t = String(s || ''); for (const k of secrets) if (k && k.length > 3) t = t.split(k).join('***').split(encodeURIComponent(k)).join('***'); return t.replace(/(api_key|wskey|key)=[^&\s]+/gi, '$1=***'); };
const RATE_HEADERS = ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-limit-hour', 'x-ratelimit-available', 'x-ratelimit-remaining-hour', 'x-ratelimit-remaining-minute', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset'];
function makeCtx(opts) {
  const env = opts.env || {}, fetchFn = opts.fetch || globalThis.fetch, ms = opts.timeoutMs || 5000, secrets = ['PEXELS_API_KEY', 'PIXABAY_API_KEY', 'UNSPLASH_ACCESS_KEY', 'SMITHSONIAN_API_KEY', 'EUROPEANA_API_KEY', 'FLICKR_API_KEY', 'OPENVERSE_CLIENT_SECRET', 'OPENVERSE_CLIENT_ID'].map((n) => keyOf(env, n));
  const ctx = { env, redact: redactWith(secrets), lastMeta: null, polite: opts.polite == null ? 1000 : opts.polite };
  ctx.http = async (url, { headers = {}, method = 'GET', body } = {}) => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try { return await fetchFn(url, { method, body, headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: ac.signal }); } finally { clearTimeout(t); }
  };
  ctx.getJson = async (url, o) => { const r = await ctx.http(url, o); if (r.status === 429) throw new Limited('source', Math.max(60, Math.min(86400, parseInt(r.headers.get('retry-after') || '3600', 10) || 3600))); if (!r.ok) throw new Error('answered ' + r.status); return r.json(); };
  ctx.openverseToken = async () => {
    const id = keyOf(env, 'OPENVERSE_CLIENT_ID'), sec = keyOf(env, 'OPENVERSE_CLIENT_SECRET'); if (!id || !sec) return '';
    if (opts._ovToken && opts._ovToken.until > Date.now()) return opts._ovToken.t;
    try { const j = await ctx.getJson('https://api.openverse.org/v1/auth_tokens/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&client_id=' + enc(id) + '&client_secret=' + enc(sec) });
      if (j && j.access_token) { opts._ovToken = { t: String(j.access_token), until: Date.now() + Math.max(60, (j.expires_in || 43200) - 600) * 1000 }; return opts._ovToken.t; } } catch (e) { if (e instanceof Limited) throw e; }
    return '';
  };
  return ctx;
}
/** the fetching context (http, getJson, redaction, Openverse token) for callers that run a source by hand: the probe. */
export const probeContext = async (opts = {}) => makeCtx(opts);
/** one source's raw candidates for a query: { cands, meta: { status, ms, rate: {header: value} } }. Throws Limited on 429 and Error otherwise. The probe uses this too. */
export async function fetchSource(id, q, ctx) {
  const s = SOURCES[id], req = await s.request(q, ctx), t0 = Date.now(); let r = await ctx.http(req.url, { headers: req.headers || {} }), via = 'primary';
  if (!r.ok && r.status !== 429 && req.fallback) { r = await ctx.http(req.fallback, { headers: req.headers || {} }); via = 'fallback'; }
  const rate = {}; for (const h of RATE_HEADERS) { const v = r.headers.get(h); if (v != null) rate[h] = v; }
  const meta = { status: r.status, ms: Date.now() - t0, rate, via };
  if (r.status === 429) { const e = new Limited(id, Math.max(60, Math.min(86400, parseInt(r.headers.get('retry-after') || '3600', 10) || 3600))); e.meta = meta; throw e; }
  if (r.status === 403 && s.perMinute) { const e = new Limited(id, 3600); e.meta = meta; throw e; } // loc.gov blocks a caller for an hour when it is over its limit: leave it alone
  if (!r.ok) { const e = new Error(id + ' answered ' + r.status); e.meta = meta; throw e; }
  let json; try { json = await r.json(); } catch (_) { if (s.perMinute) { const e = new Limited(id, 3600); e.meta = meta; throw e; } throw new Error(id + ' answered something that is not JSON'); } // loc.gov answers a CAPTCHA page when it is busy: stop for an hour
  let cands = s.parse(json, ctx); if (s.expand) cands = await s.expand(json, ctx);
  return { cands, meta, json };
}

// ---- the cache (the edge cache by default) and the limit memory ----
const edgeCache = () => {
  const c = globalThis.caches && globalThis.caches.default; if (!c) return null;
  const rq = (k) => new Request('https://free-pics.invalid/' + encodeURIComponent(k));
  return { async get(k) { try { const r = await c.match(rq(k)); return r ? await r.json() : null; } catch (_) { return null; } },
    async put(k, v, ttl) { try { await c.put(rq(k), new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + ttl } })); } catch (_) {} } };
};
const memMin = new Map(), memLimit = new Map(); // per isolate; the cache holds it across them
export const resetState = () => { memLimit.clear(); memMin.clear(); };

/** the full answer: { pics, report[] } (the report says what each source did, no keys). Options: kind ('sport'|'player'|'team'|'event'|'venue'|'place'|'space'|'art'|'animal'|'history'), sport, date 'YYYY-MM-DD', max (default 3),
 *  licences (default all five), env, fetch, cap(key, limit) -> Promise<{ok}>, cache {get, put}, sources (restrict), fromAnswer, timeoutMs, deadlineMs, blocked (Set of source pages), now. */
export async function findPicturesDetailed(subject, opts = {}) {
  const report = [], pics = [], q0 = resolveSubject(subject, opts); if (!q0) return { pics, report: [{ source: '*', skipped: 'the subject is not on a closed list' }] };
  const kind = opts.kind || 'sport', q = opts.sport && KIND_ORDER[kind] !== 'space' && !q0.toLowerCase().includes(String(opts.sport).toLowerCase()) && NAMED.has(kind) ? q0 + ' ' + String(opts.sport).replace(/[^\p{L} ]/gu, '').slice(0, 20) : q0;
  const max = Math.max(1, Math.min(10, opts.max || 3)), now = opts.now || Date.now(), deadline = now + (opts.deadlineMs || 15000), ctx = makeCtx(opts), cache = opts.cache === undefined ? edgeCache() : opts.cache;
  const env = ctx.env, day = new Date(now).toISOString().slice(0, 10), globalDay = Math.max(1, Math.floor(Number(env.FREE_PICS_DAY)) || 400);
  const ids = (opts.sources && opts.sources.length ? opts.sources : orderFor(kind)).filter((id) => SOURCES[id]);
  for (const id of ids) {
    if (pics.length >= max) break;
    const s = SOURCES[id], st = sourceState(id, env); if (!st.on) { report.push({ source: id, skipped: st.why }); continue; }
    if (s.stock && NAMED.has(kind)) { report.push({ source: id, skipped: 'stock pictures are not used for named people, teams or events' }); continue; }
    if (Date.now() > deadline && !opts.now) { report.push({ source: id, skipped: 'out of time' }); continue; }
    const until = memLimit.get(id) || (cache ? await cache.get('fp-limit|' + id) : null); if (until && (typeof until === 'number' ? until : until.until) > now) { report.push({ source: id, skipped: 'rate limited (429) earlier, left alone' }); continue; }
    const ck = 'fp|' + id + '|' + q.toLowerCase() + '|' + day; let cands = cache ? await cache.get(ck) : null, from = 'cache', meta = null;
    if (!cands) {
      from = 'network';
      const minKey = 'fp-' + id + '-' + new Date(now).toISOString().slice(11, 16).replace(':', '');
      if (s.perMinute) { const n = (memMin.get(minKey) || 0) + 1; memMin.set(minKey, n); if (memMin.size > 50) memMin.clear(); if (n > s.perMinute) { report.push({ source: id, skipped: 'per-minute budget used (' + s.perMinute + ')' }); continue; } }
      if (opts.cap) { if (s.perMinute) { const m = await opts.cap(minKey, s.perMinute); if (!m.ok) { report.push({ source: id, skipped: 'per-minute budget used (' + s.perMinute + ')' }); continue; } } const g = await opts.cap('freepics', globalDay), l = g.ok ? await opts.cap('fp-' + id, s.perDay) : g; if (!g.ok || !l.ok) { report.push({ source: id, skipped: 'the daily cap is used up' }); if (!g.ok) break; continue; } }
      try { const r = await fetchSource(id, q, ctx); cands = r.cands; meta = r.meta; if (cache) await cache.put(ck, cands, cands.length ? (s.ttl || 86400) : 3600); }
      catch (e) {
        if (e instanceof Limited) { const u = now + e.retry * 1000; memLimit.set(id, u); if (cache) await cache.put('fp-limit|' + id, { until: u }, e.retry); report.push({ source: id, error: 'rate limited (429), left alone for ' + e.retry + ' s', ...(e.meta ? { meta: e.meta } : {}) }); }
        else report.push({ source: id, error: ctx.redact(e && e.name === 'AbortError' ? 'timed out' : (e && e.message) || e).slice(0, 100), ...(e && e.meta ? { meta: e.meta } : {}) });
        continue;
      }
    }
    const j = judge(cands, { sourceId: id, q, kind, date: opts.date || '', licences: opts.licences, blocked: opts.blocked }), row = { source: id, from, found: cands.length, kept: j.ok.length, rejected: j.rejected.slice(0, 8), ...(meta ? { meta } : {}) };
    report.push(row);
    for (const c of j.ok) {
      if (pics.length >= max) break;
      const cr = creditOf(c, id, opts.date), archive = !(c.taken && opts.date && c.taken === opts.date);
      pics.push({ url: c.url || c.thumb, thumb: c.thumb, width: c.width || 0, height: c.height || 0, alt: (c.title ? c.title : 'A picture of ' + q).slice(0, 140), creditHtmlSafeParts: cr.safe, credit: cr.raw, authorUrl: c.authorUrl || '', licence: c.lic.code, archive,
        source: id, sourcePage: c.sourcePage, taken: c.taken || '', hotlink: s.hotlink !== false, ...(c.track ? { track: c.track } : {}) });
    }
  }
  const u = pics.find((p) => p.track); if (u && opts.fetch !== false) { try { ctx.http(u.track, { headers: { authorization: 'Client-ID ' + keyOf(env, 'UNSPLASH_ACCESS_KEY') } }).catch(() => {}); } catch (_) {} } // Unsplash asks for a ping when a picture is used
  for (const p of pics) delete p.track;
  return { pics, report };
}
/** the pictures only: [{ url, thumb, width, height, alt, creditHtmlSafeParts, licence, archive, ... }] in source order; [] when nothing qualifies (the caller keeps its drawing). */
export const findPictures = async (subject, opts = {}) => (await findPicturesDetailed(subject, opts)).pics;

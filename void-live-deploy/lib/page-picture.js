// A picture for a Wikipedia answer whose summary has none (owner, 2026-10-17: the K-pop card "didnt look" up a picture and showed a generic
// plate). The summary's thumbnail is only the article's lead image; many articles (K-pop, most genres and ideas) have none there but carry
// photos further down. This asks Wikipedia for the page image first, then for the article's own images, and keeps the first real photo:
// a jpeg or png at least 300 px wide, never a logo, icon, flag, map, chart or signature. The thumbnail comes from upload.wikimedia.org,
// which serves it to any page (so the saved card can draw it). Nothing is sent but the article's title.
const API = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&redirects=1&titles=';
const NOT_PHOTO = /\b(?:logo|icon|flag|map|locator|symbol|signature|seal|coat[ _]of[ _]arms|emblem|chart|graph|diagram|commons-logo|wiki|edit-|question|ambox|portal|disambig|stub|padlock|speaker|audio|sound)\b|\.(?:svg|gif|tiff?|webm|ogg|ogv|mp3|wav|pdf|djvu)$/i;

/** the URLs to ask, in order: the page image (any licence Wikipedia shows on the page), then the article's own images. Pure. */
export function pictureUrls(title) {
  const t = encodeURIComponent(String(title || '').slice(0, 200));
  return [API + t + '&action=query&prop=pageimages&piprop=thumbnail&pithumbsize=640&pilicense=any',
    API + t + '&action=query&generator=images&gimlimit=40&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=640'];
}
/** the first real photo in an API reply: the page image, or the first article image that is a jpeg or png, 300 px wide or more, and not a
 *  logo, icon, flag, map or chart. Its https thumbnail URL, or ''. Pure. */
export function pickPicture(reply) {
  const pages = (reply && reply.query && reply.query.pages) || [];
  const list = Array.isArray(pages) ? pages : Object.values(pages);
  for (const p of list) { const t = p && p.thumbnail; if (t && /^https:\/\/upload\.wikimedia\.org\//.test(t.source || '') && !NOT_PHOTO.test(p.pageimage || '')) return t.source; }
  const imgs = list.filter((p) => p && Array.isArray(p.imageinfo) && p.imageinfo[0]).map((p) => ({ name: String(p.title || ''), i: p.imageinfo[0] }))
    .filter(({ name, i }) => /^image\/(?:jpeg|png)$/.test(i.mime || '') && (i.width || 0) >= 300 && !NOT_PHOTO.test(name.replace(/^File:/, '')) && /^https:\/\/upload\.wikimedia\.org\//.test(i.thumburl || ''));
  return imgs.length ? imgs[0].i.thumburl : '';
}
/** the picture for an article, or '' (browser or worker: needs fetch). Never throws. */
export async function pictureFor(title, get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null))) {
  for (const u of pictureUrls(title)) { try { const got = pickPicture(await get(u)); if (got) return got; } catch (_) {} }
  return '';
}

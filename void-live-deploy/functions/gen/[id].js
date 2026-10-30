// a-to-mind.com/gen/<id>: a published generator's own link, with its share card (owner, 2026-10-25: perchance's $meta). The page is
// /generators/make/ as it is; only its title, description, preview image and canonical address are set from the generator's $meta (or its
// name), so a link pasted in a chat shows what it is. The generator's text is never put into the HTML: the page fetches it from /api/generators.
// GET only; an id that is not a published generator gets the plain editor page with a 404 status. Read-only, no model, no writes.
import { compile } from '../../lib/listgen.js';

export const ID_RE = /^[a-z2-7]{8}$/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** the editor page's html with the share card set for one generator. Pure. */
export function withCard(html, { id, title, description, image }, origin = 'https://a-to-mind.com') {
  const url = origin + '/gen/' + id, t = esc(title) + ' · Verse', d = esc(description), img = image ? origin + '/api/gallery?img=' + image : origin + '/og.png';
  return String(html)
    .replace(/<title>[^<]*<\/title>/, '<title>' + t + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + d + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + t + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + d + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">')
    .replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + img + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
}
export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || ''), page = await env.ASSETS.fetch(new Request(new URL('/generators/make/', request.url)));
  let html = await page.text(), row = null;
  if (ID_RE.test(id) && env.DB) { try { row = await env.DB.prepare('SELECT id, title, text FROM void_gens WHERE id = ? AND reports < 3').bind(id).first(); } catch (_) { row = null; } }
  if (!row) return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  const g = compile(row.text), m = g.meta || {};
  html = withCard(html, { id, title: m.title || row.title, description: m.description || ('A random generator: ' + row.title + '. Press to make more; remix it into your own.'), image: m.image }, new URL(request.url).origin);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}

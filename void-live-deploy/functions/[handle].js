// a-to-mind.com/@name: the homepage, with that Void's look set in the HTML itself (so it is there on the first paint)
// and its public cards handed to the page as data. Anything that is not /@name falls through to the site as usual.
import { pageOf, HANDLE_RE } from '../lib/pages.js';

const inline = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export async function onRequestGet(ctx) {
  const { request, env, params, next } = ctx;
  const raw = String(params.handle || '');
  if (!raw.startsWith('@')) return next();
  const handle = raw.slice(1).toLowerCase();
  const home = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
  let html = await home.text();
  const page = HANDLE_RE.test(handle) && env.DB ? await pageOf(env, handle) : null;
  const pub = page ? { handle, look: page.look, cards: page.cards, updated: page.updated } : { handle, none: true };
  const vars = page ? `<style>:root{--void-bg:${page.look.bg};--void-glow:${page.look.glow}}</style>` : '';
  html = html.replace('<html', `<html data-fx="${page ? page.look.fx : 'off'}" data-page="@${handle.replace(/[^a-z0-9_]/g, '')}"`)
    .replace('</head>', `${vars}<script>window.__VOID_PAGE__=${inline(pub)}</script></head>`);
  return new Response(html, { status: page ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}

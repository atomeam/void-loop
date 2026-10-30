// a-to-mind.com/@name: the homepage, with that Verse's look set in the HTML itself (so it is there on the first paint)
// and its public cards handed to the page as data. Anything that is not /@name falls through to the site as usual.
import { pageOf, pageMember, shareTags, HANDLE_RE } from '../lib/pages.js';
import { tierOf } from '../lib/void-me.js';
import { builtBy } from '../lib/members.js';

const inline = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export async function onRequestGet(ctx) {
  const { request, env, params, next } = ctx;
  const raw = String(params.handle || '');
  if (!raw.startsWith('@')) return next();
  const handle = raw.slice(1).toLowerCase();
  const home = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
  let html = await home.text();
  const page = HANDLE_RE.test(handle) && env.DB ? await pageOf(env, handle) : null;
  // member: the page's owner is a MultiVerse member right now, so the page shows the mark (members perk, 2026-10-30); never who they are
  // built: the owner's ideas that Verse built, credit they keep (already public on /members/ under Built by members)
  const built = page ? await builtBy(env, handle) : [];
  const pub = page ? { handle, look: page.look, cards: page.cards, updated: page.updated, ...(await pageMember(env, handle, tierOf) ? { member: true } : {}), ...(built.length ? { built } : {}) } : { handle, none: true };
  const vars = page ? `<style>:root{--void-bg:${page.look.bg};--void-glow:${page.look.glow}}</style>` : '';
  if (page) html = shareTags(html, handle, page);
  html = html.replace('<html', `<html data-fx="${page ? page.look.fx : 'off'}" data-page="@${handle.replace(/[^a-z0-9_]/g, '')}"`)
    .replace('</head>', `${vars}<script>window.__VOID_PAGE__=${inline(pub)}</script></head>`);
  // no-store: unpublish and forget take a page down at once, and a handle's next owner never gets the old page from a cache
  return new Response(html, { status: page ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

// V01D Tube's RSS feed (owner, 2026-10-15: "an RSS feed so others can subscribe"): /films/rss, newest first, each item linking
// its watch page /films/?v=<id> (the film's own play link is signed and runs out, so the feed never carries it).
import { onRequestGet as list } from '../api/films.js';
const SITE = 'https://a-to-mind.com';
export const esc = (s) => String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
export function rss(films) {
  const items = films.map((f) => `<item><title>${esc(f.title)}</title><link>${SITE}/films/?v=${encodeURIComponent(f.id)}</link><guid isPermaLink="false">${esc(f.id)}</guid><pubDate>${new Date(f.at).toUTCString()}</pubDate><description>${esc(f.description)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Verse Tube</title><link>${SITE}/films/</link><description>Short films and ads Verse makes of itself. Free to watch, free to repost.</description>${items}</channel></rss>`;
}
export async function onRequestGet(ctx) {
  let films = [];
  try { const r = await list({ ...ctx, request: new Request(SITE + '/api/films') }); films = (await r.json()).films || []; } catch (_) {}
  return new Response(rss(films), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}

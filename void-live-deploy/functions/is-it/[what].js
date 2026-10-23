// a-to-mind.com/is-it/<day>: the one-word answer as its own page and feed (skills/is-it.js; owner's scout, 2026-10-23: isitchristmas.com has a
// page that works with JavaScript off and an RSS feed that says NO every day and YES once a year). The page is rendered here, so it answers with
// scripts off; with scripts on, a few lines redo it by the visitor's own clock (the server only knows UTC, or ?tz=Area/City). The word is in the
// language the browser asks for (Accept-Language), never guessed from the network. /is-it/<day>.rss is the feed. Nothing is stored; read only.
//   /is-it/christmas   /is-it/friday?tz=America/Toronto   /is-it/halloween.rss
import { isIt, wordFor } from '../../skills/is-it.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** "now" as the wall clock of a time zone (the Worker's own clock is UTC, so its getters then read that zone's day). Pure. */
export function wallClock(at, tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(at).map((x) => [x.type, x.value]));
    return new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  } catch (_) { return null; }
}
/** the languages a browser asks for, best first ("fr-CA,fr;q=0.9,en;q=0.8" -> ['fr-CA', 'fr', 'en']). Pure. */
export const langsOf = (h) => String(h || '').split(',').map((x) => x.trim().split(';')[0]).filter((x) => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(x)).slice(0, 6);

/** the page: one giant word, the note, today's date; the script only redoes it by the device's clock. Pure. */
export function page(slug, a, w, zone) {
  return '<!doctype html><html lang="' + esc(w.lang) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Is it ' + esc(a.what) + '?</title><link rel="alternate" type="application/rss+xml" href="/is-it/' + esc(slug) + '.rss">'
    + '<style>html,body{margin:0;height:100%;background:#fff;color:#000;font-family:system-ui,-apple-system,sans-serif}main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}'
    + 'h1{font-size:clamp(96px,26vw,260px);line-height:1;margin:0;font-weight:900}p{margin:.4em 0;font-size:18px}small,a{color:#555}@media (prefers-color-scheme:dark){html,body{background:#000;color:#fff}small,a{color:#aaa}}</style></head>'
    + '<body><main><h1 id="w">' + esc(w.word) + '</h1><p id="n">' + esc(a.note) + '</p><p id="t">' + esc(a.today) + '</p>'
    + '<small id="z">By the clock in ' + esc(zone) + '. <a href="/is-it/' + esc(slug) + '.rss">RSS</a> · <a href="/">Ask Verse anything</a></small></main>'
    + '<script type="module">import{isIt,wordFor}from"/skills/is-it.js";const a=isIt(' + JSON.stringify('is it ' + slug.replace(/-/g, ' ')) + ');if(a){const w=wordFor(a.yes,navigator.languages);'
    + 'document.getElementById("w").textContent=w.word;document.getElementById("n").textContent=a.note;document.getElementById("t").textContent=a.today;'
    + 'document.getElementById("z").firstChild.textContent="By this device\\u2019s clock ("+(Intl.DateTimeFormat().resolvedOptions().timeZone||"local time")+"). ";}</script></body></html>';
}
/** the feed: one item, today's answer (a reader polls it daily, as the old feed was read). Pure. */
export function feed(slug, a, w, origin, at) {
  const day = at.toISOString().slice(0, 10), url = origin + '/is-it/' + slug;
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Is it ' + esc(a.what) + '?</title><link>' + esc(url) + '</link>'
    + '<description>' + esc(a.what) + ': ' + esc(w.word) + ' or ' + esc(wordFor(!a.yes, [w.lang]).word) + ', one item a day, from Verse.</description><ttl>60</ttl>'
    + '<item><title>' + esc(w.word) + '</title><description>' + esc(a.note) + '</description><link>' + esc(url) + '</link><guid isPermaLink="false">' + esc(slug + '-' + day) + '</guid>'
    + '<pubDate>' + new Date(day + 'T00:00:00Z').toUTCString() + '</pubDate></item></channel></rss>';
}

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url), raw = String(params.what || '').toLowerCase().slice(0, 40);
  const rss = /\.rss$/.test(raw), slug = raw.replace(/\.rss$/, '').replace(/[^a-z0-9-]/g, '');
  const tz = (url.searchParams.get('tz') || '').slice(0, 40), now = wallClock(new Date(), tz) || wallClock(new Date(), 'UTC');
  const a = slug ? isIt('is it ' + slug.replace(/-/g, ' '), now) : null;
  if (!a) return new Response('Ask me about a day: /is-it/christmas, /is-it/friday, /is-it/halloween, /is-it/the-weekend', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const w = wordFor(a.yes, langsOf(request.headers.get('accept-language')));
  const headers = { 'cache-control': 'public, max-age=300', vary: 'accept-language', 'x-content-type-options': 'nosniff' };
  if (rss) return new Response(feed(slug, a, w, url.origin, new Date()), { headers: { ...headers, 'content-type': 'application/rss+xml; charset=utf-8' } });
  return new Response(page(slug, a, w, tz && wallClock(new Date(), tz) ? tz : 'UTC'), { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
}

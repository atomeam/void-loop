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
// the word as big as the screen allows (the tower gate, 2026-10-24: 101 px against isitchristmas.com's 160 at phone width): its size follows its
// length, so "NO" fills the width and "NAC YDY" still fits; --n is the word's letters, reset when the script answers in the device's language
// a full-width character (Chinese, Japanese, Korean) is about 1 em wide against about 0.8 for a Latin capital, so it counts 1.3
export const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60]/;
export const letters = (word) => Math.max(1, Array.from(String(word || '')).reduce((n, c) => n + (WIDE.test(c) ? 1.3 : 1), 0));
// a holiday and event countdown for any date (docs/WIDER-USE.md, owner 2026-10-28): days to go for this day, other days one tap away, any date
// handed to /time/ (a live countdown across time zones) and the day opened in /calendar/; works with scripts off (the form is a plain GET)
export const OTHER_DAYS = [['halloween', 'Halloween'], ['new-years-day', 'New Year'], ['valentines-day', 'Valentine’s'], ['easter', 'Easter'], ['thanksgiving', 'Thanksgiving'], ['friday', 'Friday'], ['the-weekend', 'The weekend']];
export function countdown(a) {
  const iso = a.at ? new Date(a.at).toISOString().slice(0, 10) : '', days = a.at ? Math.max(0, Math.round((a.at - Date.now()) / 864e5)) : null;
  return '<section id="any" aria-label="Holiday and event countdown"><p><b>Holiday &amp; event countdown</b>' + (days ? ' · ' + days + (days === 1 ? ' day' : ' days') + ' to ' + esc(a.what) : '') + '</p>'
    + '<form id="anyf" action="/time/" method="get"><label>Any date <input type="date" name="at" value="' + esc(iso) + '"></label> <button type="submit">Count down</button></form>'
    + '<p>' + OTHER_DAYS.map(([s, n]) => '<a href="/is-it/' + s + '">' + esc(n) + '</a>').join(' · ') + '</p>'
    // the day's Use with row: the calendar and the time zones take the day over (lib/toolkit.js's ring of tools; the self-check counts #related)
    + '<nav id="related" aria-label="Use with"><p>Use with ' + (iso ? '<a href="/calendar/?d=' + iso + '&amp;view=day">Open ' + esc(iso) + ' in the calendar</a> · <a href="/time/?at=' + iso + 'T00:00">Countdown across time zones</a>'
      : '<a href="/calendar/">the calendar</a> · <a href="/time/">time zones</a>') + '</p></nav></section>';
}
export function page(slug, a, w, zone, origin = 'https://a-to-mind.com') {
  const url = origin + '/is-it/' + slug, said = w.word + ': ' + a.note;
  return '<!doctype html><html lang="' + esc(w.lang) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Is it ' + esc(a.what) + '? Holiday &amp; event countdown</title><link rel="alternate" type="application/rss+xml" href="/is-it/' + esc(slug) + '.rss"><link rel="modulepreload" href="/skills/is-it.js">'
    + '<meta name="description" content="' + esc(said) + '"><meta property="og:type" content="website"><meta property="og:site_name" content="Verse"><meta property="og:title" content="Is it ' + esc(a.what) + '? ' + esc(w.word) + '">'
    + '<meta property="og:description" content="' + esc(said) + '"><meta property="og:url" content="' + esc(url) + '"><meta property="og:image" content="' + esc(origin) + '/og.png"><meta name="twitter:card" content="summary_large_image">'
    + '<style>html,body{margin:0;height:100%;background:#0b0a10;color:#ecebf5;color-scheme:dark;font-family:system-ui,-apple-system,sans-serif}main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box}'
    + 'h1{font-size:min(260px,calc(84vw / (var(--n) * .8)));line-height:1;margin:0;font-weight:900;white-space:nowrap}button{font:inherit;font-size:14px;color:inherit;background:none;border:1px solid #999;border-radius:999px;padding:4px 14px;cursor:pointer;margin-top:10px}p{margin:.4em 0;font-size:18px}small,a{color:#aaa}#any{margin-top:28px;font-size:14px;color:#aaa;max-width:36em}#any p{margin:8px 0}#any input{font:inherit;padding:2px 4px}</style><script src="/visit.js" defer></script></head>'
    + '<body><main><h1 id="w" style="--n:' + letters(w.word) + '">' + esc(w.word) + '</h1><p id="n">' + esc(a.note) + '</p><p id="t">' + esc(a.today) + '</p>'
    + '<small id="z">By the clock in ' + esc(zone) + '. <a href="/is-it/' + esc(slug) + '.rss">RSS</a> · <a href="/is-it/' + esc(slug) + '.rss?only=yes">RSS, on the day only</a> · <a href="/is-it/' + esc(slug) + '.json">JSON</a> · <a href="/">Ask Verse anything</a></small><button type="button" id="s">Share</button></main>'
    + countdown(a)
    + '<script type="module">import{isIt,wordFor}from"/skills/is-it.js";const a=isIt(' + JSON.stringify('is it ' + slug.replace(/-/g, ' ')) + ');if(a){const w=wordFor(a.yes,navigator.languages);'
    + 'const h=document.getElementById("w");h.textContent=w.word;h.style.setProperty("--n",Array.from(w.word).reduce((n,c)=>n+(/[\\u1100-\\u115f\\u2e80-\\ua4cf\\uac00-\\ud7a3\\uf900-\\ufaff\\uff00-\\uff60]/.test(c)?1.3:1),0));document.getElementById("n").textContent=a.note;document.getElementById("t").textContent=a.today;'
    + 'document.getElementById("z").firstChild.textContent="By this device\\u2019s clock ("+(Intl.DateTimeFormat().resolvedOptions().timeZone||"local time")+"). ";}'
    // Share: the phone's own share sheet, or the link copied; and the page opens offline after one visit (sw.js keeps /is-it/ pages)
    + 'document.getElementById("s").onclick=async()=>{const d={title:document.title,text:document.getElementById("w").textContent+": "+document.getElementById("n").textContent,url:location.href};try{if(navigator.share)await navigator.share(d);else{await navigator.clipboard.writeText(d.url);document.getElementById("s").textContent="Link copied";}}catch(_){}};'
    + 'const f=document.getElementById("anyf");f.onsubmit=(e)=>{const d=f.elements.at.value;if(!d)return;e.preventDefault();location.href="/time/?at="+d+"T00:00";};'
    + 'if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script></body></html>';
}
/** the answer for each of the last `n` days, newest first: [{ day: 'YYYY-MM-DD', a }] (isitchristmas.com's feed carries the last 10). Pure. */
export function lastDays(slug, now, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12); const a = isIt('is it ' + slug.replace(/-/g, ' '), d); if (a) out.push({ day: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), a }); }
  return out;
}
/** the feed: one item a day for the last ten days; `only` keeps the YES days alone (the old site's "Christmas only" feed: silent all
 *  year, one item on the day). Pure. */
export function feed(slug, a, w, origin, now, only = false) {
  const url = origin + '/is-it/' + slug, items = lastDays(slug, now).filter((x) => !only || x.a.yes);
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Is it ' + esc(a.what) + '?' + (only ? ' (' + esc(a.what) + ' only)' : '') + '</title><link>' + esc(url) + '</link>'
    + '<description>' + esc(a.what) + ': ' + esc(w.word) + ' or ' + esc(wordFor(!a.yes, [w.lang]).word) + (only ? ', only on the day itself' : ', one item a day') + ', from Verse.</description><ttl>60</ttl>'
    + items.map(({ day, a: x }) => '<item><title>' + esc(wordFor(x.yes, [w.lang]).word) + '</title><description>' + esc(x.note) + '</description><link>' + esc(url + '#' + day) + '</link><guid isPermaLink="false">' + esc(slug + '-' + day) + '</guid>'
      + '<pubDate>' + new Date(day + 'T00:00:00Z').toUTCString() + '</pubDate></item>').join('') + '</channel></rss>';
}
/** the answer as data, for a bot, a shortcut or a home screen widget (the old site's /api for IFTTT). Pure. */
export function answerJson(slug, a, w, zone) {
  return { what: a.what, yes: a.yes, word: w.word, lang: w.lang, note: a.note, today: a.today, next: a.at ? new Date(a.at).toISOString().slice(0, 10) : null, zone, page: '/is-it/' + slug, feed: '/is-it/' + slug + '.rss' };
}

export async function onRequestGet({ request, params }) {
  const url = new URL(request.url), raw = String(params.what || '').toLowerCase().slice(0, 40);
  const rss = /\.rss$/.test(raw), json = /\.json$/.test(raw), slug = raw.replace(/\.(?:rss|json)$/, '').replace(/[^a-z0-9-]/g, '');
  const tz = (url.searchParams.get('tz') || '').slice(0, 40), now = wallClock(new Date(), tz) || wallClock(new Date(), 'UTC');
  const a = slug ? isIt('is it ' + slug.replace(/-/g, ' '), now) : null;
  if (!a) return new Response('Ask me about a day: /is-it/christmas, /is-it/friday, /is-it/halloween, /is-it/the-weekend', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const w = wordFor(a.yes, langsOf(request.headers.get('accept-language')));
  const headers = { 'cache-control': 'public, max-age=300', vary: 'accept-language', 'x-content-type-options': 'nosniff' };
  if (rss) return new Response(feed(slug, a, w, url.origin, now, url.searchParams.get('only') === 'yes'), { headers: { ...headers, 'content-type': 'application/rss+xml; charset=utf-8' } });
  if (json) return new Response(JSON.stringify(answerJson(slug, a, w, tz && wallClock(new Date(), tz) ? tz : 'UTC')), { headers: { ...headers, 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
  return new Response(page(slug, a, w, tz && wallClock(new Date(), tz) ? tz : 'UTC', url.origin), { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
}

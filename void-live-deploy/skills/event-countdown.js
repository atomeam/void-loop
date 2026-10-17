/**
 * event-countdown skill - how long until a named event: "how many hours til gta6", "how long until the world cup starts", "countdown to
 * the olympics" (owner's pasted card, 2026-10-17: V01D said GTA VI had no release date when it had one, 19 November 2026). The date
 * comes from the event's own Wikipedia summary, read now, never from a model's memory; the card names the source and counts down live.
 * When the summary names no date still ahead it says exactly that. Dates, holidays and times of day stay with countdown, holidays and
 * the clock (lib/event-date.js eventAsk leaves them out).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { eventAsk, searchWords, announcedDate, left } from '../lib/event-date.js';

const WIKI = 'https://en.wikipedia.org';
const UA = { headers: { 'Api-User-Agent': 'V01D/1.0 (https://a-to-mind.com)' } };

/** the summary of the page that best names the event: the exact title first, then the top search hit. { title, extract, url } or null */
async function summaryOf(words) {
  const page = async (title) => {
    const r = await fetch(WIKI + '/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), UA);
    if (!r.ok) return null; const j = await r.json();
    if (!j || !j.extract || j.type === 'disambiguation') return null;
    return { title: String(j.title || title), extract: String(j.extract), url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || WIKI + '/wiki/' + encodeURIComponent(title) };
  };
  try {
    const exact = await page(words); if (exact) return exact;
    const s = await fetch(WIKI + '/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=' + encodeURIComponent(words), UA).then((r) => r.json());
    const hit = s && s.query && s.query.search && s.query.search[0];
    return hit ? await page(hit.title) : null;
  } catch (_) { return null; }
}

const n = (x, w) => x + ' ' + w + (x === 1 ? '' : 's');
/** the big line in the unit asked for: "781 hours", "32 days, 13 hours". Pure. */
export function bigLine(l, unit) {
  if (unit === 'hours') return n(l.totalHours, 'hour');
  if (unit === 'minutes') return n(Math.floor(l.ms / 60000), 'minute');
  if (unit === 'weeks') return n(Math.floor(l.days / 7), 'week') + (l.days % 7 ? ', ' + n(l.days % 7, 'day') : '');
  return n(l.days, 'day') + (l.hours ? ', ' + n(l.hours, 'hour') : '');
}

async function run(text, api) {
  const ask = eventAsk(text); if (!ask) return 'none';
  const { showPage, esc } = api;
  let body;
  const el = showPage((p) => { p.innerHTML = '<h2></h2><div class="ec-body"><p>Looking up when ' + esc(ask.event) + ' is…</p></div>'; p.querySelector('h2').textContent = 'Until ' + ask.event; body = p.querySelector('.ec-body'); });
  const s = await summaryOf(searchWords(ask.event));
  if (!el.isConnected) return 'event-countdown';
  const when = s && announcedDate(s.extract);
  if (!s) { body.innerHTML = '<p>I could not find ' + esc(ask.event) + ' to look up its date. Try its full name.</p>'; return 'event-countdown'; }
  el.querySelector('h2').textContent = 'Until ' + s.title;
  const src = '<div class="src">Source: <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + ' on Wikipedia</a>, read just now</div>';
  if (!when) { body.innerHTML = '<p>' + esc(s.title) + ' has no announced date still ahead on its Wikipedia page, so there is nothing to count down to yet.</p>' + src; return 'event-countdown'; }
  const day = when.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  body.innerHTML = '<p class="ec-big" style="font-size:30px;font-weight:600;margin:6px 0"></p><p class="ec-rest" style="opacity:.8;margin:0 0 10px"></p>'
    + '<p>' + esc(s.title) + ': ' + esc(day) + ' (counted to the start of that day where you are; the hour can differ by region).</p>'
    + '<blockquote style="margin:8px 0;opacity:.85">' + esc(when.sentence.slice(0, 280)) + '</blockquote>' + src;
  const big = body.querySelector('.ec-big'), rest = body.querySelector('.ec-rest');
  const tick = () => {
    if (!el.isConnected) return clearInterval(timer);
    const l = left(when.date);
    big.textContent = l.ms ? bigLine(l, ask.unit) : 'Today';
    rest.textContent = l.ms ? n(l.days, 'day') + ', ' + n(l.hours, 'hour') + ', ' + n(l.minutes, 'minute') : '';
  };
  const timer = setInterval(tick, 30000); tick();
  return 'event-countdown';
}

export default {
  name: 'event-countdown',
  examples: [
    'how many hours til gta6',
    'how long until gta 6 comes out',
    'countdown to the world cup',
  ],
  nearMisses: [
    'how many days until christmas',
    'how long until sunset',
    'how long to boil an egg',
    'what is gta 6',
  ],
  match(lower, text) { return !!eventAsk(text || lower); },
  run,
};

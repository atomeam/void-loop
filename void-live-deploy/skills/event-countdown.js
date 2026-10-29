/**
 * event-countdown skill - how long until a named event: "how many hours til gta6", "how long until the world cup starts", "countdown to
 * the olympics" (owner's pasted card, 2026-10-17: Verse said GTA VI had no release date when it had one, 19 November 2026). The date
 * comes from the event's own Wikipedia summary, read now, never from a model's memory; the card names the source and counts down live.
 * When the summary names no date still ahead it says exactly that. Dates, holidays and times of day stay with countdown, holidays and
 * the clock (lib/event-date.js eventAsk leaves them out).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { eventAsk, searchWords, announcedFrom, confidenceOf, rawSnippet, left } from '../lib/event-date.js';

const WIKI = 'https://en.wikipedia.org';
const UA = { headers: { 'Api-User-Agent': 'Verse/1.0 (https://a-to-mind.com)' } };

/** the summary of the page that best names the event: the exact title first, then the top search hit. { title, extract, url } or null */
async function summaryOf(words) {
  const page = async (title) => {
    const r = await fetch(WIKI + '/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), UA);
    if (!r.ok) return null; const j = await r.json();
    if (!j || !j.extract || j.type === 'disambiguation') return null;
    return { title: String(j.title || title), extract: String(j.extract), edited: String(j.timestamp || ''), url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || WIKI + '/wiki/' + encodeURIComponent(title) };
  };
  try {
    const exact = await page(words); if (exact) return exact;
    const s = await fetch(WIKI + '/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=' + encodeURIComponent(words), UA).then((r) => r.json());
    const hit = s && s.query && s.query.search && s.query.search[0];
    return hit ? await page(hit.title) : null;
  } catch (_) { return null; }
}

const n = (x, w) => x + ' ' + w + (x === 1 ? '' : 's');
/** how fresh the source is, after the confidence badge (asked by Verse: "a 'last-verified' timestamp to the confidence badge so users know how
 *  fresh the source data is"): the page's last edit from Wikipedia and when Verse read it. '' when the page gave no edit time. Pure. */
export function verifiedLine(edited, now = new Date()) {
  const e = new Date(edited || ''); if (!edited || isNaN(e)) return '';
  const day = e.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return 'page last edited ' + day + ' · checked ' + now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
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
  // the summary is the article's first paragraph, which often leaves the date to later in the lead or to the infobox (the live GTA VI card)
  let when = s && announcedFrom({ extract: s.extract });
  if (s && !when) {
    const api = (q) => fetch(WIKI + '/w/api.php?' + q + '&format=json&formatversion=2&origin=*&titles=' + encodeURIComponent(s.title), UA).then((r) => r.json()).catch(() => null);
    const sec0 = (t) => fetch(WIKI + '/w/api.php?action=parse&prop=wikitext&section=0&format=json&formatversion=2&origin=*&page=' + encodeURIComponent(t), UA).then((r) => r.json()).catch(() => null);
    const [lead, wiki] = await Promise.all([api('action=query&prop=extracts&exintro=1&explaintext=1'), sec0(s.title)]);
    const leadText = (lead && lead.query && lead.query.pages && lead.query.pages[0] && lead.query.pages[0].extract) || '';
    when = announcedFrom({ extract: s.extract, lead: leadText, wikitext: (wiki && wiki.parse && wiki.parse.wikitext) || '' });
    if (!el.isConnected) return 'event-countdown';
  }
  if (!s) { body.innerHTML = '<p>I could not find ' + esc(ask.event) + ' to look up its date. Try its full name.</p>'; return 'event-countdown'; }
  el.querySelector('h2').textContent = 'Until ' + s.title;
  const src = '<div class="src">Source: <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + ' on Wikipedia</a>, read just now</div>';
  if (!when) { body.innerHTML = '<p>' + esc(s.title) + ' has no announced date still ahead on its Wikipedia page, so there is nothing to count down to yet.</p>' + src; return 'event-countdown'; }
  const conf = confidenceOf(when.from); el.dataset.dateFrom = when.from; // the card says, and keeps, which part of the page the date came from
  const day = when.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  body.innerHTML = '<p class="ec-big" style="font-size:30px;font-weight:600;margin:6px 0"></p><p class="ec-rest" style="opacity:.8;margin:0 0 10px"></p>'
    + '<p>' + esc(s.title) + ': ' + esc(day) + ' (counted to the start of that day where you are; the hour can differ by region).</p>'
    + '<blockquote style="margin:8px 0;opacity:.85">' + esc(when.sentence.slice(0, 280)) + '</blockquote>'
    + '<p class="ec-sure" data-from="' + esc(when.from) + '" data-sure="' + esc(conf.sure) + '" style="font-size:12px;margin:4px 0;opacity:' + (conf.sure === 'high' ? '.95' : '.6') + '"><span class="ec-badge" tabindex="0" title="' + esc(rawSnippet(when)) + '" style="display:inline-block;padding:1px 8px;border-radius:9px;border:1px solid currentColor;margin-right:6px;cursor:help">' + (conf.sure === 'high' ? 'sure' : 'less sure') + '</span> ' + esc('Date ' + conf.label) + (verifiedLine(s.edited) ? ' <span class="ec-verified" data-verified="' + esc(s.edited) + '">· ' + esc(verifiedLine(s.edited)) + '</span>' : '')
    // the raw text the date was read from, on hover, focus or a tap of the badge (asked by Verse, twice)
    // left out of a saved or copied card (lib/card-share.js data-share-skip): the sentence is already in the quote above
    + '<code class="ec-raw" data-share-skip style="display:none;margin-top:4px;padding:4px 6px;border-radius:4px;background:rgba(255,255,255,.07);white-space:pre-wrap;word-break:break-word">' + esc(rawSnippet(when)) + '</code></p>'
    + '<style>.ec-sure:hover .ec-raw,.ec-sure:focus-within .ec-raw,.ec-sure.open .ec-raw{display:block!important}</style>' + src;
  const badge = body.querySelector('.ec-badge'); if (badge) badge.addEventListener('click', () => badge.parentNode.classList.toggle('open'));
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
    'how many days until summer',
    'how long until sunset',
    'how long to boil an egg',
    'what is gta 6',
  ],
  match(lower, text) { return !!eventAsk(text || lower); },
  run,
};

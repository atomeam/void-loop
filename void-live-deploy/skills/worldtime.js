/**
 * worldtime skill — the time anywhere, converting a time between two places, sunrise and sunset. Open-Meteo, no key
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * Places and time zones come from Open-Meteo geocoding; sunrise and sunset from the Open-Meteo forecast. Clock math uses the
 * browser's own time-zone data (Intl), so nothing else is called.
 */
const CLEAN = (s) => s.replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
const PLACE = (s) => CLEAN(s).replace(/^(the\s+)/i, '').replace(/\s+(right\s+)?now$/i, '').replace(/\s+(today|tomorrow)$/i, '').trim();
const NOT_PLACE = /^(it|this|that|here|there|my\s+\w+|the\s+\w+\s+zone|a\s+\w+|\d+.*)$/i;
const TIME = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|\\d{1,2}:\\d{2}|noon|midnight)';

// One ask -> { kind: 'now' | 'convert' | 'sun', ... } or null. Only asks that name a place (or two) are ours.
export function parseWorldTime(text) {
  const t = CLEAN(text || '');
  // "world clock", "show the world clock", "world clock for Paris, Sydney and Lagos" (Tokyo, London and New York by default)
  let m = t.match(/^(?:show\s+(?:me\s+)?|open\s+)?(?:the\s+|a\s+)?world\s*clocks?(?:\s+(?:for|with)\s+(.+))?$/i);
  if (m) {
    const places = m[1] ? m[1].split(/\s*(?:,|\band\b|&)\s*/i).map(PLACE).filter((x) => x && !NOT_PLACE.test(x)).slice(0, 8) : [];
    return { kind: 'clock', places };
  }
  m = t.match(/^(?:(?:what|what's|whats)\s+(?:is\s+)?)?(?:the\s+)?(?:current\s+|local\s+)?time\s+(?:is\s+it\s+)?(?:right\s+now\s+)?(?:in|at)\s+(.+)$/i)
    || t.match(/^what\s+time\s+is\s+it\s+(?:right\s+now\s+)?(?:in|at)\s+(.+)$/i)
    || t.match(/^(?:current|local)\s+time\s+(?:in|at|for)\s+(.+)$/i)
    || t.match(/^what\s+(?:day|date)\s+is\s+it\s+(?:today\s+)?(?:in|at)\s+(.+)$/i)
    || t.match(/^(?:what'?s|whats|what\s+is)\s+(?:the\s+)?(?:date|day)\s+(?:today\s+)?(?:in|at)\s+(.+)$/i)
    // "what is the time zone of Denver", "time zone in Tokyo", "what time zone is Denver in": the card shows the zone and offset
    || t.match(/^(?:(?:what|what's|whats)\s+(?:is\s+)?)?(?:the\s+)?time\s*zone\s+(?:of|in|for)\s+(.+)$/i)
    || t.match(/^what\s+time\s*zone\s+is\s+(.+?)(?:\s+in)?$/i);
  if (m) { const place = PLACE(m[1]); return place && !NOT_PLACE.test(place) ? { kind: 'now', place } : null; }
  // "hours between 3pm London and Tokyo", "time difference between London and Tokyo" (no time = now)
  m = t.match(new RegExp('^(?:how\\s+many\\s+)?hours?\\s+(?:difference\\s+)?between\\s+(?:' + TIME + '\\s+(?:in\\s+)?)?(.+?)\\s+and\\s+(.+?)(?:\\s+time)?$', 'i'))
    || t.match(/^(?:what(?:'s|s|\s+is)\s+)?(?:the\s+)?time\s+difference\s+(?:between\s+)?()(.+?)\s+(?:and|to|vs\.?)\s+(.+)$/i);
  if (m) {
    const from = PLACE(m[2]), to = PLACE(m[3]);
    if (from && to && !NOT_PLACE.test(from) && !NOT_PLACE.test(to)) return { kind: 'convert', time: m[1] ? m[1].toLowerCase().replace(/\./g, '').replace(/\s+/g, '') : 'now', from, to };
    return null;
  }
  m = t.match(new RegExp('^(?:convert\\s+|what\\s+is\\s+|what\'s\\s+)?' + TIME + '\\s+(?:in\\s+)?(.+?)\\s+(?:to|in)\\s+(.+?)(?:\\s+time)?$', 'i'));
  if (m) {
    const from = PLACE(m[2]), to = PLACE(m[3]);
    if (from && to && !NOT_PLACE.test(from) && !NOT_PLACE.test(to)) return { kind: 'convert', time: m[1].toLowerCase().replace(/\./g, '').replace(/\s+/g, ''), from, to };
    return null;
  }
  m = t.match(/^(?:(?:when|what\s+time)\s+is\s+|what's\s+|whats\s+)?(?:the\s+)?(?:(today's|tomorrow's)\s+)?(sunrise|sunset|sun\s+rise|sun\s+set|dawn|dusk)\s+(?:(?:today|tomorrow)\s+)?(?:in|at|for)\s+(.+)$/i)
    || t.match(/^(?:(when)\s+)?does\s+the\s+sun\s+(rise|set)\s+(?:(?:today|tomorrow)\s+)?(?:in|at)\s+(.+)$/i);
  if (m) {
    const which = /rise|dawn/i.test(m[2]) ? 'sunrise' : 'sunset', place = PLACE(m[3]);
    const tomorrow = /tomorrow/i.test(t);
    return place && !NOT_PLACE.test(place) ? { kind: 'sun', which, place, tomorrow } : null;
  }
  return null;
}

// The UTC offset (minutes) of a time zone at a given instant, from Intl alone.
function offsetMin(tz, at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const g = (k) => +parts.find((p) => p.type === k).value;
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - at.getTime()) / 60000);
}
// Wall-clock y-m-d h:m in tz -> the real instant (checked twice, so a DST change in between still lands right).
function instantIn(tz, y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo, d, h, mi);
  let at = new Date(guess - offsetMin(tz, new Date(guess)) * 60000);
  at = new Date(guess - offsetMin(tz, at) * 60000);
  return at;
}
function ymdIn(tz, at) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at).split('-');
  return [+p[0], +p[1] - 1, +p[2]];
}
function parseClock(s) {
  if (s === 'noon') return [12, 0];
  if (s === 'midnight') return [0, 0];
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = +m[1]; const mi = +(m[2] || 0);
  if (m[3]) { if (h < 1 || h > 12) return null; h = (h % 12) + (m[3] === 'pm' ? 12 : 0); }
  if (h > 23 || mi > 59) return null;
  return [h, mi];
}
const fmtTime = (tz, at) => new Intl.DateTimeFormat([], { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at);
const fmtDay = (tz, at) => new Intl.DateTimeFormat([], { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(at);
const gmt = (min) => 'UTC' + (min >= 0 ? '+' : '−') + Math.floor(Math.abs(min) / 60) + (Math.abs(min) % 60 ? ':' + String(Math.abs(min) % 60).padStart(2, '0') : '');
function diffWords(min) {
  if (!min) return 'same time as you';
  const h = Math.abs(min) / 60, n = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, '');
  return n + (h === 1 ? ' hour ' : ' hours ') + (min > 0 ? 'ahead of you' : 'behind you');
}
const label = (r) => r.name + (r.admin1 && r.admin1 !== r.name ? ', ' + r.admin1 : '') + (r.country ? ', ' + r.country : '');
const SRC = '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (place and time zone) · clock from your browser</div>';

// Which of the places with this name was meant. "Springfield, Illinois" (or ", IL", ", US") narrows by state or country.
// Several towns of the same name, none far bigger than the next, are a real question: { choices } lists them, and the page
// asks. For the time itself, towns in one time zone are the same answer, so only a difference in zone makes it a question.
const US_STATES = { al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming' };
export function pickPlace(results, name, zoneOnly) {
  const [base, ...rest] = String(name || '').split(',');
  const qual = rest.join(',').trim().toLowerCase().replace(/\./g, '');
  let rs = (results || []).filter((r) => r && r.timezone).sort((a, b) => (b.population || 0) - (a.population || 0));
  if (qual) {
    const want = US_STATES[qual] || qual;
    const fits = (r) => [r.admin1, r.admin2, r.country].some((x) => x && x.toLowerCase() === want) || (r.country_code && r.country_code.toLowerCase() === (qual === 'uk' ? 'gb' : qual === 'usa' ? 'us' : qual))
      || [r.admin1, r.country].some((x) => x && want.length > 3 && x.toLowerCase().startsWith(want));
    const narrowed = rs.filter(fits);
    return { r: narrowed[0] || null, choices: null };
  }
  if (!rs.length) return { r: null, choices: null };
  const b = base.trim().toLowerCase();
  const same = rs.filter((r) => r.name && r.name.toLowerCase() === b);
  const seen = new Set(), distinct = [];
  for (const r of same) { const k = (r.admin1 || '') + '|' + r.country_code; if (!seen.has(k)) { seen.add(k); distinct.push(r); } }
  const top = distinct[0], next = distinct[1];
  // a city of a million or more is what people mean (Dublin, Birmingham); otherwise within 20x of the next is a real question
  const close = top && next && !(top.population >= 1e6) && (!(top.population > 0) || (top.population || 0) < 20 * (next.population || 0));
  if (close) {
    const pool = distinct.filter((r) => !top.population || (r.population || 0) * 20 > top.population).slice(0, 6);
    const zones = new Set(pool.map((r) => r.timezone));
    if (pool.length > 1 && (!zoneOnly || zones.size > 1)) return { r: null, choices: pool };
  }
  return { r: rs[0], choices: null };
}
// "Springfield, Illinois": the state when it tells two apart, else the country
export function choiceLabel(r, all) {
  const twin = (all || []).some((o) => o !== r && o.admin1 === r.admin1 && o.country_code === r.country_code);
  return r.name + ', ' + (r.admin1 && !twin ? r.admin1 : r.country || r.admin1 || '');
}
async function geo(name, zoneOnly) {
  const base = String(name).split(',')[0].trim();
  const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&name=' + encodeURIComponent(base)).then((r) => r.json());
  return pickPlace(g.results, name, zoneOnly);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseWorldTime(text);
  if (!q) return 'none';
  const title = q.kind === 'clock' ? 'World clock' : q.kind === 'convert' ? q.time + ' ' + q.from + ' → ' + q.to : q.kind === 'sun' ? q.which[0].toUpperCase() + q.which.slice(1) + ' in ' + q.place : 'Time in ' + q.place;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  const choose = (n, pool) => {
    const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    el.innerHTML = '<h2>Which ' + esc(n) + '?</h2><div class="sub">There\'s more than one. Pick one, or ask again with the state or country.</div>'
      + '<ul class="choices">' + pool.map((r) => { const l = choiceLabel(r, pool); return '<li><a href="#" data-ask="' + esc(text.replace(re, l)) + '">' + esc(l) + (r.population ? ' <small>· ' + esc(r.population.toLocaleString()) + ' people</small>' : '') + ' <small>· ' + esc(r.timezone.replace(/_/g, ' ')) + '</small></a></li>'; }).join('') + '</ul>'
      + SRC;
    api.say && api.say('which one?');
    return 'worldtime';
  };
  const missing = (n) => { el.innerHTML = '<h2>' + esc(title) + '</h2><p>I couldn\'t find "' + esc(n) + '". Try a city name, like "time in Tokyo".</p>'; return 'none'; };
  try {
    const now = new Date(), youTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (q.kind === 'clock') {
      // no lookup for the default three; named places go through the same geocoder as everything else
      let rows = [{ name: 'Tokyo', tz: 'Asia/Tokyo' }, { name: 'London', tz: 'Europe/London' }, { name: 'New York', tz: 'America/New_York' }];
      if (q.places.length) {
        const found = await Promise.all(q.places.map((n) => geo(n, true).then((g) => ({ n, g })).catch(() => ({ n, g: { r: null } }))));
        if (!api._pageStill(el)) return 'worldtime';
        const miss = found.filter((x) => !x.g.r && !x.g.choices).map((x) => x.n);
        rows = found.filter((x) => x.g.r || x.g.choices).map((x) => { const r = x.g.r || x.g.choices[0]; return { name: r.name, tz: r.timezone }; });
        if (!rows.length) return missing(miss[0] || q.places[0]);
        el._missing = miss;
      }
      rows.push({ name: 'You', tz: youTz, you: true });
      const draw = () => {
        const at = new Date(), yo = offsetMin(youTz, at);
        el.innerHTML = '<h2 class="wt">World clock</h2>'
          + '<div class="wclock">' + rows.map((r) => {
            const off = offsetMin(r.tz, at), day = ymdIn(r.tz, at).join('-'), yday = ymdIn(youTz, at).join('-');
            return '<div class="wrow' + (r.you ? ' you' : '') + '"><div><b>' + esc(r.name) + '</b><div class="sub" style="margin:0">' + esc(r.tz.replace(/_/g, ' ')) + ' · ' + gmt(off) + (r.you ? '' : ' · ' + esc(diffWords(off - yo))) + (day === yday ? '' : day > yday ? ' · tomorrow' : ' · yesterday') + '</div></div>'
              + '<div class="wtime">' + esc(fmtTime(r.tz, at)) + '</div></div>';
          }).join('') + '</div>'
          + (el._missing && el._missing.length ? '<p class="sub">I couldn\'t find ' + esc(el._missing.join(', ')) + '.</p>' : '')
          + SRC;
      };
      draw();
      // it keeps time while it is open, then stops
      const tick = setInterval(() => { if (!api._pageStill(el)) return clearInterval(tick); draw(); }, 15000);
      return 'worldtime';
    }
    if (q.kind === 'now') {
      const { r, choices } = await geo(q.place, true);
      if (!api._pageStill(el)) return 'worldtime';
      if (choices) return choose(q.place, choices);
      if (!r) return missing(q.place);
      const off = offsetMin(r.timezone, now), youOff = offsetMin(youTz, now);
      el.innerHTML = '<h2 class="wt">' + esc(label(r)) + '</h2>'
        + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(fmtTime(r.timezone, now)) + '</div>'
        + '<div class="sub">' + esc(fmtDay(r.timezone, now)) + ' · ' + esc(r.timezone.replace(/_/g, ' ')) + ' · ' + gmt(off) + ' · ' + esc(diffWords(off - youOff)) + '</div>'
        + SRC;
      return 'worldtime';
    }
    if (q.kind === 'convert') {
      const nowMode = q.time === 'now';
      const hm = nowMode ? [0, 0] : parseClock(q.time);
      const [ga, gb] = await Promise.all([geo(q.from, true), geo(q.to, true)]);
      if (!api._pageStill(el)) return 'worldtime';
      if (!hm) { el.innerHTML = '<h2>' + esc(title) + '</h2><p>"' + esc(q.time) + '" isn\'t a time I can read. Try "3pm London to Tokyo".</p>'; return 'none'; }
      if (ga.choices) return choose(q.from, ga.choices);
      if (gb.choices) return choose(q.to, gb.choices);
      const a = ga.r, b = gb.r;
      if (!a) return missing(q.from);
      if (!b) return missing(q.to);
      const [y, mo, d] = ymdIn(a.timezone, now);
      const at = nowMode ? now : instantIn(a.timezone, y, mo, d, hm[0], hm[1]);
      const gapMin = offsetMin(b.timezone, at) - offsetMin(a.timezone, at), gh = Math.floor(Math.abs(gapMin) / 60), gm = Math.abs(gapMin) % 60;
      const gapLine = gapMin === 0 ? b.name + ' and ' + a.name + ' are on the same time' : b.name + ' is ' + (gh ? gh + (gh === 1 ? ' hour' : ' hours') : '') + (gh && gm ? ' ' : '') + (gm ? gm + ' minutes' : '') + (gapMin > 0 ? ' ahead of ' : ' behind ') + a.name;
      const dayA = ymdIn(a.timezone, at).join('-'), dayB = ymdIn(b.timezone, at).join('-');
      const shift = dayA === dayB ? '' : (dayB > dayA ? ' (next day)' : ' (day before)');
      el.innerHTML = '<div class="sub wt">' + esc(fmtTime(a.timezone, at)) + ' in ' + esc(label(a)) + ' is</div>'
        + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(fmtTime(b.timezone, at)) + '</div>'
        + '<div class="sub">in ' + esc(label(b)) + ' · ' + esc(fmtDay(b.timezone, at)) + esc(shift) + ' · ' + gmt(offsetMin(a.timezone, at)) + ' → ' + gmt(offsetMin(b.timezone, at)) + '</div>'
        + '<p class="wt-gap">' + esc(gapLine) + '.</p>'
        + SRC;
      return 'worldtime';
    }
    // sunrise / sunset
    const { r, choices } = await geo(q.place, false);
    if (!api._pageStill(el)) return 'worldtime';
    if (choices) return choose(q.place, choices);
    if (!r) return missing(q.place);
    const w = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + r.latitude + '&longitude=' + r.longitude + '&daily=sunrise,sunset&timezone=' + encodeURIComponent(r.timezone) + '&forecast_days=2').then((x) => x.json());
    if (!api._pageStill(el)) return 'worldtime';
    const days = (w.daily && w.daily.time) || [], list = (w.daily && w.daily[q.which]) || [];
    if (!list.length) throw new Error('no sun times');
    const toInstant = (s) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return instantIn(r.timezone, +m[1], +m[2] - 1, +m[3], +m[4], +m[5]); };
    let i = q.tomorrow ? 1 : 0;
    if (!q.tomorrow && list[1] && toInstant(list[0]) < now) i = 1; // today's already passed: show the next one
    const at = toInstant(list[i] || list[0]);
    const other = q.which === 'sunrise' ? 'sunset' : 'sunrise', o = w.daily[other] && w.daily[other][i];
    el.innerHTML = '<h2 class="wt">' + esc(q.which === 'sunrise' ? 'Sunrise' : 'Sunset') + ' · ' + esc(label(r)) + '</h2>'
      + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(fmtTime(r.timezone, at)) + '</div>'
      + '<div class="sub">' + esc(fmtDay(r.timezone, at)) + (i && !q.tomorrow ? ' (today\'s has passed)' : '') + ' · local time, ' + esc(r.timezone.replace(/_/g, ' '))
      + (o ? ' · ' + other + ' ' + esc(fmtTime(r.timezone, toInstant(o))) : '') + '</div>'
      + '<div class="src">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></div>';
    return 'worldtime';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>The time service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'worldtime',
  examples: ['world clock', 'time in Tokyo', '3pm London to Tokyo', 'sunset in Paris', 'when is sunrise in New York', 'what time is it in Sydney', 'what day is it in Auckland', 'time difference between London and Tokyo', 'time zone of Denver'],
  nearMisses: ['make a clock', 'make a 5 minute timer', 'what is time', 'set a timer for 3pm', 'time zones explained'],
  match(lower, text) { return !!parseWorldTime(text); },
  run
};

/**
 * worldtime skill — Open-Meteo geocoding (gives each place's time zone), no key
 * Contract: { name, examples, match(lower, text), run(text, api) }
 * api: { showPage, esc, say, reportMiss, loopLog }
 * Asks: "time in Tokyo", "what time is it in London", "current time in New York", "Tokyo time now",
 * "time zone in Lisbon", "time difference between Paris and Tokyo".
 * Left alone: "make a clock", "what time is it", timers, "time in a bottle", "once upon a time in Hollywood", "screen time".
 */
const LEAD = /^(?:(?:what'?s|what\s+is|tell\s+me|show\s+me)\s+)?(?:the\s+)?(?:current\s+|local\s+)?(?:time\s+(?:is\s+it\s+|right\s+now\s+|now\s+)?(?:in|at)|(?:time\s+zone|timezone)\s+(?:in|at|for|of))\s+(.+)$/;
const ASK = /^what\s+time\s+is\s+it\s+(?:right\s+now\s+|now\s+)?in\s+(.+)$/;
const TRAIL = /^(?:(?:what'?s|what\s+is)\s+(?:the\s+)?)?([a-z][a-z .,'-]*?)\s+(?:local\s+)?time\s+(?:now|right\s+now)$/;
const DIFF = /^(?:what'?s\s+|what\s+is\s+)?(?:the\s+)?time\s+difference\s+(?:between\s+)?(.+?)\s+(?:and|vs\.?|to)\s+(.+)$/;
const NOT_PLACE = /^(?:a|an|my|your|our|this|that|it|here|there|home|work|school|night|noon|midnight|history|the\s+(?:past|future|moment|morning|afternoon|evening|day|night|meantime|office))\b/;

function clean(s) {
  return s.replace(/[?.!]+$/, '').replace(/\b(right now|now|today)\b/g, '').replace(/\s+/g, ' ').trim();
}
function okPlace(p) {
  return p && p.length <= 60 && p.split(' ').length <= 5 && !NOT_PLACE.test(p) && !/\d/.test(p);
}
function parse(lower) {
  const t = lower.replace(/[?!]+$/, '').replace(/\.$/, '').trim();
  let m = t.match(DIFF);
  if (m) { const a = clean(m[1]), b = clean(m[2]); return okPlace(a) && okPlace(b) ? { places: [a, b] } : null; }
  m = t.match(ASK) || t.match(LEAD) || t.match(TRAIL);
  if (m) { const a = clean(m[1]); return okPlace(a) ? { places: [a] } : null; }
  return null;
}

async function geocode(place) {
  const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place)).then((r) => r.json());
  const r0 = g.results && g.results[0];
  if (!r0 || !r0.timezone) return null;
  return { tz: r0.timezone, name: r0.name + (r0.admin1 && r0.admin1 !== r0.name ? ', ' + r0.admin1 : '') + (r0.country ? ', ' + r0.country : '') };
}

// Minutes east of UTC for a zone at a moment (DST-aware, no library).
function offsetMin(tz, d) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d)) parts[p.type] = p.value;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}
function utcLabel(min) {
  const s = min < 0 ? '−' : '+', a = Math.abs(min);
  return 'UTC' + s + Math.floor(a / 60) + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : '');
}
function gapLabel(min) {
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  return (h ? h + (h === 1 ? ' hour' : ' hours') : '') + (h && m ? ' ' : '') + (m ? m + ' minutes' : '');
}
function relTo(minA, minB, nameB) {
  const d = minA - minB;
  return d === 0 ? 'same time as ' + nameB : gapLabel(d) + (d > 0 ? ' ahead of ' : ' behind ') + nameB;
}
function timeStr(tz, d) { return d.toLocaleTimeString([], { timeZone: tz, hour: 'numeric', minute: '2-digit' }); }
function dayStr(tz, d) { return d.toLocaleDateString([], { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); }

async function run(text, api) {
  const { showPage, esc } = api;
  const ask = parse(text.toLowerCase().trim());
  if (!ask) return 'none';
  const title = ask.places.length === 2 ? 'Time difference' : ask.places[0];
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  let locs;
  try {
    locs = await Promise.all(ask.places.map(geocode));
  } catch (_) {
    if (api._pageStill(el)) el.innerHTML = '<h2>' + esc(title) + '</h2><p>The place lookup didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
  if (!api._pageStill(el)) return 'worldtime';
  const missing = ask.places.filter((_, i) => !locs[i]);
  if (missing.length) {
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>I couldn\'t find “' + esc(missing[0]) + '”. Try a city name, like “time in Tokyo”.</p>';
    return 'none';
  }
  const src = '<div class="src">Time zone from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> · clock from this device</div>';
  const hereTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const draw = () => {
    const now = new Date();
    if (locs.length === 2) {
      const [a, b] = locs, oa = offsetMin(a.tz, now), ob = offsetMin(b.tz, now);
      const row = (l, o) => '<div style="margin:6px 0"><div style="font-size:15px">' + esc(l.name) + '</div><div style="font-size:34px;font-weight:300;line-height:1.15">' + esc(timeStr(l.tz, now)) + '</div><div class="sub">' + esc(dayStr(l.tz, now)) + ' · ' + esc(utcLabel(o)) + '</div></div>';
      el.innerHTML = '<h2>Time difference</h2>' + row(a, oa) + row(b, ob)
        + '<p>' + esc(a.name.split(', ')[0]) + ' is ' + esc(relTo(oa, ob, b.name.split(', ')[0])) + '.</p>' + src;
    } else {
      const l = locs[0], o = offsetMin(l.tz, now), mine = offsetMin(hereTz, now);
      el.innerHTML = '<h2>' + esc(l.name) + '</h2>'
        + '<div class="sub">' + esc(dayStr(l.tz, now)) + ' · ' + esc(l.tz) + ' · ' + esc(utcLabel(o)) + '</div>'
        + '<div style="font-size:56px;font-weight:300;line-height:1.1;margin:6px 0 4px">' + esc(timeStr(l.tz, now)) + '</div>'
        + '<p>' + esc(relTo(o, mine, 'you').replace(/^s/, 'S')) + '.</p>' + src;
    }
  };
  draw();
  const tick = setInterval(() => { if (api._pageStill(el)) draw(); else clearInterval(tick); }, 15000);
  return 'worldtime';
}

export default {
  name: 'worldtime',
  examples: ['time in Tokyo', 'what time is it in London', 'current time in New York', 'time difference between Paris and Tokyo'],
  match(lower) { return !!parse(lower.trim()); },
  run
};

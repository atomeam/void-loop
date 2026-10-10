/**
 * A standing watch (frontier build order step 4, first piece): one thing Void can already fetch and a condition, asked
 * for in plain words. "tell me when it's below 0 in Oslo", "let me know if https://… says sold out", "alert me when the
 * price on https://… drops below 50", "tell me when it's 9am in Tokyo", "watch https://… for changes". This is the
 * pure half: the asks, what a watch may say, how a fetched sample is judged against it, and the words the card and the
 * record use. No network, no D1: tools/watch.test.mjs runs it in node. lib/automations-run.js does the fetching: a watch
 * is an automation step of action 'watch' on the 15-minute clock (no second scheduler), its every check an execution
 * record of kind watch.check, its match told by that record (a note on the stage) or by a stubbed send.
 * Nothing is watched that was not asked for: a watch is made only from an ask, and only in the asker's own scope.
 */
export const KINDS = ['weather', 'page', 'price', 'time'];
export const PAGE_OPS = ['contains', 'not-contains', 'changes'];
export const TELLS = ['note', 'send'];
export const MAX_TEXT = 200000, MAX_SEEN = 240, DEFAULT_EVERY = 15;

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const clean = (s) => str(s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

// a few cities people name by name; anything else must be an IANA zone ("Europe/Oslo")
export const CITY_ZONES = {
  tokyo: 'Asia/Tokyo', london: 'Europe/London', paris: 'Europe/Paris', berlin: 'Europe/Berlin', oslo: 'Europe/Oslo', madrid: 'Europe/Madrid', rome: 'Europe/Rome', amsterdam: 'Europe/Amsterdam',
  'new york': 'America/New_York', nyc: 'America/New_York', chicago: 'America/Chicago', denver: 'America/Denver', 'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles', toronto: 'America/Toronto', 'sao paulo': 'America/Sao_Paulo', 'são paulo': 'America/Sao_Paulo', 'mexico city': 'America/Mexico_City',
  sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', auckland: 'Pacific/Auckland', singapore: 'Asia/Singapore', 'hong kong': 'Asia/Hong_Kong', dubai: 'Asia/Dubai', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', seoul: 'Asia/Seoul', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', utc: 'UTC',
};
export function zoneOf(place) {
  const p = clean(place).toLowerCase().replace(/\.$/, '');
  if (CITY_ZONES[p]) return CITY_ZONES[p];
  if (/^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(str(place).trim()) || /^utc$/i.test(p)) { try { new Intl.DateTimeFormat('en', { timeZone: str(place).trim() }); return str(place).trim(); } catch (_) { return ''; } }
  return '';
}

const LEAD = '(?:please\\s+)?(?:(?:can|could|would)\\s+you\\s+)?(?:tell\\s+me\\s+(?:when|if)|let\\s+me\\s+know\\s+(?:when|if)|alert\\s+me\\s+(?:when|if)|notify\\s+me\\s+(?:when|if)|warn\\s+me\\s+(?:when|if)|watch\\s+(?:for\\s+)?(?:when\\s+)?|ping\\s+me\\s+(?:when|if))\\s*';
const LINK = '(https?:\\/\\/[^\\s"\'<>]+)';
const NUM = '(-?\\d+(?:\\.\\d+)?)';
const BELOW = '(?:below|under|less\\s+than|lower\\s+than|colder\\s+than|drops?\\s+(?:below|under|to\\s+under)|falls?\\s+(?:below|under)|goes\\s+(?:below|under))';
const ABOVE = '(?:above|over|more\\s+than|higher\\s+than|warmer\\s+than|hotter\\s+than|at\\s+least|rises?\\s+(?:above|over)|goes\\s+(?:above|over)|reaches|hits)';
const NOT_RE = /\b(?:movie|film|show|series|netflix|apple\s+watch|smart\s*watch|wrist|joke|story)\b|^what\b|^how\b|^weather\b|^time\b|^what'?s the (?:time|weather)/i;
const tidyUrl = (u) => str(u).replace(/[.,;:!?)]+$/, '');

/** the watch an ask describes, or null */
export function parseWatchAsk(text) {
  const t = clean(text).replace(/[.!?]+$/, '');
  if (!t || NOT_RE.test(t)) return null;
  let m;
  // weather: "tell me when it's below 0 in Oslo", "alert me when it goes above 30 degrees in Madrid"
  if ((m = new RegExp('^' + LEAD + "(?:it'?s|it\\s+is|it\\s+(?:gets|goes|drops|falls|rises)|the\\s+temperature\\s+(?:is|gets|goes|drops|falls|rises))?\\s*(?:to\\s+)?(" + BELOW + '|' + ABOVE + ')\\s*' + NUM + '\\s*(?:°|degrees?)?\\s*([cf])?\\s+in\\s+(.{2,60})$', 'i').exec(t))) {
    const op = new RegExp('^' + BELOW + '$', 'i').test(m[1]) ? '<' : '>';
    return { kind: 'weather', place: clean(m[4]), op, value: parseFloat(m[2]), unit: (m[3] || 'c').toLowerCase() };
  }
  // price: "alert me when the price on https://… drops below 50"
  if ((m = new RegExp('^' + LEAD + '(?:the\\s+)?price\\s+(?:on|at|of)\\s+' + LINK + '\\s+(?:is\\s+)?(' + BELOW + '|' + ABOVE + ')\\s*[$€£]?\\s*' + NUM + '$', 'i').exec(t))) {
    return { kind: 'price', url: tidyUrl(m[1]), op: new RegExp('^' + BELOW + '$', 'i').test(m[2]) ? '<' : '>', value: parseFloat(m[3]) };
  }
  // page text: "let me know if https://… says sold out", "tell me when https://… no longer says out of stock"
  if ((m = new RegExp('^' + LEAD + LINK + '\\s+(no\\s+longer\\s+|stops\\s+saying\\s+|doesn\'?t\\s+)?(?:says|say|contains?|has|shows?|mentions?|includes?)?\\s*["“\']?(.{1,120}?)["”\']?$', 'i').exec(t)) && !/^(?:for\s+)?changes?$/i.test(m[3])) {
    return { kind: 'page', url: tidyUrl(m[1]), op: m[2] ? 'not-contains' : 'contains', value: clean(m[3]) };
  }
  // page changes: "watch https://… for changes", "tell me when https://… changes"
  if ((m = new RegExp('^' + LEAD + LINK + '\\s*(?:for\\s+changes|changes|for\\s+any\\s+change|is\\s+updated|updates)?$', 'i').exec(t))) return { kind: 'page', url: tidyUrl(m[1]), op: 'changes' };
  // time: "tell me when it's 9am in Tokyo"
  if ((m = new RegExp('^' + LEAD + "(?:it'?s|it\\s+is|the\\s+time\\s+is)?\\s*(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?|noon|midnight)\\s+in\\s+(.{2,60})$", 'i').exec(t))) {
    const zone = zoneOf(m[2]); const at = timeOf(m[1]);
    if (zone && at) return { kind: 'time', zone, at, place: clean(m[2]) };
  }
  return null;
}
/** "9am" | "9:30 pm" | "noon" -> "HH:MM" (24 h), or '' */
export function timeOf(s) {
  const t = clean(s).toLowerCase().replace(/\s+/g, '');
  if (t === 'noon') return '12:00'; if (t === 'midnight') return '00:00';
  const m = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(t); if (!m) return '';
  let h = +m[1]; const mi = +(m[2] || 0);
  if (h > 23 || mi > 59) return '';
  if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

/** a public https address a watch may read (same fence as automations' http.post) */
export function safeWatchUrl(u) {
  let x; try { x = new URL(str(u)); } catch (_) { return false; }
  if (x.protocol !== 'https:' || x.username || x.password || x.port) return false;
  const h = x.hostname.toLowerCase();
  return !(/^\[|^\d+\.\d+\.\d+\.\d+$|^localhost$|\.local$|\.internal$|\.localhost$/.test(h) || !h.includes('.'));
}

/** { ok, errors, watch } : the watch as kept, every field checked */
export function validateWatch(input) {
  const errors = [], bad = (m) => errors.push(m);
  const w = input && typeof input === 'object' ? input : {};
  const out = { kind: str(w.kind) };
  if (!KINDS.includes(out.kind)) bad('kind is one of ' + KINDS.join(', '));
  if (out.kind === 'weather') {
    out.place = clean(w.place).slice(0, 60); if (!out.place) bad('weather needs a place');
    out.op = w.op === '<' ? '<' : w.op === '>' ? '>' : ''; if (!out.op) bad('weather needs < or >');
    out.value = Number(w.value); if (!Number.isFinite(out.value) || out.value < -100 || out.value > 150) bad('weather needs a temperature');
    out.unit = w.unit === 'f' ? 'f' : 'c';
  } else if (out.kind === 'page' || out.kind === 'price') {
    out.url = tidyUrl(w.url).slice(0, 500); if (!safeWatchUrl(out.url)) bad('the address must be a public https page');
    if (out.kind === 'page') { out.op = PAGE_OPS.includes(w.op) ? w.op : ''; if (!out.op) bad('a page watch says contains, not-contains or changes'); if (out.op !== 'changes') { out.value = clean(w.value).slice(0, 120); if (!out.value) bad('what text to look for'); } }
    else { out.op = w.op === '<' ? '<' : w.op === '>' ? '>' : ''; if (!out.op) bad('a price watch says < or >'); out.value = Number(w.value); if (!Number.isFinite(out.value) || out.value < 0) bad('a price watch needs an amount'); }
  } else if (out.kind === 'time') {
    out.zone = zoneOf(w.zone || w.place); if (!out.zone) bad('a time zone Void knows (a city it knows, or Europe/Oslo)');
    out.at = timeOf(w.at); if (!out.at) bad('a time of day');
    if (w.place) out.place = clean(w.place).slice(0, 60);
  }
  return { ok: !errors.length, errors, watch: errors.length ? null : out };
}

/** the watch in one plain line, as the card and the record name it */
export function describe(w) {
  if (!w) return '';
  const deg = (w.unit === 'f' ? '°F' : '°C');
  if (w.kind === 'weather') return (w.op === '<' ? 'below ' : 'above ') + w.value + deg + ' in ' + w.place;
  if (w.kind === 'price') return 'the price on ' + w.url + (w.op === '<' ? ' below ' : ' above ') + w.value;
  if (w.kind === 'page') return w.op === 'changes' ? w.url + ' changes' : w.url + (w.op === 'contains' ? ' says "' : ' no longer says "') + w.value + '"';
  if (w.kind === 'time') return w.at + ' in ' + (w.place || w.zone);
  return w.kind;
}

/** visible text of a fetched page: tags, scripts and styles out, whitespace folded, capped */
export function pageText(html) {
  return str(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}
/** a short stable fingerprint of text (FNV-1a, 32 bit) for "changes" */
export function fingerprint(text) {
  let h = 0x811c9dc5; const s = str(text);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/** the first money amount on a page: "$1,234.50", "€49", "49.00 USD" */
export function priceIn(text) {
  const m = /(?:[$€£]\s?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?)|(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?)\s?(?:usd|eur|gbp|dollars?|euros?|pounds?)\b)/i.exec(str(text));
  if (!m) return null;
  const raw = (m[1] || m[2]).replace(/,(?=\d{3}\b)/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(raw); return Number.isFinite(n) ? n : null;
}
/** local HH:MM in a zone at a moment */
export function localTime(zone, now = Date.now()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(now));
  const h = p.find((x) => x.type === 'hour').value, mi = p.find((x) => x.type === 'minute').value;
  return (h === '24' ? '00' : h) + ':' + mi;
}
export const localDay = (zone, now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

/**
 * Judge one check. sample: what was fetched ({ temperature } | { text } | { now }); prev: the kept state of the last
 * check ({ seen, matched, day } or null) -> { matched, seen, state } where seen is the evidence in words and state is
 * what to keep for next time. Pure.
 */
export function evaluate(w, sample, prev = null) {
  if (w.kind === 'weather') {
    const raw = sample && sample.temperature, t = raw == null || raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(t)) return { matched: false, seen: 'no temperature for ' + w.place, state: prev };
    const v = w.unit === 'f' ? t * 9 / 5 + 32 : t;
    const matched = w.op === '<' ? v < w.value : v > w.value;
    return { matched, seen: Math.round(v * 10) / 10 + (w.unit === 'f' ? '°F' : '°C') + ' in ' + w.place, state: { seen: v, matched } };
  }
  if (w.kind === 'price') {
    const n = priceIn(sample && sample.text);
    if (n == null) return { matched: false, seen: 'no price found on the page', state: prev };
    const matched = w.op === '<' ? n < w.value : n > w.value;
    return { matched, seen: 'price ' + n + ' on the page', state: { seen: n, matched } };
  }
  if (w.kind === 'page') {
    const text = str(sample && sample.text);
    if (!text) return { matched: false, seen: 'the page gave no text', state: prev };
    if (w.op === 'changes') {
      const fp = fingerprint(text), was = prev && prev.seen;
      const matched = !!was && was !== fp;
      return { matched, seen: (was ? (matched ? 'the page changed (' + was + ' → ' + fp + ')' : 'unchanged (' + fp + ')') : 'first look (' + fp + ')'), state: { seen: fp, matched } };
    }
    const has = text.toLowerCase().includes(w.value.toLowerCase());
    const matched = w.op === 'contains' ? has : !has;
    return { matched, seen: (has ? 'found "' : 'did not find "') + w.value + '" on the page (' + text.length + ' chars)', state: { seen: has, matched } };
  }
  if (w.kind === 'time') {
    const now = Number(sample && sample.now) || Date.now();
    const hm = localTime(w.zone, now), day = localDay(w.zone, now);
    const reached = hm >= w.at, already = prev && prev.day === day && prev.matched;
    const matched = reached && !already;
    return { matched, seen: hm + ' in ' + (w.place || w.zone) + (reached ? ' (past ' + w.at + ')' : ' (before ' + w.at + ')'), state: { seen: hm, matched: reached, day } };
  }
  return { matched: false, seen: 'unknown watch', state: prev };
}

/** one check as the record says it; told = a note went to the stage or a send was stubbed */
export function checkText(w, r, told) {
  return (r.matched ? 'MATCH · ' : '') + r.seen + ' · watching for ' + describe(w) + (told ? ' · ' + told : '');
}

const ASK_RE = /^(?:(?:show|open|list)\s+)?(?:me\s+)?(?:my\s+)?(?:watches|standing\s+watches|watch\s+list)$|^what\s+(?:am\s+i|are\s+you)\s+watching(?:\s+for\s+me)?$|^what\s+do\s+you\s+watch\s+for\s+me$/i;
/** the asks: a new watch ({ watch }), the list ({ list: true }), or null */
export function watchOf(text) {
  const t = clean(text).replace(/[.!?]+$/, '');
  if (ASK_RE.test(t)) return { list: true };
  const w = parseWatchAsk(t);
  return w ? { watch: w } : null;
}

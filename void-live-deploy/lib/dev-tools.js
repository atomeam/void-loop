// Pure logic of the dev tools card (tools pack 7, owner 2026-10-18: JSON formatter, Base64, regex test box, cron explain, HTTP status
// cheat card, dummy data rows, git commit message polish; the hex/rgb converter is the colour card in skills/util.js, the UUID and
// lorem ipsum already were there). Nothing here touches the page or the network; everything runs on the text you give it.

const tidy = (s) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim();
export const MODES = ['json', 'base64', 'regex', 'cron', 'http', 'dummy', 'commit'];

// ---- JSON -----------------------------------------------------------------------------------------

/** pretty-print (or minify) JSON text: { ok, out } or { ok:false, err } with the engine's own words. Pure. */
export function formatJson(text, { minify = false, indent = 2 } = {}) {
  const s = String(text == null ? '' : text);
  if (!s.trim()) return { ok: true, out: '' };
  try { return { ok: true, out: JSON.stringify(JSON.parse(s), null, minify ? 0 : indent) }; } catch (e) { return { ok: false, err: String((e && e.message) || e).slice(0, 160) }; }
}

// ---- Base64 ---------------------------------------------------------------------------------------

/** UTF-8 text to Base64. Pure. */
export function b64Encode(s) {
  let bin = '';
  for (const b of new TextEncoder().encode(String(s == null ? '' : s))) bin += String.fromCharCode(b);
  return btoa(bin);
}
/** Base64 (or URL-safe Base64) back to UTF-8 text: { ok, out } or { ok:false, err }. Pure. */
export function b64Decode(s) {
  let clean = String(s == null ? '' : s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!clean) return { ok: true, out: '' };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return { ok: false, err: 'that is not Base64 (it has characters outside A-Z a-z 0-9 + /)' };
  while (clean.length % 4) clean += '=';
  try {
    const bin = atob(clean), bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { ok: true, out: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch (_) { return { ok: false, err: 'those bytes are not text (not valid UTF-8)' }; }
}

// ---- regex test box -------------------------------------------------------------------------------

export const REGEX_LIMITS = { pattern: 200, text: 4000, matches: 100 };

/** a pattern shaped like (a+)+ or (.*)* can lock a page up; those are refused. Pure. */
export function regexRisky(pattern) {
  return /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,?\d*\})/.test(String(pattern || ''));
}

/** run a pattern over a text: { ok, matches:[{ index, text, groups }] } or { ok:false, err }. Pure. */
export function regexTest(pattern, flags, text) {
  const p = String(pattern == null ? '' : pattern), t = String(text == null ? '' : text);
  if (!p) return { ok: true, matches: [] };
  if (p.length > REGEX_LIMITS.pattern) return { ok: false, err: 'the pattern is over ' + REGEX_LIMITS.pattern + ' characters' };
  if (t.length > REGEX_LIMITS.text) return { ok: false, err: 'the text is over ' + REGEX_LIMITS.text + ' characters' };
  if (regexRisky(p)) return { ok: false, err: 'a repeat inside a repeat, like (a+)+, can hang the page: I left it alone' };
  const fl = Array.from(new Set(String(flags || '').replace(/[^dgimsuy]/g, '').split('').filter((f) => f !== 'g'))).join('') + 'g';
  let re;
  try { re = new RegExp(p, fl); } catch (e) { return { ok: false, err: String((e && e.message) || e).replace(/^Invalid regular expression: /, '').replace(/^\/.*\/[a-z]*: /, '').slice(0, 160) }; }
  const matches = [];
  for (const m of t.matchAll(re)) {
    matches.push({ index: m.index, text: m[0], groups: m.slice(1).map((g) => (g == null ? '' : g)) });
    if (matches.length >= REGEX_LIMITS.matches) break;
  }
  return { ok: true, matches };
}

/** the text cut into { text, hit } pieces so a card can mark the matches. Pure. */
export function regexPieces(text, matches) {
  const out = []; let at = 0;
  for (const m of matches) {
    if (m.index < at || !m.text) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index), hit: false });
    out.push({ text: m.text, hit: true }); at = m.index + m.text.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

// ---- cron -----------------------------------------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ALIASES = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
const RANGES = { minute: [0, 59], hour: [0, 23], dom: [1, 31], month: [1, 12], dow: [0, 7] };

function num(tok, kind) {
  const l = String(tok).toLowerCase();
  if (kind === 'month' && MONTHS.includes(l)) return MONTHS.indexOf(l) + 1;
  if (kind === 'dow' && DAYS.includes(l)) return DAYS.indexOf(l);
  return /^\d{1,2}$/.test(l) ? +l : NaN;
}

/** one cron field as a list of { from, to, step } parts, or null when it is not valid. Pure. */
export function cronField(field, kind) {
  const [lo, hi] = RANGES[kind], parts = [];
  for (const tok of String(field).split(',')) {
    const m = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d{1,2}))?$/i.exec(tok);
    if (!m) return null;
    const step = m[2] ? +m[2] : 1;
    if (!step) return null;
    let from, to;
    if (m[1] === '*') { from = lo; to = kind === 'dow' ? 6 : hi; } else if (m[1].includes('-')) { const [a, b] = m[1].split('-'); from = num(a, kind); to = num(b, kind); } else { from = num(m[1], kind); to = m[2] ? (kind === 'dow' ? 6 : hi) : from; }
    if (!(from >= lo && to >= lo && from <= hi && to <= hi && from <= to)) return null;
    parts.push({ from, to, step, star: m[1] === '*', single: !m[2] && !m[1].includes('-') && m[1] !== '*' });
  }
  return parts;
}
const fieldHas = (parts, v) => parts.some((p) => v >= p.from && v <= p.to && (v - p.from) % p.step === 0) || (parts.some((p) => p.to === 7 || p.from === 7) && v === 0 && parts.some((p) => 7 >= p.from && 7 <= p.to && (7 - p.from) % p.step === 0));

const two = (n) => String(n).padStart(2, '0');
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const listOf = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

function phrase(parts, kind, word) {
  const named = kind === 'month' || kind === 'dow';
  const label = (v) => (kind === 'month' ? MONTH_NAMES[v - 1] : kind === 'dow' ? DAY_NAMES[v % 7] : String(v));
  if (parts.length > 1 && parts.every((p) => p.single)) return (named ? '' : word + 's ') + listOf(parts.map((p) => label(p.from)));
  return listOf(parts.map((p) => {
    if (p.star && p.step === 1) return 'every ' + word;
    if (p.star) return 'every ' + p.step + ' ' + word + 's';
    if (p.single) return (named ? '' : word + ' ') + label(p.from);
    const range = label(p.from) + (p.from === p.to ? '' : ' through ' + label(p.to));
    if (p.step > 1) return 'every ' + p.step + ' ' + word + 's from ' + range;
    return named ? range : 'every ' + word + ' from ' + range;
  }));
}

/** a 5-field cron line in words: { ok, text } or { ok:false, err }. A 6th leading field is read as seconds. Pure. */
export function explainCron(expr) {
  let s = tidy(expr).toLowerCase();
  if (ALIASES[s]) s = ALIASES[s];
  const f = s.split(' ').filter(Boolean);
  let sec = null;
  if (f.length === 6) sec = f.shift();
  if (f.length !== 5) return { ok: false, err: 'a cron line has 5 fields: minute hour day-of-month month day-of-week' };
  const kinds = ['minute', 'hour', 'dom', 'month', 'dow'], parsed = f.map((x, i) => cronField(x, kinds[i]));
  const bad = parsed.findIndex((p) => !p);
  if (bad >= 0) return { ok: false, err: 'the ' + ['minute', 'hour', 'day-of-month', 'month', 'day-of-week'][bad] + ' field "' + f[bad] + '" is not valid' };
  const [mi, ho, dm, mo, dw] = parsed;
  const single = (p) => p.length === 1 && p[0].single;
  const every = (p, w) => 'Every ' + (p[0].step === 1 ? w : p[0].step + ' ' + w + 's');
  const miStar = mi.length === 1 && mi[0].star, hoStar = ho.length === 1 && ho[0].star && ho[0].step === 1;
  let when, clock = false;
  if (single(mi) && single(ho)) { when = 'At ' + two(ho[0].from) + ':' + two(mi[0].from); clock = true; }
  else if (miStar && hoStar) when = every(mi, 'minute');
  else if (hoStar) when = 'At ' + phrase(mi, 'minute', 'minute') + ' of every hour';
  else when = (miStar ? every(mi, 'minute') : 'At ' + phrase(mi, 'minute', 'minute')) + ' past ' + phrase(ho, 'hour', 'hour');
  const domStar = dm.length === 1 && dm[0].star && dm[0].step === 1, dowStar = dw.length === 1 && dw[0].star && dw[0].step === 1, moStar = mo.length === 1 && mo[0].star && mo[0].step === 1;
  const days = [];
  if (!domStar) days.push('on ' + phrase(dm, 'dom', 'day-of-month'));
  if (!dowStar) days.push('on ' + phrase(dw, 'dow', 'day'));
  let text = when + (days.length ? ' ' + days.join(' and ') : clock && domStar && dowStar ? ' every day' : '') + (moStar ? '' : ' in ' + phrase(mo, 'month', 'month'));
  if (sec && sec !== '0') text = 'Seconds "' + sec + '": ' + text;
  if (!domStar && !dowStar) text += ' (cron runs when either the date or the weekday fits)';
  return { ok: true, text: text + '.' };
}

/** the next n times a 5-field cron line fires after `from` (minute steps, local time); [] when it never does within a year. Pure. */
export function nextRuns(expr, from, n = 3) {
  let s = tidy(expr).toLowerCase();
  if (ALIASES[s]) s = ALIASES[s];
  const f = s.split(' ').filter(Boolean);
  if (f.length !== 5) return [];
  const kinds = ['minute', 'hour', 'dom', 'month', 'dow'], p = f.map((x, i) => cronField(x, kinds[i]));
  if (p.some((x) => !x)) return [];
  const domStar = p[2][0].star && p[2].length === 1 && p[2][0].step === 1, dowStar = p[4][0].star && p[4].length === 1 && p[4][0].step === 1;
  const t = new Date(from.getTime()); t.setSeconds(0, 0); t.setMinutes(t.getMinutes() + 1);
  const out = [];
  for (let i = 0; i < 366 * 24 * 60 && out.length < n; i++, t.setMinutes(t.getMinutes() + 1)) {
    if (!fieldHas(p[0], t.getMinutes()) || !fieldHas(p[1], t.getHours()) || !fieldHas(p[3], t.getMonth() + 1)) continue;
    const dOk = fieldHas(p[2], t.getDate()), wOk = fieldHas(p[4], t.getDay());
    if (!(domStar || dowStar ? dOk && wOk : dOk || wOk)) continue;
    out.push(new Date(t.getTime()));
  }
  return out;
}

// ---- HTTP status ----------------------------------------------------------------------------------

export const HTTP = [
  [100, 'Continue', 'The server got the start of the request; keep sending.'], [101, 'Switching Protocols', 'The server agrees to switch protocol (a WebSocket upgrade).'],
  [200, 'OK', 'It worked; the answer is in the body.'], [201, 'Created', 'A new thing was made (usually after a POST).'], [202, 'Accepted', 'Taken in, but not done yet.'], [204, 'No Content', 'It worked; there is nothing to send back.'], [206, 'Partial Content', 'Only the byte range asked for.'],
  [301, 'Moved Permanently', 'It lives at a new address for good; update links.'], [302, 'Found', 'It is somewhere else for now; ask there this time.'], [303, 'See Other', 'Fetch the result with a GET at another address.'], [304, 'Not Modified', 'Your cached copy is still good.'], [307, 'Temporary Redirect', 'Same request, other address, same method.'], [308, 'Permanent Redirect', 'Same request, new address for good, same method.'],
  [400, 'Bad Request', 'The request is malformed: check the syntax, body and headers.'], [401, 'Unauthorized', 'No valid login was sent: sign in or send the credentials.'], [403, 'Forbidden', 'Known who you are, but not allowed.'], [404, 'Not Found', 'Nothing lives at that address: check the URL.'], [405, 'Method Not Allowed', 'That address does not take this method (GET, POST...).'], [406, 'Not Acceptable', 'It cannot answer in a form the Accept header allows.'], [408, 'Request Timeout', 'The server gave up waiting for the request.'],
  [409, 'Conflict', 'It clashes with the current state (an edit race, a duplicate).'], [410, 'Gone', 'It was here and is removed for good.'], [413, 'Payload Too Large', 'The body is bigger than the server accepts.'], [415, 'Unsupported Media Type', 'The server cannot read that content type.'], [418, "I'm a teapot", 'A joke code from RFC 2324: the teapot will not brew coffee.'], [422, 'Unprocessable Content', 'The syntax is fine but the content is not valid.'], [429, 'Too Many Requests', 'Slow down: rate limited; look for Retry-After.'],
  [500, 'Internal Server Error', 'The server broke: read its logs.'], [501, 'Not Implemented', 'The server does not support that.'], [502, 'Bad Gateway', 'A proxy got a bad answer from the server behind it.'], [503, 'Service Unavailable', 'Down or overloaded for now; try again later.'], [504, 'Gateway Timeout', 'A proxy waited too long for the server behind it.'],
].map(([code, name, means]) => ({ code, name, means }));

/** the entry for a code (or the class when the exact code is not listed), or null. Pure. */
export function httpInfo(code) {
  const c = Math.floor(+code);
  if (!(c >= 100 && c <= 599)) return null;
  const hit = HTTP.find((x) => x.code === c);
  if (hit) return hit;
  const cls = { 1: 'Informational', 2: 'Success', 3: 'Redirection', 4: 'Client error', 5: 'Server error' }[Math.floor(c / 100)];
  return { code: c, name: cls, means: 'Not in the cheat card: any ' + Math.floor(c / 100) + 'xx is a ' + cls.toLowerCase() + '.' };
}

// ---- dummy data -----------------------------------------------------------------------------------

const FIRST = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Tim', 'Hedy', 'Claude', 'Katherine', 'Edsger', 'Joan', 'Donald', 'Sophie', 'Marco', 'Amara', 'Jonas'];
const LAST = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Berners', 'Lamarr', 'Shannon', 'Johnson', 'Dijkstra', 'Clarke', 'Knuth', 'Germain', 'Polo', 'Okafor', 'Berg'];
const CITY = ['Lisbon', 'Osaka', 'Nairobi', 'Lima', 'Oslo', 'Hanoi', 'Cairo', 'Quito', 'Perth', 'Turin', 'Seoul', 'Austin', 'Accra', 'Tallinn', 'Hobart'];
const COUNTRY = ['Portugal', 'Japan', 'Kenya', 'Peru', 'Norway', 'Vietnam', 'Egypt', 'Ecuador', 'Australia', 'Italy', 'South Korea', 'Ghana', 'Estonia', 'Chile', 'Canada'];
const COMPANY = ['Northwind', 'Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Hooli', 'Vandelay', 'Soylent', 'Tyrell', 'Aperture'];
const WORDS = ['river', 'lantern', 'copper', 'meadow', 'signal', 'harbor', 'maple', 'ember', 'quartz', 'orbit', 'willow', 'basalt'];
export const DUMMY_COLUMNS = ['id', 'name', 'first', 'last', 'email', 'city', 'country', 'phone', 'age', 'date', 'company', 'word', 'active'];
export const DUMMY_MAX_ROWS = 200;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** n rows of made-up data for the named columns, the same every time for one seed (fake names, example.com addresses, 555 phones). Pure. */
export function dummyRows(cols, n, seed = 1) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const rows = [];
  for (let i = 0; i < Math.min(DUMMY_MAX_ROWS, Math.max(1, Math.floor(n) || 1)); i++) {
    const first = pick(FIRST), last = pick(LAST), row = {};
    for (const c of cols) {
      row[c] = c === 'id' ? i + 1 : c === 'name' ? first + ' ' + last : c === 'first' ? first : c === 'last' ? last : c === 'email' ? (first + '.' + last).toLowerCase() + '@example.com'
        : c === 'city' ? pick(CITY) : c === 'country' ? pick(COUNTRY) : c === 'phone' ? '555-01' + two(Math.floor(r() * 100)) : c === 'age' ? 18 + Math.floor(r() * 62)
          : c === 'date' ? (2020 + Math.floor(r() * 6)) + '-' + two(1 + Math.floor(r() * 12)) + '-' + two(1 + Math.floor(r() * 28)) : c === 'company' ? pick(COMPANY) : c === 'word' ? pick(WORDS) : c === 'active' ? r() < 0.5 : '';
    }
    rows.push(row);
  }
  return rows;
}
/** the column names found in free words ("name, email and age"), in order, only known ones. Pure. */
export function columnsIn(words) {
  const found = [];
  for (const w of String(words || '').toLowerCase().split(/[^a-z]+/)) {
    const c = w === 'names' ? 'name' : w === 'emails' ? 'email' : w === 'cities' ? 'city' : w === 'ages' ? 'age' : w === 'dates' ? 'date' : w === 'phones' || w === 'phone' ? 'phone' : w === 'ids' ? 'id' : w;
    if (DUMMY_COLUMNS.includes(c) && !found.includes(c)) found.push(c);
  }
  return found;
}
export const toCsv = (cols, rows) => [cols.join(',')].concat(rows.map((r) => cols.map((c) => String(r[c]).includes(',') ? '"' + String(r[c]).replace(/"/g, '""') + '"' : String(r[c])).join(','))).join('\n');
export const toJsonRows = (rows) => JSON.stringify(rows, null, 2);

// ---- git commit message polish -----------------------------------------------------------------------

const BASES = 'add fix remove delete update change rename move refactor improve implement create build bump upgrade downgrade revert merge clean simplify document test handle prevent avoid allow enable disable support use make set get return show hide load save write read parse format validate check correct resolve patch tweak adjust extract replace restore introduce drop skip stop start tidy speed optimize cache log wire connect install configure initialize rewrite reduce increase expand limit deploy release polish'.split(' ');
const VERB = new Map();
for (const b of BASES) {
  const ed = b.endsWith('e') ? b + 'd' : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + 'ied' : /[^aeiou][aeiou][bdgmnprt]$/.test(b) && b.length <= 4 ? b + b.slice(-1) + 'ed' : b + 'ed';
  const s = /(?:s|x|z|ch|sh)$/.test(b) ? b + 'es' : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + 'ies' : b + 's';
  const ing = b.endsWith('ie') ? b.slice(0, -2) + 'ying' : b.endsWith('e') && !b.endsWith('ee') ? b.slice(0, -1) + 'ing' : /[^aeiou][aeiou][bdgmnprt]$/.test(b) && b.length <= 4 ? b + b.slice(-1) + 'ing' : b + 'ing';
  for (const f of [b, ed, s, ing]) VERB.set(f, b);
}
for (const [f, b] of [['made', 'make'], ['got', 'get'], ['set', 'set'], ['wrote', 'write'], ['written', 'write'], ['ran', 'run'], ['built', 'build'], ['took', 'take'], ['gave', 'give'], ['dropped', 'drop'], ['fixed', 'fix'], ['added', 'add']]) VERB.set(f, b);
const TYPE_OF = { fix: 'fix', resolve: 'fix', patch: 'fix', correct: 'fix', prevent: 'fix', avoid: 'fix', handle: 'fix', add: 'feat', implement: 'feat', introduce: 'feat', create: 'feat', support: 'feat', allow: 'feat', enable: 'feat', document: 'docs',
  refactor: 'refactor', rename: 'refactor', clean: 'refactor', simplify: 'refactor', tidy: 'refactor', extract: 'refactor', restructure: 'refactor', test: 'test', optimize: 'perf', speed: 'perf', cache: 'perf', bump: 'chore', upgrade: 'chore', update: 'chore', remove: 'chore', delete: 'chore', revert: 'revert' };
const VAGUE = new Set(['fix', 'fixes', 'fixed', 'update', 'updates', 'updated', 'change', 'changes', 'changed', 'wip', 'stuff', 'misc', 'commit', 'test', 'tests', 'fix bug', 'fix bugs', 'bug fix', 'bugfix', 'minor changes', 'small fix', 'updates', 'more changes']);

/** a commit message in imperative mood, no trailing full stop, kept short, with a Conventional Commits form: { plain, conventional, body, notes } or null when empty. Pure. */
export function polishCommit(raw) {
  let s = String(raw == null ? '' : raw).trim().replace(/^git\s+commit\s+(?:-\w+\s+)*-m\s+/i, '').replace(/^["'“”]+|["'“”]+$/g, '').trim();
  if (!s) return null;
  const lines = s.split(/\r?\n/);
  let subject = tidy(lines[0]), body = lines.slice(1).join('\n').trim();
  const notes = [];
  if (/[.]+$/.test(subject)) { subject = subject.replace(/[.]+$/, ''); notes.push('dropped the full stop'); }
  let type = '', scope = '';
  const cc = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\(([^)]+)\))?(!)?:\s*(.*)$/i.exec(subject);
  if (cc) { type = cc[1].toLowerCase(); scope = cc[2] || ''; subject = cc[4] + ''; }
  subject = subject.replace(/^(?:i|we)\s+(?:just\s+|also\s+)?/i, '').replace(/^(?:just|also|so|then)\s+/i, '');
  const words = subject.split(' ').filter(Boolean);
  if (!words.length) return null;
  const base = VERB.get(words[0].toLowerCase().replace(/[^a-z]/g, ''));
  if (base) { if (base !== words[0].toLowerCase()) notes.push('"' + words[0] + '" became "' + base + '" (imperative: what the commit does)'); words[0] = base; }
  const lowFirst = (w) => (/^[A-Z]{2,}|[a-z][A-Z]/.test(w) ? w : w.charAt(0).toLowerCase() + w.slice(1));
  const rest = words.slice(1).join(' ');
  const lowered = [lowFirst(words[0])].concat(words.slice(1)).join(' ');
  if (!type && base && TYPE_OF[base]) type = TYPE_OF[base];
  const plain = lowered.charAt(0).toUpperCase() + lowered.slice(1);
  const conventional = type ? type + (scope ? '(' + scope + ')' : '') + ': ' + lowered : '';
  if (plain.length > 72) notes.push('the subject is ' + plain.length + ' characters: keep it under 72 and move detail to the body');
  if (VAGUE.has(lowered.toLowerCase()) || (words.length <= 1 && !rest)) notes.push('too vague: say what changed and why');
  if (!type) notes.push('no Conventional Commits type guessed from the verb');
  return { plain, conventional, body, notes };
}

// ---- what an ask means ---------------------------------------------------------------------------------

const LEADIN = '(?:please\\s+)?(?:(?:open|show|give|make|start|get)\\s+(?:me\\s+)?(?:a\\s+|an\\s+|the\\s+|my\\s+)?)?';

/** the dev tool an ask names: { mode, input?, opts? } or null. Every shape needs a tool word, so "what is json" is left to others. Pure. */
export function devOf(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 6000) return null;
  let m;
  if ((m = new RegExp('^(?:please\\s+)?(?:(format|pretty[- ]?print|prettify|beautify|minify|minimi[sz]e|validate|lint)\\s+(?:this\\s+|my\\s+|the\\s+|some\\s+)?json|' + LEADIN + 'json\\s+(?:formatter|pretty\\s*printer|validator|minifier|beautifier|tool))\\s*:?\\s*([\\s\\S]*)$', 'i').exec(t))) {
    const verb = (m[1] || '').toLowerCase();
    return { mode: 'json', input: m[2].trim(), opts: { minify: /^mini/.test(verb) } };
  }
  if ((m = /^(?:please\s+)?(?:base\s?64|b64)\s+(encode|decode|encoder|decoder|tool|converter)\b\s*:?\s*([\s\S]*)$/i.exec(t))) return { mode: 'base64', input: m[2].trim(), opts: { dir: /^dec/i.test(m[1]) ? 'decode' : 'encode' } };
  if ((m = /^(?:please\s+)?(encode|decode)\s+([\s\S]+?)\s+(?:in|to|as|from|with)\s+base\s?64$/i.exec(t))) return { mode: 'base64', input: m[2].replace(/^["“]|["”]$/g, '').trim(), opts: { dir: m[1].toLowerCase() } };
  if ((m = new RegExp('^(?:please\\s+)?(?:' + LEADIN + '(?:regex|regexp|regular\\s+expression)\\s+(?:test(?:er|\\s+box)?|playground|checker|tool)|test\\s+(?:this\\s+|a\\s+|my\\s+)?(?:regex|regexp|regular\\s+expression))\\s*:?\\s*([\\s\\S]*)$', 'i').exec(t))) {
    const r = parseRegexBody(m[1]);
    return { mode: 'regex', input: r.text, opts: { pattern: r.pattern, flags: r.flags } };
  }
  if ((m = /^(?:please\s+)?(?:explain|decode|translate|what\s+does|what\s+is)\s+(?:this\s+|the\s+|my\s+)?(?:cron(?:\s+(?:expression|schedule|line|job))?\s*:?\s*["']?|["'])([\d*@\/,\-a-z ]{3,60}?)["']?(?:\s+mean)?\??$/i.exec(t)) || (m = /^cron\s+(?:explain(?:er)?|decoder|translator)\s*:?\s*["']?([\d*@\/,\-a-z ]{0,60}?)["']?$/i.exec(t))) {
    return { mode: 'cron', input: tidy(m[1]) };
  }
  if ((m = /^(?:what\s+does|explain)\s+["']?([\d*@\/,\-a-z ]{9,60}?)["']?\s+(?:mean\s+)?in\s+cron\??$/i.exec(t))) return { mode: 'cron', input: tidy(m[1]) };
  if ((m = /^(?:please\s+)?(?:show\s+|open\s+|give\s+me\s+)?(?:the\s+|an?\s+)?http\s+(?:status\s+)?(?:codes?\s+)?(?:cheat\s*(?:sheet|card)|card|list|lookup|reference)?\s*:?\s*(\d{3})?$/i.exec(t)) && /status|code|cheat|card|lookup|reference/i.test(t)) return { mode: 'http', input: m[1] || '' };
  if ((m = /^(?:what\s+does\s+)?http\s+(\d{3})(?:\s+mean)?\??$/i.exec(t))) return { mode: 'http', input: m[1] };
  if ((m = new RegExp('^(?:please\\s+)?(?:(?:generate|make|give\\s+me|create|get)\\s+(?:me\\s+)?(?:(\\d{1,3})\\s+)?(?:rows?\\s+of\\s+)?(?:dummy|fake|sample|mock|test)\\s+(?:data|rows|records|people|users)|(?:dummy|fake|mock)\\s+data\\s+(?:rows|generator))\\b\\s*(?:with|for|of|as|columns?|:)?\\s*([\\s\\S]*)$', 'i').exec(t))) {
    const tail = m[2] || '', n = +(m[1] || (/(\d{1,3})\s+rows?/i.exec(tail) || [])[1]) || 5;
    return { mode: 'dummy', input: columnsIn(tail).join(',') || 'id,name,email,city', opts: { n: Math.min(DUMMY_MAX_ROWS, n), seed: 1 } };
  }
  if ((m = /^(?:please\s+)?(?:(?:polish|improve|tidy|clean\s*up|rewrite|reword|fix|check)\s+(?:up\s+)?(?:my\s+|this\s+|the\s+)?commit\s+(?:message|msg)|commit\s+(?:message|msg)\s+(?:polish|polisher|helper|tool|check(?:er)?))\s*:?\s*([\s\S]*)$/i.exec(t))) return { mode: 'commit', input: m[1].trim() };
  return null;
}

/** "/\d+/g on abc 123", "\d+ :: abc 123" or just a pattern, to { pattern, flags, text }. Pure. */
export function parseRegexBody(body) {
  const b = String(body || '').trim();
  let m = /^\/((?:\\.|[^/\\\n])+)\/([a-z]*)\s*(?:(?:on|in|against|::|\|)\s+)?([\s\S]*)$/.exec(b);
  if (m) return { pattern: m[1], flags: m[2], text: m[3] };
  m = /^(\S+)\s+(?:on|against|::)\s+([\s\S]+)$/.exec(b);
  if (m) return { pattern: m[1], flags: '', text: m[2] };
  return { pattern: b.split('\n')[0].trim(), flags: '', text: b.includes('\n') ? b.split('\n').slice(1).join('\n') : '' };
}

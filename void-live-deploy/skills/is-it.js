/**
 * is-it skill: the yes-or-no day question, answered the way isitchristmas.com does it, one giant word (the tower's first rung, owner
 * 2026-10-23: "the absolute bottom rung of the tower ... The Single-Question Boolean Site"). "is it christmas?", "is it friday yet",
 * "is today halloween", "is it a leap year", "is it thanksgiving" read this device's own clock (no network, works offline) and show
 * YES or NO big, with one small line saying when it next is. Questions that are not about the day ("is it going to rain", "is it safe
 * to ...") are left for the skills that know them.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const nth = (y, m, weekday, n) => { const d = new Date(y, m, 1); d.setDate(1 + ((weekday - d.getDay() + 7) % 7) + 7 * (n - 1)); return d; }; // nth weekday of a month
/** Easter Sunday (the anonymous Gregorian computus). Pure. */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
// the days it knows: a name people type -> [the day's name, the date in a given year] (exported so tools/sitemap.mjs lists /is-it/<day> pages)
export const DAYS = {
  christmas: ['Christmas', (y) => new Date(y, 11, 25)], 'christmas day': ['Christmas', (y) => new Date(y, 11, 25)], xmas: ['Christmas', (y) => new Date(y, 11, 25)],
  'christmas eve': ['Christmas Eve', (y) => new Date(y, 11, 24)], 'boxing day': ['Boxing Day', (y) => new Date(y, 11, 26)],
  halloween: ['Halloween', (y) => new Date(y, 9, 31)], 'new year': ['New Year’s Day', (y) => new Date(y, 0, 1)], 'new years': ['New Year’s Day', (y) => new Date(y, 0, 1)],
  'new years day': ['New Year’s Day', (y) => new Date(y, 0, 1)], 'new years eve': ['New Year’s Eve', (y) => new Date(y, 11, 31)],
  'valentines day': ['Valentine’s Day', (y) => new Date(y, 1, 14)], valentines: ['Valentine’s Day', (y) => new Date(y, 1, 14)],
  'st patricks day': ['St Patrick’s Day', (y) => new Date(y, 2, 17)], 'saint patricks day': ['St Patrick’s Day', (y) => new Date(y, 2, 17)],
  'april fools day': ['April Fools’ Day', (y) => new Date(y, 3, 1)], 'april fools': ['April Fools’ Day', (y) => new Date(y, 3, 1)],
  'pi day': ['Pi Day', (y) => new Date(y, 2, 14)], 'groundhog day': ['Groundhog Day', (y) => new Date(y, 1, 2)],
  'independence day': ['the Fourth of July', (y) => new Date(y, 6, 4)], 'the fourth of july': ['the Fourth of July', (y) => new Date(y, 6, 4)], 'the 4th of july': ['the Fourth of July', (y) => new Date(y, 6, 4)], '4th of july': ['the Fourth of July', (y) => new Date(y, 6, 4)], 'july 4th': ['the Fourth of July', (y) => new Date(y, 6, 4)],
  thanksgiving: ['Thanksgiving (US)', (y) => nth(y, 10, 4, 4)], easter: ['Easter Sunday', easter], 'easter sunday': ['Easter Sunday', easter],
  'mothers day': ['Mother’s Day (US)', (y) => nth(y, 4, 0, 2)], 'fathers day': ['Father’s Day (US)', (y) => nth(y, 5, 0, 3)],
};
// YES and NO in the visitor's language (isitchristmas.com picks it from the IP address and guesses wrong near borders; the device says)
export const WORDS = { en: ['YES', 'NO'], fr: ['OUI', 'NON'], de: ['JA', 'NEIN'], es: ['SÍ', 'NO'], it: ['SÌ', 'NO'], pt: ['SIM', 'NÃO'], nl: ['JA', 'NEE'],
  pl: ['TAK', 'NIE'], tr: ['EVET', 'HAYIR'], id: ['YA', 'TIDAK'], ms: ['YA', 'TIDAK'], sv: ['JA', 'NEJ'], da: ['JA', 'NEJ'], nb: ['JA', 'NEI'], no: ['JA', 'NEI'],
  nn: ['JA', 'NEI'], fi: ['KYLLÄ', 'EI'], cs: ['ANO', 'NE'], sk: ['ÁNO', 'NIE'], hu: ['IGEN', 'NEM'], ro: ['DA', 'NU'], el: ['ΝΑΙ', 'ΟΧΙ'], ru: ['ДА', 'НЕТ'],
  uk: ['ТАК', 'НІ'], bg: ['ДА', 'НЕ'], sr: ['ДА', 'НЕ'], hr: ['DA', 'NE'], sl: ['DA', 'NE'], et: ['JAH', 'EI'], lv: ['JĀ', 'NĒ'], lt: ['TAIP', 'NE'],
  is: ['JÁ', 'NEI'], ga: ['TÁ', 'NÍL'], cy: ['YDY', 'NAC YDY'], ca: ['SÍ', 'NO'], eu: ['BAI', 'EZ'], gl: ['SI', 'NON'], ja: ['はい', 'いいえ'], zh: ['是', '不是'],
  ko: ['네', '아니요'], ar: ['نعم', 'لا'], he: ['כן', 'לא'], fa: ['بله', 'نه'], ur: ['ہاں', 'نہیں'], hi: ['हाँ', 'नहीं'], bn: ['হ্যাঁ', 'না'], th: ['ใช่', 'ไม่ใช่'],
  vi: ['CÓ', 'KHÔNG'], tl: ['OO', 'HINDI'], fil: ['OO', 'HINDI'], sw: ['NDIYO', 'HAPANA'], af: ['JA', 'NEE'], sq: ['PO', 'JO'], mk: ['ДА', 'НЕ'], ka: ['კი', 'არა'], hy: ['ԱՅՈ', 'ՈՉ'] };
export const LANG_NAMES = { english: 'en', french: 'fr', german: 'de', spanish: 'es', italian: 'it', portuguese: 'pt', dutch: 'nl', polish: 'pl', turkish: 'tr',
  indonesian: 'id', malay: 'ms', swedish: 'sv', danish: 'da', norwegian: 'nb', finnish: 'fi', czech: 'cs', slovak: 'sk', hungarian: 'hu', romanian: 'ro', greek: 'el',
  russian: 'ru', ukrainian: 'uk', bulgarian: 'bg', serbian: 'sr', croatian: 'hr', slovenian: 'sl', estonian: 'et', latvian: 'lv', lithuanian: 'lt', icelandic: 'is',
  irish: 'ga', welsh: 'cy', catalan: 'ca', basque: 'eu', galician: 'gl', japanese: 'ja', chinese: 'zh', mandarin: 'zh', korean: 'ko', arabic: 'ar', hebrew: 'he',
  persian: 'fa', farsi: 'fa', urdu: 'ur', hindi: 'hi', bengali: 'bn', thai: 'th', vietnamese: 'vi', tagalog: 'tl', filipino: 'fil', swahili: 'sw', afrikaans: 'af',
  albanian: 'sq', macedonian: 'mk', georgian: 'ka', armenian: 'hy' };
/** the word for yes or no in the first of the visitor's languages Verse knows (English when none), and its language. Pure. */
export function wordFor(yes, langs = ['en']) {
  for (const l of [].concat(langs || [])) { const k = String(l || '').toLowerCase().split('-')[0]; if (WORDS[k]) return { word: WORDS[k][yes ? 0 : 1], lang: k }; }
  return { word: yes ? 'YES' : 'NO', lang: 'en' };
}
/** the two-letter region of a language tag ("en-CA" -> "CA"), or '' when it names none. Pure. */
export const regionOf = (tag) => ((/^[a-z]{2,3}[-_]([a-z]{2})\b/i.exec(String(tag || '')) || [])[1] || '').toUpperCase();
/** the flag of the visitor's region from their language tag ("en-CA" -> 🇨🇦), or '' when the tag names no region. Pure. */
export function flagOf(tag) {
  const r = (/^[a-z]{2,3}[-_]([a-z]{2})\b/i.exec(String(tag || '')) || [])[1];
  return r ? String.fromCodePoint(...[...r.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';
}
// the midnight wave (owner, 2026-10-24: "something amazingly special when its actually christmas"): Christmas comes to Kiritimati first and
// sweeps west across the world for 26 hours. Places from first to last, each with its time zone.
export const WAVE = [['Kiritimati', 'Pacific/Kiritimati'], ['Auckland', 'Pacific/Auckland'], ['Sydney', 'Australia/Sydney'], ['Tokyo', 'Asia/Tokyo'], ['Seoul', 'Asia/Seoul'],
  ['Beijing', 'Asia/Shanghai'], ['Manila', 'Asia/Manila'], ['Bangkok', 'Asia/Bangkok'], ['Dhaka', 'Asia/Dhaka'], ['Delhi', 'Asia/Kolkata'], ['Karachi', 'Asia/Karachi'],
  ['Dubai', 'Asia/Dubai'], ['Moscow', 'Europe/Moscow'], ['Nairobi', 'Africa/Nairobi'], ['Athens', 'Europe/Athens'], ['Cairo', 'Africa/Cairo'], ['Berlin', 'Europe/Berlin'],
  ['Rome', 'Europe/Rome'], ['Paris', 'Europe/Paris'], ['Lagos', 'Africa/Lagos'], ['London', 'Europe/London'], ['Dublin', 'Europe/Dublin'], ['Reykjavík', 'Atlantic/Reykjavik'],
  ['Azores', 'Atlantic/Azores'], ['Rio de Janeiro', 'America/Sao_Paulo'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'], ['Halifax', 'America/Halifax'],
  ['New York', 'America/New_York'], ['Toronto', 'America/Toronto'], ['Chicago', 'America/Chicago'], ['Mexico City', 'America/Mexico_City'], ['Denver', 'America/Denver'],
  ['Los Angeles', 'America/Los_Angeles'], ['Anchorage', 'America/Anchorage'], ['Honolulu', 'Pacific/Honolulu'], ['Pago Pago', 'Pacific/Pago_Pago']];
/** a time zone's offset from UTC in minutes at a moment (Tokyo +540). Pure. */
export function offsetMin(tz, at) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}
/** where Christmas is right now: every place 'before', 'now' (it is the 25th there) or 'after', the count reached, and the next place with
 *  the milliseconds until its midnight. `on` is false outside the wave's two days (no place on the 25th and none within a day of it). Pure. */
export function wave(at = new Date()) {
  const y = at.getUTCMonth() === 0 ? at.getUTCFullYear() - 1 : at.getUTCFullYear();
  const places = WAVE.map(([name, tz]) => {
    const off = offsetMin(tz, at), start = Date.UTC(y, 11, 25) - off * 60000, end = start + 864e5;
    return { name, tz, start, state: at < start ? 'before' : at < end ? 'now' : 'after' };
  });
  const next = places.find((p) => p.state === 'before'), reached = places.filter((p) => p.state !== 'before').length, now = places.filter((p) => p.state === 'now').length;
  const first = places[0].start, last = places[places.length - 1].start + 864e5;
  return { on: at >= first - 864e5 && at < last, now, reached, total: places.length, places, next: next ? { name: next.name, ms: next.start - at } : null };
}
const hm = (ms) => { const m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60); return (h ? h + ' h ' : '') + (m % 60) + ' min'; };
/** the wave in one line: "Christmas has reached 12 of 36 places. Next: Moscow in 1 h 5 min." Pure. */
export function waveLine(w) {
  if (!w || !w.on) return '';
  if (!w.reached) return 'Christmas reaches Kiritimati first, in ' + hm(w.next.ms) + ', then sweeps west around the world.';
  return (w.now ? 'It is Christmas in ' + w.now + ' of ' + w.total + ' places right now' : 'Christmas has been everywhere') + (w.next ? '. Next: ' + w.next.name + ' in ' + hm(w.next.ms) + '.' : '. It has reached everywhere.');
}
/** a region's name in English ("FR" -> "France"), or the code itself when the browser cannot name it. */
export function regionName(code) { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(String(code || '').toUpperCase()) || code; } catch (_) { return code; } }
/** the time left until a date as "62 days 3 hours 4 minutes 5 seconds" (the parts that are not zero), or '' when it has come. Pure. */
export function countdown(to, now = new Date()) {
  let s = Math.floor((to - now) / 1000);
  if (!(s > 0)) return '';
  const parts = [[Math.floor(s / 86400), 'day'], [Math.floor(s / 3600) % 24, 'hour'], [Math.floor(s / 60) % 60, 'minute'], [s % 60, 'second']];
  return parts.filter(([n]) => n > 0).map(([n, u]) => n.toLocaleString('en') + ' ' + u + (n === 1 ? '' : 's')).join(' ');
}

const fold = (s) => String(s || '').toLowerCase().replace(/[‘’']/g, '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
const ASK = /^(?:so\s+|hey\s+|verse\s+)?is\s+(?:it|today)\s+(?:a\s+|an\s+)?(.+?)(?:\s+(?:yet|today|now|already|right now))?(?:\s+in\s+([a-z]+))?$/;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const until = (d, now) => Math.round((dayStart(d) - dayStart(now)) / 864e5);
const dateLine = (d) => DAY_NAMES[d.getDay()][0].toUpperCase() + DAY_NAMES[d.getDay()].slice(1) + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
const inDays = (n) => (n === 1 ? 'tomorrow' : 'in ' + n.toLocaleString('en') + ' days');

/** the answer to a yes-or-no day question, or null when the ask is not one this skill knows. Pure: `now` is the device's clock. */
export function isIt(text, now = new Date()) {
  const m = ASK.exec(fold(text));
  if (!m) return null;
  const lang = m[2] ? LANG_NAMES[m[2]] || '' : '';
  if (m[2] && !lang) return null; // "is it cold in london": not a language, not this skill's question
  const what = m[1].replace(/^the\s+(?=weekend|fourth)/, (x) => (/fourth/.test(m[1]) ? x : '')).trim();
  const today = DAY_NAMES[now.getDay()], Today = today[0].toUpperCase() + today.slice(1), base = { lang, slug: what.replace(/\s+/g, '-'), today: 'Today is ' + dateLine(now) + '.' };
  if (DAY_NAMES.includes(what)) {
    const yes = what === today, n = (DAY_NAMES.indexOf(what) - now.getDay() + 7) % 7;
    return { ...base, at: yes ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() + n), what: what[0].toUpperCase() + what.slice(1), yes, note: yes ? 'Today is ' + Today + '.' : 'Today is ' + Today + '. ' + what[0].toUpperCase() + what.slice(1) + ' is ' + inDays(n) + '.' };
  }
  if (what === 'weekend' || what === 'the weekend') {
    const yes = now.getDay() === 0 || now.getDay() === 6, n = (6 - now.getDay() + 7) % 7;
    return { ...base, at: yes ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() + n), what: 'The weekend', yes, note: yes ? 'Today is ' + Today + '.' : 'Today is ' + Today + '. Saturday is ' + inDays(n) + '.' };
  }
  if (what === 'weekday') { const yes = now.getDay() > 0 && now.getDay() < 6; return { ...base, at: null, what: 'A weekday', yes, note: 'Today is ' + Today + '.' }; }
  if (what === 'leap year') {
    const y = now.getFullYear(), leap = (z) => (z % 4 === 0 && z % 100 !== 0) || z % 400 === 0; let next = y + 1; while (!leap(next)) next++;
    return { ...base, at: null, what: 'A leap year', yes: leap(y), note: y + (leap(y) ? ' has a February 29.' : ' has no February 29. The next leap year is ' + next + '.') };
  }
  const day = DAYS[what];
  if (!day) return null;
  const [name, on] = day, here = on(now.getFullYear()), yes = sameDay(here, now);
  const next = until(here, now) >= 0 ? here : on(now.getFullYear() + 1), n = until(next, now);
  return { ...base, at: yes ? null : next, festive: /^christmas/.test(what) || what === 'xmas' || what === 'boxing day', what: name, yes, note: yes ? 'Today is ' + name + '.' : name + ' is ' + inDays(n) + ': ' + dateLine(next) + '.' };
}

// each day's light and the particles that burst from the word when it lands (scout notes, 2026-10-23: glowing softly against the starfield, a
// thematic glow, a quick burst, the details fading in below); a plain day keeps Verse's own violet. Pure data.
export const THEMES = { christmas: ['#ff6b6b', '#4ade80', '❄'], 'christmas eve': ['#ff6b6b', '#4ade80', '❄'], 'boxing day': ['#ff6b6b', '#4ade80', '❄'], xmas: ['#ff6b6b', '#4ade80', '❄'],
  halloween: ['#ff8a1f', '#a855f7', '🦇'], 'valentines day': ['#ff5fa2', '#ff9ec7', '♥'], valentines: ['#ff5fa2', '#ff9ec7', '♥'], 'st patricks day': ['#3ddc84', '#a3e635', '☘'],
  'saint patricks day': ['#3ddc84', '#a3e635', '☘'], 'new year': ['#ffd166', '#fff3c4', '✨'], 'new years': ['#ffd166', '#fff3c4', '✨'], 'new years day': ['#ffd166', '#fff3c4', '✨'],
  'new years eve': ['#ffd166', '#fff3c4', '✨'], thanksgiving: ['#e09f3e', '#9e2a2b', '🍂'], easter: ['#c3a6ff', '#fbcfe8', '🌸'], 'easter sunday': ['#c3a6ff', '#fbcfe8', '🌸'],
  'independence day': ['#6ea8ff', '#ff6b6b', '★'], 'the fourth of july': ['#6ea8ff', '#ff6b6b', '★'], 'the 4th of july': ['#6ea8ff', '#ff6b6b', '★'], '4th of july': ['#6ea8ff', '#ff6b6b', '★'],
  'july 4th': ['#6ea8ff', '#ff6b6b', '★'], 'mothers day': ['#f9a8d4', '#fde68a', '✿'], 'fathers day': ['#93c5fd', '#fde68a', '✦'], 'pi day': ['#67e8f9', '#c4b5fd', 'π'],
  'groundhog day': ['#d6a46b', '#fde68a', '✦'], 'april fools day': ['#f472b6', '#facc15', '?'], 'april fools': ['#f472b6', '#facc15', '?'] };
export const themeOf = (slug) => THEMES[String(slug || '').replace(/-/g, ' ')] || ['#bda6ff', '#7dd3fc', '✦'];

const CSS = '<style>.vpage:has(.is-it-word) .vc-art{display:none}.is-it-stage{position:relative;padding:6px 0;touch-action:manipulation}'
  + '.is-it-word{font:900 clamp(84px,16vw,150px)/1 system-ui,-apple-system,sans-serif;letter-spacing:.02em;text-align:center;margin:18px 0 10px;user-select:none;color:#fff;'
  + 'text-shadow:0 0 18px var(--glow),0 0 48px var(--glow),0 0 90px var(--glow2);animation:is-it-land .55s cubic-bezier(.2,1.4,.4,1) both}'
  + '@keyframes is-it-land{from{transform:scale(.6);opacity:0;filter:blur(8px)}to{transform:none;opacity:1;filter:none}}'
  + '.is-it-fade{opacity:0;animation:is-it-fade .6s ease-out forwards}@keyframes is-it-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'
  + '.is-it-bit{position:absolute;left:50%;top:50%;pointer-events:none;font-size:18px;color:var(--glow);animation:is-it-burst 1.1s ease-out forwards}'
  + '@keyframes is-it-burst{from{transform:translate(-50%,-50%) scale(.4);opacity:1}to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1);opacity:0}}'
  + '.is-it-ripple{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:2px solid currentColor;pointer-events:none;animation:is-it-ripple .8s ease-out forwards}'
  + '@keyframes is-it-ripple{to{transform:scale(14);opacity:0}}.is-it-stamp{position:absolute;font-size:30px;pointer-events:none;animation:is-it-stamp 4s ease-in forwards}'
  + '@keyframes is-it-stamp{80%{opacity:1}to{opacity:0}}.is-it-snow{position:absolute;top:-10px;color:#fff;pointer-events:none;animation:is-it-snow linear infinite}'
  + '@keyframes is-it-snow{to{transform:translateY(340px)}}'
  + '.is-it-wave-strip{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 6px;margin:4px 0 10px;font-size:11px}.is-it-wave-place{padding:1px 6px;border-radius:999px;border:1px solid rgba(255,255,255,.15);opacity:.45;transition:all .6s}'
  + '.is-it-wave-place[data-state=now]{opacity:1;color:#fff;border-color:#ffd166;background:rgba(255,107,107,.25);box-shadow:0 0 10px rgba(255,209,102,.55)}.is-it-wave-place[data-state=after]{opacity:.3;text-decoration:line-through}'
  + '.is-it-snowfall{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}.is-it-snowfall span{position:absolute;top:-20px;color:#fff;animation:is-it-fall linear infinite}'
  + '@keyframes is-it-fall{to{transform:translate(4vw,110vh)}}'
  + '@media (prefers-reduced-motion:reduce){.is-it-snow,.is-it-ripple,.is-it-stamp,.is-it-bit,.is-it-snowfall{animation:none;display:none}.is-it-word,.is-it-fade{animation:none;opacity:1}}</style>';

function run(text, api) {
  const a = isIt(text);
  if (!a) return 'none';
  const { showPage, esc } = api;
  const nav = typeof navigator !== 'undefined' ? navigator : {}, langs = a.lang ? [a.lang] : (nav.languages && nav.languages.length ? nav.languages : [nav.language || 'en']);
  const flag = flagOf((nav.languages && nav.languages.find((l) => /-/.test(l))) || nav.language || '');
  const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time');
  const th = themeOf(a.slug);
  const el = showPage((card) => {
    const w = wordFor(a.yes, langs);
    card.innerHTML = CSS + '<h2>Is it ' + esc(a.what.replace(/^The /, 'the ').replace(/^A /, 'a ')) + '?</h2>'
      + '<div class="is-it-stage" style="--glow:' + th[0] + ';--glow2:' + th[1] + '"><div class="is-it-word" lang="' + esc(w.lang) + '">' + esc(w.word) + '</div></div>'
      + (w.lang !== 'en' ? '<p class="is-it-fade" style="text-align:center;margin-top:-4px;animation-delay:.35s">' + (a.yes ? 'Yes' : 'No') + '</p>' : '')
      + '<p class="is-it-fade" style="text-align:center;animation-delay:.45s">' + esc(a.note) + '</p>'
      + (a.at ? '<p class="is-it-left is-it-fade" style="text-align:center;font-variant-numeric:tabular-nums;font-size:20px;animation-delay:.6s;color:' + th[0] + '"></p>' : '')
      + '<p class="is-it-fade" style="text-align:center;opacity:.8;animation-delay:.75s">' + esc(a.today) + '</p>'
      + '<div class="src">Source: this device’s clock and calendar (' + esc(zone) + '), no network. Tap the word for a ripple; right-click or hold to stamp your flag; the wheel or the arrow keys turn it. Also at a-to-mind.com/is-it/' + esc(a.slug) + '</div>';
  });
  const box = el && el.querySelector ? el.querySelector('.is-it-stage') : null;
  if (box) {
    // a tap makes a ripple where it lands; a right-click or a long press leaves your flag there for a few seconds
    const at = (e, cls, txt) => { const r = box.getBoundingClientRect(), d = document.createElement('span'); d.className = cls; d.textContent = txt || ''; d.style.left = (e.clientX - r.left) + 'px'; d.style.top = (e.clientY - r.top) + 'px'; box.appendChild(d); setTimeout(() => d.remove(), cls === 'is-it-stamp' ? 4100 : 900); };
    const stamp = (e) => at(e, 'is-it-stamp', flag || '🏳️');
    let hold = null;
    for (let i = 0; i < 16; i++) { const b = document.createElement('span'), ang = (i / 16) * Math.PI * 2, r = 70 + (i * 37) % 60; b.className = 'is-it-bit'; b.textContent = th[2]; b.style.setProperty('--dx', Math.round(Math.cos(ang) * r * 1.8) + 'px'); b.style.setProperty('--dy', Math.round(Math.sin(ang) * r) + 'px'); b.style.animationDelay = (0.25 + (i % 4) * 0.04) + 's'; box.appendChild(b); setTimeout(() => b.remove(), 1600); }
    box.addEventListener('click', (e) => at(e, 'is-it-ripple'));
    box.addEventListener('contextmenu', (e) => { e.preventDefault(); stamp(e); });
    box.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') hold = setTimeout(() => stamp(e), 550); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) box.addEventListener(ev, () => clearTimeout(hold));
    // everyone here (owner, 2026-10-23: the live crowd of visitors' flags; the scout's teardown: on Christmas week the old site showed everyone's flag
    // moving live): a public room on the relay (lib/share.js PUBLIC_ROOMS 'is-it', lib/share-client.js). On 24 to 26 December the card joins by itself;
    // any other day a small "Everyone here" switch joins it, remembered on this device. What passes is a closed list: a place with a two-letter
    // region (from the device's own language setting, never the network), a ripple, a stamp; nothing typed ever does. The flags of the others are
    // drawn at their places inside this box; their ripples and stamps play here as yours do. With the relay not switched on, tabs in this browser share.
    const CROWD_KEY = 'a2m.void.isit.crowd.v1', region = regionOf((nav.languages && nav.languages.find((l) => /-/.test(l))) || nav.language || '');
    const d0 = new Date(), festiveWeek = a.festive && d0.getMonth() === 11 && d0.getDate() >= 24 && d0.getDate() <= 26;
    let wantCrowd = festiveWeek; try { if (localStorage.getItem(CROWD_KEY) === '1') wantCrowd = true; if (localStorage.getItem(CROWD_KEY) === '0' && !festiveWeek) wantCrowd = false; } catch (_) {}
    const crowdLine = document.createElement('p'); crowdLine.className = 'is-it-crowd'; crowdLine.style.cssText = 'text-align:center;font-size:13px;opacity:.85;margin:4px 0';
    const sw = document.createElement('button'); sw.type = 'button'; sw.className = 'is-it-crowd-switch'; sw.style.cssText = 'font:inherit;font-size:12px;background:transparent;color:inherit;border:1px solid currentColor;border-radius:999px;padding:2px 10px;cursor:pointer;opacity:.8';
    const status = document.createElement('span'); status.className = 'is-it-crowd-status'; status.style.marginLeft = '8px';
    crowdLine.append(sw, status); const srcLine = el.querySelector('.src'); if (srcLine) srcLine.before(crowdLine); else box.after(crowdLine);
    const others = new Map(); let crowd = null, angle = 0, lastAt = null;
    // your own flag is your pointer inside the stage, and it turns (isitchristmas.com: the scroll wheel and the arrow keys turn your flag 15° a
    // step, a middle click sets it straight; the others see it turn). Mouse only: on a phone a finger has no hover, the tap and the hold stay.
    if (flag) {
      const mine = document.createElement('span'); mine.className = 'is-it-me'; mine.textContent = flag; mine.setAttribute('aria-hidden', 'true');
      mine.style.cssText = 'position:absolute;font-size:26px;pointer-events:none;display:none;transform:translate(-50%,-50%);filter:drop-shadow(0 0 6px rgba(0,0,0,.6))';
      box.appendChild(mine); let over = false;
      const turn = (by) => { angle = by === 0 ? 0 : Math.max(-360, Math.min(360, angle + by)); if (Math.abs(angle) === 360) angle = 0; mine.style.transform = 'translate(-50%,-50%) rotate(' + angle + 'deg)'; if (crowd && lastAt) crowd.cursor(lastAt[0], lastAt[1], region || undefined, angle || undefined); };
      box.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = box.getBoundingClientRect(); mine.style.left = (e.clientX - r.left) + 'px'; mine.style.top = (e.clientY - r.top) + 'px'; mine.style.display = ''; box.style.cursor = 'none'; over = true; });
      box.addEventListener('pointerleave', () => { mine.style.display = 'none'; box.style.cursor = ''; over = false; });
      box.addEventListener('wheel', (e) => { if (!over) return; e.preventDefault(); turn(e.deltaY < 0 ? 15 : -15); }, { passive: false });
      box.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); turn(0); } });
      const keys = (e) => { if (!box.isConnected) return document.removeEventListener('keydown', keys); if (!over || /^(?:input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) return; if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-15); } else if (e.key === 'ArrowRight') { e.preventDefault(); turn(15); } };
      document.addEventListener('keydown', keys);
    }
    const place = (x, y) => ({ left: (x * box.clientWidth) + 'px', top: (y * box.clientHeight) + 'px' });
    const presence = (id, x, y, fl, ang) => {
      let f = others.get(id);
      if (!f) { f = document.createElement('span'); f.className = 'is-it-peer'; f.style.cssText = 'position:absolute;font-size:22px;transition:left .25s linear,top .25s linear,transform .2s;filter:drop-shadow(0 0 6px rgba(0,0,0,.6))'; f.setAttribute('aria-hidden', 'true'); box.appendChild(f); others.set(id, f); }
      f.textContent = fl ? flagOf('xx-' + fl) : '·'; f.dataset.region = fl || ''; f.title = fl ? regionName(fl) : 'someone'; // hover a flag: whose country it is (the old site's legend)
      f.style.transform = 'translate(-50%,-50%) rotate(' + (ang || 0) + 'deg)'; Object.assign(f.style, place(x, y)); count(others.size + 1);
    };
    const gone = (id) => { const f = others.get(id); if (f) f.remove(); others.delete(id); count(others.size + 1); };
    const atUnit = (x, y, cls, txt) => { const d = document.createElement('span'); d.className = cls; d.textContent = txt || ''; Object.assign(d.style, place(x, y)); box.appendChild(d); setTimeout(() => d.remove(), cls === 'is-it-stamp' ? 4100 : 900); };
    // how many are here, and from where ("3 people here right now: Canada, France and you")
    const count = (n) => {
      if (!crowd) return;
      const from = [...new Set([...others.values()].map((f) => f.dataset.region).filter(Boolean).map(regionName))];
      status.textContent = n > 1 ? n.toLocaleString('en') + ' people here right now' + (from.length ? ': ' + from.slice(0, 6).join(', ') + (from.length > 6 ? ' and more' : '') + ' and you' : '') : 'only you here right now';
    };
    const unit = (e) => { const r = box.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    const leaveCrowd = () => { if (crowd) { try { crowd.leave(); } catch (_) {} crowd = null; } for (const id of [...others.keys()]) gone(id); status.textContent = ''; sw.textContent = 'Everyone here'; sw.setAttribute('aria-pressed', 'false'); };
    const joinCrowd = () => {
      sw.textContent = 'Everyone here: on'; sw.setAttribute('aria-pressed', 'true'); status.textContent = 'joining…';
      import('/lib/share-client.js').then((m) => {
        if (!box.isConnected) return;
        crowd = m.join('public-is-it', { summon() {}, presence, gone, count, ripple: (id, x, y) => atUnit(x, y, 'is-it-ripple'), stamp: (id, x, y, fl) => atUnit(x, y, 'is-it-stamp', flagOf('xx-' + fl)), note: (t) => { status.textContent = /not switched on/.test(t) ? 'live crowd not switched on yet: tabs in this browser share it' : status.textContent; } });
        let last = 0;
        box.addEventListener('pointermove', (e) => { const t = Date.now(); if (!crowd || t - last < 60) return; last = t; const [x, y] = unit(e); lastAt = [x, y]; crowd.cursor(x, y, region || undefined, angle || undefined); }, { passive: true });
      }).catch(() => { status.textContent = 'the crowd could not start in this browser'; });
    };
    box.addEventListener('click', (e) => { if (crowd) { const [x, y] = unit(e); crowd.ripple(x, y); } });
    box.addEventListener('contextmenu', (e) => { if (crowd && region) { const [x, y] = unit(e); crowd.stamp(x, y, region); } });
    sw.addEventListener('click', (e) => { e.stopPropagation(); if (crowd) { leaveCrowd(); try { localStorage.setItem(CROWD_KEY, '0'); } catch (_) {} } else { joinCrowd(); try { localStorage.setItem(CROWD_KEY, '1'); } catch (_) {} } });
    sw.textContent = 'Everyone here'; sw.setAttribute('aria-pressed', 'false');
    if (wantCrowd) joinCrowd();
    const watch = new MutationObserver(() => { if (!box.isConnected) { leaveCrowd(); watch.disconnect(); } }); watch.observe(document.body, { childList: true });
    // Christmas Eve, Christmas Day and Boxing Day: snow over the word
    const now = new Date();
    // the midnight wave: while Christmas is somewhere on Earth, the card follows it around the world (which places have it now, which is next and
    // when), a strip of places lights up from Kiritimati to Pago Pago, and snow falls over the whole stage while the card is open
    if (a.festive && wave(now).on) {
      const wv = document.createElement('div'); wv.className = 'is-it-wave';
      const wl = document.createElement('p'); wl.className = 'is-it-wave-line'; wl.style.cssText = 'text-align:center;font-size:15px;margin:6px 0';
      const strip = document.createElement('div'); strip.className = 'is-it-wave-strip'; strip.setAttribute('aria-hidden', 'true');
      const chips = WAVE.map(([name]) => { const c = document.createElement('span'); c.className = 'is-it-wave-place'; c.textContent = name; strip.appendChild(c); return c; });
      wv.append(wl, strip); crowdLine.before(wv);
      const drawWave = () => { if (!wv.isConnected) return clearInterval(wt); const w = wave(); wl.textContent = waveLine(w); w.places.forEach((p, i) => { chips[i].dataset.state = p.state; }); };
      const wt = setInterval(drawWave, 15000); drawWave();
      const sky = document.createElement('div'); sky.className = 'is-it-snowfall'; sky.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 70; i++) { const f = document.createElement('span'); f.textContent = i % 5 ? '•' : '❄'; f.style.left = ((i * 37) % 100) + 'vw'; f.style.fontSize = (6 + (i * 11) % 14) + 'px'; f.style.opacity = (0.35 + ((i * 7) % 6) / 10).toFixed(2); f.style.animationDuration = (7 + (i * 13) % 9) + 's'; f.style.animationDelay = (-((i * 17) % 11)) + 's'; sky.appendChild(f); }
      document.body.appendChild(sky);
      const unsnow = new MutationObserver(() => { if (!box.isConnected) { sky.remove(); unsnow.disconnect(); } }); unsnow.observe(document.body, { childList: true, subtree: true });
    }
    if (a.festive && now.getMonth() === 11 && now.getDate() >= 24 && now.getDate() <= 26) for (let i = 0; i < 24; i++) { const f = document.createElement('span'); f.className = 'is-it-snow'; f.textContent = '❄'; f.style.left = (i * 4.2) + '%'; f.style.fontSize = (8 + (i * 7) % 12) + 'px'; f.style.animationDuration = (4 + (i * 13) % 6) + 's'; f.style.animationDelay = (-(i * 7) % 5) + 's'; box.appendChild(f); }
  }
  // the countdown runs every second while the card is open, and the word flips by itself at your midnight
  const left = el && el.querySelector ? el.querySelector('.is-it-left') : null;
  if (left && a.at) {
    const node = document.createTextNode(''); left.appendChild(node); // one text node whose data ticks: no child changes for the page's card watcher
    const tick = () => {
      if (!left.isConnected) return clearInterval(t);
      const c = countdown(a.at);
      if (c) node.data = c + ' to go';
      else { clearInterval(t); const b = isIt(text); const word = el.querySelector('.is-it-word'); if (b && word) { const w = wordFor(b.yes, langs); word.textContent = w.word; node.data = b.note; } }
    };
    const t = setInterval(tick, 1000); tick();
  }
  if (api.say) api.say(a.yes ? 'Yes.' : 'No.');
  // for the curious who open the console, as on the old one-word sites
  try { if (typeof window !== 'undefined') { window.verse = window.verse || {}; window.verse.isIt = (q) => { const r = isIt('is it ' + q); return r ? (r.yes ? 'YES' : 'NO') + ': ' + r.note : 'ask me about a day: verse.isIt("christmas")'; }; } } catch (_) {}
  return 'is-it';
}

export default {
  name: 'is-it',
  examples: ['is it christmas', 'is it christmas yet?', 'is it friday', 'is today halloween', 'is it a leap year', 'is it thanksgiving', 'is it easter', 'is it christmas in french'],
  nearMisses: ['is it going to rain', 'is it safe to eat raw eggs', 'is it cold in london', 'is it open', 'what is christmas'],
  isIt,
  easter,
  wordFor,
  flagOf,
  themeOf,
  countdown,
  match(lower, text) { return !!isIt(text || lower); },
  run
};

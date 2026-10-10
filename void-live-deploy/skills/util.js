/**
 * util skill — small tools: passwords, QR codes, colours, word counts, text case, moon phase, placeholder text
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Everything runs in the browser (crypto for passwords, maths for the moon); only the QR image comes from goqr.me (no key).
 */
const CASES = { uppercase: (s) => s.toUpperCase(), 'upper case': (s) => s.toUpperCase(), lowercase: (s) => s.toLowerCase(), 'lower case': (s) => s.toLowerCase(),
  // title case keeps the small words small unless they open or close the title ("The Lord of the Rings")
  'title case': (s) => { const w = s.toLowerCase().split(/(\s+)/), last = w.length - 1; return w.map((x, i) => (i && i !== last && SMALL.has(x)) ? x : x.replace(/^\p{L}/u, (c) => c.toUpperCase())).join(''); },
  'capitalize words': (s) => s.replace(/(^|\s)(\p{L})/gu, (_, a, c) => a + c.toUpperCase()),
  reverse: (s) => Array.from(s).reverse().join(''), 'reverse words': (s) => s.trim().split(/\s+/).reverse().join(' ') };
const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'via', 'vs']);
// syllables by vowel groups, with the usual English corrections (silent final e, -le, -ed); right for most words, labelled "about"
export function syllables(w) {
  w = String(w).toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  let s = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const n = (s.match(/[aeiouy]+/g) || []).length + (/[^aeiouy]le$/.test(w) ? 1 : 0) - (/[^aeiouy]le$/.test(w) && /e$/.test(s) ? 1 : 0);
  return Math.max(1, n);
}
const NAMED = { red: '#ff0000', green: '#008000', blue: '#0000ff', teal: '#008080', navy: '#000080', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gold: '#ffd700', coral: '#ff7f50', salmon: '#fa8072', turquoise: '#40e0d0', indigo: '#4b0082', violet: '#ee82ee', maroon: '#800000', olive: '#808000', lime: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080', brown: '#a52a2a', beige: '#f5f5dc', lavender: '#e6e6fa' };
export function utilOf(text) {
  const raw = String(text || '').trim(), t = raw.replace(/[?!.]+$/, '').replace(/\s+/g, ' '), l = t.toLowerCase();
  let m = l.match(/^(?:generate|make|create|give me|new)\s+(?:me\s+)?(?:a\s+)?(?:strong\s+|secure\s+|random\s+)*password(?:\s+(?:with|of)\s+(\d{1,3})\s+(?:characters|chars|letters))?$|^password\s+generator$/);
  if (m) return { kind: 'password', n: Math.min(128, Math.max(8, +m[1] || 20)) };
  m = t.match(/^(?:make\s+(?:me\s+)?|create\s+|generate\s+)?(?:a\s+)?qr(?:\s+code)?\s+(?:for|of|with)\s+(.{1,300})$/i);
  if (m) return { kind: 'qr', data: m[1].trim() };
  m = l.match(/^(?:what\s+colou?r\s+is\s+|show\s+(?:me\s+)?(?:the\s+colou?r\s+)?|colou?r\s+)(#?[0-9a-f]{6}|#?[0-9a-f]{3}|[a-z]{3,12})$/);
  if (m && (/^#?[0-9a-f]{3}([0-9a-f]{3})?$/.test(m[1]) || NAMED[m[1]])) return { kind: 'color', c: m[1] };
  // "what color is rgb 255 0 0", "rgb(0, 128, 255)"
  m = l.match(/^(?:what\s+colou?r\s+is\s+|show\s+(?:me\s+)?)?rgb\s*\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/);
  if (m && [m[1], m[2], m[3]].every((v) => +v <= 255)) return { kind: 'color', c: '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('') };
  m = t.match(/^(?:word\s+count|count\s+(?:the\s+)?words)(?:\s+(?:of|in|for)\s+|\s*:\s*)(.+)$/i) || t.match(/^how\s+many\s+words\s+(?:are\s+)?in\s+(.+)$/i);
  if (m) return { kind: 'count', s: m[1].replace(/^["“]|["”]$/g, '') };
  // "make it uppercase: hello world", "turn this into title case: ..."
  m = t.match(/^(?:make|turn|convert|change|put)\s+(?:it|this|that|the\s+text)\s+(?:in(?:to)?\s+|to\s+)?(uppercase|upper case|lowercase|lower case|title case|all caps|caps)\s*:\s*(.+)$/i);
  if (m) return { kind: 'case', how: /caps/i.test(m[1]) ? 'uppercase' : m[1].toLowerCase(), s: m[2] };
  // "how many characters in supercalifragilistic", "character count of ..."
  // "how many vowels in banana", "count the consonants in rhythm"
  m = t.match(/^(?:how\s+many|count\s+(?:the\s+)?)\s*(vowels|consonants)\s+(?:are\s+)?(?:in|of)\s+(?:the\s+word\s+)?["“]?([\p{L}\p{M}' -]{1,60}?)["”]?$/iu);
  if (m) return { kind: 'letters', which: m[1].toLowerCase(), s: m[2] };
  m = t.match(/^(?:how\s+many\s+(?:characters|letters|chars)\s+(?:are\s+)?in|count\s+(?:the\s+)?(?:characters|letters|chars)\s+in|(?:character|letter|char)\s+count\s+(?:of|in|for))\s+(.+)$/i);
  if (m && /^(?:the\s+)?(?:english\s+)?alphabet$/i.test(m[1])) m = null; // a fact, not a count of the word "alphabet"
  if (m) return { kind: 'count', s: m[1].replace(/^(?:the\s+)?(?:word|name|phrase)\s+(?=\S)/i, '').replace(/^["“]|["”]$/g, ''), chars: true };
  if (/^(?:generate|make|give\s+me|create|new)\s+(?:a\s+|an\s+)?(?:uuid|guid|unique\s+id)$|^(?:uuid|guid)$/i.test(t)) return { kind: 'uuid' };
  m = t.match(/^(?:an?\s+)?emojis?\s+(?:for|of|that\s+means)\s+([a-z ]{2,20})$/i);
  if (m && EMOJI[m[1].trim().toLowerCase()]) return { kind: 'emoji', w: m[1].trim().toLowerCase() };
  // "nato alphabet for hello", "spell hello in nato", "morse code for sos", "hello in binary"
  m = t.match(/^(?:(?:the\s+)?(?:nato|phonetic)\s+(?:alphabet|spelling)\s+(?:for|of)\s+(.{1,40})|spell\s+(.{1,40}?)\s+(?:in|with\s+the)\s+(?:nato|phonetic)(?:\s+alphabet)?)$/i);
  if (m) return { kind: 'nato', s: (m[1] || m[2]).trim() };
  m = t.match(/^(?:(?:the\s+)?morse(?:\s+code)?\s+(?:for|of)\s+(.{1,60})|(.{1,60}?)\s+in\s+morse(?:\s+code)?)$/i);
  if (m) return { kind: 'morse', s: (m[1] || m[2]).trim() };
  m = t.match(/^(?:(?:the\s+)?(?:word|text)\s+)?["“']?([a-z ]{1,24}?)["”']?\s+in\s+binary$/i);
  if (m && /[a-z]/i.test(m[1]) && !/^\d/.test(m[1])) return { kind: 'textbin', s: m[1] };
  m = t.match(/^spell\s+(.+?)\s+backwards?$/i);
  if (m) return { kind: 'case', how: 'reverse', s: m[1] };
  // "reverse the words in hello big world"
  m = t.match(/^reverse\s+(?:the\s+)?(?:order\s+of\s+(?:the\s+)?)?words\s+(?:in|of)\s*:?\s+(.+)$/i);
  if (m) return { kind: 'case', how: 'reverse words', s: m[1] };
  // "is racecar a palindrome", "is 'never odd or even' a palindrome"
  m = t.match(/^is\s+["“']?(.+?)["”']?\s+a\s+palindrome$/i);
  if (m) return { kind: 'palindrome', s: m[1] };
  // "how many syllables in banana", "syllables in elephant"
  m = l.match(/^(?:how\s+many\s+)?syllables?\s+(?:are\s+)?(?:in|does)\s+(?:the\s+word\s+)?["“']?([a-z'-]{1,30})["”']?(?:\s+have)?$|^how\s+many\s+syllables\s+does\s+["“']?([a-z'-]{1,30})["”']?\s+have$/);
  if (m) return { kind: 'syllables', w: m[1] || m[2] };
  // "capitalize every word in the cat sat on the mat": each word starts with a capital, small words too
  m = t.match(/^(?:capitali[sz]e|uppercase)\s+(?:every|each|all\s+the|the\s+first\s+letter\s+of\s+(?:every|each))\s+words?\s+(?:in|of)\s*:?\s+(.+)$/i);
  if (m) return { kind: 'case', how: 'capitalize words', s: m[1] };
  m = t.match(/^(uppercase|upper case|lowercase|lower case|title case|reverse)\s*:?\s+(?:this:?\s+)?(.+)$/i);
  // "this" is filler ("uppercase this: hello") only when typed as a word, not when it is part of the text ("lowercase THIS IS LOUD")
  if (m) { const f = t.match(/^\S+(?:\s+case)?\s*:?\s+(this:?\s+)/i); if (f && f[1].trim().replace(/:$/, '') !== 'this') m[2] = f[1] + m[2]; }
  if (m && !/^(the\s+)?(list|timer|clock|note|sticky)\b/i.test(m[2]) && !/^(?:\d+(?:\.\d+)?\s*)?(?:percentage|percent|%)/i.test(m[2])) return { kind: 'case', how: m[1].toLowerCase(), s: m[2] }; // "reverse percentage ..." is maths
  // the moon (phase, next full and new) is skills/moontonight.js now: lib/astro.js, good to minutes; the mean-cycle sum below was off by hours
  m = l.match(/^(?:give\s+me\s+)?(?:some\s+|(\d{1,2})\s+paragraphs?\s+(?:of\s+)?)?(?:lorem\s+ipsum|placeholder\s+text|dummy\s+text)(?:\s+(\d{1,2})\s+paragraphs?)?$/);
  if (m) return { kind: 'lorem', n: Math.max(1, Math.min(10, +(m[1] || m[2]) || 1)) };
  return null;
}
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu', 0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };
const MORSE = { A: '·−', B: '−···', C: '−·−·', D: '−··', E: '·', F: '··−·', G: '−−·', H: '····', I: '··', J: '·−−−', K: '−·−', L: '·−··', M: '−−', N: '−·', O: '−−−', P: '·−−·', Q: '−−·−', R: '·−·', S: '···', T: '−', U: '··−', V: '···−', W: '·−−', X: '−··−', Y: '−·−−', Z: '−−··', 0: '−−−−−', 1: '·−−−−', 2: '··−−−', 3: '···−−', 4: '····−', 5: '·····', 6: '−····', 7: '−−···', 8: '−−−··', 9: '−−−−·', '.': '·−·−·−', ',': '−−··−−', '?': '··−−··', '!': '−·−·−−', '/': '−··−·', '@': '·−−·−·' };
const EMOJI = { happy: '😀 😊 😄', sad: '😢 😞 ☹️', love: '❤️ 😍 🥰', laugh: '😂 🤣', angry: '😠 😡', tired: '😴 🥱', cool: '😎', thinking: '🤔', party: '🎉 🥳', fire: '🔥', ok: '👌 👍', yes: '✅ 👍', no: '❌ 👎', thanks: '🙏', heart: '❤️', star: '⭐ 🌟', sun: '☀️', moon: '🌙', rain: '🌧️', snow: '❄️', coffee: '☕', pizza: '🍕', cake: '🎂', dog: '🐶', cat: '🐱', money: '💰 💵', idea: '💡', rocket: '🚀', music: '🎵 🎶', birthday: '🎂 🎉', surprised: '😮 😲', scared: '😱', sick: '🤒', cry: '😭', wink: '😉', kiss: '😘', clap: '👏', strong: '💪', eyes: '👀', skull: '💀', ghost: '👻', robot: '🤖', alien: '👽', earth: '🌍', flower: '🌸', tree: '🌳', car: '🚗', home: '🏠', book: '📚', phone: '📱', time: '⏰', warning: '⚠️', check: '✔️' };
function hex(c) { c = NAMED[c] || c; c = c.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return '#' + c.toLowerCase(); }
function hsl(h) { const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let H = 0;
  if (d) H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H = Math.round(H * 60 + 360) % 360; const L = (mx + mn) / 2, S = d ? d / (1 - Math.abs(2 * L - 1)) : 0;
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), h: H, s: Math.round(S * 100), l: Math.round(L * 100) }; }
export function moonPhase(d = new Date()) { // kept for the explainer's test (tools/explainers.test.mjs); the moon skill uses lib/astro.js. Days since a known new moon (2000-01-06 18:14 UTC), mean synodic month
  const syn = 29.530588853, age = ((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 % syn + syn) % syn, f = age / syn;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { age, name: names[Math.floor(f * 8 + 0.5) % 8], lit: Math.round((1 - Math.cos(2 * Math.PI * f)) / 2 * 100), nextFull: new Date(d.getTime() + ((syn / 2 - age + syn) % syn) * 864e5) };
}
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
async function run(text, api) {
  const { showPage, esc } = api;
  const q = utilOf(text);
  if (!q) return 'none';
  const big = (s, size) => '<div class="util-out" style="font-size:' + (size || 30) + 'px;font-weight:300;line-height:1.3;margin:8px 0;word-break:break-all">' + esc(s) + '</div>';
  const copyBtn = '<button type="button" class="tr-copy util-copy">copy</button>';
  let el;
  if (q.kind === 'password') {
    const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?';
    const a = new Uint32Array(q.n); crypto.getRandomValues(a);
    const pw = Array.from(a, (x) => set[x % set.length]).join('');
    el = showPage((p) => { p.innerHTML = '<h2>Password</h2>' + big(pw, 26) + copyBtn + '<p style="color:#8a8a8a">' + q.n + ' characters, made in your browser and never sent anywhere · ask again for another</p>'; });
  } else if (q.kind === 'qr') {
    const src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(q.data);
    el = showPage((p) => { p.innerHTML = '<h2>QR code</h2><div class="sub">' + esc(q.data) + '</div><img alt="QR code for ' + esc(q.data) + '" src="' + esc(src) + '" style="float:none;max-width:240px;max-height:240px;background:#fff;border-radius:8px;margin:8px 0">'
      + '<div class="src">Source: <a href="https://goqr.me/api/" target="_blank" rel="noopener">goqr.me</a></div>'; });
  } else if (q.kind === 'color') {
    const h = hex(q.c), v = hsl(h);
    el = showPage((p) => { p.innerHTML = '<h2>' + esc(NAMED[q.c] ? q.c : h) + '</h2><div style="height:110px;border-radius:12px;margin:8px 0;background:' + esc(h) + ';border:1px solid rgba(255,255,255,.15)"></div>'
      + '<ul><li><b>Hex</b> ' + esc(h) + '</li><li><b>RGB</b> ' + v.r + ', ' + v.g + ', ' + v.b + '</li><li><b>HSL</b> ' + v.h + '°, ' + v.s + '%, ' + v.l + '%</li></ul>'; });
  } else if (q.kind === 'letters') {
    // a, e, i, o, u are vowels (y is counted as a consonant, the usual school answer)
    const ls = Array.from(q.s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).filter((c) => /[a-z]/.test(c)), v = ls.filter((c) => 'aeiou'.includes(c)).length, n = q.which === 'vowels' ? v : ls.length - v;
    el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.which.charAt(0).toUpperCase() + q.which.slice(1)) + ' in ' + esc(q.s) + '</h2>' + big(n + ' ' + (n === 1 ? q.which.slice(0, -1) : q.which), 44) + '<p style="color:#8a8a8a">' + v + ' vowels (a e i o u) · ' + (ls.length - v) + ' consonants</p>'; });
  } else if (q.kind === 'count') {
    const words = (q.s.match(/[\p{L}\p{N}'’-]+/gu) || []).length, chars = Array.from(q.s).length, noSp = Array.from(q.s.replace(/\s/g, '')).length;
    el = q.chars
      ? showPage((p) => { p.innerHTML = '<h2>Characters</h2>' + big(chars + (chars === 1 ? ' character' : ' characters'), 44) + '<p style="color:#8a8a8a">' + noSp + ' without spaces · ' + words + (words === 1 ? ' word' : ' words') + '</p>'; })
      : showPage((p) => { p.innerHTML = '<h2>Word count</h2>' + big(words + (words === 1 ? ' word' : ' words'), 44) + '<p style="color:#8a8a8a">' + chars + ' characters (' + noSp + ' without spaces)</p>'; });
  } else if (q.kind === 'uuid') {
    const id = (crypto.randomUUID && crypto.randomUUID()) || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
    el = showPage((p) => { p.innerHTML = '<h2>UUID</h2>' + big(id, 22) + copyBtn + '<p style="color:#8a8a8a">version 4, random, made in your browser · ask again for another</p>'; });
  } else if (q.kind === 'emoji') {
    el = showPage((p) => { p.innerHTML = '<h2>Emoji for “' + esc(q.w) + '”</h2>' + big(EMOJI[q.w], 44) + copyBtn; });
  } else if (q.kind === 'case') {
    const out = CASES[q.how](q.s);
    el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.how.charAt(0).toUpperCase() + q.how.slice(1)) + '</h2>' + big(out, 28) + copyBtn; });
  } else if (q.kind === 'palindrome') {
    const k = Array.from(q.s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')), yes = k.length > 1 && k.join('') === k.slice().reverse().join('');
    el = showPage((p) => { p.innerHTML = '<h2>Palindrome?</h2>' + big(yes ? 'Yes' : 'No', 44) + '<p style="color:#8a8a8a">“' + esc(q.s) + '” ' + (yes ? 'reads the same backwards' : 'backwards is “' + esc(Array.from(q.s).reverse().join('')) + '”') + ' (ignoring spaces, punctuation and case)</p>'; });
  } else if (q.kind === 'syllables') {
    const n = syllables(q.w);
    el = showPage((p) => { p.innerHTML = '<h2>Syllables</h2>' + big(n + (n === 1 ? ' syllable' : ' syllables'), 44) + '<p style="color:#8a8a8a">“' + esc(q.w) + '”, counted by its vowel sounds; a few words break the rules</p>'; });
  } else if (q.kind === 'nato') {
    const words = Array.from(q.s.toUpperCase()).map((c) => NATO[c] || (c === ' ' ? '·' : c)).join(' ');
    el = showPage((p) => { p.innerHTML = '<h2>NATO alphabet</h2>' + big(words, 24) + copyBtn + '<p style="color:#8a8a8a">“' + esc(q.s) + '” letter by letter</p>'; });
  } else if (q.kind === 'morse') {
    const code = Array.from(q.s.toUpperCase()).map((c) => (c === ' ' ? '/' : MORSE[c] || '')).filter(Boolean).join(' ');
    el = showPage((p) => { p.innerHTML = '<h2>Morse code</h2>' + big(code, 28) + copyBtn + '<p style="color:#8a8a8a">“' + esc(q.s) + '” · letters split by spaces, words by /</p>'; });
  } else if (q.kind === 'textbin') {
    const bin = Array.from(new TextEncoder().encode(q.s)).map((b) => b.toString(2).padStart(8, '0')).join(' ');
    el = showPage((p) => { p.innerHTML = '<h2>In binary</h2>' + big(bin, 20) + copyBtn + '<p style="color:#8a8a8a">“' + esc(q.s) + '” as 8-bit UTF-8 bytes</p>'; });
  } else if (q.kind === 'lorem') {
    el = showPage((p) => { p.innerHTML = '<h2>Lorem ipsum</h2><div class="util-out">' + Array.from({ length: q.n || 1 }, () => '<p>' + esc(LOREM) + '</p>').join('\n\n') + '</div>' + copyBtn; });
  }
  const b = el && el.querySelector && el.querySelector('.util-copy');
  if (b) b.addEventListener('click', async () => { const s = (el.querySelector('.util-out') || el.querySelector('p')).textContent; let ok = false; try { await navigator.clipboard.writeText(s); ok = true; } catch (_) {} b.textContent = ok ? 'copied' : 'select it to copy'; setTimeout(() => { b.textContent = 'copy'; }, 1600); });
  return 'util';
}
export default {
  name: 'util',
  examples: ['generate a password', 'qr code for a-to-mind.com', 'what color is #ff8800', 'word count of hello world', 'lorem ipsum'],
  nearMisses: ['what is a palindrome', 'reset my password', 'what is a qr code', 'make my void blue', 'what is the moon made of', 'moon phase tonight'],
  match(lower, text) { return !!utilOf(text); },
  run
};

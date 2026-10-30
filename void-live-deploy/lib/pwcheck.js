/**
 * pwcheck: how long a password would take to guess, worked out on the device (owner, 2026-10-24: back to the easy sites; the data's easiest real tool was
 * howsecureismypassword.net). Nothing is sent anywhere: the password stays in the page. The estimate splits the password into the cheapest pieces for a
 * guesser (a common password or word, with capitals and l33t swaps; a sequence like 1234 or qwerty; a repeat; a year; plain digits; or brute force over the
 * letters it uses), multiplies what each piece costs, and reads the time off at two speeds: an online login that allows 100 tries a second, and a stolen
 * list cracked offline on a rig that tries 10 billion a second. It is an estimate, and says so.
 * leakCount() is the one optional network step: the number of times the password shows up in the Have I Been Pwned list, asked the k-anonymity way: only
 * the first 5 characters of the password's SHA-1 go out, the list answers with every fingerprint that starts the same, and the match is made here.
 * Tests: tools/pwcheck.test.mjs.
 */
export const MAX_LEN = 128;
// the passwords and words people really use first (public knowledge: the head of every leaked-password list); rank = how early a guesser tries it
const COMMON = ('password 123456 123456789 12345678 12345 1234567 qwerty abc123 password1 111111 123123 admin letmein welcome monkey dragon master login princess qwertyuiop solo passw0rd starwars football baseball iloveyou sunshine trustno1 shadow michael superman batman whatever freedom hello charlie donald 000000 654321 1q2w3e4r zaq12wsx qazwsx asdfgh zxcvbn 1qaz2wsx hottie lovely ashley bailey jordan harley ranger hunter buster soccer hockey killer george andrew tigger cheese summer matrix ginger flower cookie pepper maggie jessica nicole daniel thomas robert jennifer joshua pokemon naruto computer internet secret money angel mustang oliver liverpool arsenal chelsea barcelona madrid ferrari porsche mercedes cowboys yankees lakers steelers eagles falcon phoenix thunder tiger lion panda rabbit monster zombie ninja pirate wizard knight sword shield fire water earth wind storm winter spring autumn blue red green black white purple orange yellow silver gold diamond crystal heaven hell god jesus love lover baby babygirl sweety honey sugar candy chocolate banana apple cherry lemon pizza coffee beer vodka whiskey wine guitar music rock metal punk jazz dance happy lucky smile family friends friend forever always never nothing something anything everything test testing guest user root default changeme temp temporary demo sample example abcd abcdef abcdefg qwe asd zxc 1234 12345 123456 1111 0000 1212 aaaaaa aaa 123abc a1b2c3 pass pass123 pa55word p4ssword passwd mypassword newpassword yourpassword iloveu loveme lovers school college student teacher doctor nurse engineer manager boss office work home house garden car bike road city country world earth planet star moon sun space galaxy universe')
  .split(' ');
const RANK = new Map(); COMMON.forEach((w, i) => { if (!RANK.has(w)) RANK.set(w, i + 1); });
const LEET = { '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '|': 'l', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'abcdefghijklmnopqrstuvwxyz'];

const classOf = (c) => /[a-z]/.test(c) ? 'l' : /[A-Z]/.test(c) ? 'u' : /[0-9]/.test(c) ? 'd' : 's';
const cardOf = (s) => { const k = new Set([...s].map(classOf)); return (k.has('l') ? 26 : 0) + (k.has('u') ? 26 : 0) + (k.has('d') ? 10 : 0) + (k.has('s') ? 33 : 0) || 10; };

// a stretch of letters that reads like a word (vowels in a natural share, no long runs of the same letter or of consonants) is priced as a word from a
// dictionary of about 30,000, not as random letters: a phrase of ordinary words is far weaker than its letters suggest. This errs the cautious way: a
// random string that happens to look like a word is scored as the word.
const wordLike = (low) => { const v = (low.match(/[aeiouy]/g) || []).length / low.length; return v >= 0.25 && v <= 0.65 && !/([a-z])\1\1/.test(low) && !/[^aeiouy]{6}/.test(low); };

/** what one stretch of the password costs a guesser: { guesses, kind, label } or null when it is just brute force. Pure. */
export function pieceOf(seg) {
  const n = seg.length, low = seg.toLowerCase();
  if (n === 1 && ' -_.,'.includes(seg)) return { guesses: 3, kind: 'separator', label: '' }; // the space or dash between words costs little
  if (n >= 3) {
    if (RANK.has(low)) return { guesses: RANK.get(low) * (seg !== low ? 2 : 1), kind: 'common', label: 'Contains "' + seg + '", a password or word people use first' };
    const unleet = [...low].map((c) => LEET[c] || c).join('');
    if (unleet !== low && RANK.has(unleet)) return { guesses: RANK.get(unleet) * 2 * (seg !== low ? 2 : 1) * 2, kind: 'leet', label: '"' + seg + '" is the common word "' + unleet + '" with look-alike symbols, which guessers try' };
  }
  if (n >= 3) {
    for (const row of ROWS) { const at = row.indexOf(low), back = [...row].reverse().join('').indexOf(low); if (at >= 0 || back >= 0) return { guesses: 8 * n, kind: 'sequence', label: 'The run "' + seg + '" follows the keys or the alphabet, so it is easy to guess' }; }
    const codes = [...low].map((c) => c.charCodeAt(0)), step = codes[1] - codes[0];
    if ((step === 1 || step === -1) && codes.every((c, i) => i === 0 || c - codes[i - 1] === step)) return { guesses: 8 * n, kind: 'sequence', label: 'The run "' + seg + '" counts up or down, so it is easy to guess' };
    if ([...seg].every((c) => c === seg[0])) return { guesses: 94 * n, kind: 'repeat', label: 'The same character repeated ("' + seg + '")' };
  }
  if (n >= 4 && n % 2 === 0 || n >= 6) for (let b = 2; b <= Math.floor(n / 2); b++) if (n % b === 0 && seg.slice(0, b).repeat(n / b) === seg) return { guesses: Math.pow(cardOf(seg.slice(0, b)), b) * (n / b), kind: 'repeat', label: 'The piece "' + seg.slice(0, b) + '" repeated' };
  if (/^[a-z]{4,12}$/i.test(seg) && wordLike(low)) return { guesses: 30000 * (/[A-Z]/.test(seg) ? 2 : 1), kind: 'word', label: '"' + seg + '" looks like an ordinary word, and a guesser tries words from a dictionary of tens of thousands' };
  if (/^(?:19|20)\d\d$/.test(seg)) return { guesses: 130, kind: 'year', label: 'A year (' + seg + ') is among the first things guessed' };
  if (n >= 4 && /^\d+$/.test(seg)) return { guesses: Math.pow(10, n), kind: 'digits', label: 'Only digits (' + seg + ')' };
  return null;
}

/** the cheapest way to build the password from pieces: { guesses, pieces: [{ text, guesses, kind, label }] }. Pure. */
export function guessesFor(pw) {
  const s = String(pw).slice(0, MAX_LEN), n = s.length; if (!n) return { guesses: 1, pieces: [] };
  const best = new Array(n + 1).fill(Infinity), path = new Array(n + 1).fill(null), cnt = new Array(n + 1).fill(0); best[0] = 1;
  for (let j = 1; j <= n; j++) for (let i = 0; i < j; i++) {
    if (best[i] === Infinity) continue; const seg = s.slice(i, j), p = pieceOf(seg), g = p ? p.guesses : Math.pow(cardOf(seg), seg.length), k = cnt[i] + 1;
    const sep = p && p.kind === 'separator', total = best[i] * g * (cnt[i] && !sep ? k : 1); // each extra piece multiplies by its place (the pieces can be in any order: k! in all); a separator does not count
    if (total < best[j]) { best[j] = total; path[j] = { i, p, g, text: seg }; cnt[j] = sep ? cnt[i] : k; }
  }
  const pieces = []; for (let j = n; j > 0; j = path[j].i) pieces.unshift({ text: path[j].text, guesses: path[j].g, kind: path[j].p ? path[j].p.kind : 'random', label: path[j].p ? path[j].p.label : '' });
  return { guesses: Math.max(10, best[n]), pieces };
}

export const SPEEDS = Object.freeze({ online: 100, offline: 1e10 }); // guesses a second: a login that allows 100, a stolen list on a rig that tries 10 billion
const UNITS = [['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['month', 2629800], ['year', 31557600]];
/** seconds as a plain phrase: "instantly", "3 hours", "412 years", "9 thousand years", "2 million years", "more than a trillion years". Pure. */
export function timeWords(sec) {
  if (!(sec >= 1)) return 'instantly'; const yr = 31557600;
  if (sec >= 1e12 * yr) return 'more than a trillion years'; if (sec >= 1e9 * yr) return Math.round(sec / yr / 1e9) + ' billion years';
  if (sec >= 1e6 * yr) return Math.round(sec / yr / 1e6) + ' million years'; if (sec >= 1e3 * yr) return Math.round(sec / yr / 1e3) + ' thousand years';
  let u = UNITS[0]; for (const x of UNITS) if (sec >= x[1]) u = x; const v = Math.round(sec / u[1]); return v + ' ' + u[0] + (v === 1 ? '' : 's');
}
export const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

/** the whole answer for a password: { length, guesses, score 0-4, label, online, offline (time phrases), pieces, reasons, tips }. Pure. */
export function check(pw) {
  const s = String(pw == null ? '' : pw).slice(0, MAX_LEN), g = guessesFor(s), lg = Math.log10(g.guesses), score = lg < 6 ? 0 : lg < 11 ? 1 : lg < 14.5 ? 2 : lg < 18 ? 3 : 4; // by the offline rig: under 5 s is weak, hours to days is fair, about a year or more is strong
  const reasons = g.pieces.filter((p) => p.label).map((p) => p.label), tips = [];
  if (s.length && s.length < 12) tips.push('Make it longer: ' + (12 - s.length) + ' more character' + (12 - s.length === 1 ? '' : 's') + ' would reach 12, and each one multiplies the work of guessing it.');
  if (g.pieces.some((p) => p.kind === 'common' || p.kind === 'leet')) tips.push('Do not build on a word people use; a few unrelated words strung together beat one clever word.');
  if (g.pieces.some((p) => p.kind === 'word') && g.pieces.filter((p) => p.kind === 'word').length >= 2) tips.push('Ordinary words are guessed one by one from a dictionary: put more of them in, or mix in characters that are not part of any word.');
  if (g.pieces.some((p) => p.kind === 'sequence' || p.kind === 'repeat' || p.kind === 'year' || p.kind === 'digits')) tips.push('Leave out runs, repeats, years and plain digits: they are the first things tried.');
  if (s.length && !tips.length && score < 4) tips.push('Longer is the surest way up: add another unrelated word.');
  return { length: s.length, guesses: g.guesses, score, label: s ? LABELS[score] : '', online: s ? timeWords(g.guesses / 2 / SPEEDS.online) : '', offline: s ? timeWords(g.guesses / 2 / SPEEDS.offline) : '', pieces: g.pieces, reasons, tips };
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
/** how many times the password is in the Have I Been Pwned list: a number (0 when it is not), or null when the list could not be asked. Only the first 5 characters of the SHA-1 are sent. */
export async function leakCount(pw, get = (u, o) => fetch(u, o), subtle = globalThis.crypto && globalThis.crypto.subtle) {
  try {
    const h = hex(await subtle.digest('SHA-1', new TextEncoder().encode(String(pw)))), prefix = h.slice(0, 5), rest = h.slice(5);
    const r = await get('https://api.pwnedpasswords.com/range/' + prefix, { headers: { 'add-padding': 'true' } }); if (!r.ok) return null;
    for (const line of (await r.text()).split(/\r?\n/)) { const [sfx, n] = line.trim().split(':'); if (sfx === rest) return Number(n) || 0; }
    return 0;
  } catch (_) { return null; }
}

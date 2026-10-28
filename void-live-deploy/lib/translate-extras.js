// The translator's catch-up features (docs/PARITY/google-translate.md, owner 2026-10-28: "we actually want to outdo them all in every way"):
// recently used languages, searching the language list, an on-screen keyboard for other scripts, your own corrections remembered, and the
// two sides of a conversation. Pure: the page (/translate/) owns the DOM, this owns the rules, tools/translate-extras.test.mjs checks them.
import { LANGS, codeOf } from './translate-langs.js';

export const RECENT_MAX = 5;

/** the recently used list with `code` moved to the front, at most `max`, unknown codes and 'auto' left out. Pure. */
export function recentLangs(list, code, max = RECENT_MAX) {
  const c = String(code || '');
  const rest = (Array.isArray(list) ? list : []).filter((x) => LANGS[x] && x !== c);
  return (LANGS[c] ? [c].concat(rest) : rest).slice(0, max);
}

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** the languages a typed query names, best first: the code itself, a name that starts with it, then one that contains it (English or
 *  the speaker's own name, accents ignored: "espa" finds Spanish, "deu" German, "中" Chinese). Pure. */
export function matchLangs(query, max = 12) {
  const q = fold(query).trim();
  if (!q) return [];
  const scored = [];
  for (const [c, [en, own]] of Object.entries(LANGS)) {
    const a = fold(en), b = fold(own);
    const s = c === q ? 0 : a.startsWith(q) || b.startsWith(q) ? 1 : a.split(/\s+/).some((w) => w.startsWith(q)) || b.split(/\s+/).some((w) => w.startsWith(q)) ? 2 : a.includes(q) || b.includes(q) ? 3 : 9;
    if (s < 9) scored.push([s, en, c]);
  }
  const alias = codeOf(query);
  if (alias && !scored.some((x) => x[2] === alias)) scored.push([1, LANGS[alias][0], alias]);
  return scored.sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1])).slice(0, max).map((x) => x[2]);
}

// on-screen keyboards: the letters of a script, row by row, and the accented letters a Latin-alphabet language has that a US keyboard lacks
const CYR = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];
const KB = {
  ru: CYR, be: ['йцукенгшўзх\'', 'фывапролджэ', 'ячсмітьбю'], uk: ['йцукенгшщзхї', 'фівапролджє', 'ячсмитьбюґ'], bg: ['явертъуиопчш', 'асдфгхйклщ', 'зьцжбнмю'],
  sr: ['љњертзуиопшђ', 'асдфгхјклчћ', 'џцвбнмж'], mk: ['љњертѕуиопшѓ', 'асдфгхјклчќ', 'зџцвбнмж'], kk: ['әіңғүұқөһ', ...CYR], mn: ['фцужэнгшүзкъ', 'йыбөахролдп', 'ячёсмитьвю'],
  ba: ['әөһғҫҙҡңү', ...CYR],
  el: ['ςερτυθιοπ', 'ασδφγηξκλ', 'ζχψωβνμ', 'άέήίόύώϊϋΐΰ'],
  ar: ['ضصثقفغعهخحجد', 'شسيبلاتنمكط', 'ئءؤرلاىةوزظ', 'ًٌٍَُِّْ'], fa: ['ضصثقفغعهخحجچ', 'شسیبلاتنمکگ', 'ظطزرذدپو', 'ژآءئؤ'], ur: ['طصھدٹپتبجح', 'مورنلہاکیق', 'فےسشغعضظژڈڑںۓ'],
  ps: ['ضصثقفغعهخحجچ', 'شسیبلاتنمکګ', 'ظطزرذدپوټډړښږځڅ'], sd: ['قصيرتٺٿپ', 'اسدفگهجڪل', 'زخطڀبنمڙڄڃ'],
  he: ['קראטוןםפ', 'שדגכעיחלךף', 'זסבהנמצתץ'], yi: ['קראטוןםפ', 'שדגכעיחלךף', 'זסבהנמצתץ', 'ײױװאַאָ'],
  hi: ['अआइईउऊएऐओऔ', 'कखगघङचछजझञ', 'टठडढणतथदधन', 'पफबभमयरलवशषसह', 'ािीुूेैोौंःँ्'],
  mr: ['अआइईउऊएऐओऔ', 'कखगघङचछजझञ', 'टठडढणतथदधन', 'पफबभमयरलवशषसहळ', 'ािीुूेैोौंःँ्'],
  ne: ['अआइईउऊएऐओऔ', 'कखगघङचछजझञ', 'टठडढणतथदधन', 'पफबभमयरलवशषसह', 'ािीुूेैोौंःँ्'],
  hy: ['էթփձջւևրչճ', 'քոեռտըւիօպ', 'ասդֆգհյկլ', 'զղցվբնմշ'], ka: ['ქწერტყუიოპ', 'ასდფგჰჯკლ', 'ზხცვბნმ', 'ღთშჟძჩჭ'],
  th: ['กขฃคฅฆงจฉชซฌญฎฏ', 'ฐฑฒณดตถทธนบปผฝพฟ', 'ภมยรลวศษสหฬอฮ', 'ะัาำิีึืุูเแโใไ่้๊๋็์'],
  ko: ['ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ', 'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ', 'ㅋㅌㅊㅍㅠㅜㅡ'],
  es: ['áéíóúüñ¿¡'], fr: ['àâæçéèêëîïôœùûüÿ«»'], de: ['äöüß„“'], pt: ['áâãàçéêíóôõú'], it: ['àèéìíîòóùú'], pl: ['ąćęłńóśźż'], cs: ['áčďéěíňóřšťúůýž'],
  sk: ['áäčďéíĺľňóôŕšťúýž'], tr: ['çğıİöşü'], ro: ['ăâîșț'], hu: ['áéíóöőúüű'], vi: ['ăâđêôơưàảãáạằẳẵắặầẩẫấậ', 'èẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộ', 'ờởỡớợùủũúụừửữứựỳỷỹýỵ'],
  da: ['æøå'], no: ['æøå'], sv: ['åäö'], fi: ['åäö'], is: ['áðéíóúýþæö'], et: ['äöõüšž'], lv: ['āčēģīķļņšūž'], lt: ['ąčęėįšųūž'], hr: ['čćđšž'], bs: ['čćđšž'],
  sl: ['čšž'], ca: ['àçèéíïòóúü·'], gl: ['áéíñóú'], ga: ['áéíóú'], cy: ['âêîôûŵŷ'], az: ['çəğıöşü'], uz: ['ʻ'], sq: ['çë'],
  ht: ['àèò'], yo: ['ẹọṣáàéèíìóòúù'], ig: ['ịọụṅ'], ha: ['ɓɗƙƴ'], wo: ['àéëñóŋ'], ln: ['ɛɔ'], ff: ['ɓɗŋƴ'], af: ['êëîïôûŉ'], lb: ['äéë'], fy: ['âêéôûú'],
  ms: [], id: [], tl: ['ñ'], ast: ['ḥḷñ'], oc: ['àçèéíòóú'], br: ['âêñùû'], gd: ['àèìòù'],
};
export const KEYBOARD_LANGS = Object.freeze(Object.keys(KB).filter((c) => LANGS[c] && KB[c].length));

/** the keyboard for a language: its rows of keys, or null when the language types on any keyboard. Pure. */
export function keyboardFor(code) {
  const rows = KB[String(code || '')];
  return rows && rows.length ? rows.map((r) => [...r]) : null;
}

/** what a key press makes of a text box: the key put in at the caret (replacing a selection), and where the caret goes next. Pure. */
export function typeKey(value, start, end, key) {
  const v = String(value || ''), s = Math.max(0, Math.min(start ?? v.length, v.length)), e = Math.max(s, Math.min(end ?? s, v.length));
  if (key === '⌫') { const a = s === e ? Math.max(0, s - [...v.slice(0, s)].slice(-1).join('').length) : s; return { value: v.slice(0, a) + v.slice(e), caret: a }; }
  const k = key === '␣' ? ' ' : String(key || '');
  return { value: v.slice(0, s) + k + v.slice(e), caret: s + k.length };
}

/** the key a correction is filed under: the same words (spaces and case aside) between the same two languages. Pure. */
export const fixKey = (text, from, to) => String(text || '').trim().replace(/\s+/g, ' ').toLowerCase() + '␞' + (from || 'auto') + '␞' + (to || '');

/** your own correction for a text, if you made one (with the source language detected or not). Pure. */
export function correctionFor(fixes, text, from, to) {
  const f = fixes || {};
  return f[fixKey(text, from, to)] || (from && from !== 'auto' ? f[fixKey(text, 'auto', to)] : '') || '';
}

/** the fixes with one more (or one removed, when the corrected text is empty or the same as the machine's), the 200 newest kept. Pure. */
export function withCorrection(fixes, text, from, to, mine, machine) {
  const out = { ...(fixes || {}) }, k = fixKey(text, from, to), m = String(mine || '').trim();
  delete out[k];
  if (!m || m === String(machine || '').trim()) return out;
  const keys = Object.keys(out); while (keys.length >= 200) delete out[keys.shift()];
  out[k] = m; return out;
}

/** a conversation turn: who spoke, in which language, and the language the other side hears it in. Pure. */
export function turn(side, a, b) {
  const me = side === 'b' ? b : a, other = side === 'b' ? a : b;
  return { side: side === 'b' ? 'b' : 'a', from: me, to: other };
}

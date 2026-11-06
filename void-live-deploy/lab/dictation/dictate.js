// Dictation's words (lab/dictation/). Pure, no DOM. The browser's speech service hands back plain words; this turns spoken punctuation
// ("comma", "full stop", "new paragraph") into the marks, capitalises each sentence and joins each new piece onto the text with the right spacing.
const MARKS = [
  [/\s*\b(?:new paragraph)\b\s*/gi, '\n\n'], [/\s*\b(?:new line|next line)\b\s*/gi, '\n'],
  [/\s*\b(?:full stop|period)\b/gi, '.'], [/\s*\bcomma\b/gi, ','], [/\s*\bquestion mark\b/gi, '?'], [/\s*\bexclamation (?:mark|point)\b/gi, '!'],
  [/\s*\bsemicolon\b/gi, ';'], [/\s*\bcolon\b/gi, ':'], [/\s*\b(?:dash|hyphen)\b\s*/gi, ' - '],
  [/\s*\b(?:close quote|end quote|unquote)\b/gi, '\u0002'], [/\s*\b(?:open quote|quote)\b\s*/gi, ' \u0001'],
  [/\s*\bclose bracket\b/gi, ')'], [/\s*\bopen bracket\b\s*/gi, ' ('],
];
/** spoken punctuation -> marks: "hi comma how are you question mark" -> "hi, how are you?". */
export function marksOf(words) {
  let t = String(words || '');
  for (const [re, mark] of MARKS) t = t.replace(re, mark);
  return t.replace(/\u0001\s*/g, '"').replace(/\s*\u0002/g, '"').replace(/ {2,}/g, ' ').replace(/ +([,.;:?!)])/g, '$1').replace(/\( +/g, '(').replace(/ *\n */g, '\n').replace(/^ +| +$/g, '');
}
/** capitalise the start of each sentence and of each line, and a lone "i". */
export function capsOf(t) {
  return String(t).replace(/(^|[.?!]\s+|\n+\s*)([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\bi\b(?=[\s,.;:?!']|$)/g, 'I');
}
/** add a piece the speech service just finished onto the text so far. */
export function joinOf(text, piece) {
  const p = marksOf(String(piece || '').trim()); if (!p.trim()) return capsOf((text || '') + p);
  const t = String(text || ''), glue = !t || /[\s(]$/.test(t) || /^[,.;:?!)\n]/.test(p) ? '' : ' ';
  const ended = !t.trim() || /[.?!]\s*$|\n\s*$/.test(t);
  const head = ended ? p.replace(/^(\s*["(]?)([a-z])/, (_, a, b) => a + b.toUpperCase()) : p;
  return capsOf(t + glue + head);
}
/** words in the text, for the count under the box. */
export const wordsOf = (t) => (String(t || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
/** the languages the picker offers first (the browser's own language is added at the top when it is not here). */
export const LANGS = Object.freeze([['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['es-ES', 'Español'], ['es-MX', 'Español (México)'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['it-IT', 'Italiano'], ['pt-BR', 'Português (Brasil)'], ['nl-NL', 'Nederlands'], ['pl-PL', 'Polski'], ['hi-IN', 'हिन्दी'], ['ja-JP', '日本語'], ['ko-KR', '한국어'], ['zh-CN', '中文 (普通话)'], ['ar-SA', 'العربية'], ['ru-RU', 'Русский'], ['tr-TR', 'Türkçe']]);

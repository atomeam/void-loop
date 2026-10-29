/**
 * The stage's translate languages (skills/translate.js) and the translate page's stage card.
 * The card carries the text in the box as base64url ("translate #<code> from <language> to <language>"),
 * so no keyword skill reads its words; the skill reads the code back only when it is that exact code.
 */
export const STAGE_LANGS = Object.freeze({
  english:'en', spanish:'es', french:'fr', german:'de', italian:'it', portuguese:'pt', dutch:'nl',
  russian:'ru', ukrainian:'uk', polish:'pl', czech:'cs', greek:'el', turkish:'tr', arabic:'ar',
  hebrew:'he', hindi:'hi', bengali:'bn', urdu:'ur', japanese:'ja', korean:'ko', chinese:'zh-CN',
  mandarin:'zh-CN', cantonese:'zh-TW', vietnamese:'vi', thai:'th', indonesian:'id', malay:'ms',
  filipino:'tl', tagalog:'tl', swedish:'sv', norwegian:'no', danish:'da', finnish:'fi',
  hungarian:'hu', romanian:'ro', swahili:'sw', persian:'fa', farsi:'fa', irish:'ga', welsh:'cy',
  latin:'la', hawaiian:'haw', catalan:'ca', croatian:'hr', serbian:'sr', bulgarian:'bg'
});
// a page code to the first stage name for it; the page's Chinese (zh) is the stage's chinese (zh-CN)
const NAME_OF = {};
for (const [name, code] of Object.entries(STAGE_LANGS)) if (!NAME_OF[code]) NAME_OF[code] = name;
NAME_OF.zh = 'chinese';

const b64url = (bin) => btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** the translate page's card ask for the text it translates and its languages, or '' (the example) when the stage cannot ask it. Pure. */
export function cardAsk(text, from, to, max = 1000) {
  const s = String(text ?? '').trim(), toName = NAME_OF[to], fromName = from && from !== 'auto' ? NAME_OF[from] : '';
  if (!s || !toName || Array.from(s).length > max) return '';
  let bin = ''; for (const x of new TextEncoder().encode(s)) bin += String.fromCharCode(x);
  return 'translate #' + b64url(bin) + (fromName ? ' from ' + fromName : '') + ' to ' + toName;
}

/** the text a card code holds ("#<base64url>"), or null when it is not that exact code (a typed "#tag" stays as typed). Pure. */
export function cardText(q) {
  const m = /^#([A-Za-z0-9_-]{2,1400})$/.exec(String(q ?? ''));
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), s = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return s.trim() && b64url(bin) === m[1] ? s : null;
  } catch (_) { return null; }
}

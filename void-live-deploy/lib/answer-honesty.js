// What an answer may claim (owner, 2026-10-29, five answer cards in a row about Verse's own cards). Pure, no I/O.
// - A source stays on the card only when its fetched text holds the sentence that cites it (supportedOnly); a paraphrase of the
//   ask cited to a page that says nothing about it is unsourced, and lib/cite.js then drops the page.
// - An ask that corrects itself ("Correction: ...") is answered from the correction, never with both versions as true.
// - Writing the answer is the only thing the answer engine does: a line that says Verse noted, logged, saved or passed something on
//   is cut, because no such write ran and nothing records it (dropUnbackedActs).
// - No filler about being a program or having no feelings (dropFiller): the card answers the message and says nothing else.
import { keepCited } from './cite.js';

// how much of an ask the answer engine reads: long enough for a status note, so it is never cut mid-word ("smallest" read as
// "smalles" at the old 300 characters). The Wikipedia search still uses only the first 300 (functions/api/answer.js sources).
export const ASK_MAX = 4000, QUERY_MAX = 300;

const STOP = new Set('a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its just me my no not of on or our she so than that the their them then there these they this those to up us was we were what when where which who why will with would you your yours about also very more most some any all only own same such too can will just should now one two'.split(' '));
const wordsOf = (t) => (String(t || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]*[a-z0-9]|[a-z0-9]/g) || []).map((w) => w.replace(/'s$/, '')).filter((w) => w.length > 2 && !STOP.has(w));
const stem = (w) => w.replace(/(?:ing|ed|es|s)$/, '');

/** true when the sentence's own content words are in the source's text: at least two of them, and at least a quarter. */
export function supports(sentence, text) {
  const need = [...new Set(wordsOf(String(sentence).replace(/\[\d+\]/g, ' ')))];
  if (!need.length) return false;
  const have = new Set(wordsOf(text).map(stem));
  const hit = need.filter((w) => have.has(stem(w))).length;
  return hit >= 2 && hit >= Math.ceil(need.length * 0.25);
}

/** the answer with each [n] marker removed from a sentence that source n's text does not hold; sources are { text } in [n] order. */
export function unsupportedMarks(answer, sources) {
  const src = Array.isArray(sources) ? sources : [];
  // a sentence ends at . ! ? or a line break; a fenced code block is left as it is
  return String(answer || '').split(/(```[\s\S]*?```)/).map((part) => part.startsWith('```') ? part : part.replace(/[^.!?\n]+[.!?]*/g, (s) => s.replace(/\s?\[(\d+)\]/g, (m, n) => {
    const x = src[+n - 1];
    return x && supports(s, x.text) ? m : '';
  }))).join('');
}

/** the answer and the sources it may still cite: unsupported markers dropped, then lib/cite.js keeps only the cited sources. */
export function supportedOnly(answer, sources, pub) {
  return keepCited(unsupportedMarks(answer, sources), pub || sources);
}

// an ask that corrects itself: a later line replaces an earlier one
const CORRECTED = /(?:^|[\s.!?:;(⏎])(?:correction\s*:|correcting\s+(?:myself|that)|scratch\s+that|i\s+was\s+wrong|i\s+got\s+(?:that|it)\s+wrong|that\s+was\s+wrong|update\s*:|edit\s*:|actually,|not\s+\S+(?:\s+\S+)?,\s+but\b|i\s+meant\b|to\s+correct\s+(?:that|my))/i;
export const hasCorrection = (ask) => CORRECTED.test(String(ask || ''));
export const CORRECTION_RULE = 'The message corrects itself: a later line (after "Correction:", "scratch that", "I was wrong", "actually" or the like) replaces what an earlier line said. Answer from the corrected version only. Never treat the earlier statement and its correction as both true, and do not repeat the statement that was corrected as a fact.';

export const ACT_RULE = 'Writing this answer is the only thing you do here: you cannot note, log, save, record, remember, file, flag, forward or pass anything on, and nothing you write reaches a thread, a ticket or your builders. Never say you did or will do any of that. If the message asks you to, say plainly that you have not done it.';
export const FILLER_RULE = 'Answer the message and say nothing else: no lines about being a program, an AI or a language model, about having or not having feelings, about what you can or cannot access in general, and no closing summary.';

// "I have noted this correction for the thread", "I've logged it", "I will pass this on": a claimed write with no record
const OBJ = '(?:it|this|that|these|those|the\\s+\\w+|your\\s+\\w+)\\s+';
const DONE = 'noted|logged|recorded|saved|remembered|filed|flagged|forwarded|reported|stored|passed\\s+(?:' + OBJ + ')?(?:on|along)|written\\s+(?:' + OBJ + ')?down|wrote\\s+(?:' + OBJ + ')?down|added\\s+' + OBJ + 'to|updated\\s+(?:the|your|my)\\s+(?:thread|ticket|notes?|record|ledger|log|inbox|board)|sent\\s+' + OBJ + 'to|made\\s+a\\s+note';
const TODO = 'note|log|record|save|remember|file|flag|forward|report|store|pass\\s+(?:' + OBJ + ')?(?:on|along)|write\\s+(?:' + OBJ + ')?down|add\\s+' + OBJ + 'to|update\\s+(?:the|your|my)\\s+(?:thread|ticket|notes?|record|ledger|log|inbox|board)|send\\s+' + OBJ + 'to|make\\s+a\\s+note';
const ADV = '(?:(?:now|also|already|just)\\s+)?';
const ACT_CLAIM = new RegExp("\\b(?:i(?:\\s+have\\s+|'ve\\s+|\\s+)" + ADV + '(?:' + DONE + ")|(?:i\\s+will|i'll|i\\s+am\\s+going\\s+to|i'm\\s+going\\s+to|i\\s+shall)\\s+" + ADV + '(?:' + TODO + '))\\b', 'i');
const NEGATED = /\b(?:not|never|cannot|can't|cannot|no\s+way|unable)\b/i;
const sentences = (t) => String(t || '').match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [];
/** the answer without a sentence that claims a write (noted, logged, saved, passed on) no tool ran; a refusal to claim one stays. */
export function dropUnbackedActs(answer) {
  return sentences(answer).filter((s) => !(ACT_CLAIM.test(s) && !NEGATED.test(s))).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const FILLER = /\bi\s+am\s+(?:just\s+|only\s+|simply\s+)?(?:a|an)\s+(?:computer\s+)?(?:program|ai|language\s+model|machine|bot|piece\s+of\s+software)\b|\b(?:do\s+not|don't|cannot|can't)\s+(?:have|feel|experience)\s+(?:any\s+)?(?:feelings|emotions)\b/i;
/** the answer without lines about being a program or having no feelings. */
export function dropFiller(answer) {
  return sentences(answer).filter((s) => !FILLER.test(s)).join('').replace(/\n{3,}/g, '\n\n').trim();
}

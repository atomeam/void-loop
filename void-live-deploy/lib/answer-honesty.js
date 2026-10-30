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

// A caveat or an equivalence the model adds to tie an off-target source to the ask (coordinator, 2026-10-30: "the 3 mile run" was answered
// "the exact distance of three miles can vary depending on the surface ... [1]" from the 5000 metres page, and "5 m c" was answered
// ""5 m c" is an unconventional notation for Mach 5 [2]" from the Mach number page). A sentence that cites a source says the source holds
// it, and word overlap (supports) passes both, so these two kinds of claim are checked against the cited text itself: a variation or a
// dependence, and a notation, abbreviation or "stands for". A claim the cited text does not make is cut: the clause when it is one
// ("While X, Y" keeps Y; "Y, though X" keeps Y), else the sentence. A sentence that cites nothing is left alone: it is the model's own.
export const INVENT_RULE = 'Every sentence that cites a source must say only what that source says. Never add a caveat, a range or a dependence a source does not state (a stated distance, weight or date does not vary), never say the words asked are a notation, abbreviation or name for something unless a source says so, and never label one thing as another (a speed in m/s is not a Mach number).';
const VARIES = /\b(?:can|may|might|could|will|does|do|often|also)\s+(?:also\s+|often\s+|sometimes\s+)?(?:vary|differ|change)\b|\bvar(?:y|ies|ying)\s+(?:by|with|depending|according|from|between|based)\b|\bdepend(?:s|ing|ent)?\s+(?:on|upon)\b/i;
const VARIES_SRC = /\bvar(?:y|ies|ied|iable|iation|iations|ying)\b|\bdiffer|\bdepend/i;
const NOTATION = /\b(?:notation|abbreviation|shorthand|short\s+form|acronym|initialism)\s+(?:for|of)\b|\bstands?\s+for\b|\bis\s+short\s+for\b/i;
const NOTATION_SRC = /\bnotation|\babbreviat|\bshorthand|\bshort\s+form|\bacronym|\binitialism|\bstands?\s+for|\bshort\s+for|\(\s*[A-Za-z0-9-]{1,8}\s*\)/;
const quotedIn = (claim, text) => (claim.match(/["“]([^"”]{1,40})["”]/g) || []).every((q) => String(text).toLowerCase().includes(q.replace(/["“”]/g, '').toLowerCase()));
/** true when the claim is a caveat or a notation that the source text does not make. Pure. */
export function unbacked(claim, text) {
  const t = String(text || '');
  if (VARIES.test(claim) && !VARIES_SRC.test(t)) return true;
  if (NOTATION.test(claim) && !(NOTATION_SRC.test(t) && quotedIn(claim, t))) return true;
  return false;
}
const cites = (s) => [...s.matchAll(/\[(\d+)\]/g)].map((m) => +m[1]);
// a sentence: its body, then its end (citation markers and the stop, in either order)
const ends = (s) => { const m = String(s).match(/^([\s\S]*?)((?:\s*\[\d+\])*\s*[.!?]*(?:\s*\[\d+\])*\s*)$/); return m ? [m[1], m[2]] : [s, '']; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** the answer without a cited caveat or notation its cited sources do not make; sources are { text } in [n] order. Pure. */
export function dropUnbackedClaims(answer, sources) {
  const src = Array.isArray(sources) ? sources : [];
  if (!src.length) return String(answer || '');
  return String(answer || '').split(/(```[\s\S]*?```)/).map((part) => part.startsWith('```') ? part : part.replace(/[^.!?\n]+[.!?]*(?:\s*\[\d+\])*/g, (s) => {
    const n = cites(s); if (!n.length) return s;
    const text = n.map((i) => (src[i - 1] && src[i - 1].text) || '').join(' ');
    if (!unbacked(s, text)) return s;
    const lead = s.match(/^(\s*)((?:while|although|though|whereas|even\s+though|even\s+if)\s+[^,]+),\s*([\s\S]+)$/i);
    if (lead && unbacked(lead[2], text) && !unbacked(lead[3], text)) return lead[1] + cap(lead[3]);
    const [body, end] = ends(s), tail = body.match(/^([\s\S]+?),\s*(?:though|although|but|while|whereas|even\s+though|albeit)\s+([^,]+)$/i);
    if (tail && unbacked(tail[2], text) && !unbacked(tail[1], text)) return tail[1] + end;
    return s.match(/^\s*/)[0] === '\n' ? '\n' : ''; // the whole sentence makes the claim
  })).join('').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** true when an answer (a cached one, whose sources' text is gone) cites a caveat or a notation: it is answered again, not served. Pure. */
export const citesUnbacked = (answer) => String(answer || '').split(/(?<=[.!?\n])/).some((s) => /\[\d+\]/.test(s) && (VARIES.test(s) || NOTATION.test(s)));

// A guess (the sources do not hold the ask's words) is answered as readings, one a line: "5 m/s (Mach): ... [2]". A reading is named by
// the page it cites, never by a label the page does not hold: a label with a word or a number-and-unit that the cited page lacks is
// replaced by that page's title, so "5 m/s (Mach)" reads "Mach number". Only a list of readings (two lines or more) is relabelled: one
// "X: y [1]" line is a plain sentence with a colon ("In short: ..."), not a reading, and keeps its words. Pure.
const labelBits = (l) => (String(l).toLowerCase().match(/\d[\d.,]*\s*[a-z/]+|[a-z][a-z0-9-]*[a-z0-9]|[a-z]|\d[\d.,]*/g) || []).map((x) => x.replace(/\s+/g, ' '));
export function titledReadings(answer, sources) {
  const src = Array.isArray(sources) ? sources : [];
  const lines = String(answer || '').split('\n'), reading = (line) => line.match(/^(\s*(?:[-*•]|\d+[.)])?\s*)(\*\*|__)?([^:\n*_]{1,70}?)(\*\*|__)?\s*:\s+(.*\[(\d+)\].*)$/);
  if (lines.filter((l) => reading(l)).length < 2) return String(answer || '');
  return lines.map((line) => {
    const m = reading(line);
    if (!m) return line;
    const s = src[+m[6] - 1]; if (!s || !s.title) return line;
    const have = ((s.title || '') + ' ' + (s.text || '')).toLowerCase().replace(/\s+/g, ' ');
    if (labelBits(m[3]).every((b) => have.includes(b) || have.includes(b.replace(/\s+/g, '')))) return line;
    return m[1] + (m[2] || '') + String(s.title).replace(/\s*§.*$/, '') + (m[4] || '') + ': ' + m[5];
  }).join('\n');
}

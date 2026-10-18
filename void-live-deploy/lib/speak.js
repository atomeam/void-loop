// Verse's spoken voice (frontier #16, first piece). Hold Space (not while typing) to talk; let go and Verse answers out loud in
// one low, steady voice, sentence by sentence, so the first sentence starts while the rest is queued. Spoken in this browser
// (speechSynthesis): nothing leaves it. A voice of Verse's own (a streaming text-to-speech worker) is the next step.
// The sculpt (domains/void.sculpt.md) is calm, dark and unhurried; the voice matches it: low, a little slow, never bright.
// A robot's voice, and a cool one (owner, 2026-10-15: "I like V01ds robot voice I just wish it was a cooler better robot voice that
// paced its words better"): lower and flatter than a person, steady, and said in short phrases with a beat between them.
export const VOICE = { pitch: 0.6, rate: 0.9 };
export const HOLD_MS = 220; // a tap of Space stays a tap; only a hold listens

// low, even system voices by name (macOS, Windows, Chrome, Android); none of them is required
const LOW = /\b(daniel|alex|fred|aaron|arthur|guy|ryan|george|thomas|oliver|rishi|reed|eddy|ralph|google uk english male|male)\b/i;
const BRIGHT = /\b(novelty|whisper|bells|bubbles|boing|jester|organ|superstar|trinoids|zarvox|cellos|bad news|good news|albert)\b/i;

// the voice to speak in: the page's language first, a low one where there is one, a local one over a network one
export function pickVoice(voices, lang = 'en-US') {
  const list = Array.from(voices || []).filter((v) => v && v.lang && !BRIGHT.test(v.name || ''));
  const base = String(lang || 'en-US').toLowerCase().split('-')[0];
  const same = list.filter((v) => v.lang.toLowerCase() === String(lang).toLowerCase());
  const near = list.filter((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base);
  for (const pool of [same, near]) {
    const low = pool.filter((v) => LOW.test(v.name || ''));
    const pick = low.find((v) => v.localService) || low[0] || pool.find((v) => v.localService) || pool[0];
    if (pick) return pick;
  }
  return null;
}

// what is worth saying out loud from a card: no code, no links, no citation marks, no "Source:" line
export function speakable(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[\d+\]/g, ' ')
    .replace(/(^|\n)\s*(source|sources|written by void)\b[^\n]*/gi, '$1')
    .replace(/[*_`#>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// sentences, grouped up to max characters (a short first one goes alone so speech starts at once); a long sentence is cut
// at a comma, else at a space; the whole is capped so a long page is not read for minutes
export function chunks(text, max = 220, cap = 1800) {
  const t = speakable(text).slice(0, cap);
  if (!t) return [];
  const sentences = t.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) || [t];
  const out = [];
  for (let s of sentences.map((x) => x.trim()).filter(Boolean)) {
    while (s.length > max) {
      let at = s.lastIndexOf(', ', max); if (at < max / 3) at = s.lastIndexOf(' ', max); if (at < 1) at = max;
      out.push(s.slice(0, at + 1).trim()); s = s.slice(at + 1).trim();
    }
    if (out.length > 1 && (out[out.length - 1] + ' ' + s).length <= max) out[out.length - 1] += ' ' + s; else out.push(s);
  }
  return out.filter(Boolean);
}

// the held key: Space, with no modifier, not a key repeat, and only when nothing has focus (the page itself): a focused card,
// game, control or text box keeps its own Space
export function holdKey(e, typing) {
  if (!e || typing || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  if (e.code !== 'Space' && e.key !== ' ') return false;
  const tag = (e.target && e.target.tagName) || 'BODY';
  return tag === 'BODY' || tag === 'HTML';
}

// the pacing: each chunk said as short phrases, one utterance each, so the voice takes a beat at every comma, colon, dash and
// sentence end (the gap between utterances is the pause; nothing is timed, so stop, the read button and "is it speaking" still
// see one queue). A long phrase with no comma is cut before "and", "but", "so", "which", "because" or "when" near its middle.
export function phrases(text, max = 90) {
  const out = [];
  for (const c of chunks(text)) {
    const bits = c.split(/(?<=[,;:]|\s[\u2013\u2014-])\s+|(?<=[.!?\u2026]["')\]]?)\s+/).map((x) => x.trim()).filter(Boolean);
    // a scrap shorter than a few words joins its neighbour, so the beat never lands every two words
    const merged = [];
    for (const b of bits) { if (merged.length && (b.length < 14 || merged[merged.length - 1].length < 14) && (merged[merged.length - 1] + ' ' + b).length <= max) merged[merged.length - 1] += ' ' + b; else merged.push(b); }
    for (let b of merged) {
      while (b.length > max) {
        const mid = b.length / 2, cuts = [...b.matchAll(/\s(?=(?:and|but|so|which|because|when|while|then|or)\s)/g)].map((m) => m.index).filter((i) => i > 15 && i < b.length - 15);
        const at = cuts.length ? cuts.reduce((x, y) => (Math.abs(y - mid) < Math.abs(x - mid) ? y : x)) : b.lastIndexOf(' ', max);
        if (at < 1) break;
        out.push(b.slice(0, at).trim()); b = b.slice(at).trim();
      }
      if (b) out.push(b);
    }
  }
  return out;
}

// the cadence (asked by Void, 2026-10-15: "if I am running a high-stakes simulation or a complex 'forge' operation, the voice should
// slow down even further to reflect the precision required"): precise content is said slower than plain talk. Precise means
// dense with numbers, units, measures and steps, or the words of a simulation, a build or a review; the rate never drops below
// 0.78, so it stays a voice, not a crawl. Pure.
export const PRECISE = /\b(?:simulat\w*|forge|print(?:ing|ed)?|tolerance|calibrat\w*|torque|voltage|dosage|dose|step \d+|layer|infill|nozzle|ratio|bug|risk|line \d+|exactly|precis\w*)\b/gi;
export function cadence(text) {
  const t = speakable(text);
  if (!t) return VOICE.rate;
  const words = t.split(/\s+/).length, nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).length, units = (t.match(/\d\s?(?:mm|cm|km|kg|g|ml|l|°[cf]?|%|v|w|nm|rpm|ms|s)\b/gi) || []).length;
  if (words < 12) return VOICE.rate; // a short answer ("it is 3:40 pm in Tokyo") keeps the voice's pace
  const terms = (t.match(PRECISE) || []).length;
  const density = (nums + units * 2 + terms * 2) / Math.max(1, words);
  return Math.max(0.78, Math.round((VOICE.rate - Math.min(0.12, density * 0.3)) * 100) / 100);
}

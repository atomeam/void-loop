// Void's spoken voice (frontier #16, first piece). Hold Space (not while typing) to talk; let go and Void answers out loud in
// one low, steady voice, sentence by sentence, so the first sentence starts while the rest is queued. Spoken in this browser
// (speechSynthesis): nothing leaves it. A voice of Void's own (a streaming text-to-speech worker) is the next step.
// The sculpt (domains/void.sculpt.md) is calm, dark and unhurried; the voice matches it: low, a little slow, never bright.
export const VOICE = { pitch: 0.78, rate: 0.96 };
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

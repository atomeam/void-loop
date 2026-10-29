/**
 * ascii skill — show ASCII / Unicode codes for text
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "ascii for hello", "char codes of world", "what is the ascii of A".
 */
/** the text whose codes are asked for, or null when the ask is not one for this skill (a closing ? ! or . is not part of it). Pure. */
export function phraseOf(text) {
  const m = /^(?:please\s+)?(?:(?:ascii|char\s+codes?|unicode)\s+(?:for|of)\s+(.+)|what\s+is\s+the\s+(?:ascii|unicode)\s+of\s+(.+))$/i.exec(String(text || '').trim().replace(/[?!.]+$/, ''));
  return m ? (m[1] || m[2]).trim() : null;
}

export function isAscii(text) {
  return phraseOf(text) !== null;
}

/** "h: 104, i: 105", each character with its code point in decimal. Pure. */
export const codesOf = (phrase) => [...phrase].map((c) => c + ': ' + c.codePointAt(0)).join(', ');

function run(text, api) {
  const { showPage, esc } = api;
  const phrase = phraseOf(text) || 'A';
  const codes = codesOf(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>ASCII / Unicode</h2><p>' + esc(codes) + '</p><div class="sub">for “' + esc(phrase) + '”</div><div class="src">Character codes from this device.</div>';
  });
  return 'ascii';
}

export default {
  name: 'ascii',
  examples: ['ascii for hello', 'char codes of world', 'what is the ascii of A'],
  nearMisses: ['what is ascii', 'ascii art', 'unicode table'],
  match(lower, text) { return isAscii(text); },
  run,
  suite() {
    const ok = isAscii('ascii for hello') && isAscii('char codes of A') && !isAscii('what is ascii');
    return { ok, got: 'match works' };
  }
};

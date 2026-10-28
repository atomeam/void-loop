/**
 * ascii skill — show ASCII / Unicode codes for text
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "ascii for hello", "char codes of world", "what is the ascii of A".
 */
export function isAscii(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:ascii|char\s+codes?|unicode)\s+(?:for|of)\s+(.+)|what\s+is\s+the\s+(?:ascii|unicode)\s+of\s+(.+))$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:ascii|char\s+codes?|unicode)\s+(?:for|of)\s+(.+)|what\s+is\s+the\s+(?:ascii|unicode)\s+of\s+(.+)/i.exec(text);
  const phrase = (m && (m[1] || m[2]) || 'A').trim();
  const codes = [...phrase].map((c) => c + ': ' + c.codePointAt(0)).join(', ');
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

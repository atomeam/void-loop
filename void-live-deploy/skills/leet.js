/**
 * leet skill — convert text to 1337 speak
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "leet hello", "1337 speak for world", "convert cool to leet".
 */
const MAP = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1' };

// words that ask about leet rather than give text to convert ("leet code", "leet speak")
const ABOUT = /^(?:code|speak|meaning|alphabet|translator|generator)$/i;

/** the text to convert, or null when the ask is not one for this skill (a closing ? ! or . is not part of it). Pure. */
export function phraseOf(text) {
  const m = /^(?:please\s+)?(?:(?:leet|1337|l33t)\s+(?:speak\s+)?(?:for\s+)?(.+)|convert\s+(.+)\s+to\s+(?:leet|1337))$/i.exec(String(text || '').trim().replace(/[?!.]+$/, ''));
  const p = m ? (m[1] || m[2]).trim() : '';
  return p && !ABOUT.test(p) ? p : null;
}

export function isLeet(text) {
  return phraseOf(text) !== null;
}

export function toLeet(s) {
  return String(s).toLowerCase().replace(/[aeiostl]/g, (c) => MAP[c] || c);
}

function run(text, api) {
  const { showPage, esc } = api;
  const phrase = phraseOf(text) || 'hello world';
  const out = toLeet(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>1337</h2><p style="font-size:24px;font-weight:300">' + esc(out) + '</p><div class="sub">from “' + esc(phrase) + '”</div><div class="src">Simple letter swaps.</div>';
  });
  return 'leet';
}

export default {
  name: 'leet',
  examples: ['leet hello', '1337 speak for world', 'convert cool to leet'],
  nearMisses: ['what is leet', 'leet code', 'speak leet'],
  match(lower, text) { return isLeet(text); },
  run,
  suite() {
    const ok = isLeet('leet hello') && isLeet('convert world to 1337') && !isLeet('what is leet');
    return { ok, got: 'match works' };
  }
};

/**
 * morse skill — encode text to Morse code
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse code hello", "translate to morse hello", "encode in morse sos".
 * "sos in morse" and "morse code for sos" are the util skill's (asked before this one), so this one leaves them alone.
 */
const MORSE = { a:'.-', b:'-...', c:'-.-.', d:'-..', e:'.', f:'..-.', g:'--.', h:'....', i:'..', j:'.---', k:'-.-', l:'.-..', m:'--', n:'-.', o:'---', p:'.--.', q:'--.-', r:'.-.', s:'...', t:'-', u:'..-', v:'...-', w:'.--', x:'-..-', y:'-.--', z:'--..', '1':'.----', '2':'..---', '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.', '0':'-----', ' ':'/' };

// words that ask about Morse code rather than give text to encode ("morse code history", "morse alphabet")
const ABOUT = /^(?:code|history|alphabet|chart|table|meaning|definition|inventor|translator|decoder|tutorial|practice|sounds?|audio)$/i;

/** the text to encode, or null when the ask is not one for this skill. Pure. */
export function payloadOf(text) {
  const m = /^(?:please\s+)?(?:morse\s+code|morse|encode\s+in\s+morse(?:\s+code)?|translate\s+to\s+morse(?:\s+code)?)\s+(.+)$/i.exec(String(text || '').trim().replace(/[?!.]+$/, ''));
  if (!m) return null;
  const p = m[1].trim();
  if (ABOUT.test(p) || /^(?:for|of)\s/i.test(p) || !/[a-z0-9]/i.test(p)) return null;
  return p;
}

export function isMorse(text) {
  return payloadOf(text) !== null;
}

/** letters split by spaces, words by /; anything without a Morse letter is left out. Pure. */
export function toMorse(text) {
  return String(text).toLowerCase().split('').map((c) => MORSE[c] || '').filter(Boolean).join(' ');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const payload = payloadOf(text) || 'sos';
  const code = toMorse(payload);
  showPage((el) => { el.innerHTML = '<h2>Morse</h2><p style="font-size:24px;font-family:monospace">' + esc(code) + '</p><div class="sub">' + esc(payload) + '</div>'; });
  return 'morse';
}

export default {
  name: 'morse',
  examples: ['morse code hello', 'morse hello world', 'encode in morse sos', 'translate to morse hello'],
  nearMisses: ['what is morse', 'morse code history', 'decode morse', 'morse code', 'morse code for sos'],
  match(lower, text) { return isMorse(text); },
  run,
  suite() {
    const ok = isMorse('morse code hello') && isMorse('encode in morse sos') && !isMorse('what is morse') && !isMorse('morse code history');
    return { ok, got: 'match works' };
  }
};

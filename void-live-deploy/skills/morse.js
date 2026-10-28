/**
 * morse skill — encode text to Morse code
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse code hello", "encode sos in morse".
 */
const MORSE = { a:'.-', b:'-...', c:'-.-.', d:'-..', e:'.', f:'..-.', g:'--.', h:'....', i:'..', j:'.---', k:'-.-', l:'.-..', m:'--', n:'-.', o:'---', p:'.--.', q:'--.-', r:'.-.', s:'...', t:'-', u:'..-', v:'...-', w:'.--', x:'-..-', y:'-.--', z:'--..', '1':'.----', '2':'..---', '3':'...--', '4':'....-', '5':'.....', '6':'-....', '7':'--...', '8':'---..', '9':'----.', '0':'-----', ' ':'/' };

export function isMorse(text) {
  return /^(?:please\s+)?(?:(?:morse\s+code|encode\s+in\s+morse|translate\s+to\s+morse)\s+.+|morse\s+.+)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function toMorse(text) {
  return String(text).toLowerCase().split('').map((c) => MORSE[c] || '').filter(Boolean).join(' ');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const payload = text.replace(/^(?:please\s+)?(?:morse\s+code|encode\s+in\s+morse|translate\s+to\s+morse|morse)\s+/i, '').trim();
  const code = toMorse(payload || 'sos');
  const el = showPage((p) => { p.innerHTML = '<h2>Morse</h2><div class="sub">…</div>'; });
  el.innerHTML = '<h2>Morse</h2><p style="font-size:24px;font-family:monospace">' + esc(code) + '</p><div class="sub">' + esc(payload || 'sos') + '</div>';
  return 'morse';
}

export default {
  name: 'morse',
  examples: ['morse code hello', 'encode sos in morse', 'translate to morse hello'],
  nearMisses: ['what is morse', 'morse code history', 'decode morse'],
  match(lower, text) { return isMorse(text); },
  run,
  suite() {
    const ok = isMorse('morse code hello') && isMorse('encode sos in morse') && !isMorse('what is morse');
    return { ok, got: 'match works' };
  }
};

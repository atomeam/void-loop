/**
 * morse skill — convert text to Morse code and back (pure, no API)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse for hello", "text to morse", "decode morse".
 */
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----', ' ': '/' };
const REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function isMorse(text) {
  return /^(?:please\s+)?(?:(?:convert|translate|text)\s+to\s+morse|(?:morse\s+code\s+for|morse\s+for)\s+.+|decode\s+morse(?:\s+code)?|morse\s+to\s+text)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function toMorse(s) {
  return String(s).toLowerCase().split('').map(c => MORSE[c] || c).join(' ');
}

function fromMorse(s) {
  return String(s).trim().split(/\s+/).map(c => REV[c] || c).join('');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const isDecode = /decode|to\s+text/i.test(text);
  let input = String(text).replace(/^(?:please\s+)?(?:convert|translate|text)\s+to\s+morse\s*:?\s*/i, '').replace(/^(?:morse\s+code\s+for|morse\s+for)\s+/i, '').replace(/^(?:decode\s+morse(?:\s+code)?|morse\s+to\s+text)\s*:?\s*/i, '').trim();
  if (!input) input = isDecode ? '.... . .-.. .-.. ---' : 'hello';
  const result = isDecode ? fromMorse(input) : toMorse(input);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Morse code</h2><p><b>' + (isDecode ? 'Decoded' : 'Encoded') + ':</b> ' + esc(result) + '</p><div class="sub">say “morse for something else” or “decode morse”</div>';
  });
  return 'morse';
}

export default {
  name: 'morse',
  examples: ['morse for hello', 'text to morse', 'decode morse', 'morse code for sos'],
  nearMisses: ['what is morse', 'morse code history', 'send a message'],
  match(lower, text) { return isMorse(text); },
  run,
  suite() {
    const ok = isMorse('morse for hello') && isMorse('text to morse') && !isMorse('what is morse');
    return { ok, got: 'match works' };
  }
};

/**
 * morse skill — Morse code translator.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse code for hello", "translate to morse: SOS".
 * Empty surface stays empty.
 */
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', ' ': '/' };

export function morseOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:morse(?:\s+code)?\s+(?:for|of)\s+|translate\s+(?:to\s+)?morse:?\s*)(.+)$/i);
  return m ? m[1].trim() : null;
}

function toMorse(s) {
  return String(s || '').toLowerCase().split('').map(c => MORSE[c] || c).join(' ');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const phrase = morseOf(text);
  if (!phrase) return 'none';
  const code = toMorse(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Morse code</h2><p>' + esc(phrase) + '</p><pre style="font-size:16px;letter-spacing:2px">' + esc(code) + '</pre><div class="sub">say “morse code for …” for another</div>';
  });
  return 'morse';
}

export default {
  name: 'morse',
  examples: ['morse code for hello', 'translate to morse: SOS'],
  nearMisses: ['what is morse code', 'morse history', 'SOS meaning'],
  match(lower, text) { return !!morseOf(text); },
  run,
  suite() {
    return { ok: morseOf('morse code for hello') === 'hello' && toMorse('sos') === '... --- ...' && morseOf('hello') === null };
  }
};

/**
 * morse skill — encode text to Morse or decode Morse to text (pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "morse hello", "decode ... .", "to morse".
 */
const CODE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  ' ': '/' 
};
const REVERSE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));

export function isMorse(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:(?:encode\s+)?(?:to\s+)?morse\s+|morse\s+)(.+)$/i.test(t) || /^(?:decode\s+morse\s+|morse\s+decode\s+)(.+)$/i.test(t);
}

function encode(s) {
  return s.toUpperCase().split('').map(c => CODE[c] || '').filter(Boolean).join(' ');
}
function decode(s) {
  return s.trim().split(/\s+/).map(m => REVERSE[m] || '?').join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let result, title, sub;
  const enc = t.match(/^(?:(?:encode\s+)?(?:to\s+)?morse\s+|morse\s+)(.+)$/i);
  const dec = t.match(/^(?:decode\s+morse\s+|morse\s+decode\s+)(.+)$/i);
  if (dec) {
    result = decode(dec[1]);
    title = 'Morse decoded';
    sub = esc(dec[1]);
  } else if (enc) {
    result = encode(enc[1]);
    title = 'Morse encoded';
    sub = esc(enc[1]);
  } else {
    result = encode('HELLO');
    title = 'Morse';
    sub = 'HELLO';
  }
  showPage((p) => {
    p.innerHTML = '<h2>' + title + '</h2><p style="font-size:18px;font-family:monospace;line-height:1.6">' + esc(result) + '</p><div class="sub">from: ' + sub + '</div><div class="sub">say “morse hello” or “decode .... . .-.. .-.. ---</div>';
  });
  return 'morse';
}

export default {
  name: 'morse',
  examples: ['morse hello', 'to morse world', 'decode .... . .-.. .-.. ---', 'morse decode ... --- ...'],
  nearMisses: ['what is morse code', 'morse history', 'send a message'],
  match(lower, text) { return isMorse(text); },
  run,
  suite() {
    const ok = isMorse('morse hello') && isMorse('decode .... .') && !isMorse('what is morse');
    return { ok, got: 'match works' };
  }
};

/**
 * nato skill — spell a word in the NATO phonetic alphabet
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "nato for hello", "spell cat in nato", "phonetic alphabet for abc".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isNato(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:nato\s+(?:for\s+|of\s+)?\w+|spell\s+\w+\s+(?:in\s+)?nato|phonetic\s+(?:alphabet\s+)?(?:for\s+)?\w+)$/i.test(t);
}

const NATO = {
  a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
  g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliet', k: 'Kilo', l: 'Lima',
  m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
  s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray',
  y: 'Yankee', z: 'Zulu'
};

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:nato\s+(?:for\s+|of\s+)?|spell\s+|phonetic\s+(?:alphabet\s+)?(?:for\s+)?)(\w+)/i.exec(text) || [null, 'hello'];
  const word = m[1].toLowerCase();
  const spelled = word.split('').map(c => NATO[c] || c).join(' ');
  showPage((p) => {
    p.innerHTML = '<h2>NATO Phonetic</h2><p style="font-size:24px;text-align:center">' + esc(spelled) + '</p><div class="sub">for “' + esc(word) + '”</div>';
  });
  return 'nato';
}

export default {
  name: 'nato',
  examples: ['nato for hello', 'spell cat in nato', 'phonetic alphabet for abc'],
  nearMisses: ['what is nato', 'nato alphabet list', 'military'],
  match(lower, text) { return isNato(text); },
  run,
  suite() {
    const ok = isNato('nato for hello') && isNato('spell cat in nato') && !isNato('what is nato');
    return { ok, got: 'match works' };
  }
};

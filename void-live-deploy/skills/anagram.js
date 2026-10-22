/**
 * anagram skill — scramble a word or test if two words are anagrams (pure)
 * "anagram of listen", "scramble the word silent", "are listen and silent anagrams"
 */
export function scramble(word) {
  const a = Array.from(String(word || ''));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

export function isAnagram(a, b) {
  const norm = (s) => Array.from(String(s || '').toLowerCase().replace(/[^a-z]/g, '')).sort().join('');
  const x = norm(a), y = norm(b);
  return x.length > 1 && x === y;
}

export function parseAnagram(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:anagram|scramble)(?:\s+(?:of|the\s+word))?\s+([a-zA-Z]{2,24})$/i);
  if (m) return { mode: 'scramble', word: m[1] };
  m = t.match(/^(?:scramble\s+(?:the\s+)?word)\s+([a-zA-Z]{2,24})$/i);
  if (m) return { mode: 'scramble', word: m[1] };
  m = t.match(/^are\s+([a-zA-Z]{2,24})\s+and\s+([a-zA-Z]{2,24})\s+anagrams?$/i);
  if (m) return { mode: 'check', a: m[1], b: m[2] };
  m = t.match(/^is\s+([a-zA-Z]{2,24})\s+an\s+anagram\s+of\s+([a-zA-Z]{2,24})$/i);
  if (m) return { mode: 'check', a: m[1], b: m[2] };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseAnagram(text);
  if (!q) {
    showPage((p) => { p.innerHTML = '<h2>Anagram</h2><p>Say <b>anagram of listen</b> or <b>are listen and silent anagrams</b>.</p>'; });
    return 'anagram';
  }
  if (q.mode === 'scramble') {
    let out = scramble(q.word);
    // avoid identity when possible
    if (out === q.word && q.word.length > 1) out = scramble(q.word);
    showPage((p) => { p.innerHTML = '<h2>Anagram</h2><p style="font-size:28px;font-weight:600">' + esc(out) + '</p><div class="sub">from “' + esc(q.word) + '” · ask again for another scramble</div>'; });
    return 'anagram';
  }
  const yes = isAnagram(q.a, q.b);
  showPage((p) => { p.innerHTML = '<h2>Anagrams?</h2><p style="font-size:36px;font-weight:600">' + (yes ? 'Yes' : 'No') + '</p><div class="sub">“' + esc(q.a) + '” and “' + esc(q.b) + '”</div>'; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of listen', 'scramble the word silent', 'are listen and silent anagrams', 'is silent an anagram of listen'],
  nearMisses: ['what is an anagram', 'anagram solver online', 'crossword'],
  match(lower, text) { return !!parseAnagram(text || lower); },
  run,
  suite() {
    const ok = isAnagram('listen', 'silent') && !isAnagram('listen', 'list')
      && !!parseAnagram('anagram of listen') && !parseAnagram('what is an anagram');
    return { ok };
  },
};

/**
 * wordladder skill — transform one word to another by changing one letter at a time
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "word ladder from cat to dog", "ladder from cold to warm".
 */
export function isWordLadder(text) {
  return /^(?:please\s+)?(?:(?:make\s+|solve\s+)?(?:a\s+)?word\s+ladder|ladder\s+from\s+[a-z]+\s+to\s+[a-z]+)(?:\s+from\s+[a-z]+\s+to\s+[a-z]+)?(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const DICT = new Set(['cat', 'bat', 'hat', 'hot', 'dot', 'dog', 'cog', 'cot', 'cold', 'cord', 'card', 'ward', 'warm', 'word', 'lord', 'load', 'lead', 'dead', 'deed', 'feed']);

function ladder(start, end) {
  if (start === end) return [start];
  if (start.length !== end.length) return null;
  const q = [[start]], seen = new Set([start]);
  while (q.length) {
    const path = q.shift();
    const last = path[path.length - 1];
    for (let i = 0; i < last.length; i++) {
      for (let c = 97; c <= 122; c++) {
        const next = last.slice(0, i) + String.fromCharCode(c) + last.slice(i + 1);
        if (next === end) return [...path, next];
        if (DICT.has(next) && !seen.has(next)) {
          seen.add(next);
          q.push([...path, next]);
        }
      }
    }
  }
  return null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /from\s+([a-z]+)\s+to\s+([a-z]+)/i.exec(text || '');
  const a = m ? m[1].toLowerCase() : 'cat', b = m ? m[2].toLowerCase() : 'dog';
  const path = ladder(a, b);
  const html = path ? '<p style="font-size:24px;text-align:center">' + path.map(esc).join(' &rarr; ') + '</p>' : '<p style="text-align:center">No ladder found from ' + esc(a) + ' to ' + esc(b) + ' in its word list. It knows only a small set of 3 and 4 letter words.</p>';
  showPage((p) => { p.innerHTML = '<h2>Word Ladder</h2>' + html + '<div class="sub">say “word ladder from cat to dog”</div>'; });
  return 'wordladder';
}

export default {
  name: 'wordladder',
  examples: ['word ladder from cat to dog', 'ladder from cold to warm', 'word ladder'],
  nearMisses: ['what is a word ladder', 'ladder in words', 'ladder', 'buy a ladder', 'snakes and ladders'],
  match(lower, text) { return isWordLadder(text); },
  run,
  suite() {
    const ok = isWordLadder('word ladder from cat to dog') && !isWordLadder('ladder') && !isWordLadder('what is a word ladder');
    return { ok, got: 'match works' };
  }
};

/**
 * word ladder skill — transform one word to another by changing one letter at a time
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "word ladder", "ladder from cat to dog".
 */
export function isWordLadder(text) {
  return /^(?:please\s+)?(?:(?:play|start)\s+)?word\s+ladder(?:\s+from\s+\w+\s+to\s+\w+)?(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')) || /ladder\s+from\s+/i.test(text);
}

const DICT = new Set(['cat', 'bat', 'hat', 'hot', 'dot', 'dog', 'cog', 'cot', 'cut', 'cup', 'pup', 'pop', 'top']);
function ladder(start, end) {
  if (start === end) return [start];
  const q = [[start]], seen = new Set([start]);
  while (q.length) {
    const path = q.shift();
    const w = path[path.length - 1];
    for (let i = 0; i < w.length; i++) {
      for (let c = 97; c <= 122; c++) {
        const nw = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1);
        if (DICT.has(nw) && !seen.has(nw)) {
          const np = path.concat(nw);
          if (nw === end) return np;
          seen.add(nw); q.push(np);
        }
      }
    }
  }
  return null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = text.match(/from\s+(\w+)\s+to\s+(\w+)/i);
  showPage((p) => {
    if (m) {
      const path = ladder(m[1].toLowerCase(), m[2].toLowerCase());
      p.innerHTML = '<h2>Word Ladder</h2><p style="font-size:20px;text-align:center">' + (path ? esc(path.join(' → ')) : 'No path found') + '</p>';
    } else {
      p.innerHTML = '<h2>Word Ladder</h2><p>Say “word ladder from cat to dog”</p>';
    }
  });
  return 'wordladder';
}

export default {
  name: 'wordladder',
  examples: ['word ladder', 'ladder from cat to dog', 'word ladder from cat to dog'],
  nearMisses: ['what is a word ladder', 'ladder'],
  match(lower, text) { return isWordLadder(text); },
  run,
  suite() {
    const ok = isWordLadder('word ladder') && isWordLadder('ladder from cat to dog') && !isWordLadder('what is a word ladder');
    return { ok, got: 'match works' };
  }
};

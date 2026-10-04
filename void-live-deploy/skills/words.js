/**
 * words skill — synonyms, opposites, rhymes and spelling, from Datamuse (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "synonym for happy", "another word for big", "opposite of cold", "what rhymes with orange", "how do you spell necessary".
 */
// "plural of cactus": English rules plus the common irregulars, no network needed
const IRREGULAR = { cactus: 'cacti (or cactuses)', fungus: 'fungi', nucleus: 'nuclei', radius: 'radii', stimulus: 'stimuli', syllabus: 'syllabi (or syllabuses)',
  octopus: 'octopuses (or octopi)', child: 'children', person: 'people', man: 'men', woman: 'women', mouse: 'mice', goose: 'geese', tooth: 'teeth', foot: 'feet',
  ox: 'oxen', die: 'dice', criterion: 'criteria', phenomenon: 'phenomena', datum: 'data', medium: 'media (or mediums)', curriculum: 'curricula',
  analysis: 'analyses', crisis: 'crises', thesis: 'theses', hypothesis: 'hypotheses', index: 'indices (or indexes)', appendix: 'appendices (or appendixes)',
  sheep: 'sheep', deer: 'deer', fish: 'fish (or fishes)', moose: 'moose', series: 'series', species: 'species', aircraft: 'aircraft',
  leaf: 'leaves', knife: 'knives', wife: 'wives', life: 'lives', wolf: 'wolves', half: 'halves', calf: 'calves', shelf: 'shelves', loaf: 'loaves', thief: 'thieves',
  potato: 'potatoes', tomato: 'tomatoes', hero: 'heroes', echo: 'echoes', veto: 'vetoes', torpedo: 'torpedoes', roof: 'roofs', chef: 'chefs', belief: 'beliefs', chief: 'chiefs' };
export function pluralOf(word) {
  const w = String(word || '').toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (/(?:s|x|z|ch|sh)$/.test(w)) return w + 'es';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
  return w + 's';
}
export function wordsOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase().replace(/["“”]/g, '');
  let m = t.match(/^(?:what(?:'s| is| are)\s+)?(?:a\s+|the\s+)?(?:synonyms?|another\s+word|other\s+words?|a\s+word|words?)\s+(?:for|that\s+means?|meaning|like)\s+([a-z' -]{2,30})$/);
  if (m) return { kind: 'syn', word: m[1].trim() };
  m = t.match(/^(?:what(?:'s| is)\s+)?(?:the\s+)?(?:opposite|antonyms?)\s+(?:of|for)\s+([a-z' -]{2,30})$/);
  if (m) return { kind: 'ant', word: m[1].trim() };
  m = t.match(/^(?:what\s+(?:words?\s+)?rhymes?\s+with|words?\s+that\s+rhymes?\s+with|rhymes?\s+(?:for|with))\s+([a-z']{2,30})$/);
  if (m) return { kind: 'rhy', word: m[1] };
  m = t.match(/^(?:what(?:'s| is)\s+)?(?:the\s+)?plural\s+(?:of|for)\s+(?:a\s+|an\s+)?([a-z']{2,30})$/);
  if (m) return { kind: 'plural', word: m[1] };
  m = t.match(/^(?:how\s+(?:do\s+(?:you|i)|to)\s+spell|spell|spelling\s+of|is\s+it\s+spelled)\s+([a-z']{2,30})$/);
  if (m) return { kind: 'spell', word: m[1] };
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = wordsOf(text);
  if (!q) return 'none';
  if (q.kind === 'plural') {
    const pl = pluralOf(q.word);
    showPage((p) => { p.innerHTML = '<h2>Plural of “' + esc(q.word) + '”</h2><div style="font-size:30px;font-weight:300;margin:6px 0">' + esc(pl) + '</div>'; });
    return 'words';
  }
  const title = { syn: 'Words for “' + q.word + '”', ant: 'Opposites of “' + q.word + '”', rhy: 'Rhymes with “' + q.word + '”', spell: q.word }[q.kind];
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  const src = '<div class="src">Source: <a href="https://www.datamuse.com/api/" target="_blank" rel="noopener">Datamuse</a></div>';
  try {
    if (q.kind === 'spell') {
      const s = await fetch('https://api.datamuse.com/sug?max=3&s=' + encodeURIComponent(q.word)).then((r) => r.json());
      if (!api._pageStill(el)) return 'words';
      const best = (s && s[0] && s[0].word) || q.word;
      const same = best.toLowerCase() === q.word.toLowerCase();
      el.innerHTML = '<h2>' + esc(best) + '</h2><div style="font-size:30px;letter-spacing:.18em;font-weight:300;margin:6px 0">' + esc(best.toUpperCase().split('').join(' ')) + '</div>'
        + '<p style="color:#8a8a8a">' + (same ? 'Spelled right.' : 'Did you mean ' + esc(best) + '? You typed ' + esc(q.word) + '.') + '</p>' + src;
      return 'words';
    }
    const rel = { syn: 'rel_syn', ant: 'rel_ant', rhy: 'rel_rhy' }[q.kind];
    let r = await fetch('https://api.datamuse.com/words?max=24&' + rel + '=' + encodeURIComponent(q.word)).then((x) => x.json());
    if (q.kind === 'syn' && (!r || r.length < 4)) r = (r || []).concat(await fetch('https://api.datamuse.com/words?max=16&ml=' + encodeURIComponent(q.word)).then((x) => x.json()).catch(() => []));
    if (!api._pageStill(el)) return 'words';
    const words = Array.from(new Set((r || []).map((x) => x.word).filter((w) => w && w !== q.word))).slice(0, 24);
    if (!words.length) { el.innerHTML = '<h2>' + esc(title) + '</h2><p>I didn\'t find any for “' + esc(q.word) + '”. Check the spelling, or try “define ' + esc(q.word) + '”.</p>' + src; return 'none'; }
    el.innerHTML = '<h2>' + esc(title) + '</h2><p style="font-size:18px;line-height:1.7">' + words.map(esc).join(' · ') + '</p>' + src;
    return 'words';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(title) + '</h2><p>The word service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'words',
  examples: ['synonym for happy', 'opposite of cold', 'what rhymes with orange', 'how do you spell necessary', 'plural of cactus'],
  nearMisses: ['define happy', 'what is a synonym', 'what is a plural', 'spell check my essay', 'weather in Paris'],
  match(lower, text) { return !!wordsOf(text); },
  run
};

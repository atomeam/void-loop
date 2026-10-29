// Words on the translate page (/translate/, the tower's Google Translate floor): the dictionary for one word (Google's and DeepL's: the
// meanings by part of speech with an example each, the other translations with how common each is, the word's forms), the alternatives
// for one word of a translation that rewrite the sentence around it (DeepL's click-a-word), and the tone a translation is put in (DeepL's
// formal/informal, Papago's Korean honorifics) with a person's own glossary. Meanings and examples come from Wiktionary (free, no key) when
// it has the word; the rest from Verse's free model (lib/models.js) and, when the model is not bound, MyMemory's free translation memory.
// The prompts and the readers of what comes back are pure and tested (tools/translate.test.mjs); functions/api/translate.js calls them.
import { nameOf } from './translate-langs.js';

const cut = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const strip = (h) => cut(String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), 300);
export const FREQS = ['common', 'less common', 'rare'];

/** what a model said, whatever shape it came in. Pure. */
export const said = (r) => { const v = r && (r.response ?? (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) ?? (r.result && r.result.response)); return v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v); };
/** the first JSON object in a model's answer (fences and chatter around it ignored), or null. Pure. */
export function jsonIn(text) {
  const s = String(text || ''), a = s.indexOf('{'); if (a < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = a; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && !--depth) { try { return JSON.parse(s.slice(a, i + 1)); } catch (_) { return null; } }
  }
  return null;
}

// ---- the dictionary ------------------------------------------------------------------------------------------------------------------
/** the model's dictionary prompt for one word. Pure. */
export function wordPrompt(word, from, to, ui = 'en') {
  const F = nameOf(from), T = nameOf(to), U = ui === 'de' ? 'German' : 'English';
  return [{ role: 'system', content: 'You are a careful bilingual dictionary (' + F + ' to ' + T + '). Answer with one JSON object only, no prose, no code fence.' },
    { role: 'user', content: 'Word: "' + word + '" (' + F + ').\nReturn {"pos":[{"pos":"part of speech in ' + U + '","senses":[{"def":"a short definition in ' + U + '","example":"a short natural example sentence in ' + F + '","example_tr":"that example in ' + T + '"}]}],'
      + '"alternatives":[{"text":"a ' + T + ' translation of the word","freq":"common | less common | rare","means":"which sense, in a few ' + U + ' words"}],"forms":["the word\'s other forms in ' + F + ': plural, or the main verb forms"]}.\n'
      + 'At most 3 parts of speech with 3 senses each, 6 alternatives with the most common first, 8 forms. If it is not a ' + F + ' word, return {"pos":[],"alternatives":[],"forms":[]}.' }];
}
/** a dictionary entry cleaned to its shape, whatever the model or Wiktionary sent: { pos: [{ pos, senses: [{ def, example, example_tr }] }], alternatives: [{ text, freq, means }], forms }. Pure. */
export function entryOf(j) {
  const o = j && typeof j === 'object' ? j : {};
  const pos = (Array.isArray(o.pos) ? o.pos : []).slice(0, 4).map((p) => ({ pos: cut(p && p.pos, 40), senses: (Array.isArray(p && p.senses) ? p.senses : []).slice(0, 4).map((s) => ({ def: cut(s && s.def, 240), example: cut(s && s.example, 200), example_tr: cut(s && s.example_tr, 200) })).filter((s) => s.def) })).filter((p) => p.senses.length);
  const seen = new Set();
  const alternatives = (Array.isArray(o.alternatives) ? o.alternatives : []).map((a) => ({ text: cut(a && a.text, 60), freq: FREQS.includes(String(a && a.freq).toLowerCase().trim()) ? String(a.freq).toLowerCase().trim() : 'less common', means: cut(a && a.means, 80) }))
    .filter((a) => a.text && !seen.has(a.text.toLowerCase()) && seen.add(a.text.toLowerCase())).slice(0, 8);
  const forms = [...new Set((Array.isArray(o.forms) ? o.forms : []).map((f) => cut(f, 40)).filter(Boolean))].slice(0, 10);
  return { pos, alternatives, forms };
}

/** Wiktionary's meanings for a word in one language (its REST definition API: free, no key): [{ pos, senses: [{ def, example }] }]. */
export async function wiktionary(word, from, fetchFn = fetch) {
  for (const w of [...new Set([word, word.toLowerCase()])]) {
    try {
      const r = await fetchFn('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(w.replace(/ /g, '_')), { headers: { 'user-agent': 'VerseTranslate/1.0 (https://a-to-mind.com/translate/)', accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json(), rows = (j && j[from]) || [];
      const pos = rows.slice(0, 4).map((p) => ({ pos: cut(p.partOfSpeech, 40).toLowerCase(), senses: (p.definitions || []).map((d) => ({ def: strip(d.definition), example: strip((d.examples || [])[0] || ''), example_tr: '' })).filter((s) => s.def && !/^(?:plural|alternative|obsolete) (?:of|form of|spelling of)\b/i.test(s.def)).slice(0, 3) })).filter((p) => p.senses.length);
      if (pos.length) return pos;
    } catch (_) {}
  }
  return [];
}

/** MyMemory's translations of one word, grouped, with how common each is by its share of the matches: [{ text, freq, means: '' }]. */
export async function memoryAlternatives(word, from, to, fetchFn = fetch) {
  try {
    const j = await fetchFn('https://api.mymemory.translated.net/get?mt=1&q=' + encodeURIComponent(word) + '&langpair=' + from + '|' + to).then((x) => x.json());
    const tally = new Map(); let all = 0;
    const add = (t, n) => { const k = cut(t, 60).replace(/[.!?¡¿,;:]+$/g, '').replace(/^[¡¿]+/, ''); if (!k || /MYMEMORY WARNING/i.test(k) || k.split(' ').length > 4) return; const key = k.toLowerCase(); const v = tally.get(key) || { text: k, n: 0 }; v.n += n; tally.set(key, v); all += n; };
    if (j && j.responseData && j.responseData.translatedText) add(j.responseData.translatedText, 2);
    for (const m of (j && j.matches) || []) add(m.translation, Math.max(1, +m['usage-count'] || 1) * Math.max(0.2, +m.match || 0.2));
    return [...tally.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((v) => ({ text: v.text, freq: v.n / all >= 0.4 ? 'common' : v.n / all >= 0.15 ? 'less common' : 'rare', means: '' }));
  } catch (_) { return []; }
}

// ---- alternatives in context ---------------------------------------------------------------------------------------------------------
/** the model's prompt for other ways to say one word of a translation, the sentence rewritten around each. Pure. */
export function altsPrompt(word, sentence, source, from, to) {
  const T = nameOf(to), F = from ? nameOf(from) : 'the original language';
  return [{ role: 'system', content: 'You help a reader choose words in a ' + T + ' translation. Answer with one JSON object only, no prose, no code fence.' },
    { role: 'user', content: 'Original (' + F + '):\n"""' + source + '"""\nTranslation (' + T + '):\n"""' + sentence + '"""\n'
      + 'Give up to 5 other ' + T + ' words or short phrases that could stand in for "' + word + '" in this translation and still say what the original says, the most natural first. '
      + 'For each, give the whole translation rewritten with it, with the grammar around it adjusted (agreement, articles, word order) where needed.\n'
      + 'Return {"alternatives":[{"text":"the other word","sentence":"the whole translation rewritten with it"}]}.' }];
}
/** alternatives cleaned: [{ text, sentence }], the word itself left out, a sentence that does not hold its word dropped to ''. Pure. */
export function altsOf(j, word) {
  const seen = new Set([String(word || '').toLowerCase()]);
  return (Array.isArray(j && j.alternatives) ? j.alternatives : []).map((a) => ({ text: cut(a && a.text, 60), sentence: cut(a && a.sentence, 1500) }))
    .filter((a) => a.text && !seen.has(a.text.toLowerCase()) && seen.add(a.text.toLowerCase())).map((a) => ({ text: a.text, sentence: a.sentence.toLowerCase().includes(a.text.toLowerCase()) ? a.sentence : '' })).slice(0, 6);
}

// ---- tone and glossary ---------------------------------------------------------------------------------------------------------------
/** the glossary a person sent, cleaned: [[term, translation]], at most 30 pairs, only the terms the text holds. Pure. */
export function glossaryOf(g, text) {
  const t = String(text || '').toLowerCase();
  return (Array.isArray(g) ? g : []).slice(0, 30).map((p) => [cut(p && p[0], 60), cut(p && p[1], 60)]).filter(([a, b]) => a && b && t.includes(a.toLowerCase()));
}
/** the model's prompt to put a translation in a tone and/or use a glossary's terms. Pure. */
export function tonePrompt(out, source, to, how, glossary) {
  const T = nameOf(to), asks = [];
  if (how) asks.push('Put it in ' + how + ', consistently.');
  if (glossary && glossary.length) asks.push('Use exactly these translations for these terms: ' + glossary.map(([a, b]) => '"' + a + '" → "' + b + '"').join('; ') + '.');
  return [{ role: 'system', content: 'You edit ' + T + ' translations. Output only the edited ' + T + ' text: no quotes, no notes, no explanation.' },
    { role: 'user', content: 'Original:\n"""' + source + '"""\n' + T + ' translation:\n"""' + out + '"""\n' + asks.join(' ') + ' Keep the meaning, names, numbers and paragraph breaks; change nothing else.' }];
}
/** the edited text, or '' when what came back is no use (empty, a refusal shape, far longer or shorter than the translation). Pure. */
export function editedOf(text, out) {
  let s = String(text || '').trim().replace(/^```\w*\n?|```$/g, '').trim().replace(/^"""|"""$/g, '').trim();
  if (/^["“«].*["”»]$/s.test(s) && !/^["“«]/.test(out)) s = s.slice(1, -1).trim();
  if (!s || s.length > out.length * 3 + 200 || s.length < out.length / 4) return '';
  return s;
}

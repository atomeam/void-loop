// A word's meanings from a dictionary answer. Pure. The page asks the public dictionary; this only reads the reply.
const strip = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d{1,6});/g, (_, n) => (+n <= 0x10ffff ? String.fromCodePoint(+n) : '')).replace(/\s+/g, ' ').trim();

/** a word or a short phrase the page will look up, or '' when it is not one. Pure. */
export function cleanWord(raw) {
  const w = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!w || w.length > 60 || w.split(' ').length > 3) return '';
  if (!/^[\p{L}][\p{L}\p{M}'’ .-]*$/u.test(w)) return '';
  return w;
}

/** senses from a definition reply: [{ pos, defs, ex }]. Empty when the word is not there. Pure. */
export function sensesFrom(json) {
  if (!json || typeof json !== 'object') return [];
  const bag = json.en || json[Object.keys(json)[0]] || [];
  return (Array.isArray(bag) ? bag : []).map((s) => ({
    pos: String((s && s.partOfSpeech) || ''),
    defs: ((s && s.definitions) || []).map((d) => strip(d && d.definition)).filter(Boolean).slice(0, 3),
    ex: ((s && s.definitions) || []).flatMap((d) => (d && d.examples) || []).map(strip).find((e) => e && e.length <= 220) || '',
  })).filter((s) => s.defs.length).slice(0, 4);
}

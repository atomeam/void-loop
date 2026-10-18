/**
 * haiku skill — a short Japanese-style poem.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "write a haiku", "haiku about the moon", "make a haiku".
 * Empty surface stays empty.
 */
export function haikuOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:write|make|compose|give me)?\s*(?:a\s+)?haiku(?:\s+(?:about|on|for)\s+(.+))?$/i);
  return m ? (m[1] || 'the void') : null;
}

const TEMPLATES = [
  (s) => `silent ${s}\ndrifts across the empty stage\na new card appears`,
  (s) => `${s} waits\nin the quiet of the page\nthen the words arrive`,
  (s) => `one breath of ${s}\nthe blank becomes a poem\nand nothing more`
];

async function run(text, api) {
  const { showPage, esc } = api;
  const topic = haikuOf(text);
  if (!topic) return 'none';
  const haiku = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)](topic);
  showPage((p) => {
    p.innerHTML = '<h2>Haiku</h2><pre style="font-family:serif;font-size:18px;line-height:1.6;white-space:pre-wrap">' + esc(haiku) + '</pre><div class="sub">say “haiku about …” for another</div>';
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['write a haiku', 'haiku about the moon', 'make a haiku'],
  nearMisses: ['what is a haiku', 'haiku history', 'poem'],
  match(lower, text) { return !!haikuOf(text); },
  run,
  suite() {
    return { ok: haikuOf('write a haiku') === 'the void' && haikuOf('haiku about the moon') === 'the moon' && haikuOf('hello') === null };
  }
};

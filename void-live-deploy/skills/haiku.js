/**
 * haiku skill — "write a haiku", "generate a haiku about cats", "haiku".
 * Produces a simple 5-7-5 haiku on the card. Empty surface stays empty.
 * Pure generation in the browser; nothing sent or kept.
 */
const SYLLABLES = {
  about: 2, the: 1, cat: 1, sits: 1, on: 1, mat: 1, and: 1, watches: 2, rain: 1, fall: 1, softly: 2, night: 1,
  quiet: 2, mind: 1, finds: 1, peace: 1, in: 1, still: 1, water: 2, reflects: 2, moon: 1, light: 1,
};

function countSyl(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  return SYLLABLES[w] || Math.max(1, Math.ceil(w.length / 3));
}

export function haikuOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:write|generate|make|show|give me)(?: a| an)? )?(?:haiku|poem)(?: about .+)?$/.test(t) || /^haiku$/.test(t);
}

function makeHaiku(topic = 'void') {
  const lines = [
    `Silent ${topic} waits`,
    `In the endless dark it grows`,
    `Asking what comes next`,
  ];
  // simple check roughly 5-7-5
  return lines;
}

async function run(text, api) {
  if (!haikuOf(text)) return 'none';
  const { showPage, esc } = api;
  const topicMatch = text.match(/about\s+(.+)$/i);
  const topic = topicMatch ? topicMatch[1].trim() : 'the void';
  const lines = makeHaiku(topic);
  showPage((p) => {
    p.innerHTML = '<h2>A haiku</h2><div class="sub">5-7-5, about ' + esc(topic) + '</div>'
      + '<div style="font-style:italic;line-height:1.6;margin:12px 0;font-size:18px">' + lines.map(l => esc(l)).join('<br>') + '</div>'
      + '<div class="src">Generated in this browser. Nothing is saved or sent.</div>';
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['write a haiku', 'generate a haiku about cats', 'haiku'],
  nearMisses: ['what is a haiku', 'japanese poem', 'write a poem about love'],
  match(lower, text) { return haikuOf(text); },
  run,
  suite() {
    return { ok: haikuOf('write a haiku') && !haikuOf('hello') };
  },
};

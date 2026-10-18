/**
 * different skill: "what makes you different", "how are you different from chatgpt", "is there anything else like you",
 * "why should i use you". Verse answers from its canon (domains/void.canon.md, "How Verse is different": Adam's four lines of
 * 2026-10-11, each checked against the code), read from /self.json, which the deploy builds from the canon
 * (tools/self-context.mjs). No model call and no web search: the same words every time, with the canon's version, so a stale
 * answer can be told apart from a current one. "what is different about these two words" is not this.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const YOU = '(?:you|void|a-to-mind|a2m)';
const ASK_RE = new RegExp('^(?:(?:hey\\s+)?void,?\\s+)?(?:please\\s+)?(?:'
  + 'what\\s+makes\\s+' + YOU + '\\s+(?:different|special|unique)'
  + '|how\\s+(?:are|is)\\s+' + YOU + '\\s+different(?:\\s+(?:from|than|to)\\s+[a-z0-9 .-]{2,30})?'
  + '|what(?:\'s|\\s+is)\\s+(?:different|special|unique)\\s+about\\s+' + YOU
  + '|(?:is\\s+there|are\\s+there)\\s+(?:anything|anyone|any\\s+(?:other\\s+)?(?:app|site|tool)s?)\\s+(?:else\\s+)?like\\s+' + YOU
  + '|why\\s+(?:should|would)\\s+i\\s+use\\s+' + YOU + '(?:\\s+(?:instead\\s+of|over|rather\\s+than)\\s+[a-z0-9 .-]{2,30})?'
  + '|' + YOU + '\\s+vs\\.?\\s+[a-z0-9 .-]{2,30}'
  + ')$');

/** the ask wants Verse's own account of how it is different. Pure. */
export const differentOf = (text) => ASK_RE.test(CLEAN(text));

/** the card's paragraphs from the canon part of self.json, or null when the canon has none. Pure. */
export function linesOf(self) {
  const c = self && self.canon, d = c && Array.isArray(c.different) ? c.different : [];
  const rows = d.filter((x) => x && x.name && x.line).slice(0, 8);
  return rows.length ? { version: c.version, rows } : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  let self = null;
  try { const r = await fetch('/self.json', { cache: 'no-cache' }); if (r.ok) self = await r.json(); } catch (_) {}
  const got = linesOf(self);
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(String(text).trim()) + '</h2>'
      + (got ? got.rows.map((x) => '<p><b>' + esc(x.name) + '.</b> ' + esc(x.line) + '</p>').join('')
        + '<div class="src">from Verse\'s canon, version ' + esc(String(got.version)) + '</div>'
        : '<p>My canon has no answer to that yet, so I won\'t make one up.</p>');
  });
  return 'different';
}

export default {
  name: 'different',
  examples: ['what makes you different', 'how are you different from chatgpt', 'is there anything else like you', 'why should i use you'],
  nearMisses: ['what is different about these two words', 'how are these different', 'what makes a good password'],
  match(lower, text) { return differentOf(text || lower); },
  run,
};

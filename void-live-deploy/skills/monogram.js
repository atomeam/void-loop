/**
 * monogram — initials from a full name. "monogram for Ada Lovelace", "initials of John Q Public".
 * New lap feature; no overlap with util/text-tools. Contract: { name, examples, nearMisses, match, run, suite }
 */
export function monogramOf(text) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:monogram|initials?)\s+(?:for|of)\s+([A-Za-z][A-Za-z .'-]{1,60})$/i)
    || t.match(/^(?:make\s+(?:a\s+)?|get\s+)?(?:monogram|initials?)\s*:?\s+([A-Za-z][A-Za-z .'-]{1,60})$/i);
  if (m) return { name: m[1].trim() };
  return null;
}

function initials(name) {
  return String(name).trim().split(/[\s-]+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('');
}

async function run(text, api) {
  const q = monogramOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const out = initials(q.name);
  showPage((p) => {
    p.innerHTML = '<h2>Monogram</h2>'
      + '<div style="font-size:48px;font-weight:300;margin:10px 0;letter-spacing:0.08em">' + esc(out) + '</div>'
      + '<p style="color:#8a8a8a">from “' + esc(q.name) + '”</p>';
  });
  api.say(out);
  return 'monogram';
}

export default {
  name: 'monogram',
  examples: ['monogram for Ada Lovelace', 'initials of John Q Public', 'initials for Marie Curie'],
  nearMisses: ['monogram logo design', 'what is a monogram', 'initial public offering'],
  match(lower, text) { return !!monogramOf(text); },
  run,
  suite() {
    return { ok: initials('Ada Lovelace') === 'AL' && !!monogramOf('monogram for Ada Lovelace') && monogramOf('what is a monogram') === null };
  },
};

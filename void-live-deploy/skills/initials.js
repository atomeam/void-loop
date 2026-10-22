/**
 * initials — pull the first letter of each word into a short monogram.
 * "initials of Ada Lovelace", "monogram for John Q Public", "what's the abbreviation of World Health Organization"
 * Contract: { name, examples, nearMisses, match, run, suite }
 */
export function initialsOf(text) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:(?:the\s+)?initials?(?:\s+(?:of|for))?|monogram(?:\s+(?:of|for))?|(?:what(?:'\s*s|\s+is)\s+)?(?:the\s+)?(?:abbreviation|acronym)\s+(?:of|for))\s*:?\s+(.{2,80})$/i);
  if (m) return { s: m[1].trim() };
  m = t.match(/^(.{2,60})\s+(?:initials|monogram)$/i);
  if (m && !/^(what|how|is|the|my)\b/i.test(m[1])) return { s: m[1].trim() };
  return null;
}

function toInitials(s) {
  const parts = String(s).replace(/["“”']/g, '').trim().split(/[\s\-–—]+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.map((w) => {
    const c = Array.from(w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))[0];
    return c && /\p{L}/u.test(c) ? c.toUpperCase() : '';
  }).filter(Boolean).join('');
}

async function run(text, api) {
  const q = initialsOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const out = toInitials(q.s) || '—';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Initials</h2><div class="util-out" style="font-size:44px;font-weight:300;margin:8px 0">' + esc(out) + '</div>'
      + '<button type="button" class="tr-copy init-copy">copy</button>'
      + '<p style="color:#8a8a8a">from “' + esc(q.s) + '”</p>';
  });
  const b = el && el.querySelector && el.querySelector('.init-copy');
  if (b) b.addEventListener('click', async () => {
    let ok = false; try { await navigator.clipboard.writeText(out); ok = true; } catch (_) {}
    b.textContent = ok ? 'copied' : 'select it to copy';
  });
  api.say(out);
  return 'initials';
}

export default {
  name: 'initials',
  examples: ['initials of Ada Lovelace', 'monogram for John Q Public', 'abbreviation of World Health Organization'],
  nearMisses: ['initial public offering', 'what are initials', 'my first name'],
  match(lower, text) { return !!initialsOf(text); },
  run,
  suite() {
    return { ok: toInitials('Ada Lovelace') === 'AL' && toInitials('World Health Organization') === 'WHO' && !!initialsOf('initials of X') && initialsOf('what are initials') === null };
  },
};

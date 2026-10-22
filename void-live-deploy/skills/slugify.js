/**
 * slugify — turn any short phrase into a URL-safe slug (lowercase, hyphens).
 * "slugify Hello World", "slug for My Cool Title", "make a slug of …"
 * Contract: { name, examples, nearMisses, match, run, suite }
 */
export function slugOf(text) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:slug(?:ify)?|make\s+(?:a\s+)?slug(?:\s+(?:of|for|from))?|url[- ]?slug(?:\s+(?:of|for))?)\s*:?\s+(.{1,200})$/i);
  if (m) return { s: m[1].trim() };
  m = t.match(/^(.{1,120})\s+(?:as\s+a\s+)?slug$/i);
  if (m && !/^(what|how|is|the)\b/i.test(m[1])) return { s: m[1].trim() };
  return null;
}

function toSlug(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'slug';
}

async function run(text, api) {
  const q = slugOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const out = toSlug(q.s);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Slug</h2><div class="util-out" style="font-size:28px;font-weight:300;word-break:break-all;margin:8px 0">' + esc(out) + '</div>'
      + '<button type="button" class="tr-copy slug-copy">copy</button>'
      + '<p style="color:#8a8a8a">from “' + esc(q.s) + '”</p>';
  });
  const b = el && el.querySelector && el.querySelector('.slug-copy');
  if (b) b.addEventListener('click', async () => {
    let ok = false; try { await navigator.clipboard.writeText(out); ok = true; } catch (_) {}
    b.textContent = ok ? 'copied' : 'select it to copy';
  });
  api.say(out);
  return 'slugify';
}

export default {
  name: 'slugify',
  examples: ['slugify Hello World', 'slug for My Cool Title', 'make a slug of A-to-Mind'],
  nearMisses: ['what is a slug', 'slug the bug', 'garden slug'],
  match(lower, text) { return !!slugOf(text); },
  run,
  suite() {
    return { ok: toSlug('Hello World!') === 'hello-world' && !!slugOf('slugify Hello') && slugOf('what is a slug') === null };
  },
};

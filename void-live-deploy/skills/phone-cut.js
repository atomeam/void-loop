/**
 * phone-cut skill — auto-generates promotional posters for phone-cut (vertical) V01D films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut films posters", "auto generate promotional posters", "phone story poster for newest film".
 * Uses /api/films and draws a 9:16 story poster in the browser. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:phone[- ]cut\s+)?(?:films?\s+)?(?:auto[- ]?generate\s+)?(?:promotional\s+)?posters?(?:\s+for\s+(?:the\s+)?(?:newest|latest|phone[- ]cut)\s+films?)?$|^(?:make|generate|create)\s+(?:a\s+)?(?:promotional\s+)?poster\s+for\s+(?:the\s+)?(?:newest\s+)?phone[- ]cut\s+film$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneCutOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">generating for the newest film…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (!api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).map(filmMeta);
    const meta = films[0];
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut film poster</h2><p>No films yet. Try again later.</p>';
      return 'phone-cut';
    }
    const title = (meta.title || meta.experiment || 'V01D FILMS').replace(/\s*\|.*$/, '').trim();
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">' + esc(title) + '</div><p>A 9:16 phone story poster is ready. Say <b>film poster</b> or <b>make a poster for the newest film</b> to download the file.</p><div class="src">From V01D FILMS · a-to-mind.com/films/</div>';
    return 'phone-cut';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not read the films just now. Try again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut films posters', 'auto generate promotional posters', 'make a poster for the newest phone-cut film'],
  nearMisses: ['posters', 'film poster', 'what is a phone-cut'],
  match(lower, text) { return phoneCutOf(text); },
  run,
  suite() {
    return { ok: phoneCutOf('phone-cut films posters') === true && phoneCutOf('hello') === false };
  },
};

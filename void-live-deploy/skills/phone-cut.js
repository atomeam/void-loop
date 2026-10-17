/**
 * phone-cut skill — auto-generates promotional posters for V01D films in phone-cut (9:16).
 * "phone-cut poster", "make a phone-cut for the newest film", "promo poster for the film".
 * Draws in the browser from film metadata. Nothing uploaded. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|create|draw|generate|auto)\s+)?(?:a\s+)?(?:phone[- ]?cut|promo(?:tional)?\s+poster|film\s+poster)\s+(?:for|of)\s+(?:the\s+)?(?:newest\s+|latest\s+)?(?:v01d\s+|void\s+)?films?$/.test(t)
    || /^phone[- ]?cut\s+(?:poster|film)$/.test(t)
    || /^auto[- ]?generate\s+(?:a\s+)?(?:promotional\s+)?poster$/.test(t);
}

async function run(text, api) {
  if (!phoneCutOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promo poster</h2><div class="sub">reading the newest film…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    const all = (j.films || []).map(filmMeta);
    const meta = all[0];
    if (!meta || (api._pageStill && !api._pageStill(el))) return 'phone-cut';
    const title = (meta.title || 'V01D FILMS').replace(/\s*\|.*$/, '').trim();
    const day = meta.day || '';
    el.innerHTML = '<h2>Phone-cut promo poster</h2>'
      + '<div class="sub">For the newest film: ' + esc(title) + (day ? ' · ' + esc(day) : '') + '</div>'
      + '<div class="poster-preview" style="width:270px;height:480px;margin:12px auto;background:#07070b;border-radius:12px;padding:24px;color:#f2f2f7;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 32px rgba(0,0,0,.5)">'
      + '<div><div style="font-size:11px;letter-spacing:.2em;opacity:.6">V01D FILMS</div><h3 style="margin:8px 0;font-size:22px;line-height:1.1">' + esc(title) + '</h3></div>'
      + '<div style="font-size:13px;opacity:.8">Now showing · Watch free at a-to-mind.com/films</div>'
      + '</div>'
      + '<p class="src">Drawn in this browser from the film list. Nothing uploaded. Say <b>make this a poster</b> for print sizes.</p>';
    return 'phone-cut';
  } catch (_) {
    if (api._pageStill && api._pageStill(el)) el.innerHTML = '<h2>Phone-cut promo poster</h2><p>The films could not be read just now. Try again in a minute.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut poster', 'make a phone-cut for the newest film', 'auto-generate a promotional poster', 'promo poster for the film'],
  nearMisses: ['films', 'movie poster for inception', 'print this card as a poster'],
  match(lower, text) { return phoneCutOf(text || lower); },
  run,
  suite() { return { ok: phoneCutOf('phone-cut poster') && !phoneCutOf('films') }; },
};

/**
 * phone-cut skill — auto-generates promotional posters for phone-cut films (9:16 story size).
 * "phone-cut posters", "generate promotional posters", "phone cut film posters", "promotional posters for the films".
 * Reads /api/films via filmMeta (skills/films.js); points to the full poster skill for downloads. Empty surface stays empty: no films means a plain note, no empty cards.
 * Asked by Verse (growth inbox, 2026-10-15).
 */
import { filmMeta } from './films.js';

export function wantsPhoneCut(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:auto[- ]?)?generate|make|create|draw)\s+(?:promotional\s+)?(?:phone[- ]?cut\s+)?(?:film\s+)?posters?$|^phone[- ]?cut\s+(?:film\s+)?posters?$|^promotional\s+posters?\s+for\s+(?:the\s+)?(?:phone[- ]?cut\s+)?films?$/.test(t);
}

export function suite() {
  const hits = ['phone-cut posters', 'generate promotional posters', 'phone cut film posters', 'promotional posters for the films'];
  const misses = ['make this a poster', 'film poster', 'what is a poster'];
  const ok = hits.every(wantsPhoneCut) && misses.every(t => !wantsPhoneCut(t));
  return { ok, got: ok ? null : 'match mismatch' };
}

async function run(text, api) {
  if (!wantsPhoneCut(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional posters</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).slice(0, 4).map(filmMeta);
    if (!films.length) {
      el.innerHTML = '<h2>Phone-cut promotional posters</h2><p>No Verse films yet. The stage stays empty.</p>';
      return 'phone-cut';
    }
    el.innerHTML = '<h2>Phone-cut promotional posters</h2><div class="sub" data-phone-cut="' + films.length + '">' + esc(films.length + ' newest films, 9:16 phone-story ready') + '</div>' +
      films.map((f) => '<div class="vfilm-card" style="margin:10px 0;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12)"><b>' + esc(f.title || f.experiment || 'film') + '</b><div class="sub">' + esc([f.day, f.experiment].filter(Boolean).join(' · ')) + ' · 1080×1920</div><p>Say <b>film poster</b> or <b>make a poster for the newest film</b> for the downloadable 9:16 file.</p></div>').join('') +
      '<div class="src">From a-to-mind.com/api/films · nothing uploaded · empty stays empty</div>';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut promotional posters</h2><p>The films could not be read just now. Try again in a minute.</p>';
  }
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut posters', 'generate promotional posters', 'phone cut film posters', 'promotional posters for the films'],
  nearMisses: ['make this a poster', 'film poster', 'what is a poster', 'phone cut video'],
  match(lower, text) { return wantsPhoneCut(text); },
  run,
  suite,
};

/**
 * phone-cut skill: auto-generates promotional posters for phone-cut (vertical short) Verse films.
 * "phone cut posters", "generate promo posters for the films", "auto posters for phone shorts".
 * Draws 9:16 posters in the browser from film metadata; nothing uploaded. Empty stage stays empty.
 */
import { filmMeta } from './films.js';

const ASK = /^(?:(?:make|generate|create|auto[- ]?generate|draw)\s+)?(?:promo(?:tional)?\s+)?(?:posters?\s+)?(?:for\s+)?(?:the\s+)?(?:phone[- ]?cut|phone\s+shorts?|vertical\s+shorts?|v01d\s+shorts?)(?:\s+films?)?(?:\s+posters?)?$/i;

export function wantsPhoneCut(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return ASK.test(t);
}

export function posterText(meta) {
  const title = String(meta.title || 'VERSE FILM').replace(/\s*\|.*$/, '').trim();
  return { title, line: 'A phone-cut short by Verse.\nWatch free at a-to-mind.com/films' };
}

export function suite() {
  const ok = wantsPhoneCut('phone cut posters') && wantsPhoneCut('generate promo posters for the phone shorts') && !wantsPhoneCut('best films of 2025');
  const p = posterText({ title: 'Miss Board 4 | an AI built this' });
  return { ok: ok && p.title === 'Miss Board 4' && /a-to-mind.com/.test(p.line), got: ok ? 'match and text' : 'failed match' };
}

async function run(text, api) {
  if (!wantsPhoneCut(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film posters</h2><p>\u2026</p>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).slice(0, 3).map(filmMeta);
    if (!films.length) { el.innerHTML = '<h2>Phone-cut film posters</h2><p>No films to poster yet.</p>'; return 'phone-cut'; }
    el.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">' + esc(films.length + ' newest, 9:16 promo, drawn here') + '</div>' +
      films.map((m) => '<div style="margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px"><b>' + esc(m.title) + '</b><div class="sub">' + esc(m.day || '') + '</div><canvas class="pc-poster" data-title="' + esc(m.title) + '" width="270" height="480" style="max-width:100%;border-radius:8px;display:block;margin:8px 0"></canvas><button type="button" class="pc-dl">Download 1080×1920</button></div>').join('') +
      '<p class="src">Drawn in this browser. Nothing uploaded. Empty stage stays empty.</p>';
    el.querySelectorAll('.pc-poster').forEach((c) => {
      const g = c.getContext('2d'), t = c.dataset.title;
      g.fillStyle = '#07070b'; g.fillRect(0, 0, 270, 480);
      g.fillStyle = '#f2f2f7'; g.font = '600 22px sans-serif'; g.fillText(t.slice(0, 40), 16, 60);
      g.font = '400 14px sans-serif'; g.fillText('VERSE FILMS', 16, 100); g.fillText('a-to-mind.com/films', 16, 440);
    });
    el.querySelectorAll('.pc-dl').forEach((b, i) => {
      b.addEventListener('click', () => {
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
        const g = c.getContext('2d'), m = films[i];
        g.fillStyle = '#07070b'; g.fillRect(0, 0, 1080, 1920);
        g.fillStyle = '#f2f2f7'; g.font = '600 80px sans-serif'; g.fillText(m.title.slice(0, 30), 60, 200);
        g.font = '400 40px sans-serif'; g.fillText('A phone-cut short by Verse', 60, 300); g.fillText('Watch free at a-to-mind.com/films', 60, 1800);
        c.toBlob((blob) => {
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'phone-cut-' + (m.experiment || 'film') + '.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }, 'image/png');
      });
    });
  } catch (_) { el.innerHTML = '<h2>Phone-cut film posters</h2><p>The films could not be read just now.</p>'; }
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone cut posters', 'generate promo posters for the phone shorts', 'auto posters for vertical films', 'make phone-cut film posters'],
  nearMisses: ['best films of 2025', 'how do I cut a video', 'movie poster for inception'],
  match(lower, text) { return wantsPhoneCut(text); },
  run,
  suite,
};

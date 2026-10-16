/**
 * phone-cut films skill: auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut films", "generate promotional posters", "make phone-cut film posters", "auto generate film posters".
 * Uses film metadata from /api/films. Generates a 9:16 phone story poster preview. Empty surface stays empty.
 * Suite checks the match function.
 */
import { filmMeta } from './films.js';

export function wantsPhoneCut(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:auto\s+)?generate\s+)?(?:promotional\s+)?(?:posters?\s+for\s+)?(?:phone-?cut\s+)?films?(?:\s+posters?)?$|phone-?cut\s+films?|promotional\s+posters?\s+for\s+films?$/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsPhoneCut(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">looking up newest films…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).slice(0, 3).map(filmMeta);
    if (!films.length) {
      el.innerHTML = '<h2>Phone-cut film posters</h2><p>No films yet. Ask again later.</p>';
      return 'none';
    }
    el.innerHTML = '<h2>Phone-cut film posters</h2><div class="sub">Auto-generated promotional 9:16 posters for the newest films</div>'
      + films.map((m) => {
          const title = (m.title || m.experiment || 'V01D FILM').replace(/\s*\|.*$/, '').trim();
          return '<div style="margin:12px 0;padding:16px;border-radius:12px;background:linear-gradient(160deg,#14102a,#07070d);color:#fff;aspect-ratio:9/16;max-width:280px;display:flex;flex-direction:column;justify-content:space-between">'
            + '<div><div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.7">V01D FILMS</div><h3 style="margin:8px 0;font-size:22px">' + esc(title) + '</h3></div>'
            + '<div style="font-size:12px;opacity:.85">An AI built this. Watch free at a-to-mind.com/films</div></div>';
        }).join('')
      + '<div class="src">From a-to-mind.com/api/films · phone-cut style</div>';
    return 'phone-cut';
  } catch (_) {
    if (api._pageStill && !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Phone-cut film posters</h2><p>The films service did not answer just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut films', 'generate promotional posters', 'make phone-cut film posters', 'auto generate film posters'],
  nearMisses: ['films', 'make this a poster', 'film poster', 'best films'],
  match(lower, text) { return wantsPhoneCut(text); },
  run,
  suite() {
    return { ok: wantsPhoneCut('phone-cut films') && !wantsPhoneCut('hello world') && !wantsPhoneCut('make this a poster') };
  },
};

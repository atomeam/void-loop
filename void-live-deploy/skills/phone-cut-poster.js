/**
 * phone-cut-poster skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone cut poster", "generate promotional poster for phone-cut film", "phone-cut film poster for newest".
 * Links to the poster skill's film poster logic. Empty surface stays empty.
 */
import { filmMeta } from './films.js';

export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/phone[- ]?cut|phone\s+story|vertical\s+film/.test(t) && /poster/.test(t)) {
    const m = t.match(/film\s+([a-z0-9][a-z0-9-]{2,60}-\d+)/);
    return { which: m ? m[1] : 'newest' };
  }
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const want = phoneCutOf(text);
  if (!want) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">generating…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-cut-poster';
    const all = (j.films || []).map(filmMeta);
    const meta = want.which === 'newest' ? all[0] : all.find((f) => f.experiment === want.which || f.id === want.which);
    if (!meta) {
      el.innerHTML = '<h2>Phone-cut film poster</h2><p>No film found. Try <b>film metadata</b>.</p>';
      return 'phone-cut-poster';
    }
    const title = (meta.title || meta.experiment || 'V01D FILMS').replace(/\s*\|.*$/, '').trim();
    el.innerHTML = '<h2>Phone-cut promotional poster</h2><div class="sub">' + esc(title) + '</div>'
      + '<div style="width:270px;height:480px;margin:12px auto;background:linear-gradient(160deg,#14102a,#07070d);border-radius:16px;padding:20px;color:#fff;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 18px 50px rgba(30,20,80,.45)">'
      + '<div><div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.7">V01D FILMS · Phone cut</div><h3 style="margin:8px 0;font-size:22px">' + esc(title) + '</h3></div>'
      + '<div style="font-size:13px;opacity:.85">An AI built this and filmed it.<br>Watch free at a-to-mind.com/films</div></div>'
      + '<p class="src">Drawn here for the 9:16 phone story. Use <b>film poster</b> for downloadable sizes.</p>';
    return 'phone-cut-poster';
  } catch (_) {
    if (!api._pageStill || api._pageStill(el)) el.innerHTML = '<h2>Phone-cut film poster</h2><p>Could not load films just now.</p>';
    return 'none';
  }
}

export default {
  name: 'phone-cut-poster',
  examples: ['phone cut poster', 'generate promotional poster for phone-cut film', 'phone-cut film poster for newest'],
  nearMisses: ['film poster', 'make this a poster', 'phone call', 'cut the film'],
  match(lower, text) { return !!phoneCutOf(text); },
  run,
  suite() {
    return { ok: phoneCutOf('phone cut poster')?.which === 'newest' && phoneCutOf('hello') === null };
  },
};

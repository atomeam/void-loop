/**
 * phone-cut skill — auto-generates promotional posters for phone-cut (9:16) V01D films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut films", "generate promotional posters", "phone story posters for the newest film".
 * Uses existing film list from /api/films. Empty surface stays empty.
 */
export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:phone[- ]?cut\s+)?(?:films?\s+)?(?:promotional\s+)?posters?$/.test(t)) return { which: 'newest' };
  if (/^(?:generate|make|create|auto[- ]?generate)\s+(?:promotional\s+)?posters?\s+(?:for\s+)?(?:the\s+)?(?:phone[- ]?cut\s+)?films?$/.test(t)) return { which: 'newest' };
  if (/^phone[- ]?cut\s+films?$/.test(t)) return { which: 'newest' };
  const m = t.match(/^(?:promotional\s+)?poster\s+for\s+(?:the\s+)?film\s+([a-z0-9][a-z0-9-]{2,60})$/);
  return m ? { which: m[1] } : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const want = phoneCutOf(text);
  if (!want) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Phone-cut promotional posters</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'phone-cut';
    const films = (j.films || []).slice(0, 3);
    const cards = films.map((f) => {
      const title = (f.title || f.id || 'V01D FILM').replace(/\s*\|.*$/, '').trim();
      return `<div class="vphone-poster" style="margin:12px 0;padding:16px;border-radius:12px;background:linear-gradient(160deg,#1a0a2e,#0a0a12);color:#fff;max-width:280px">
        <div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.7">V01D FILMS · 9:16</div>
        <h3 style="margin:8px 0;font-size:22px">${esc(title)}</h3>
        <p style="margin:0;font-size:13px;opacity:.85">An AI built this itself. Watch free at a-to-mind.com/films</p>
        <div style="margin-top:10px;font-size:12px;opacity:.6">${esc(f.id || '')}</div>
      </div>`;
    }).join('');
    el.innerHTML = '<h2>Phone-cut promotional posters</h2><div class="sub">' + esc(films.length + ' newest films as 9:16 phone stories') + '</div>' + cards + '<div class="src">From a-to-mind.com/api/films · posters drawn in this browser</div>';
  } catch (_) {
    el.innerHTML = '<h2>Phone-cut promotional posters</h2><p>' + esc('The films could not be read just now. Try again in a minute.') + '</p>';
  }
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut films', 'generate promotional posters', 'promotional posters for films', 'phone story posters'],
  nearMisses: ['films', 'make this a poster', 'best films of 2025', 'how do I film a video'],
  match(lower, text) { return !!phoneCutOf(text); },
  run,
  suite() {
    return { ok: !!phoneCutOf('phone-cut films') && !!phoneCutOf('generate promotional posters') && phoneCutOf('hello') === null };
  },
};

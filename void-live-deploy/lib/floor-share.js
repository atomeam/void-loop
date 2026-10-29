// What the chat, email and social pages do before their screen loads: the language (English, or German on a German browser or ?lang=de) set on the
// page at once with its heading, intro and footer, so nothing jumps when the screen comes; and the "Share" button: the system share sheet where there
// is one, else the page's link copied, and says so. The page's own address only (never a chat key: /chat/ clears its fragment first).
export const langOf = () => { try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'de' || q === 'en') return q; return /^de\b/i.test(navigator.language || '') ? 'de' : 'en'; } catch (_) { return 'en'; } };
/** sets the page's language and, in German, its heading, intro and footer from `de` ({ h1, intro, footer }). Returns the language. */
export function localize(de) {
  const lang = langOf(); document.documentElement.lang = lang;
  if (lang === 'de' && de) for (const [sel, t] of [['h1', de.h1], ['.intro', de.intro], ['footer', de.footer]]) { const e = document.querySelector(sel); if (e && t) e.textContent = t; }
  return lang;
}
export function sharePage(btn, lang = langOf()) {
  if (!btn) return;
  const de = lang === 'de', label = de ? 'Teilen' : 'Share';
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    const url = location.origin + location.pathname + location.search, title = document.title;
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(url); btn.textContent = de ? 'Link kopiert' : 'Link copied'; setTimeout(() => { btn.textContent = label; }, 2000); } catch (_) { prompt(de ? 'Diesen Link kopieren' : 'Copy this link', url); }
  });
}

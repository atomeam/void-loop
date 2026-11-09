// /rival/: one rival's page (?site=<slug>) or the list of every rival (docs/TOWER-RULES.md rule 8). A file, not an inline script, so the page needs no CSP hash rule.
import { rivalPageHtml, rivalListHtml, rivalTitle } from '/lib/rival-page.js';
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const slug = (new URLSearchParams(location.search).get('site') || '').toLowerCase().replace(/[^a-z0-9.-]/g, '');
const out = document.getElementById('out'), h1 = document.getElementById('title');
if (!slug) { const idx = await get('/rivals/index.json'); out.innerHTML = rivalListHtml(idx, esc); }
else {
  const [r, h] = await Promise.all([get('/rivals/' + slug + '.json'), get('/history/' + slug + '.json')]);
  out.innerHTML = r ? rivalPageHtml(r, h, esc) : '<p>No rival named ' + esc(slug) + ' on the tower. <a href="/rival/">Every rival</a></p>';
  if (r) h1.textContent = rivalTitle(r);
  if (r) document.title = r.site + ': its history, its features and what Verse still lacks';
}

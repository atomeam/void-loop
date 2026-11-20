// Every rival, and one rival's page (its cited history, every feature its study found, what Verse still lacks), inside Versus for the owner (it used to be
// /rival/). /versus/?view=rival lists them; /versus/?view=rival&site=<slug> opens one. The feature files (/rivals/*.json) answer only the owner key
// or an owner session (functions/rivals/[[path]].js), so the token goes with each read.
import { rivalPageHtml, rivalListHtml, rivalTitle } from '/lib/rival-page.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const CSS = `<style>
  .rv h1{font-size:26px;margin:8px 0 4px}.rv h2{font-size:16px;margin:22px 0 6px;color:#c3c8d8}.rv .sub{color:#c3c8d8;margin:0 0 8px}
  .rv .chips{display:flex;flex-wrap:wrap;gap:6px}.rv .chips span{padding:4px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;font-size:13px}
  .rv table{width:100%;border-collapse:collapse;font-size:13px}.rv td,.rv th{text-align:left;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}.rv td.s{white-space:nowrap}
  .rv td.s[data-s=have]{color:#8fe3a8}.rv td.s[data-s=missing]{color:#ff8f8f}.rv td.s[data-s=partial],.rv td.s[data-s=unreviewed]{color:#ffd27a}.rv .ev{color:#8e94a8;font-size:12px;overflow-wrap:anywhere}
  .rv ul{padding-left:20px}.rv #pick a{display:inline-flex;min-height:44px;align-items:center;margin:0 8px 8px 0}
</style>`;

export async function renderRivals(root, search, token) {
  const get = async (u, auth) => { try { const r = await fetch(u, { cache: 'no-store', headers: auth ? { authorization: 'Bearer ' + token } : {} }); return r.ok ? r.json() : null; } catch (_) { return null; } };
  const slug = (new URLSearchParams(search).get('site') || '').toLowerCase().replace(/[^a-z0-9.-]/g, '');
  root.innerHTML = CSS + '<div class="rv"><p class="sub"><a href="/versus/">Versus</a></p><h1 id="title">Every rival on the tower</h1><div id="out"><p class="sub">Reading the rival\'s page…</p></div></div>'; // void-review: ok (fixed markup)
  const out = root.querySelector('#out'), h1 = root.querySelector('#title');
  if (!slug) { out.innerHTML = rivalListHtml(await get('/rivals/index.json', true), esc); return; } // void-review: ok (rivalListHtml runs every value through esc)
  const [r, h] = await Promise.all([get('/rivals/' + slug + '.json', true), get('/history/' + slug + '.json')]);
  out.innerHTML = r ? rivalPageHtml(r, h, esc) : '<p>No rival named ' + esc(slug) + ' on the tower. <a href="/versus/?view=rival">Every rival</a></p>'; // void-review: ok (esc on every value)
  if (r) { h1.textContent = rivalTitle(r); document.title = r.site + ': its history, its features and what Verse still lacks'; }
}

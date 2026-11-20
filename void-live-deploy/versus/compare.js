// The side-by-side view inside Versus (owner only; it used to be its own page at /compare/): Verse's page for a floor beside the site it is measured
// against, with where each aspect stands. /versus/?view=compare&floor=<id>. Only /versus/ loads this file, and only once the owner gate has answered.
import { FLOORS, tower, noShotOf } from '/lib/tower.js';
import { matchupHtml } from '/versus/card.js';

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `<style>
  main#elv-root:has(.cmp){max-width:none;padding:0}
  .cmp{display:flex;flex-direction:column;min-height:calc(100vh - 8px)}
  .cmp-head{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;min-height:48px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgb(5 5 5 / .9)}
  .cmp-head a{color:rgb(158 178 255);min-height:44px;display:inline-flex;align-items:center}.cmp-head .st{color:#c3c8d8}.cmp-head .st b{color:#7ddeaf}.cmp-head .st i{color:#ffd27a;font-style:normal}
  .cmp-grid{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:70vh}
  .cmp #vs{border-bottom:1px solid rgba(255,255,255,.08);background:#0b0c12;padding:0 16px 8px;max-height:46vh;overflow:auto}.cmp #vs summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#8e94a8}.cmp #vs .tw{max-width:560px}
  .cmp h2 .av-face,.cmp h2 .av-verse{width:26px;height:26px;vertical-align:middle;margin-right:6px}
  .cmp section{display:flex;flex-direction:column;min-width:0}.cmp section h2{margin:0;padding:8px 16px;min-height:44px;box-sizing:border-box;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8e94a8;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;gap:8px}
  .cmp iframe{flex:1;border:0;width:100%;background:#0b0c12}
  .cmp.no-floor .cmp-grid{display:none}
  .cmp #pick{padding:16px 16px 48px;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start}.cmp #pick p{flex-basis:100%;margin:0 0 8px;color:#c3c8d8}
  .cmp #pick a{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#f2f4fb;text-decoration:none}
  .cmp .shot{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;text-align:center}.cmp .shot img{width:min(100%,390px);border:1px solid rgba(255,255,255,.10);border-radius:12px}
  .cmp .cap{margin:0;font-size:13px;color:#8e94a8;max-width:42ch}
  @media (max-width:700px){.cmp-grid{grid-template-columns:1fr;grid-template-rows:1fr 1fr}.cmp-head{font-size:15px}}
</style>`;

export function renderCompare(root, search) {
  root.innerHTML = CSS + '<div class="cmp"><div class="cmp-head"><a href="/versus/">Versus</a> · <span id="who">Side by side</span> <span class="st" id="st"></span></div>'
    + '<details id="vs" hidden><summary id="vsum">The matchup</summary><div id="vsin"></div></details>'
    + '<h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Side by side: Verse and the site it is up against</h1>'
    + '<div class="cmp-grid"><section><h2><span id="vn">Verse</span><a id="vo" href="/" target="_blank" rel="noopener">open</a></h2><iframe id="vf" title="Verse\'s page" src="about:blank"></iframe></section>'
    + '<section><h2><span id="sn">The site</span><a id="so" href="#" target="_blank" rel="noopener noreferrer">open it ↗</a></h2>'
    + '<div class="shot" id="shot"><img id="si" alt="" hidden><p class="cap" id="cap"></p><button type="button" id="beside">Open the site itself in a window beside this one</button></div></section></div></div>'; // void-review: ok (fixed markup, no value is placed in it)
  const cmp = root.querySelector('.cmp'), $ = (i) => root.querySelector('#' + i);
  const id = (new URLSearchParams(search).get('floor') || '').toLowerCase(), f = FLOORS.find((x) => x.id === id || x.aka === id) || null;
  if (!f) {
    const first = FLOORS[0] && FLOORS[0].id;
    $('who').textContent = 'Side by side: say which floor, /versus/?view=compare&floor=' + (first ? encodeURIComponent(first) : '');
    cmp.classList.add('no-floor');
    const pick = document.createElement('nav');
    pick.id = 'pick'; pick.setAttribute('aria-label', 'Floors');
    const shown = FLOORS.filter((x) => x && x.page).slice(0, 24);
    pick.innerHTML = '<p>Pick a floor. Each one opens Verse beside the site it is measured against.</p>'
      + shown.map((x) => '<a href="/versus/?view=compare&floor=' + encodeURIComponent(x.id) + '">' + esc(x.site) + '</a>').join(''); // void-review: ok (esc on every value)
    cmp.append(pick);
    return;
  }
  const vp = f.page || ('/?q=' + encodeURIComponent(f.ask || '')), site = f.url;
  document.title = 'Side by side: Verse and ' + f.site; $('who').textContent = 'Verse and ' + f.site + ', side by side';
  $('vo').href = vp; $('vf').src = vp; $('sn').textContent = f.site; $('so').href = site;
  // the two avatars over the panes: Verse's mark and the site's icon (its kept icon replaces the favicon below when the gate has one)
  $('vn').innerHTML = '<img src="/verse-logo.webp" alt="" width="26" height="26" style="width:26px;height:26px;border-radius:50%;vertical-align:middle"> Verse';
  $('sn').innerHTML = '<img src="https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(f.site) + '" alt="" width="26" height="26" referrerpolicy="no-referrer" style="width:26px;height:26px;border-radius:50%;object-fit:contain;background:#fff;padding:2px;box-sizing:border-box;vertical-align:middle"> ' + esc(f.site); // void-review: ok (esc on the site)
  // sites refuse to be framed, so the site is shown as the tower gate saw it: its screenshot at phone width from the last measurement (tower.shots/<id>.jpg), dated;
  // the site itself opens in a window beside this one. A noShot floor (the image boards) is never pictured: its front page can carry explicit or illegal pictures
  const slug = f.id.replace(/\W+/g, '-'), img = $('si'), noShot = noShotOf(f);
  if (noShot) { $('cap').textContent = 'No picture kept for this kind of site: a board\u2019s front page can carry anything its posters put there. Open it beside this one if you choose to.'; } else { img.src = '/tower.shots/' + slug + '.jpg'; }
  img.alt = f.site + ' as the gate saw it';
  img.onload = () => { img.hidden = false; fetch(img.src, { method: 'HEAD' }).then((r) => { const d = r.headers.get('last-modified'); $('cap').textContent = f.site + ' as the gate saw it' + (d ? ' on ' + new Date(d).toLocaleDateString() : '') + ', at phone width. It does not allow itself inside another page, so this is a picture.'; }).catch(() => { $('cap').textContent = f.site + ' as the gate saw it, at phone width.'; }); };
  img.onerror = () => { img.hidden = true; $('cap').textContent = 'No picture of ' + f.site + ' yet: the gate takes one at its next measurement. It does not allow itself inside another page.'; };
  $('beside').onclick = () => { const w = Math.floor(screen.availWidth / 2), h = screen.availHeight; try { window.resizeTo(w, h); window.moveTo(0, 0); } catch (_) {} window.open(site, 'verse-compare', 'noopener,noreferrer,width=' + w + ',height=' + h + ',left=' + w + ',top=0'); };
  // where each aspect stands, from the gate's last verdicts, and the matchup (versus/card.js matchupHtml, the same as the Versus card)
  fetch('/tower.evidence.json').then((r) => r.json()).then((e) => {
    const t = tower([], e.floors || e, null, e.icons || null), fl = t.floors.find((x) => x.id === f.id); if (!fl) return;
    if (fl.icon && /^tower\.icons\/[\w.-]+$/.test(fl.icon)) $('sn').innerHTML = '<img src="/' + fl.icon + '" alt="" width="26" height="26" style="width:26px;height:26px;border-radius:50%;object-fit:contain;background:#fff;padding:2px;box-sizing:border-box;vertical-align:middle"> ' + esc(f.site);
    $('st').innerHTML = (fl.beaten ? '<b>every aspect matched</b>' : '<i>' + fl.n + ' of ' + fl.m + ' aspects ahead</i>') + (fl.left && fl.left.length ? ' · still to pass: ' + fl.left.map((a) => a.replace(/[<>&]/g, '')).join(', ') : ''); // void-review: ok: fl.n and fl.m are counts and each left aspect has < > & taken out
    $('vsum').textContent = 'The matchup: Verse vs ' + f.site + ' · ' + fl.n + ' of ' + fl.m + ' aspects ahead'; $('vsin').innerHTML = matchupHtml(fl, esc); $('vs').hidden = false; // void-review: ok (matchupHtml runs every value through esc)
  }).catch(() => {});
}

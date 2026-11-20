// Obituaries and lineage, for the owner, inside Versus (it used to be the public /obituaries/ page). /versus/?view=obituaries.
// It reads the Tower code (/lib/tower.js), the evidence (/tower.evidence.json), each site's cited history (/history/<slug>.json) and /parity.json,
// every one of which answers only the owner (lib/owner-gate.js). This file is owner-only too, so a visitor to /versus/ never loads it.
const CSS = `<style>
  .ob { --ink:#ecebf5; --soft:#9a9aa8; --quiet:#b9b9c8; --line:#2a2a35; --card:#12111c; --accent:#8b7bff; max-width: 760px; margin: 0 auto; }
  .ob h1 { font-size:22px; margin:6px 0 2px; }
  .ob h2 { font-size:16px; margin:0 0 8px; }
  .ob .sub { color:var(--quiet); margin:0 0 14px; font-size:14px; }
  .ob .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin:12px 0; }
  .ob .note { color:var(--quiet); font-size:13px; margin:8px 0 0; }
  .ob #tally { min-height: 19px; } .ob #list:not(:has(*)) { min-height: 100svh; } /* the tally and the memorials fill in from the ledger: hold their space so the page does not jump */
  .ob .obit { border-left:3px solid var(--accent); padding-left:12px; margin:12px 0; }
  .ob .obit h3 { margin:0 0 4px; font-size:15px; }
  .ob .obit p { margin:6px 0; color:var(--soft); font-size:14px; }
  .ob .obit a { color:#cfc6ff; }
  .ob .row { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin:8px 0; }
  .ob label { display:block; color:var(--quiet); font-size:12px; }
  .ob label span { display:block; margin-bottom:3px; }
  .ob input { font:inherit; font-size:15px; color:var(--ink); background:#191827; border:1px solid var(--line); border-radius:8px; padding:6px 9px; min-height:34px; width:16em; }
  .ob input:focus, .ob button:focus-visible, .ob a:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
  .ob .siblings { display:flex; flex-wrap:wrap; gap:0 14px; margin:10px 0 0; }
  .ob .siblings a { display:inline-block; padding:8px 4px; min-height:24px; min-width:24px; }
  .ob footer { margin-top:22px; color:var(--soft); font-size:12px; border-top:1px solid #1c1c26; padding-top:12px; }
  .ob footer a, .ob .siblings a { color:#cfc6ff; }
  .ob .badge { display:inline-block; font-size:12px; border-radius:999px; padding:2px 9px; margin:0 0 6px; border:1px solid var(--line); }
  .ob .badge.won { background:#173222; color:#b9f3cc; border-color:#2d6b45; }
  .ob .badge.wip { background:#2e2614; color:#f3dfa6; border-color:#6b5a2d; }
  .ob .meter { height:6px; background:#22212f; border-radius:3px; overflow:hidden; margin:4px 0 8px; }
  .ob .meter i { display:block; height:100%; background:var(--accent); }
  .ob .gaps { margin:4px 0 8px 18px; padding:0; color:var(--soft); font-size:13px; }
  .ob details { margin:8px 0 0; }
  .ob summary { cursor:pointer; color:#cfc6ff; font-size:14px; min-height:24px; }
  .ob .tl { list-style:none; margin:8px 0 0; padding:0 0 0 12px; border-left:2px solid var(--line); font-size:13px; color:var(--soft); }
  .ob .tl li { margin:0 0 8px; }
  .ob .tl b { color:var(--ink); font-weight:600; margin-right:6px; }
  .ob .tl .k { color:var(--quiet); font-size:11px; text-transform:uppercase; letter-spacing:.04em; margin-right:6px; }
  .ob .tl a { color:#cfc6ff; }
  .ob select { font:inherit; font-size:15px; color:var(--ink); background:#191827; border:1px solid var(--line); border-radius:8px; padding:6px 9px; min-height:34px; }
  .ob [hidden] { display:none !important; }
</style>`;

export async function renderObituaries(root) {
  const { tower } = await import('/lib/tower.js');
  const { obituaryStatus, siteSlug, hasMemorial } = await import('/lib/obituary.js');
  root.innerHTML = CSS + `<div class="ob">
  <p class="note"><a href="/versus/">Versus</a></p>
  <h1>Obituaries & Lineage</h1>
  <p class="sub">The sites Verse learns from: each one's own history with sources, what it gave the web, and the Verse page that grew from it, so you can use either.</p>
  <div class="row">
    <label><span>Search sites</span><input id="q" type="text" aria-label="Search sites" placeholder="colorzilla"></label>
    <label><span>Show</span><select id="show" aria-label="Which sites to show"><option value="">All</option><option value="beaten">Every feature matched</option><option value="in progress">In progress</option></select></label>
  </div>
  <p class="note" id="tally"></p>
  <p class="note">A site reads "every feature matched" only when the Verse page passed every aspect of the tower gate with evidence AND has every feature on the original's inventory (docs/PARITY), with nothing missing, half-built or not yet compared. Until then it is "in progress", with the match and what is still to build. Matching a site is not the same as being better than it: the original is often the better choice.</p>
  <div id="list">Reading the lineage…</div>
  <p class="note">Every site here is read from the live Tower evidence, with its own history and a link to the original.</p>
  <p class="note">A site that was only something to read, with no tool, is an entry on <a href="/echo-vault/">Echo Vault</a>.</p>
</div>`; // void-review: ok (a fixed template; every value drawn below is set with textContent)
    const $ = (id) => root.querySelector('#' + id);
    const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const REPO = 'https://github.com/atomeam/void-loop/blob/main/';
    let all = [], parity = {};
    async function draw() {
      const [inv, ev, par] = await Promise.all([get('/lap.items.json'), get('/tower.evidence.json'), get('/parity.json')]);
      const t = tower((inv && inv.onlySite) || [], (ev && ev.floors) || {}, null);
      parity = (par && par.sites) || {};
      all = (t.floors || []).filter((f) => hasMemorial(f)).map((f) => { const slug = siteSlug(f.site); return Object.assign(f, { slug, status: obituaryStatus(f, parity[slug] || null) }); });
      const won = all.filter((f) => f.status.beaten).length;
      // the honesty check reads this tally and the won badge by these words: a site is named beaten only when obituary.js says so
      $('tally').textContent = all.length + ' memorials: ' + won + ' beaten in every way, ' + (all.length - won) + ' in progress.';
      render();
    }
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const link = (href, text) => { const a = el('a', '', text); a.href = href; if (/^https?:/.test(href)) a.rel = 'noopener'; return a; };
    async function timeline(f, box) {
      const h = await get('/history/' + f.slug + '.json');
      box.textContent = '';
      if (!h || !h.events || !h.events.length) { box.appendChild(el('p', 'note', 'No history written yet.')); return; }
      const ol = el('ol', 'tl');
      for (const e of h.events) {
        const li = el('li');
        li.appendChild(el('span', 'k', e.k));
        if (e.y && !String(e.t).startsWith(String(e.y))) li.appendChild(el('b', '', String(e.y)));
        li.appendChild(document.createTextNode(e.t + ' '));
        if (e.s) { li.appendChild(document.createTextNode('(')); li.appendChild(link(e.s, 'source')); li.appendChild(document.createTextNode(')')); }
        ol.appendChild(li);
      }
      box.appendChild(ol);
      if (h.snaps && h.snaps.length) {
        const p = el('p', 'note', 'Archived copies: ');
        h.snaps.forEach(([y, u], i) => { if (i) p.appendChild(document.createTextNode(' · ')); p.appendChild(link(u, String(y))); });
        box.appendChild(p);
      }
      const doc = el('p', 'note', 'Full history with every source: '); doc.appendChild(link(REPO + 'docs/HISTORY/' + f.slug + '.md', 'docs/HISTORY/' + f.slug + '.md')); box.appendChild(doc);
    }
    function render() {
      const w = ($('q').value || '').trim().toLowerCase(), show = $('show').value;
      const list = all.filter((f) => (!show || f.status.state === show) && (!w || (f.site + ' ' + f.id + ' ' + (f.learned || '')).toLowerCase().includes(w)));
      const box = $('list');
      while (box.firstChild) box.removeChild(box.firstChild);
      if (!list.length) { box.appendChild(el('p', 'note', 'No sites match.')); return; }
      for (const f of list) {
        const s = f.status;
        const card = el('section', 'card');
        card.appendChild(el('h2', '', f.site + ' (' + f.id + ')'));
        card.appendChild(el('span', 'badge ' + (s.beaten ? 'won' : 'wip'), s.beaten ? 'Beaten in every way' : 'In progress: ' + s.pct + '% of its features matched'));
        if (!s.beaten) {
          const m = el('div', 'meter'); m.setAttribute('role', 'img'); m.setAttribute('aria-label', s.pct + '% matched'); const bar = el('i'); bar.style.width = s.pct + '%'; m.appendChild(bar); card.appendChild(m);
          card.appendChild(el('p', 'note', 'Not beaten yet: ' + s.why.join(', ') + '.'));
          if (s.gaps.length) { const ul = el('ul', 'gaps'); for (const g of s.gaps.slice(0, 8)) ul.appendChild(el('li', '', g)); if (s.gaps.length > 8) ul.appendChild(el('li', '', 'and ' + (s.gaps.length - 8) + ' more')); card.appendChild(ul); }
        }
        const obit = el('div', 'obit');
        obit.appendChild(el('p', '', 'The Legacy: ' + (f.learned || (f.site + ' serves its users, and Verse learns from how it works.'))));
        obit.appendChild(el('p', '', s.beaten
          ? 'The Verse page: ' + (f.page || '/') + ', measured on ' + f.n + ' of ' + f.m + ' aspects against the original.'
          : 'The Verse page: ' + (f.page || '/') + ', measured on ' + f.n + ' of ' + f.m + ' aspects against the original, with ' + s.pct + '% of its features so far.'));
        obit.appendChild(el('p', '', 'Our Tribute: ' + f.site + ' showed how its corner of the web can work. Visit it at ' + f.site + '.'));
        if (f.page) { const p = el('p', '', 'Lineage: ' + f.site + ' to '); p.appendChild(link(f.page, 'Verse studio')); p.appendChild(document.createTextNode('.')); obit.appendChild(p); }
        const inv = el('p', '', 'Feature inventory: '); inv.appendChild(link(REPO + 'docs/PARITY/' + f.slug + '.md', 'every feature of ' + f.site + ', compared')); obit.appendChild(inv);
        card.appendChild(obit);
        const d = el('details'); const sum = el('summary', '', 'History of ' + f.site + ((parity[f.slug] && parity[f.slug].events) ? ' (' + parity[f.slug].events + ' cited events)' : '')); d.appendChild(sum);
        const tl = el('div', '', 'Opening the timeline…'); d.appendChild(tl);
        d.addEventListener('toggle', () => { if (d.open && !d.dataset.done) { d.dataset.done = '1'; timeline(f, tl); } });
        card.appendChild(d);
        box.appendChild(card);
      }
    }
    $('q').addEventListener('input', render);
    $('show').addEventListener('change', render);
    draw();
}

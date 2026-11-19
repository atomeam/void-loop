// Every site Verse has assimilated or tried, for the owner, inside Versus (it used to be the public /assimilated/ page). /versus/?view=assimilated.
// The list is /assimilated.json (written by tools/assimilated.mjs after every Versus run), which answers only the owner (lib/owner-gate.js), so this
// file is owner-only too and a visitor to /versus/ never loads it. Nothing here is typed by hand.
const CSS = `<style>
  .as h1 { font-size: 22px; margin: 0 0 4px; }
  .as a { color: #c9b8ff; }
  .as .lead, .as .note { color: #a3a0b3; font-size: 13px; }
  .as .bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
  .as input, .as select { font: inherit; color: inherit; background: transparent; border: 1px solid #2c2938; border-radius: 8px; padding: 8px 10px; min-height: 40px; max-width: 100%; }
  .as table { width: 100%; border-collapse: collapse; }
  .as th, .as td { text-align: left; vertical-align: top; padding: 8px 6px; border-bottom: 1px solid #2c2938; overflow-wrap: anywhere; }
  .as th { font-size: 12px; color: #a3a0b3; font-weight: 600; }
  .as .st { white-space: nowrap; font-weight: 600; }
  .as .st.surpassed { color: #64d19f; } .as .st.passed { color: #8fd0ff; } .as .st.assimilated { color: #a58bff; } .as .st.tried { color: #a3a0b3; }
  .as td small { display: block; color: #a3a0b3; } .as td a { padding-inline: 3px; } /* a short path such as /g/ is still 24 px wide to tap */
  .as #rows td.wait { height: 100svh; vertical-align: top; } /* the one "Reading the list…" row holds the space the list takes, so nothing below it jumps */
  /* a phone: each row is a stacked card. The table, its body and the status text must give up their table and no-wrap sizing too: a nowrap status such as
     "measured ahead, still being checked" is wider than the card's column and stretched the whole table past the window (the sideways scroll the phone check found) */
  @media (max-width: 640px) { .as table, .as tbody { display: block; } .as thead { display: none; } .as tr { display: block; border-bottom: 1px solid #2c2938; padding: 6px 0; } .as td { display: block; border: 0; padding: 2px 4px; } .as .st { white-space: normal; } }
</style>`;

export function renderAssimilated(root) {
  root.innerHTML = CSS + `<div class="as">
  <p class="note"><a href="/versus/">Versus</a> · <a href="/assimilated.json">The list as JSON</a> · <a href="/versus/?view=compare">Side by side</a></p>
  <h1>Assimilated</h1>
  <p class="lead" id="lead">Reading the list…</p>
  <div class="bar">
    <input id="find" type="search" placeholder="Find a site, page or family" aria-label="Find a site, page or family">
    <select id="show" aria-label="Show">
      <option value="">Every site</option>
      <option value="surpassed">Every aspect matched</option><option value="passed">Measured ahead (still being checked)</option>
      <option value="assimilated">Assimilated</option>
      <option value="tried">Tried, not taken</option>
    </select>
  </div>
  <table>
    <thead><tr><th>When</th><th>Site</th><th>What came of it</th><th>Verse page</th><th>Ease when picked</th><th>Recorded in</th></tr></thead>
    <tbody id="rows"><tr><td colspan="6" class="wait">Reading the list…</td></tr></tbody>
  </table>
  <p class="note" id="foot"></p>
</div>`; // void-review: ok (a fixed template; every value drawn below goes through esc)
    const $ = (id) => root.querySelector('#' + id), esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const kind = (r) => (r.outcome === 'surpassed' ? 'surpassed' : r.outcome === 'passed' ? 'passed' : /^(assimilated|built|page built)$/.test(r.outcome) ? 'assimilated' : 'tried');
    const day = (at) => (at ? String(at).slice(0, 10) : '');
    // plain words for the rows (house rule: Verse never brags); the data's outcome stays
    const said = (s) => ({ surpassed: 'every aspect matched', 'passed, conquering in background': 'measured ahead, still being checked' })[s] || s;
    const safePage = (p) => (/^\/[\w\-./?=&%]*$/.test(p || '') ? p : '');
    let data = null;
    function draw() {
      if (!data) return;
      const q = $('find').value.trim().toLowerCase(), show = $('show').value;
      const rows = data.sites.filter((r) => (!show || kind(r) === show) && (!q || [r.site, r.page, r.lane, r.status, said(r.status), r.why, r.took].join(' ').toLowerCase().includes(q)));
      $('rows').innerHTML = rows.map((r) => {
        const page = safePage(r.page), first = r.first, k = kind(r);
        const rec = (first ? '<a href="' + esc(data.repo + '/commit/' + first.sha) + '">' + esc(first.sha) + '</a><small>first named ' + esc(day(first.at)) + ' in ' + esc(first.file.split('/').pop()) + '</small>' : '')
          + r.sources.map((s) => '<small><a href="' + esc(data.repo + '/blob/main/' + s) + '">' + esc(s.split('/').pop()) + '</a></small>').join('');
        return '<tr><td>' + esc(day(r.at)) + '</td><td><a href="' + esc(r.url) + '" rel="nofollow noopener" target="_blank">' + esc(r.site) + '</a>' + (r.lane ? '<small>' + esc(r.lane) + '</small>' : '') + '</td>'
          + '<td><span class="st ' + k + '">' + esc(said(r.status)) + '</span>' + (r.why ? '<small>' + esc(r.why) + '</small>' : '') + (r.took ? '<small>took: ' + esc(r.took) + '</small>' : '') + (r.learned ? '<small>learned: ' + esc(r.learned) + '</small>' : '') + (r.crawl ? '<small>crawled ' + esc(r.crawl.pages) + ' pages (' + esc(r.crawl.templates) + ' kinds of page, ' + esc(r.crawl.features) + ' features)' + (r.crawl.missing.length ? '; missing ' + esc(r.crawl.missing.length) + ': ' + esc(r.crawl.missing.slice(0, 6).join(', ')) + (r.crawl.missing.length > 6 ? '…' : '') : '; Verse has every feature found') + '</small>' : '') + '</td>'
          + '<td>' + (page ? '<a href="' + esc(page) + '">' + esc(page.split('?')[0]) + '</a>' : '') + '</td>'
          + '<td>' + (r.ease ? esc(r.ease.score) + (r.ease.place ? ' (pick ' + esc(r.ease.place) + ')' : '') + '<small>' + esc(r.ease.why) + '</small>' : '<small>' + (r.sources.includes('domains/tower-self.json') ? 'not recorded then' : '') + '</small>') + '</td>'
          + '<td>' + rec + '</td></tr>';
      }).join('') || '<tr><td colspan="6">No site matches.</td></tr>';
      const c = data.counts; $('lead').textContent = c.sites + ' sites: ' + c.surpassed + ' matched on every aspect, ' + (c.passed || 0) + ' measured ahead (still being checked), ' + c.assimilated + ' assimilated into a Verse page, ' + c.tried + ' tried and not taken. Newest first, written by Versus after every run.' + (data.target ? ' Now assimilating: ' + data.target.site + (data.target.page ? ' into ' + data.target.page : '') + (data.target.score ? ', ' + data.target.score.n + ' of ' + data.target.score.m : '') + ' (the same target as the Versus card).' : '');
    }
    async function load() {
      try { const r = await fetch('/assimilated.json', { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); data = await r.json(); $('foot').textContent = data.note; draw(); }
      catch (e) { $('rows').innerHTML = '<tr><td colspan="6">The list could not be read (' + esc(e.message) + ').</td></tr>'; }
    }
    $('find').addEventListener('input', draw); $('show').addEventListener('change', draw);
    load();
}

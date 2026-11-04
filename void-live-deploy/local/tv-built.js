// /local/'s "Built from what Verse watched": each feature Verse built from a TV or radio broadcast, from /tv-built.json (tools/watch-build.mjs
// assemble, at every deploy, from domains/tv-built/). The lineage reads broadcast -> page -> pull request. Hidden when there is nothing yet.
const REPO = 'https://github.com/atomeam/void-loop/pull/';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = (d) => { const t = Date.parse(d + 'T12:00:00Z'); return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : esc(d); };

export function rowOf(b) {
  const s = b.source || {}, from = [s.station, s.network && '(' + s.network + ')', s.show && '· ' + s.show].filter(Boolean).join(' ');
  return '<li class="tvb"><b><a href="' + esc(b.mode || b.feature) + '">' + esc(b.topic) + '</a></b>' +
    '<small class="hint" style="display:block">Heard on ' + esc(s.medium === 'radio' ? 'radio' : 'TV') + ': ' + esc(from) + ', ' + day(s.day) + (s.note ? ' — “' + esc(s.note) + '”' : '') + '</small>' +
    '<small class="hint" style="display:block">' + (b.action === 'improve' ? 'Improved ' : 'Built ') + '<a href="' + esc(b.feature) + '">' + esc(b.feature) + '</a>' +
    (b.pr ? ' in <a href="' + REPO + Number(b.pr) + '" rel="noopener">#' + Number(b.pr) + '</a>' : '') +
    (b.product && b.product.url ? ' · earns through <a href="' + esc(b.product.url) + '" target="_blank" rel="noopener">' + esc(b.product.name) + '</a>' : '') + '</small></li>';
}

(async () => {
  const box = document.getElementById('tv-built'), list = document.getElementById('tv-built-list');
  if (!box || !list) return;
  try {
    const r = await fetch('/tv-built.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const j = await r.json(), builds = Array.isArray(j.builds) ? j.builds : [];
    if (!builds.length) return;
    list.innerHTML = builds.slice(0, 20).map(rowOf).join('');
    box.hidden = false;
    if (location.hash === '#tv-built') box.scrollIntoView();
  } catch (_) { /* no log yet: the section stays hidden */ }
})();

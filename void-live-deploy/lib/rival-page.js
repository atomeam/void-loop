// The rival's own page (docs/TOWER-RULES.md rule 8), /rival/?site=<slug>: the site's cited history (void-live-deploy/history/<slug>.json, never
// an unknown or a guess), every feature its study found (rivals/<slug>.json from docs/PARITY) and what Verse still lacks against it, with the
// evidence on both sides, and the Verse page that takes it on. Sites in plain text, no logos, no Verse dates. Pure.
const STATUS_WORD = { have: 'Verse has it', partial: 'partly', missing: 'Verse lacks it', unreviewed: 'not compared yet' };
/** the cited facts of a history file: the unknowns are left out. Pure. */
export const historyRows = (h) => ((h && h.events) || []).filter((e) => e && !e.u && e.t && !/unknown \(no source found yet\)/i.test(e.t)).map((e) => ({ text: String(e.t), source: /^https:\/\//.test(String(e.s || '')) ? String(e.s) : '' }));
/** the page's one heading (the page's own h1 carries it): the rival's name, or the list's title. Pure. */
export const rivalTitle = (r) => (r && r.site ? String(r.site) : 'Every rival on the tower');
export function rivalPageHtml(r, h, esc) {
  const hist = historyRows(h), m = r.match || {}, link = (u, t) => '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(t) + '</a>';
  return '<div class="chips"><span>' + esc((m.pct || 0) + '% of its features in Verse') + '</span><span>' + esc(m.have + ' have · ' + m.partial + ' partly · ' + m.missing + ' missing · ' + m.unreviewed + ' not compared') + '</span>' + (r.url ? '<span>' + link(r.url, 'visit ' + r.site) + '</span>' : '') + '</div>'
    + (r.verse && r.verse.length ? '<p class="sub">Verse takes it on with ' + r.verse.map((v) => '<a href="' + esc(v.page) + '">' + esc(v.base) + '</a>').join(', ') + '.</p>' : '<p class="sub">Verse has no page for it yet.</p>')
    + '<h2>Its history</h2>' + (hist.length ? '<ul>' + hist.map((x) => '<li>' + esc(x.text) + (x.source ? ' (' + link(x.source, 'source') + ')' : '') + '</li>').join('') + '</ul>' : '<p class="sub">No cited history found yet; nothing is guessed.</p>')
    + '<h2>What Verse still lacks</h2>' + ((r.lacks || []).length ? '<ul>' + r.lacks.map((x) => '<li>' + esc(x.feature) + ' (' + esc(STATUS_WORD[x.status] || x.status) + ')</li>').join('') + '</ul>' : '<p class="sub">Nothing in its feature study is missing.</p>')
    + '<h2>Every feature, with evidence</h2><table><thead><tr><th>Feature</th><th>Verse</th><th>Evidence</th></tr></thead><tbody>'
    + (r.features || []).map((x) => '<tr><td>' + esc(x.feature) + '<div class="ev">' + esc(x.area) + '</div></td><td class="s" data-s="' + esc(x.status) + '">' + esc(STATUS_WORD[x.status] || x.status) + '</td><td class="ev">' + esc(r.site + ': ' + x.original) + '<br>Verse: ' + esc(x.verse) + '</td></tr>').join('') + '</tbody></table>';
}
/** every rival, grouped by the Verse page that takes them on. Pure. */
export function rivalListHtml(idx, esc) {
  const pages = (idx && idx.pages) || {}, rivals = (idx && idx.rivals) || {};
  return '<p class="sub">Grouped by the Verse page that takes them on; a page covering several rivals carries every feature any of them has.</p>'
    + Object.keys(pages).sort().map((p) => '<h2><a href="' + esc(p) + '">' + esc(p) + '</a> · ' + pages[p].union.length + ' features across ' + pages[p].rivals.length + ' rival' + (pages[p].rivals.length === 1 ? '' : 's') + '</h2><div id="pick">' + pages[p].rivals.map((s) => '<a href="/rival/?site=' + esc(encodeURIComponent(s)) + '">' + esc((rivals[s] || {}).site || s) + '</a>').join('') + '</div>').join('');
}

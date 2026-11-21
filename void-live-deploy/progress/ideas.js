// The idea board (tools/idea-engine.mjs, daily): the owner's view of today's ideas, the picks sent to the will, how shipped ideas are
// doing, the older idea systems with their verdicts, and the cost. /tower.ideas.json is owner-only (lib/owner-gate.js): a visitor gets a
// 404 and the section stays hidden.
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  fetch('/tower.ideas.json', { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (b) {
    var box = document.getElementById('ideas'); if (!b || !box) return;
    var inv = b.inventory || {}, counts = Object.keys(inv.counts || {}).map(function (k) { return inv.counts[k] + ' ' + k; }).join(', ');
    var hist = b.history || {}, built = Object.keys(hist).filter(function (k) { return hist[k].status !== 'picked'; });
    var cost = b.cost || {}, cents = (b.costLog || []).reduce(function (t, r) { return t + (+r.cents || 0); }, 0);
    var h = '<p class="note">' + esc(b.day) + ': checked ' + esc(inv.total) + ' things Verse already has (' + esc(counts) + '), made ' + esc(b.generated) + ' ideas, ' + esc((b.top || []).length) + ' reached the final. Cost today ' + esc(cost.cents || 0) + '¢, last 30 days ' + esc(cents) + '¢' + (cost.model ? ' (' + esc(cost.model) + ')' : '') + '.</p>';
    h += '<table><thead><tr><th>Idea</th><th>Score</th><th>From</th></tr></thead><tbody>';
    (b.top || []).slice(0, 10).forEach(function (c) {
      var picked = (b.picks || []).some(function (p) { return p.slug === c.slug; });
      h += '<tr><td>' + (picked ? '<strong>Picked:</strong> ' : '') + esc(c.pitch || c.title) + '</td><td class="num">' + esc(c.total) + '</td><td>' + esc(c.gen) + '</td></tr>';
    });
    h += '</tbody></table>';
    if (built.length) h += '<p class="note">Shipped ideas: ' + built.map(function (k) { var x = hist[k]; return esc(x.title || k) + ' (' + esc(x.status) + (x.usedDays != null ? ', used ' + esc(x.usedDays) + ' days' : '') + ')'; }).join('; ') + '</p>';
    if ((b.tricks || []).length) h += '<p class="note">Trick ideas: ' + b.tricks.map(function (t) { return '"' + esc(t.trigger) + '": ' + esc(t.does); }).join('; ') + '</p>';
    h += '<details><summary>The older idea systems and what happened to each</summary><ul class="fails">' + (b.engines || []).map(function (e) { return '<li><strong>' + esc(e.id) + '</strong>: ' + esc(e.verdict) + '</li>'; }).join('') + '</ul></details>';
    box.querySelector('div').innerHTML = h; box.hidden = false;
  }).catch(function () {});
})();

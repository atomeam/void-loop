// /treasury/: Verse's money in public, read from /api/treasury (the ledger and the policy) and /treasury/found.json (found money).
(() => {
  const $ = (id) => document.getElementById(id);
  const usd = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(c || 0) / 100).toFixed(2);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
  const pct = (x) => Math.round((x || 0) * 100) + '%';
  const tag = (s) => '<span class="tag' + (/ready/.test(s) ? ' ready' : /Verse does|executed|paid/.test(s) ? ' auto' : '') + '">' + esc(s) + '</span>';
  const safeUrl = (u) => (/^https:\/\//.test(String(u || '')) ? String(u) : '#');

  fetch('/api/treasury').then((r) => r.json()).then((t) => {
    if (t.error) throw new Error(t.error);
    const rv = t.revenue || {}, names = ((t.policy || {}).buckets || {}).names || {};
    $('when').textContent = 'As of ' + new Date(t.as_of).toLocaleString() + '. Source: ' + t.source.only + '; Gumroad API ' + t.source.gumroad_api + '.';
    $('balance').textContent = usd(t.balance_cents);
    $('balance-note').innerHTML = esc(rv.sales + ' sale' + (rv.sales === 1 ? '' : 's') + ', ' + usd(rv.gross_cents) + ' gross, ' + usd(rv.fee_cents) + ' Gumroad fees, ' + usd(rv.refunded_cents) + ' refunded: ' + usd(rv.realized_cents) + ' realized.') + (rv.sales ? '' : ' No sales yet, so there is nothing to split or spend.') + ' <a href="' + esc(t.source.fee_source) + '">Gumroad\'s fees</a>.';
    const u = rv.usdc || {}, w = t.wallet || {};
    if (u.cents) $('balance-note').insertAdjacentHTML('beforeend', ' ' + esc(usd(rv.gumroad_cents) + ' from Gumroad and ' + usd(u.cents) + ' in USDC (' + u.x402_payments + ' paid call' + (u.x402_payments === 1 ? '' : 's') + ', ' + u.store_usdc_orders + ' store order' + (u.store_usdc_orders === 1 ? '' : 's') + ').'));
    $('wallet').innerHTML = w.address
      ? '<div class="grid"><div class="card"><b>' + (w.balance_cents == null ? 'not read' : usd(w.balance_cents)) + '</b><span>USDC on Base, read from the chain now</span></div>'
        + '<div class="card"><b>' + esc(u.x402_payments || 0) + '</b><span>paid calls confirmed on chain' + (u.x402_waiting ? ' · ' + esc(u.x402_waiting) + ' waiting for confirmations' : '') + '</span></div>'
        + '<div class="card"><b>' + usd(u.x402_cents || 0) + '</b><span>received from agents</span></div></div>'
        + '<p class="note">' + esc(w.note) + ': <a href="' + esc(safeUrl(w.explorer)) + '" rel="noopener"><code>' + esc(w.address) + '</code></a></p>'
        + (Array.isArray(w.services) && w.services.length ? '<p class="note">What agents can pay for, each call ' + esc(w.services[0].price_usdc) + ' USDC, charged only when the work is done (<a href="/api/x402">catalog</a>):</p><ul class="sells">'
          + w.services.map((s) => { const b = (u.by_service || {})[s.id] || { calls: 0, cents: 0 }; return '<li><code>' + esc(s.path) + '</code> ' + esc(s.description) + ' <b>' + esc(b.calls) + ' paid call' + (b.calls === 1 ? '' : 's') + ', ' + usd(b.cents) + '</b></li>'; }).join('') + '</ul>' : '')
      : '<p class="note">' + esc(w.note || 'No wallet yet.') + '</p>';
    const pots = [['owner', "Atom's cut"], ['reserve', 'Reserve'], ...['infrastructure', 'tools', 'growth', 'bounties'].map((k) => [k, names[k] || k])];
    $('pots').innerHTML = pots.map(([k, n]) => '<div class="card"><b>' + usd(t.pots[k]) + '</b><span>' + esc(n) + (t.weights[k] != null ? ' · ' + pct(t.weights[k]) + ' of reinvestment' : '') + '</span></div>').join('');
    const p = t.policy;
    $('policy').innerHTML = '<p><b>Atom\'s cut: ' + pct(p.owner_cut.share) + ' of every realized dollar, paid first.</b></p><p class="why">' + esc(p.owner_cut.why) + '</p>'
      + '<p><b>Reserve: ' + pct(p.reserve.share) + ' of what is left, until it holds ' + usd(p.reserve.target_cents) + '; then ' + pct(p.reserve.share_after_target) + '.</b></p><p class="why">' + esc(p.reserve.why) + '</p>'
      + '<p><b>Reinvestment, by expected return:</b> ' + Object.entries(t.weights).map(([k, w]) => esc(names[k] || k) + ' ' + pct(w)).join(', ') + '.</p><p class="why">' + esc(p.buckets.why) + '</p>'
      + '<p class="why"><b>Spending.</b> ' + esc(p.spending.rule) + '</p><p class="why"><b>Review.</b> ' + esc(p.review.why) + '</p>'
      + '<details><summary>Policy history (version ' + esc(p.version) + ', decided by ' + esc(p.decided_by) + ')</summary><ul>' + p.history.map((h) => '<li>' + esc(h.at) + ': ' + esc(h.change) + ' <span class="note">' + esc(h.why) + '</span></li>').join('') + '</ul></details>';
    $('entries').innerHTML = t.entries.length ? t.entries.slice().reverse().map((e) => '<tr><td class="num">' + day(e.at) + '</td><td>' + esc(names[e.bucket] || (e.bucket === 'owner' ? "Atom's cut" : e.bucket)) + '</td><td class="num">' + (e.kind === 'spend' || e.kind === 'paid' ? '-' : '') + usd(e.cents) + '</td><td>' + esc(e.purpose) + (e.needs ? '<div class="note">Needs: ' + esc(e.needs) + '</div>' : '') + '</td><td>' + esc(e.expected || '') + '</td><td>' + esc(e.actual || (e.kind === 'spend' ? 'not measured yet' : '')) + '</td><td>' + tag(e.status) + '</td></tr>').join('')
      : '<tr><td colspan="7" class="note">No allocations yet. The first one happens the moment a real sale is realized.</td></tr>';
    $('reviews').innerHTML = t.reviews.length ? t.reviews.slice().reverse().slice(0, 6).map((r) => '<p><b>' + day(r.at) + '</b>: ' + esc(r.reason) + ' New weights: ' + Object.entries(r.weights).map(([k, w]) => esc(names[k] || k) + ' ' + pct(w)).join(', ') + '.</p>').join('')
      : '<p class="note">The first weekly review runs on Monday. With no spends measured yet, it keeps the weights on the ROI ranking and learns nothing.</p>';
  }).catch(() => { $('when').textContent = 'The ledger did not load. Try again in a minute.'; $('balance').textContent = ''; });

  fetch('/treasury/found.json').then((r) => r.json()).then((f) => {
    const groups = {};
    for (const x of f.finds) (groups[x.category] = groups[x.category] || []).push(x);
    $('found-note').insertAdjacentHTML('beforeend', ' Last scan ' + esc(new Date(f.as_of).toLocaleString()) + ': ' + f.counts.ready_to_claim + ' ready to claim, ' + f.counts.verse_does_it + ' Verse does itself, ' + f.counts.not_eligible + ' checked and not eligible' + (f.counts.not_reached ? ', ' + f.counts.not_reached + ' sources not reached' : '') + '.');
    $('found').innerHTML = Object.entries(groups).map(([cat, xs]) => '<details' + (xs.some((x) => x.value_cents) ? ' open' : '') + '><summary><b>' + esc(cat[0].toUpperCase() + cat.slice(1)) + '</b> <span class="note">(' + xs.length + ')</span></summary><table><tbody>'
      + xs.map((x) => '<tr><td><a href="' + esc(safeUrl(x.source)) + '" rel="noopener">' + esc(x.title) + '</a><div class="note">' + esc(x.fit) + '</div><div class="note">Next: ' + esc(x.next_step) + (x.needs ? ' Needs: ' + esc(x.needs) + '.' : '') + '</div></td><td class="num">' + (x.value_cents ? usd(x.value_cents) : '—') + '<div class="note">' + esc(x.value_note || '') + '</div></td><td>' + tag(x.status) + '</td></tr>').join('') + '</tbody></table></details>').join('');
  }).catch(() => { $('found').innerHTML = '<p class="note">The found-money scan has not run yet.</p>'; });
})();

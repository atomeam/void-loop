// What the earn loop measures (tools/earn.mjs, docs/playbooks/revenue.md): one count when an offer page is seen and one when its buy button is
// pressed, on a-to-mind.com only (local runs, previews and automated browsers are never counted). No cookie, nothing kept on the device: the page
// names its offer in <meta name="offer">, a buy link names its offer in data-offer-click, and the server keeps counts only (/api/tally, a closed
// list of offer ids in lib/offer-ids.js; anything else is refused).
(function () {
  try {
    if (!/(^|\.)a-to-mind\.com$/.test(location.hostname) || navigator.webdriver || !window.fetch) return;
    var send = function (of, v) {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(v || '')) return;
      fetch('/api/tally', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ of: of, v: v }) }).catch(function () {});
    };
    var m = document.querySelector('meta[name="offer"]');
    if (m) send('offer-view', m.getAttribute('content'));
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('[data-offer-click]');
      if (a) send('offer-click', a.getAttribute('data-offer-click'));
    }, true);
  } catch (_) {}
})();

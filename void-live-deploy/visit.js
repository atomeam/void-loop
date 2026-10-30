// Who visits Verse: one count per page load, no cookie, nothing kept on the device (functions/api/visit.js, lib/visits.js). Sent once the page has
// loaded, only on a-to-mind.com itself (local runs and previews are never counted). It says the page path, the host that linked here and whether
// the browser is driven by automation; the server keeps counts only.
(function () {
  try {
    if (!/(^|\.)a-to-mind\.com$/.test(location.hostname) || !navigator.sendBeacon) return;
    var go = function () {
      var r = ''; try { r = document.referrer ? new URL(document.referrer).hostname : ''; } catch (_) {}
      navigator.sendBeacon('/api/visit', JSON.stringify({ p: location.pathname, r: r, w: navigator.webdriver ? 1 : 0 }));
    };
    if (document.readyState === 'complete') setTimeout(go, 0); else addEventListener('load', function () { setTimeout(go, 0); }, { once: true });
  } catch (_) {}
})();
// No worker: 2 s after load, ask again for each script (.js is kept 4 h)
(function () {
  var w = navigator.serviceWorker; if (w && w.controller) return;
  addEventListener('load', function () { setTimeout(function () { var s = {}; performance.getEntriesByType('resource').forEach(function (e) {
    var u = new URL(e.name), p = u.pathname; if (u.origin != location.origin || !/\.m?js$/.test(p) || p == '/visit.js' || !p.indexOf('/vendor/') || s[p]) return;
    s[p] = 1; fetch(u.href, { cache: 'no-cache' }).catch(function () {}); }); }, 2000); }); // void-review: ok (offline)
})();
// Verse Brain on every page: lib/brain-everywhere.js (window.verseBrain), after load
addEventListener('load', function () { setTimeout(function () { var s = document.createElement('script'); s.type = 'module'; s.src = '/lib/brain-everywhere.js'; document.head.appendChild(s); }, 1500); });

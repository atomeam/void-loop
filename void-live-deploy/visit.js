// Every Verse page loads this file: counts the visit, keeps scripts fresh, loads Verse Brain, catches a skipped page fade.
(function () {
  var d = document, w = navigator.serviceWorker;
  // A skipped fade rejects a promise nobody is waiting on ("Transition was aborted because of invalid state") and the page throws.
  // pageswap and pagereveal hand over the transition when there is one; a skip that never does still rejects, so that one is caught too.
  var swallow = function () {}, quiet = function (t) { if (!t) return; ['finished', 'ready', 'updateCallbackDone'].forEach(function (k) { var p = t[k]; if (p && p.catch) p.catch(swallow); }); };
  addEventListener('pageswap', function (e) { quiet(e.viewTransition); });
  addEventListener('pagereveal', function (e) { quiet(e.viewTransition); });
  addEventListener('unhandledrejection', function (e) { var m = e.reason && (e.reason.message || e.reason); if (typeof m === 'string' && m.indexOf('Transition was aborted because of invalid state') === 0) e.preventDefault(); });
  var after = function (ms, f) {
    var run = function () { setTimeout(f, ms); }, loaded = function () { d.readyState == 'complete' ? run() : addEventListener('load', run, { once: true }); };
    d.prerendering ? d.addEventListener('prerenderingchange', loaded, { once: true }) : loaded();
  };
  // Who visits Verse: one count per page load (functions/api/visit.js). Only on a-to-mind.com.
  if (/(^|\.)a-to-mind\.com$/.test(location.hostname) && navigator.sendBeacon) after(0, function () {
    var r = ''; try { r = d.referrer ? new URL(d.referrer).hostname : ''; } catch (_) {}
    navigator.sendBeacon('/api/visit', JSON.stringify({ p: location.pathname, r: r, w: navigator.webdriver ? 1 : 0 }));
  });
  // No worker: 2s after load, re-fetch cached scripts (.js kept 4h). A first visit downloads each file once.
  if (!(w && w.controller)) after(2000, function () { var s = {}; performance.getEntriesByType('resource').forEach(function (e) {
    var u = new URL(e.name), p = u.pathname; if (u.origin != location.origin || !/\.m?js$/.test(p) || p == '/visit.js' || !p.indexOf('/vendor/') || s[p] || e.transferSize || !e.decodedBodySize) return;
    s[p] = 1; fetch(u.href, { cache: 'no-cache' }).catch(function () {}); }); }); // void-review: ok (offline)
  // Verse Brain on every page: lib/brain-everywhere.js (window.verseBrain), after load
  after(1500, function () { var s = d.createElement('script'); s.type = 'module'; s.src = '/lib/brain-everywhere.js'; d.head.appendChild(s); });
  // modes on the page that already covers the job (notes, photo details, weather)
  after(0, function () {
    var p = location.pathname;
    if (p.indexOf('/notes') !== 0 && p.indexOf('/photos/exif') !== 0 && p.indexOf('/weather') !== 0) return;
    var s = d.createElement('script'); s.type = 'module'; s.src = '/lib/watched-modes.js'; d.head.appendChild(s);
  });
})();

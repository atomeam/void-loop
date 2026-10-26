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

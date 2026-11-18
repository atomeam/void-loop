// Load a family's mode document when ?mode= is set. This file is a classic
// blocking script in <head> so the family page's own scripts never run and
// cannot strip the mode or bind to missing nodes. Mode files live at
// <family>/modes/<mode>.html (see FAMILY_MODE_SRC in /lib/tower-families.js).
(function () {
  if (typeof window === 'undefined' || window.__verseFamilyModeBoot) return;
  window.__verseFamilyModeBoot = true;
  let mode;
  try { mode = new URLSearchParams(location.search).get('mode'); } catch (e) { return; }
  if (!mode || !/^[a-z0-9-]+$/.test(mode)) return;
  const path = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/';
  const url = path + 'modes/' + mode + '.html';
  const xhr = new XMLHttpRequest();
  try {
    xhr.open('GET', url, false);
    xhr.send();
  } catch (e) { return; }
  if (xhr.status < 200 || xhr.status >= 300 || !xhr.responseText) return;
  // a mode page that writes its state into the address (history.replaceState(null, '', '?n=5&nat=tr')) keeps ?mode=, so a
  // reload, a copied link or a shared address reopens the same mode instead of the family's default page
  const keepMode = (fn) => function (state, title, u) {
    if (u != null) {
      try {
        const x = new URL(String(u), location.href);
        if (x.origin === location.origin && x.pathname === location.pathname && !x.searchParams.has('mode')) { const rest = x.search.replace(/^\?/, ''); x.search = '?mode=' + mode + (rest ? '&' + rest : ''); u = x.pathname + x.search + x.hash; }
      } catch (e) { /* void-review: ok (an address URL cannot read is passed on unchanged; history itself then reports it) */ }
    }
    return fn.call(history, state, title, u);
  };
  try { history.replaceState = keepMode(history.replaceState); history.pushState = keepMode(history.pushState); } catch (e) { /* void-review: ok (a browser with a read-only History keeps its own; the mode still loads) */ }
  // A blocking script's document.open() is ignored while the page is still being parsed, so the write only inserts the
  // mode document ahead of the family page's own markup, and the family page's scripts used to run as well (the scores
  // page rewrote /scores/?mode=sports&q=... to ?league=epl and dropped the search; lists run 27). The closing <plaintext>
  // turns the rest of the family page into inert hidden text, so only the mode document's scripts run.
  document.write(xhr.responseText + '<plaintext hidden style="display:none">'); // void-review: ok (same-origin static mode file; mode is [a-z0-9-]+ only; runs in head during parse; the write is what lets the mode document's own scripts run)
})();

// Load a family's mode document when ?mode= is set. This file is a classic
// blocking script in <head> so the family page's own scripts never run and
// cannot strip the mode or bind to missing nodes. Mode files live at
// <family>/modes/<mode>.html (see FAMILY_MODE_SRC in /lib/tower-families.js).
(function () {
  if (typeof window === 'undefined' || window.__verseFamilyModeBoot) return;
  window.__verseFamilyModeBoot = true;
  var mode;
  try { mode = new URLSearchParams(location.search).get('mode'); } catch (e) { return; }
  if (!mode || !/^[a-z0-9-]+$/.test(mode)) return;
  var path = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/';
  var url = path + 'modes/' + mode + '.html';
  var xhr = new XMLHttpRequest();
  try {
    xhr.open('GET', url, false);
    xhr.send();
  } catch (e) { return; }
  if (xhr.status < 200 || xhr.status >= 300 || !xhr.responseText) return;
  document.open();
  document.write(xhr.responseText);
  document.close();
})();

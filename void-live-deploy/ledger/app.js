// /ledger/'s own code, a file of its own so the page needs no inline-script hash in _headers (Cloudflare's rule budget, tools/csp-hashes.mjs)
import * as L from '/lib/ledger.js';
const $ = (id) => document.getElementById(id);

// the words the page says, in four languages; the page picks the browser's and the picker changes it
const T = {
  en: { plain: "No account and no token: your browser reads GitHub's public API, 60 requests an hour without a login (an unchanged answer, a 304, is free), and the last copy of each repo stays on this device and opens offline.", h1: 'Repo activity ledger', lead: 'Every issue and pull request of any public GitHub project in one table: search it, filter it, export it to a spreadsheet, and share the exact view with a link.', lang: 'Language', repoH: 'Repository', repo: 'Public repository: owner/name or a github.com link', load: 'Load', refresh: 'Refresh', older: 'Load older', try: 'Try an example:', issues: 'Issues', prs: 'Pull requests', q: 'Search title, number, author or label', state: 'State', author: 'Author', anyone: 'Anyone', reset: 'Clear filters', more: 'More filters (label, dates, sort, bots)', label: 'Label', anyLabel: 'Any label', from: 'Created from', to: 'Created to', sort: 'Sort', bots: 'Include bots', title: 'Title', created: 'Created', closed: 'Closed', mergedClosed: 'Merged / closed', link: 'Link', exportH: 'Export and share', csv: 'Download CSV', json: 'Download JSON', copycsv: 'Copy as CSV', copylink: 'Copy link to this view', share: 'Share', how: 'How it works, limits and keyboard shortcuts', moreRows: 'Show more rows',
    sAll: 'All', sOpen: 'Open', sClosed: 'Closed', sMerged: 'Merged', oNew: 'Newest first', oOld: 'Oldest first', oUpd: 'Recently updated', oCom: 'Most comments',
    shown: (n, m, k) => n + ' of ' + m + ' ' + k + ' shown', capIssue: (r) => 'Issues of ' + r, capPr: (r) => 'Pull requests of ' + r, none: 'Nothing matches these filters.', noData: 'Nothing loaded yet: type a repository above or try an example.',
    loading: (r, n) => 'Reading ' + r + ' from GitHub… ' + n + ' items so far', loaded: (n, r, t) => n + ' items of ' + r + ', read ' + t, saved: (t) => 'saved copy from ' + t, left: (n, t) => 'GitHub requests left this hour from your network: ' + n + (t ? ' (resets ' + t + ')' : ''), same: 'nothing changed since the last read', partial: 'only the newest items so far: Load older reads on',
    limit: (t) => "GitHub's limit of 60 requests an hour from your network is used up" + (t ? '; it resets at ' + t : '') + '. Showing the saved copy.', limitNone: (t) => "GitHub's limit of 60 requests an hour from your network is used up" + (t ? '; it resets at ' + t : '') + '. Try again then.', bad: 'That is not a repository name. Use owner/name, like atomeam/void-loop, or paste its github.com link.', missing: (r) => 'GitHub has no public repository called ' + r + ' (or it is private).', offline: 'You are offline: showing the saved copy.', offlineNone: 'You are offline and there is no saved copy of this repository on this device yet.', failed: (e) => 'GitHub did not answer (' + e + '). Showing the saved copy if there is one.',
    news: (n, t) => n + ' new since your last look (' + t + ')', copied: 'Copied.', downloaded: (f) => 'Downloaded ' + f + '.', linkCopied: 'Link copied: it opens this repo, tab and filters.', copyFail: 'Copying was blocked by the browser; the text is selected below.' },
  de: { plain: "Kein Konto und kein Token: Ihr Browser liest die öffentliche GitHub-API, 60 Anfragen pro Stunde ohne Anmeldung (eine unveränderte Antwort, ein 304, ist kostenlos), und die letzte Kopie jedes Repos bleibt auf diesem Gerät und öffnet sich offline.", h1: 'Repo-Aktivitätsprotokoll', lead: 'Alle Issues und Pull Requests eines öffentlichen GitHub-Projekts in einer Tabelle: durchsuchen, filtern, als Tabelle für die Tabellenkalkulation exportieren und die Ansicht mit einem Link teilen.', lang: 'Sprache', repoH: 'Repository', repo: 'Öffentliches Repository: besitzer/name oder ein github.com-Link', load: 'Laden', refresh: 'Aktualisieren', older: 'Ältere laden', try: 'Ein Beispiel:', issues: 'Issues', prs: 'Pull Requests', q: 'Titel, Nummer, Autor oder Label suchen', state: 'Status', author: 'Autor', anyone: 'Alle', reset: 'Filter löschen', more: 'Mehr Filter (Label, Datum, Sortierung, Bots)', label: 'Label', anyLabel: 'Jedes Label', from: 'Erstellt ab', to: 'Erstellt bis', sort: 'Sortierung', bots: 'Bots einschließen', title: 'Titel', created: 'Erstellt', closed: 'Geschlossen', mergedClosed: 'Gemergt / geschlossen', link: 'Link', exportH: 'Exportieren und teilen', csv: 'CSV herunterladen', json: 'JSON herunterladen', copycsv: 'Als CSV kopieren', copylink: 'Link zu dieser Ansicht kopieren', share: 'Teilen', how: 'So funktioniert es, Grenzen und Tastenkürzel', moreRows: 'Mehr Zeilen zeigen',
    sAll: 'Alle', sOpen: 'Offen', sClosed: 'Geschlossen', sMerged: 'Gemergt', oNew: 'Neueste zuerst', oOld: 'Älteste zuerst', oUpd: 'Zuletzt geändert', oCom: 'Meiste Kommentare',
    shown: (n, m, k) => n + ' von ' + m + ' ' + k + ' angezeigt', capIssue: (r) => 'Issues von ' + r, capPr: (r) => 'Pull Requests von ' + r, none: 'Nichts passt zu diesen Filtern.', noData: 'Noch nichts geladen: oben ein Repository eingeben oder ein Beispiel wählen.',
    loading: (r, n) => r + ' wird von GitHub gelesen … bisher ' + n + ' Einträge', loaded: (n, r, t) => n + ' Einträge von ' + r + ', gelesen ' + t, saved: (t) => 'gespeicherte Kopie von ' + t, left: (n, t) => 'GitHub-Anfragen in dieser Stunde für dein Netz übrig: ' + n + (t ? ' (neu ab ' + t + ')' : ''), same: 'seit dem letzten Lesen nichts geändert', partial: 'bisher nur die neuesten Einträge: „Ältere laden“ liest weiter',
    limit: (t) => 'Die Grenze von 60 GitHub-Anfragen pro Stunde ist für dein Netz erreicht' + (t ? '; sie wird um ' + t + ' zurückgesetzt' : '') + '. Die gespeicherte Kopie wird gezeigt.', limitNone: (t) => 'Die Grenze von 60 GitHub-Anfragen pro Stunde ist für dein Netz erreicht' + (t ? '; sie wird um ' + t + ' zurückgesetzt' : '') + '. Dann bitte noch einmal.', bad: 'Das ist kein Repository-Name. Nutze besitzer/name, etwa atomeam/void-loop, oder füge den github.com-Link ein.', missing: (r) => 'Auf GitHub gibt es kein öffentliches Repository ' + r + ' (oder es ist privat).', offline: 'Du bist offline: die gespeicherte Kopie wird gezeigt.', offlineNone: 'Du bist offline und auf diesem Gerät gibt es noch keine Kopie dieses Repositorys.', failed: (e) => 'GitHub hat nicht geantwortet (' + e + '). Die gespeicherte Kopie wird gezeigt, falls es eine gibt.',
    news: (n, t) => n + ' neu seit deinem letzten Besuch (' + t + ')', copied: 'Kopiert.', downloaded: (f) => f + ' heruntergeladen.', linkCopied: 'Link kopiert: er öffnet dieses Repository mit Tab und Filtern.', copyFail: 'Der Browser hat das Kopieren blockiert; der Text ist unten markiert.' },
  es: { plain: "Sin cuenta y sin token: tu navegador lee la API pública de GitHub, 60 peticiones por hora sin iniciar sesión (una respuesta sin cambios, un 304, es gratis), y la última copia de cada repositorio se queda en este dispositivo y se abre sin conexión.", h1: 'Registro de actividad del repositorio', lead: 'Todos los issues y pull requests de cualquier proyecto público de GitHub en una tabla: búscalos, fíltralos, expórtalos a una hoja de cálculo y comparte la vista exacta con un enlace.', lang: 'Idioma', repoH: 'Repositorio', repo: 'Repositorio público: dueño/nombre o un enlace de github.com', load: 'Cargar', refresh: 'Actualizar', older: 'Cargar anteriores', try: 'Prueba un ejemplo:', issues: 'Issues', prs: 'Pull requests', q: 'Buscar título, número, autor o etiqueta', state: 'Estado', author: 'Autor', anyone: 'Cualquiera', reset: 'Quitar filtros', more: 'Más filtros (etiqueta, fechas, orden, bots)', label: 'Etiqueta', anyLabel: 'Cualquier etiqueta', from: 'Creado desde', to: 'Creado hasta', sort: 'Orden', bots: 'Incluir bots', title: 'Título', created: 'Creado', closed: 'Cerrado', mergedClosed: 'Fusionado / cerrado', link: 'Enlace', exportH: 'Exportar y compartir', csv: 'Descargar CSV', json: 'Descargar JSON', copycsv: 'Copiar como CSV', copylink: 'Copiar enlace a esta vista', share: 'Compartir', how: 'Cómo funciona, límites y atajos de teclado', moreRows: 'Mostrar más filas',
    sAll: 'Todos', sOpen: 'Abiertos', sClosed: 'Cerrados', sMerged: 'Fusionados', oNew: 'Más nuevos', oOld: 'Más antiguos', oUpd: 'Actualizados hace poco', oCom: 'Más comentarios',
    shown: (n, m, k) => n + ' de ' + m + ' ' + k + ' mostrados', capIssue: (r) => 'Issues de ' + r, capPr: (r) => 'Pull requests de ' + r, none: 'Nada coincide con estos filtros.', noData: 'Aún no hay nada cargado: escribe un repositorio arriba o prueba un ejemplo.',
    loading: (r, n) => 'Leyendo ' + r + ' de GitHub… ' + n + ' elementos hasta ahora', loaded: (n, r, t) => n + ' elementos de ' + r + ', leídos ' + t, saved: (t) => 'copia guardada de ' + t, left: (n, t) => 'Peticiones a GitHub que le quedan a tu red esta hora: ' + n + (t ? ' (se renuevan a las ' + t + ')' : ''), same: 'nada cambió desde la última lectura', partial: 'por ahora solo los más nuevos: «Cargar anteriores» sigue leyendo',
    limit: (t) => 'Tu red agotó el límite de GitHub de 60 peticiones por hora' + (t ? '; se renueva a las ' + t : '') + '. Se muestra la copia guardada.', limitNone: (t) => 'Tu red agotó el límite de GitHub de 60 peticiones por hora' + (t ? '; se renueva a las ' + t : '') + '. Inténtalo entonces.', bad: 'Eso no es un nombre de repositorio. Usa dueño/nombre, como atomeam/void-loop, o pega su enlace de github.com.', missing: (r) => 'GitHub no tiene ningún repositorio público llamado ' + r + ' (o es privado).', offline: 'Estás sin conexión: se muestra la copia guardada.', offlineNone: 'Estás sin conexión y aún no hay copia de este repositorio en este dispositivo.', failed: (e) => 'GitHub no respondió (' + e + '). Se muestra la copia guardada si existe.',
    news: (n, t) => n + ' nuevos desde tu última visita (' + t + ')', copied: 'Copiado.', downloaded: (f) => 'Descargado ' + f + '.', linkCopied: 'Enlace copiado: abre este repositorio con la pestaña y los filtros.', copyFail: 'El navegador bloqueó la copia; el texto está seleccionado abajo.' },
  fr: { plain: "Sans compte et sans jeton : votre navigateur lit l'API publique de GitHub, 60 requêtes par heure sans connexion (une réponse inchangée, un 304, est gratuite), et la dernière copie de chaque dépôt reste sur cet appareil et s'ouvre hors ligne.", h1: "Journal d'activité du dépôt", lead: "Toutes les issues et pull requests de n'importe quel projet GitHub public dans un seul tableau : cherchez, filtrez, exportez vers un tableur et partagez la vue exacte avec un lien.", lang: 'Langue', repoH: 'Dépôt', repo: 'Dépôt public : propriétaire/nom ou un lien github.com', load: 'Charger', refresh: 'Actualiser', older: 'Charger les plus anciens', try: 'Un exemple :', issues: 'Issues', prs: 'Pull requests', q: 'Chercher un titre, un numéro, un auteur ou un label', state: 'État', author: 'Auteur', anyone: 'Tout le monde', reset: 'Effacer les filtres', more: 'Plus de filtres (label, dates, tri, bots)', label: 'Label', anyLabel: 'Tout label', from: 'Créé depuis', to: "Créé jusqu'au", sort: 'Tri', bots: 'Inclure les bots', title: 'Titre', created: 'Créé', closed: 'Fermé', mergedClosed: 'Fusionné / fermé', link: 'Lien', exportH: 'Exporter et partager', csv: 'Télécharger le CSV', json: 'Télécharger le JSON', copycsv: 'Copier en CSV', copylink: 'Copier le lien de cette vue', share: 'Partager', how: 'Fonctionnement, limites et raccourcis clavier', moreRows: 'Afficher plus de lignes',
    sAll: 'Tous', sOpen: 'Ouverts', sClosed: 'Fermés', sMerged: 'Fusionnés', oNew: "Plus récents d'abord", oOld: "Plus anciens d'abord", oUpd: 'Modifiés récemment', oCom: 'Plus commentés',
    shown: (n, m, k) => n + ' sur ' + m + ' ' + k + ' affichés', capIssue: (r) => 'Issues de ' + r, capPr: (r) => 'Pull requests de ' + r, none: 'Rien ne correspond à ces filtres.', noData: 'Rien de chargé pour le moment : saisissez un dépôt ci-dessus ou essayez un exemple.',
    loading: (r, n) => 'Lecture de ' + r + ' sur GitHub… ' + n + ' éléments pour le moment', loaded: (n, r, t) => n + ' éléments de ' + r + ', lus ' + t, saved: (t) => 'copie enregistrée de ' + t, left: (n, t) => 'Requêtes GitHub restantes cette heure pour votre réseau : ' + n + (t ? ' (remise à zéro ' + t + ')' : ''), same: 'rien de changé depuis la dernière lecture', partial: 'seulement les plus récents pour le moment : « Charger les plus anciens » continue',
    limit: (t) => 'La limite GitHub de 60 requêtes par heure est atteinte pour votre réseau' + (t ? ' ; remise à zéro à ' + t : '') + '. La copie enregistrée est affichée.', limitNone: (t) => 'La limite GitHub de 60 requêtes par heure est atteinte pour votre réseau' + (t ? ' ; remise à zéro à ' + t : '') + '. Réessayez à ce moment-là.', bad: "Ce n'est pas un nom de dépôt. Utilisez propriétaire/nom, comme atomeam/void-loop, ou collez son lien github.com.", missing: (r) => "GitHub n'a aucun dépôt public nommé " + r + ' (ou il est privé).', offline: 'Vous êtes hors ligne : la copie enregistrée est affichée.', offlineNone: "Vous êtes hors ligne et il n'y a pas encore de copie de ce dépôt sur cet appareil.", failed: (e) => "GitHub n'a pas répondu (" + e + '). La copie enregistrée est affichée s’il y en a une.',
    news: (n, t) => n + ' nouveaux depuis votre dernière visite (' + t + ')', copied: 'Copié.', downloaded: (f) => f + ' téléchargé.', linkCopied: 'Lien copié : il ouvre ce dépôt avec l’onglet et les filtres.', copyFail: 'Le navigateur a bloqué la copie ; le texte est sélectionné ci-dessous.' },
};
const pickLang = () => { const saved = (() => { try { return localStorage.getItem(L.STORE + '.lang'); } catch (_) { return null; } })(); if (saved && T[saved]) return saved; const n = String(navigator.language || 'en').slice(0, 2).toLowerCase(); return T[n] ? n : 'en'; };
let lang = pickLang(), t = T[lang];

const view = L.decodeView(location.search);
let store = (() => { try { return JSON.parse(localStorage.getItem(L.STORE) || 'null') || { v: 1, repos: {} }; } catch (_) { return { v: 1, repos: {} }; } })();
let entry = null, busy = false, shownMax = 200, rate = null, lastWarn = '';
const fmt = (iso, withTime = true) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString(lang, withTime ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' }); };
const clock = (ms) => (ms ? new Date(ms).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) : '');
const save = () => { try { localStorage.setItem(L.STORE, JSON.stringify(store)); } catch (_) { /* full: keep only this repo */ try { store = L.putCache({ v: 1, repos: {} }, entry.repo, entry); localStorage.setItem(L.STORE, JSON.stringify(store)); } catch (__) {} } };
const say = (s, warn = false) => { $('status').textContent = s; $('status').classList.toggle('warn', warn); };

function words() {
  document.documentElement.lang = lang; t = T[lang]; $('lang').value = lang;
  const set = (id, s) => { const e = $(id); if (e) e.textContent = s; };
  set('h1', t.h1); set('lead', t.lead); set('t-lang', t.lang); set('h-repo', t.repoH); set('t-repo', t.repo); set('load', t.load); set('refresh', t.refresh); set('older', t.older); set('t-try', t.try);
  $('tab-issue').firstChild.textContent = t.issues + ' '; $('tab-pr').firstChild.textContent = t.prs + ' ';
  set('plain', t.plain); set('t-q', t.q); set('t-state', t.state); set('t-author', t.author); set('reset', t.reset); set('t-more', t.more); set('t-label', t.label); set('t-from', t.from); set('t-to', t.to); set('t-sort', t.sort); set('t-bots', t.bots);
  set('th-title', t.title); set('th-author', t.author); set('th-state', t.state); set('th-created', t.created); set('th-url', t.link); set('h-export', t.exportH); set('csv', t.csv); set('json', t.json); set('copycsv', t.copycsv); set('copylink', t.copylink); set('share', t.share); set('t-how', t.how); set('moreRows', t.moreRows);
  const o = (sel, v, s) => { const x = $(sel).querySelector('option[value="' + v + '"]'); if (x) x.textContent = s; };
  o('state', 'all', t.sAll); o('state', 'open', t.sOpen); o('state', 'closed', t.sClosed); o('state', 'merged', t.sMerged);
  o('sort', 'new', t.oNew); o('sort', 'old', t.oOld); o('sort', 'updated', t.oUpd); o('sort', 'comments', t.oCom); o('author', '', t.anyone); o('label', '', t.anyLabel);
}

function readForm() {
  view.q = $('q').value; view.state = $('state').value; view.author = $('author').value; view.label = $('label').value;
  view.from = $('from').value; view.to = $('to').value; view.sort = $('sort').value; view.bots = $('bots').checked ? '1' : '0';
}
function writeForm() {
  $('repo').value = view.repo; $('q').value = view.q; $('state').value = view.state; $('sort').value = view.sort; $('from').value = view.from; $('to').value = view.to; $('bots').checked = view.bots !== '0';
  if (view.label || view.from || view.to || view.sort !== 'new' || view.bots === '0') $('more').open = true;
}
const link = () => location.origin + location.pathname + L.encodeView(view);
const remember = () => history.replaceState(null, '', location.pathname + L.encodeView(view));

function fillSelect(sel, values, keep, first) {
  const e = $(sel), want = keep || '';
  e.replaceChildren(new Option(first, ''), ...values.slice(0, 300).map((v) => new Option(v, v)));
  if (want && !values.includes(want)) e.append(new Option(want, want));
  e.value = want;
}

function render() {
  const rows = entry ? entry.rows : [], c = L.counts(rows), f = L.facets(rows.filter((r) => r.kind === view.tab));
  $('tab-issue').querySelector('.c').textContent = rows.length ? '(' + c.issue.toLocaleString(lang) + ')' : '';
  $('tab-pr').querySelector('.c').textContent = rows.length ? '(' + c.pr.toLocaleString(lang) + ')' : '';
  for (const b of $('tabs').querySelectorAll('[role=tab]')) { const on = b.dataset.tab === view.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
  $('panel').setAttribute('aria-labelledby', 'tab-' + view.tab);
  $('state').querySelector('option[value=merged]').hidden = view.tab !== 'pr';
  if (view.tab !== 'pr' && view.state === 'merged') { view.state = 'all'; $('state').value = 'all'; }
  fillSelect('author', f.authors, view.author, t.anyone); fillSelect('label', f.labels, view.label, t.anyLabel);
  $('th-done').textContent = view.tab === 'pr' ? t.mergedClosed : t.closed;
  const list = L.filterRows(rows, view), total = view.tab === 'pr' ? c.pr : c.issue, fresh = new Set(L.newSince(rows, entry && entry.seenAt).map((r) => r.number));
  $('caption').textContent = entry ? (view.tab === 'pr' ? t.capPr(entry.repo) : t.capIssue(entry.repo)) : '';
  $('count').textContent = entry ? t.shown(list.length.toLocaleString(lang), total.toLocaleString(lang), (view.tab === 'pr' ? t.prs : t.issues).toLowerCase()) : '';
  const frag = document.createDocumentFragment(), hd = [t.title, '#', t.author, t.state, t.created, view.tab === 'pr' ? t.mergedClosed : t.closed, t.link];
  for (const r of list.slice(0, shownMax)) {
    const tr = document.createElement('tr'); if (fresh.has(r.number)) tr.className = 'fresh';
    const td = (cls, h, kids) => { const d = document.createElement('td'); if (cls) d.className = cls; if (h) d.dataset.h = h; d.append(...kids); tr.append(d); return d; };
    const a = document.createElement('a'); a.href = r.url; a.textContent = r.title; a.rel = 'noopener';
    const labels = r.labels.slice(0, 6).map((l) => { const s = document.createElement('span'); s.className = 'lbl'; s.textContent = l; return s; });
    td('title', '', [a, ...(labels.length ? [document.createElement('br'), ...labels] : [])]);
    td('num', '#', ['#' + r.number]);
    td('', hd[2], [r.author + (r.bot ? ' (bot)' : '')]);
    const st = document.createElement('span'); st.className = 'st ' + r.state; st.textContent = { open: t.sOpen, closed: t.sClosed, merged: t.sMerged }[r.state].replace(/s$/, '') ; td('', hd[3], [st]);
    const ct = document.createElement('time'); ct.dateTime = r.created_at || ''; ct.textContent = fmt(r.created_at); td('when', hd[4], [ct]);
    const doneAt = r.merged_at || r.closed_at, dt = document.createElement('time'); dt.dateTime = doneAt || ''; dt.textContent = doneAt ? fmt(doneAt) : '—'; td('when', hd[5], [dt]);
    const u = document.createElement('a'); u.href = r.url; u.rel = 'noopener'; u.textContent = r.url.replace(/^https:\/\/github\.com\//, ''); u.setAttribute('aria-label', r.url); td('', hd[6], [u]);
    frag.append(tr);
  }
  $('rows').replaceChildren(frag);
  $('empty').hidden = !!list.length; $('empty').textContent = entry ? (rows.length ? t.none : t.noData) : t.noData;
  $('table').hidden = !list.length;
  $('moreRows').hidden = list.length <= shownMax;
  $('older').hidden = !(entry && entry.next);
  const n = fresh.size; $('newline').hidden = !n; if (n) $('newline').textContent = t.news(n.toLocaleString(lang), fmt(entry.seenAt));
}

function statusLine(extra) {
  if (!entry) return;
  const parts = [t.loaded(entry.rows.length.toLocaleString(lang), entry.repo, fmt(entry.fetchedAt))];
  if (entry.next) parts.push(t.partial);
  if (extra) parts.push(extra);
  if (rate && rate.remaining != null) parts.push(t.left(rate.remaining, clock(rate.reset)));
  say(parts.join(' · '));
}

// one GET with the saved ETag; a 304 is free and means the saved rows still stand
async function get(url) {
  const etags = (entry && entry.etags) || {}, h = { accept: 'application/vnd.github+json' };
  if (etags[url]) h['if-none-match'] = etags[url];
  const res = await fetch(url, { headers: h, cache: 'no-store' });
  rate = L.rateOf((k) => res.headers.get(k));
  return res;
}

async function fetchPages(repo, firstUrl, { max, since }) {
  let url = firstUrl, n = 0, got = [], changed = false, next = null;
  while (url && n < max) {
    if (rate && rate.remaining != null && rate.remaining < 1 && rate.reset > Date.now()) throw Object.assign(new Error('limit'), { limit: true });
    const res = await get(url); n++;
    if (res.status === 304) { next = null; break; }
    if (L.isRateLimited(res.status, rate)) throw Object.assign(new Error('limit'), { limit: true });
    if (res.status === 404) throw Object.assign(new Error('missing'), { missing: true });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json(); if (!Array.isArray(data)) throw new Error('not a list');
    const tag = res.headers.get('etag'); if (tag && n === 1) { entry.etags = { [url]: tag }; }
    changed = true; got = got.concat(data.map(L.rowOf)); next = L.nextLink(res.headers.get('link')); url = next;
    if (!since) say(t.loading(repo, (entry.rows.length + got.length).toLocaleString(lang)));
  }
  return { rows: got, changed, next: since ? null : next };
}

async function load(repo, { older = false } = {}) {
  if (busy) return; busy = true; $('load').disabled = $('refresh').disabled = $('older').disabled = true;
  const have = L.cached(store, repo);
  entry = have ? { ...have, etags: have.etags || {} } : { repo, rows: [], etags: {}, fetchedAt: null, next: null, seenAt: null };
  if (have) { entry.seenAt = have.viewedAt || null; render(); statusLine(t.saved(fmt(have.fetchedAt))); }
  if (!navigator.onLine) { say(have ? t.offline : t.offlineNone, !have); finish(); return; }
  try {
    let r;
    if (older && entry.next) r = await fetchPages(repo, entry.next, { max: L.FIRST_PAGES });
    else if (entry.rows.length) { const since = L.lastUpdated(entry.rows); r = await fetchPages(repo, L.listUrl(repo, { since }), { max: 20, since }); r.next = entry.next; }
    else r = await fetchPages(repo, L.listUrl(repo), { max: L.FIRST_PAGES });
    if (r.changed) entry.rows = L.mergeRows(entry.rows, r.rows);
    entry.next = r.next || null; entry.fetchedAt = new Date().toISOString();
    store = L.putCache(store, repo, entry); save();
    render(); statusLine(r.changed ? '' : t.same);
  } catch (e) {
    if (e.limit) say(have ? t.limit(clock(rate && rate.reset)) : t.limitNone(clock(rate && rate.reset)), true);
    else if (e.missing) { say(t.missing(repo), true); if (!have) entry = null; }
    else say(t.failed(e.message || String(e)), true);
    render();
  }
  finish();
}
function finish() { busy = false; $('load').disabled = $('refresh').disabled = $('older').disabled = false; }

// the last look at a repo is when its rows were last on screen: "new since your last look" counts from there, on the next visit
addEventListener('pagehide', () => { if (entry && entry.rows.length) { const e = L.cached(store, entry.repo); if (e) { e.viewedAt = new Date().toISOString(); save(); } } });

function open(text, opts) {
  const repo = L.parseRepo(text);
  view.repo = String(text || '').trim() || L.DEFAULT_REPO; remember();
  if (!repo) { say(t.bad, true); entry = null; render(); return; }
  view.repo = repo; $('repo').value = repo; remember(); shownMax = 200;
  load(repo, opts);
}

$('repoform').addEventListener('submit', (e) => { e.preventDefault(); open($('repo').value); });
$('repo').addEventListener('change', () => { view.repo = $('repo').value.trim() || L.DEFAULT_REPO; remember(); });
$('refresh').onclick = () => open($('repo').value || view.repo);
$('older').onclick = () => { const r = L.parseRepo(view.repo); if (r) load(r, { older: true }); };
$('presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) { $('repo').value = b.dataset.preset; open(b.dataset.preset); } });
const onFilter = () => { readForm(); shownMax = 200; remember(); render(); };
for (const id of ['state', 'author', 'label', 'from', 'to', 'sort', 'bots']) $(id).addEventListener('change', onFilter);
let qt = 0; $('q').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(onFilter, 120); }); $('q').addEventListener('change', onFilter);
$('reset').onclick = () => { Object.assign(view, { q: '', state: 'all', author: '', label: '', from: '', to: '', sort: 'new', bots: '1' }); writeForm(); onFilter(); };
$('moreRows').onclick = () => { shownMax += 500; render(); };
const pickTab = (tab, focus) => { view.tab = tab; view.author = ''; view.label = ''; shownMax = 200; remember(); render(); if (focus) $('tab-' + tab).focus(); };
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) pickTab(b.dataset.tab); });
$('tabs').addEventListener('keydown', (e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); pickTab(e.key === 'Home' ? 'issue' : e.key === 'End' ? 'pr' : view.tab === 'issue' ? 'pr' : 'issue', true); } });
$('lang').addEventListener('change', () => { lang = $('lang').value; try { localStorage.setItem(L.STORE + '.lang', lang); } catch (_) {} words(); render(); if (entry) statusLine(); });

// export: the rows of the view on screen, every column
const viewRows = () => L.filterRows(entry ? entry.rows : [], view);
const fileBase = () => 'ledger-' + (entry ? entry.repo.replace('/', '-') : 'repo') + '-' + (view.tab === 'pr' ? 'pull-requests' : 'issues') + '-' + new Date().toISOString().slice(0, 10);
const download = (name, type, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); $('exportsay').textContent = t.downloaded(name); };
const copy = async (text, ok) => { try { await navigator.clipboard.writeText(text); $('exportsay').textContent = ok; } catch (_) { $('exportsay').textContent = t.copyFail; const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('aria-label', t.copycsv); ta.style.cssText = 'width:100%;min-height:120px'; $('exportsay').after(ta); ta.select(); } };
$('csv').onclick = () => download(fileBase() + '.csv', 'text/csv;charset=utf-8', '\ufeff' + L.toCSV(viewRows()));
$('json').onclick = () => download(fileBase() + '.json', 'application/json', L.toJSON(viewRows(), { repo: entry && entry.repo, fetchedAt: entry && entry.fetchedAt, view: { ...view } }));
$('copycsv').onclick = () => copy(L.toCSV(viewRows()), t.copied);
$('copylink').onclick = () => copy(link(), t.linkCopied);
if (navigator.share) { $('share').hidden = false; $('share').onclick = () => navigator.share({ title: document.title, url: link() }).catch(() => {}); }

// shortcuts, never while typing in a field
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
  if (e.key === '/') { e.preventDefault(); $('q').focus(); }
  else if (e.key === 'r') { e.preventDefault(); $('refresh').click(); }
  else if (e.key === 'e') { e.preventDefault(); $('csv').click(); }
});
addEventListener('online', () => { if (entry) statusLine(); });

words(); writeForm(); render();
open(view.repo);
addEventListener('load', () => { import('/lib/toolkit.js').then((m) => m.mountRelated(document.getElementById('related'), '/ledger/', [{ label: 'Copy link to this view', run: () => $('copylink').click() }])).catch(() => {}); });

if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)

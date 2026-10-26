// /flights/trip/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["trip"],"de":{"h1":"Reiseplan und Zwischenstopps","intro":"Fügen Sie eine Buchungsbestätigung ein, und die Flüge werden daraus gelesen: Flugnummern, Flughäfen, Daten und Zeiten und der Buchungscode. Oder tragen Sie jeden Flug ein. Die Seite prüft die Wartezeit zwischen den Flügen über Zeitzonen hinweg und warnt vor knappen Anschlüssen, Wartezeiten über Nacht und Flughafenwechseln, macht eine Kalenderdatei und einen Link zum Teilen. Alles bleibt auf diesem Gerät: nichts wird hochgeladen, kein Konto."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/trip/'));

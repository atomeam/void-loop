// /flights/trip/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["trip"],"de":{"h1":"Reiseplan und Zwischenstopps","intro":"Fügen Sie eine Buchungsbestätigung ein, und die Flüge werden daraus gelesen: Flugnummern, Flughäfen, Daten und Zeiten und der Buchungscode. Oder tragen Sie jeden Flug ein. Die Seite prüft die Wartezeit zwischen den Flügen über Zeitzonen hinweg und warnt vor knappen Anschlüssen, Wartezeiten über Nacht und Flughafenwechseln, macht eine Kalenderdatei und einen Link zum Teilen. Alles bleibt auf diesem Gerät: nichts wird hochgeladen, kein Konto."}});
mountRelated(document.getElementById('related'), '/flights/trip/');

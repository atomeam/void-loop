// /flights/map/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["route"],"de":{"h1":"Großkreiskarte","intro":"Geben Sie Flughäfen in der Reihenfolge Ihres Fluges ein, wie JFK-LHR-SIN, und sehen Sie den Großkreisweg jeder Etappe auf einer Karte mit der Entfernung jeder Etappe und der Summe. Bleibt auf Ihrem Gerät: nichts wird gesendet."}});
mountRelated(document.getElementById('related'), '/flights/map/');

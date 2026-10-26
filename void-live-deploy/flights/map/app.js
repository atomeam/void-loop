// /flights/map/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["route"],"de":{"h1":"Großkreiskarte","intro":"Geben Sie Flughäfen in der Reihenfolge Ihres Fluges ein, wie JFK-LHR-SIN, und sehen Sie den Großkreisweg jeder Etappe auf einer Karte mit der Entfernung jeder Etappe und der Summe. Bleibt auf Ihrem Gerät: nichts wird gesendet."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/map/'));

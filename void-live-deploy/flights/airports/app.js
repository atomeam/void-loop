// /flights/airports/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["airports"],"de":{"h1":"Flughafencodes","intro":"Suchen Sie einen Flughafen über seinen dreistelligen IATA- oder vierstelligen ICAO-Code, oder finden Sie den Code einer Stadt, eines Flughafens oder eines Landes. Sehen Sie Lage, Zeitzone und die Uhrzeit dort, weitere Flughäfen derselben Stadt und die in der Nähe. Rund 4.000 Flughäfen mit Linienverkehr, auf Ihrem Gerät gespeichert."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/airports/'));

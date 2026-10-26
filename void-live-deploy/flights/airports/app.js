// /flights/airports/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["airports"],"de":{"h1":"Flughafencodes","intro":"Suchen Sie einen Flughafen über seinen dreistelligen IATA- oder vierstelligen ICAO-Code, oder finden Sie den Code einer Stadt, eines Flughafens oder eines Landes. Sehen Sie Lage, Zeitzone und die Uhrzeit dort, weitere Flughäfen derselben Stadt und die in der Nähe. Rund 4.000 Flughäfen mit Linienverkehr, auf Ihrem Gerät gespeichert."}});
mountRelated(document.getElementById('related'), '/flights/airports/');

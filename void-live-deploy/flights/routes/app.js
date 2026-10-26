// /flights/routes/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","routes"],"controls":["origin"],"de":{"h1":"Wohin kann ich fliegen","intro":"Wählen Sie einen Flughafen und eine Flugzeit und sehen Sie, welche Flughäfen ein Flug dieser Länge erreichen könnte, die nächsten zuerst, nach Land. Das ist Reichweite, auf Ihrem Gerät berechnet, kein Flugplan: Ob eine Fluggesellschaft eine Strecke nonstop fliegt, zeigen die Anbieter. Jedes Ergebnis öffnet die Strecke mit den Links zur Suche."}});
mountRelated(document.getElementById('related'), '/flights/routes/');

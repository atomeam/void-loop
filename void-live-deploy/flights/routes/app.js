// /flights/routes/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","routes"],"controls":["origin"],"de":{"h1":"Wohin kann ich fliegen","intro":"Wählen Sie einen Flughafen und eine Flugzeit und sehen Sie, welche Flughäfen ein Flug dieser Länge erreichen könnte, die nächsten zuerst, nach Land. Das ist Reichweite, auf Ihrem Gerät berechnet, kein Flugplan: Ob eine Fluggesellschaft eine Strecke nonstop fliegt, zeigen die Anbieter. Jedes Ergebnis öffnet die Strecke mit den Links zur Suche."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/routes/'));

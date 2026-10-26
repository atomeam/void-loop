// /flights/distance/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","facts","route"],"controls":["airports"],"de":{"h1":"Flugdistanz","intro":"Die Entfernung zwischen zwei Flughäfen in Kilometern, Meilen und Seemeilen entlang des Großkreises, mit üblicher Flugzeit, Zeitunterschied, Richtung und tatsächlich geflogener Strecke. Verketten Sie mehrere Flughäfen für eine Reise mit Zwischenstopps und sehen Sie jede Etappe und die Summe."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/distance/'));

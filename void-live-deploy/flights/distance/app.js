// /flights/distance/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","facts","route"],"controls":["airports"],"de":{"h1":"Flugdistanz","intro":"Die Entfernung zwischen zwei Flughäfen in Kilometern, Meilen und Seemeilen entlang des Großkreises, mit üblicher Flugzeit, Zeitunterschied, Richtung und tatsächlich geflogener Strecke. Verketten Sie mehrere Flughäfen für eine Reise mit Zwischenstopps und sehen Sie jede Etappe und die Summe."}});
mountRelated(document.getElementById('related'), '/flights/distance/');

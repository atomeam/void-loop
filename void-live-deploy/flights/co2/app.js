// /flights/co2/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","co2"],"controls":["airports","trip","pax","cabin"],"de":{"h1":"CO2-Rechner für Flüge","intro":"Das CO2, das ein Sitz auf einem Flug verursacht, für die Flughäfen, die Kabine, die Zahl der Passagiere und einen Rückflug, die Sie wählen. Die Methode steht unter der Zahl, mit einer Spanne und dem Wert mit Effekten in großer Höhe. Eine Schätzung aus Durchschnitten, keine Zahl einer Fluggesellschaft; auf Ihrem Gerät berechnet."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/co2/'));

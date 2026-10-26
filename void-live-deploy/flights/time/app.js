// /flights/time/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","time"],"controls":["airports","via","stay","dates","time"],"de":{"h1":"Flugzeitrechner","intro":"Wählen Sie Abflug- und Zielflughafen und wann Sie fliegen: Sie erhalten die übliche Flugzeit, die Ankunft in der Ortszeit des Ziels, den Zeitunterschied und ob die Strecke die Datumsgrenze überquert. Fügen Sie einen Zwischenstopp mit Wartezeit hinzu, um die ganze Reise zu sehen. Berechnet auf Ihrem Gerät aus Lage und Zeitzone der Flughäfen."}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/time/'));

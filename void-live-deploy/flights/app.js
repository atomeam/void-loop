// /flights/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountFlights } from '/lib/flights-ui.js';
mountFlights(document.getElementById('app'), {"panels":["controls","providers","facts","tracker","trip"],"controls":["airports","trip","dates","pax","cabin"],"de":{"h1":"Flüge","intro":"Planen Sie einen Flug: Wählen Sie Flughäfen und Daten, öffnen Sie dieselbe Suche mit einem Klick bei Google Flights, Skyscanner, Kayak, Momondo und Expedia und sehen Sie Entfernung, Flugzeit, Zeitunterschied und CO2 auf Ihrem Gerät berechnet. Behalten Sie die Preise, die Sie sehen, mit dem niedrigsten und einem Ziel, und Ihre Reise mit ihren Zwischenstopps. Verse hat keine Live-Preise: Die Preise stehen bei den Anbietern. Kein Konto, keine Werbung."}});
mountRelated(document.getElementById('related'), '/flights/');

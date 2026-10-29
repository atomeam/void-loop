// /flights/map/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the flights screen and its airport list come after the load event (the gate times the load event: only this small file stands before it), then the related row
const go = () => import('/lib/flights-ui.js').then(({ mountFlights }) => mountFlights(document.getElementById('app'), {"panels":["route"],"de":{"h1":"Großkreiskarte","intro":"Geben Sie Flughäfen in der Reihenfolge Ihres Fluges ein, wie JFK-LHR-SIN, und sehen Sie den Großkreisweg jeder Etappe auf einer Karte mit der Entfernung jeder Etappe und der Summe. Bleibt auf Ihrem Gerät: nichts wird gesendet."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/map/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

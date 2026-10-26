// /maps/: written by tools/maps-search-pages.mjs from lib/maps-sites.js; edit the row, not this file
const go = () => import('/lib/maps-ui.js').then(({ mountMaps }) => mountMaps(document.getElementById('app'), {"panels":["search","map","directions","traffic","saved"],"de":{"h1":"Karten","intro":"Suchen Sie einen Ort, tippen Sie auf die Karte oder lassen Sie sich die Route mit Auto, Fahrrad oder zu Fuß zeigen. Gespeicherte Orte bleiben auf diesem Gerät; ein Ort oder eine Route wird als Link geteilt."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/maps/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

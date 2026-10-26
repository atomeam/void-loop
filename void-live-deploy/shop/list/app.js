// /shop/list/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the shopping screen comes after the load event (only this small file stands before it), then the related row
const go = () => import('/lib/shop-ui.js').then(({ mountShop }) => mountShop(document.getElementById('app'), {"panels":["cart","unit"],"de":{"h1":"Einkaufsliste","intro":"Tragen Sie ein, was Sie brauchen, mit Menge, Preis, falls bekannt, und Shop. Haken Sie beim Einkaufen ab; die Liste ordnet sich nach Shops mit Summen und lässt sich als Link teilen. Exportieren Sie sie als CSV, holen Sie eine CSV zurück und vergleichen Sie Grundpreise im Laden. Auf diesem Gerät gespeichert, kein Konto."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/shop/list/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

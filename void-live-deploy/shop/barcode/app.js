// /shop/barcode/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the shopping screen comes after the load event (only this small file stands before it), then the related row
const go = () => import('/lib/shop-ui.js').then(({ mountShop }) => mountShop(document.getElementById('app'), {"panels":["lookup","stores"],"de":{"h1":"Barcode-Suche","intro":"Tippen oder scannen Sie einen UPC, EAN oder eine ISBN. Verse prüft die Prüfziffer, sagt, welche Art Code es ist, findet das Produkt in den offenen Produktdatenbanken (Lebensmittel, Haushaltswaren, Kosmetik) und öffnet denselben Code als Suche bei den Shops. Nichts wird auf einem Server gespeichert; die offenen Datenbanken sind unten genannt."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/shop/barcode/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

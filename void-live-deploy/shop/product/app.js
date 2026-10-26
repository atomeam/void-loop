// /shop/product/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the shopping screen comes after the load event (only this small file stands before it), then the related row
const go = () => import('/lib/shop-ui.js').then(({ mountShop }) => mountShop(document.getElementById('app'), {"panels":["lookup","stores","unit"],"de":{"h1":"Produktsuche","intro":"Suchen Sie ein Produkt nach Name, Marke oder Barcode in den offenen Produktdatenbanken, sehen Sie Bild, Marke, Größe und Kategorie, und öffnen Sie dieselbe Suche bei Amazon, eBay, Walmart, Target, Etsy und anderen, um zu sehen, wer es verkauft. Finden Sie über den Grundpreis die günstigere Packung."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/shop/product/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

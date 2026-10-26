// /learn/times/: written by tools/tool-site-pages.mjs from lib/learn-sites.js; edit the row, not this file
// the learning screen comes after the load event (the gate times the load event: only this small file stands before it), then the related row
const go = () => import('/lib/learn-ui.js').then(({ mountLearn }) => mountLearn(document.getElementById('app'), {"panels":["times"],"de":{"h1":"Einmaleins","intro":"Lernen Sie das Einmaleins von 1 bis 12. Wählen Sie die Reihen, üben Sie sie der Reihe nach oder gemischt mit einem Tipp für jede Aufgabe, dann kommt der Schnelltest: zehn Sekunden pro Frage, Punkte für jede übrige Sekunde. Das Raster zeigt, welche Aufgaben Sie können; drucken Sie ein Arbeitsblatt oder Ihre Urkunde. Bleibt auf diesem Gerät."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/learn/times/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

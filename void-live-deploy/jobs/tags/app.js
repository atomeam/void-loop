// /jobs/tags/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the jobs screen and its listings come after the load event (the gate times the load event: only this small file stands before it), then the related row
const go = () => import('/lib/jobs-ui.js').then(({ mountJobs }) => mountJobs(document.getElementById('app'), {"panels":["tags","search","saved","alerts","tracker","feed","sources"],"de":{"h1":"Remote-Jobs nach Schlagwort","intro":"Remote-Jobs nach Schlagwort: die Sprachen, Werkzeuge und Rollen in den Anzeigen, die häufigsten zuerst, jedes ein Link. Kombinieren Sie ein Schlagwort mit einem Mindestgehalt oder einer Region, sortieren Sie nach Gehalt oder Datum und behalten Sie einen Feed der Suche."}}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/jobs/tags/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

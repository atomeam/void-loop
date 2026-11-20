// /flights/: one page for every travel-lane site. Written by tools/tool-site-pages.mjs; query picks the panel.
const ALL = ["controls","providers","facts","tracker","trip","airports","time","route","co2","routes"];
const go = () => import('/lib/flights-ui.js').then(({ mountFlights }) => {
  mountFlights(document.getElementById('app'), { panels: ALL, controls: ["airports","trip","dates","pax","cabin"], de: {"h1":"Flüge","intro":"Planen Sie einen Flug: Geben Sie die Flughäfen einmal ein und sehen Sie Entfernung, Flugzeit, CO2 und Großkreis-Karte zusammen, öffnen Sie dieselbe Suche mit einem Klick bei fünf Anbietern, schlagen Sie Flughafencodes nach, sehen Sie, wohin Sie fliegen können, und behalten Sie Ihre Reise mit ihren Zwischenstopps. Verse hat keine Live-Preise: Die Preise stehen bei den Anbietern. Kein Konto, keine Werbung."} });
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode) {
    const el = document.getElementById(mode);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }
}).finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

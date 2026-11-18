// /flights/: one flights page for every travel-lane site. All panels; ?mode= scrolls to that panel.
const ALL = ["controls","providers","facts","tracker","trip","airports","time","route","co2","routes"];
const go = () => import('/lib/flights-ui.js').then(({ mountFlights }) => {
  const root = document.getElementById('app');
  mountFlights(root, { panels: ALL, controls: ["airports","trip","dates","pax","cabin"], de: { h1: 'Flüge', intro: 'Planen Sie einen Flug: Wählen Sie Flughäfen und Daten, öffnen Sie dieselbe Suche bei mehreren Anbietern und sehen Sie Entfernung, Flugzeit, Zeitunterschied und CO2 auf Ihrem Gerät.' } });
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode) {
    const el = document.getElementById(mode) || document.querySelector('[id*="' + mode + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }
}).finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/flights/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });

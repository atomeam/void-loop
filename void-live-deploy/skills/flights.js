/**
 * flights skill - made with tools/new-skill.mjs (docs/UPGRADING.md); owner, 2026-10-26: "need a flights page". "flights to lisbon", "cheap flights", "flight time london new
 * york", "airport codes", "layover calculator" answer with a card that opens the flights page that does it, with the places in the link
 * (lib/flight-sites.js flightAskOf, the same ask the tool pages' ask bar routes). Verse has no live fares and the card says so: the page opens the search on the
 * providers. Nothing is made here. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { flightAskOf } from '../lib/flight-sites.js';
const TOOLS = [['/flights/', 'Flights', 'search on five providers, route facts, a price log, itineraries'], ['/flights/time/', 'Flight time', 'duration, local arrival, time difference'], ['/flights/distance/', 'Distance', 'km, miles, nautical miles'], ['/flights/airports/', 'Airport codes', 'IATA and ICAO, nearby airports'], ['/flights/trip/', 'Itinerary and layovers', 'from a pasted confirmation'], ['/flights/co2/', 'CO2', 'per seat, with the method'], ['/flights/map/', 'Great circle map', 'chained airports'], ['/flights/routes/', 'Where can I fly', 'airports within a flight time']];
function run(text, api) {
  const { showPage, esc } = api, to = flightAskOf(String(text || '').trim().replace(/[?!.]+$/, '')) || '/flights/';
  showPage((el) => {
    el.dataset.page = to.replace(/\?.*$/, '');
    el.innerHTML = '<h2>Flights</h2><p>Verse has no live fares: the prices are on the providers, and the flights page opens your search on Google Flights, Skyscanner, Kayak, Momondo and Expedia. The route, the flight time, the time difference and the CO2 are worked out on your device.</p>' // void-review: ok: fixed text
      + '<p><a href="' + esc(to) + '" style="font-weight:600">Open the page →</a></p><ul style="padding-left:18px;margin:6px 0">' + TOOLS.map(([h, n, d]) => '<li><a href="' + h + '">' + esc(n) + '</a>: ' + esc(d) + '</li>').join('') + '</ul>' // void-review: ok: fixed text and escaped
      + '<div class="src">Made by Verse · airports from OurAirports (public domain) · as of 2026-10</div>';
  });
  return 'flights';
}
export default {
  name: 'flights',
  examples: ['flights to lisbon', 'cheap flights', 'flight time london new york', 'airport codes', 'layover calculator', 'where can i fly from berlin'],
  nearMisses: ['fly to tokyo', 'my flight is delayed', 'how do planes fly', 'distance from london to new york'],
  match(lower) { const to = flightAskOf(String(lower || '').trim()); return !!to && !to.startsWith('/flights/distance/?'); }, // a distance between two places stays with the distance skill; "flight distance" alone opens the page
  run,
};

// The journeys each floor must pass before it can count as beaten (owner's standards, 2026-10-28: "structural equivalence"): what a person
// does on the rival site, end to end, done on Verse's page by a script (tools/tower-journeys.mjs) with positive controls (what must be on the
// page after each step) and negative controls (no stub, placeholder, error page or "coming soon": lib/tower-controls.js). A route that loads,
// a 200, or a keyword in the page is never a journey. Every floor has at least the two default journeys; a floor named here has its own list.
// A journey with no script yet is INCOMPLETE (never a pass), so the floor waits until someone writes it and it passes. Pure data.
import { JOURNEY_PREFIX } from './tower-controls.js';

export const DEFAULT_JOURNEYS = Object.freeze(['do the main job and see the result', 'share the result and reopen it from the link']);

/** per floor id: the journeys the rival's own visitors take, the smallest set that is the site's job. */
export const JOURNEYS = Object.freeze({
  // the far-future giants (owner, 2026-10-28: not now; small sites first): the list is what beating them would honestly take
  shopping: ['search the catalogue for a product', 'filter and sort the results', 'open a product with price, stock and reviews', 'add to a cart and change the quantity', 'check out and pay', 'see the order and track its delivery', 'return an item'],
  video: ['search for a video', 'watch it with seek, quality and captions', 'open a channel and follow it', 'get recommendations from what was watched', 'make a playlist', 'read and write comments', 'upload a video'],
  'is it': ['see today\'s answer for the question', 'see the answer in the visitor\'s language', 'share the answer and reopen it from the link'],
  'coin flip': ['flip a coin and see heads or tails', 'flip again and see the running count', 'share the result and reopen it from the link'],
  'random number': ['pick a number in a range', 'change the range and pick again', 'share the result and reopen it from the link'],
  'word count': ['type text and see words and characters counted', 'paste a long text and see reading time', 'share the result and reopen it from the link'],
  stopwatch: ['start, lap and stop the stopwatch', 'reset and start again', 'share the result and reopen it from the link'],
  // nameunit.com (/hosting/, 2026-10-29): its visitors type a name and read which endings are free or taken, then send that answer on
  'wheelroot.com': ['draw a drill and see its score', 'share the drawing and reopen it from the link'],
  nameunit: ['search a name and see each ending free or taken', 'share the result and reopen it from the link'],
  paint: ['choose a picture from the library', 'zoom in and fill a numbered area', 'use a hint for the selected colour', 'leave and come back to the saved picture', 'finish and watch the reveal', 'colour your own photo'],
});

/** the journeys a floor must pass, as plain names. Pure. */
export const journeysOf = (f) => (f && JOURNEYS[f.id]) || (f && f.lane && JOURNEYS[f.lane] && JOURNEYS[f.lane].slice(0, 2)) || DEFAULT_JOURNEYS;
/** the same as checklist aspects ("journey: ..."). Pure. */
export const journeyAspects = (f) => journeysOf(f).map((j) => JOURNEY_PREFIX + j);

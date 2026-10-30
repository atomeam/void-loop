/**
 * fantasy skill - "fantasy tools", "start or sit", "compare players": what the /fantasy/ page does and that it works from the person's own sheet, on their device. No feed is read here;
 * the card is framed with the "Open the full Fantasy page" link (lib/card-frame.js PAGE_OF).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:fantasy(?: football| basketball| hockey| baseball)?(?: tools?| helper| draft| assistant)?|(?:fantasy )?start(?: or |\/| and )sit|(?:fantasy )?(?:compare|compare two) players|(?:fantasy )?trade (?:value|analy[sz]er|calculator)|(?:fantasy )?mock draft)$/i;
function run(text, api) {
  const { showPage } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Fantasy tools</h2><div class="sub">From your own sheet, on your device</div><p>Paste or open a sheet of players with your own numbers (projections, floors, ceilings, ADP). Verse compares players, says start or sit, weighs a trade in your value column, builds a draft board and runs a mock draft, and works out averages from box scores.</p>'
      + '<p>Live projections and paid feeds are not bundled, and nothing you paste leaves your device.</p><div class="src">No account, no ads, no betting</div>';
  });
  return 'fantasy';
}
export default {
  name: 'fantasy',
  examples: ['fantasy tools', 'start or sit'],
  nearMisses: ['nba scores', 'browse sports', 'what is the score of 3 plus 4'],
  match(lower, text) { return WHEN.test(String(text || lower).trim().replace(/[?!.]+$/, '')); },
  run
};

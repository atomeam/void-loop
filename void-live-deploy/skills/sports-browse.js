/**
 * sports-browse skill - "browse sports", "list of sports": the sports Verse can show live scores for, and where the rest are (the /sports/ page: 42 sports to browse and one search
 * box across teams, events, venues and players). No feed is read here; the card is framed with the "Open the full Sports page" link (lib/card-frame.js PAGE_OF).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:browse (?:all )?sports|(?:the |a )?list of (?:all )?sports|what sports (?:do you|does verse) (?:have|cover|show)|sports (?:list|search|browser))$/i;
function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Sports</h2><div class="sub">Live scores in Verse</div><ul><li>Soccer: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, MLS, Champions League</li><li>Basketball: NBA</li><li>American football: NFL</li><li>Baseball: MLB</li><li>Ice hockey: NHL</li><li>Motorsport: Formula 1</li></ul>'
      + '<p>Thirty-six more sports are listed on the Sports page, and one search box finds teams, events, venues and players in any of them.</p><div class="src">Source: ' + esc('TheSportsDB for the search, ESPN, OpenLigaDB and Jolpica for scores') + '</div>';
  });
  return 'sports-browse';
}
export default {
  name: 'sports-browse',
  examples: ['browse sports', 'list of sports'],
  nearMisses: ['nba scores', 'nba team celtics', 'what stadium do the yankees play in'],
  match(lower, text) { return WHEN.test(String(text || lower).trim().replace(/[?!.]+$/, '')); },
  run
};

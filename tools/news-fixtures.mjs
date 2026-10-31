// Fixture feeds for the news page's tests: made-up headlines in the three formats real feeds use (RSS 2.0, RSS 1.0 / RDF, Atom). Nothing here is a real publisher's text.
const ago = (min) => new Date(Date.now() - min * 6e4).toUTCString();
const iso = (min) => new Date(Date.now() - min * 6e4).toISOString();
export const rss = (items) => '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>' + items.map(([t, l, d, m]) => `<item><title><![CDATA[${t}]]></title><link>${l}</link><description><![CDATA[<p>${d}</p>]]></description><pubDate>${ago(m)}</pubDate></item>`).join('') + '</channel></rss>';
export const rdf = (items) => '<?xml version="1.0"?><rdf:RDF xmlns="http://purl.org/rss/1.0/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>x</title></channel>' + items.map(([t, l, d, m]) => `<item><title>${t}</title><link>${l}</link><description>${d}</description><dc:date>${iso(m)}</dc:date></item>`).join('') + '</rdf:RDF>';
export const atom = (items) => '<feed xmlns="http://www.w3.org/2005/Atom"><title>x</title>' + items.map(([t, l, d, m]) => `<entry><title type="html">${t}</title><link rel="alternate" href="${l}"/><summary>${d}</summary><updated>${iso(m)}</updated></entry>`).join('') + '</feed>';
const S = 'A longer summary line that the feed itself carries, to show where there is one.';
export const STORY = {
  quake: ['Strong earthquake strikes off the coast of Chile', 'Strong earthquake hits Chile coast, tsunami watch issued', 'Chile coast hit by strong earthquake; tsunami watch'],
};
/** the fixture world: for each feed host, the XML it answers. Same quake story from three outlets, different stories otherwise. */
export function fixtureFor(url) {
  const u = new URL(url);
  if (u.host === 'feeds.bbci.co.uk') return rss([[STORY.quake[0], 'https://www.bbc.co.uk/news/a1', S, 12], ['Parliament votes on the budget amendment', 'https://www.bbc.co.uk/news/a2', S, 50], ['Rail strike called off after late deal', 'https://www.bbc.co.uk/news/a3', '', 95]]);
  if (u.host === 'www.theguardian.com') return rss([[STORY.quake[1], 'https://www.theguardian.com/world/b1', S, 20], ['Scientists find a new species of deep sea octopus', 'https://www.theguardian.com/science/b2', S, 180], ['Opinion: why the budget amendment matters', 'https://www.theguardian.com/b3', S, 240]]);
  if (u.host === 'feeds.npr.org') return rss([[STORY.quake[2], 'https://www.npr.org/c1', S, 9], ['Farmers brace for a dry summer ahead', 'https://www.npr.org/c2', S, 300]]);
  if (u.host === 'rss.dw.com') return rdf([['Germany opens its largest offshore wind farm', 'https://www.dw.com/en/d1', S, 40], ['Berlin museum returns artefacts to Nigeria', 'https://www.dw.com/en/d2', S, 120]]);
  if (u.host === 'www.aljazeera.com') return atom([['Ceasefire talks resume in Geneva this week', 'https://www.aljazeera.com/e1', S, 33], ['Ships queue as the canal reopens', 'https://www.aljazeera.com/e2', S, 75]]);
  if (u.host === 'www.cbsnews.com') return rss([['Hockey league announces a new expansion city', 'https://www.cbsnews.com/f1', S, 61]]);
  if (u.host === 'www.france24.com') return '<html>not a feed</html>';
  throw new Error('fixture: no network for ' + u.host);
}

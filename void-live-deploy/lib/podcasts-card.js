// /podcasts/'s stage card: the search open on the page, as an ask the stage's podcast search reads back (skills/podcast-search.js), so
// "See it as a card on the stage" shows the same shows, not a fixed example. Only the words searched go into the ask: a show or an
// episode open on the page, and the shows followed on the device, give '' and the example ask stays. Pure: tools/toolkit.test.mjs.
import { podcastTopicOf } from '../skills/podcast-search.js';

/** the stage ask for the page's address (location.search), or ''. Pure. */
export function cardAsk(search) {
  let q = ''; try { q = new URLSearchParams(String(search || '')).get('q') || ''; } catch (_) { return ''; }
  const words = q.trim().replace(/\s+/g, ' '), ask = 'podcasts about ' + words;
  return words && podcastTopicOf(ask) === words ? ask : '';
}

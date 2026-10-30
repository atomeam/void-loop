// /news/'s stage card: what the page shows, as an ask the stage's news skill reads back (skills/news.js), so "See it as a card on the
// stage" matches the page, not always the day's headlines. Words in the search box give "news about <words>" (the stage's topic card,
// Hacker News stories from the past week), only when the skill reads the same words back; the Technology section gives "tech news"
// (the Hacker News front page). Any other view gives '', so the example ask (today's headlines) stays. Followed topics and saved
// stories stay on the device and never go into the ask. Pure: tools/toolkit.test.mjs.
import { isTechNews, topicNewsOf } from '../skills/news.js';

/** the stage ask for the section and the search words open on the page, or ''. Pure. */
export function cardAsk(sec, q) {
  const words = String(q || '').trim().replace(/\s+/g, ' ');
  if (words) { const ask = 'news about ' + words; if (topicNewsOf(ask) === words) return ask; }
  return sec === 'tech' && isTechNews('tech news') ? 'tech news' : '';
}


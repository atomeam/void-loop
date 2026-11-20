// What a visitor sees behind the UniVerse screen: a real picture of the page (void-live-deploy/gate/<name>.webp, taken from the page itself)
// and, where a free card does the same job, the ask that opens it on the home page. A card stays free; a full page is UniVerse.
const P = (name, line, img, ask) => ({ name, line, img, ask });
export const PREVIEWS = {
  '/arcade': P('Arcade', 'Every game you can play against Verse, in one 3D cabinet. New rounds play right there.', 'arcade', 'open the arcade'),
  '/world': P('World', 'Real things as live 3D scenes you can explore: a garden snail with its real anatomy, a way to slow time, look inside and change the weather around it.', 'world', 'show me a snail'),
  '/echo-vault': P('Echo Vault', 'Stories of sites that were only something to read: what each was, when, and what a visitor could do there.', 'echo-vault', ''),
  '/lab': P('Lab', 'Tools from the Verse lab, each a page that does one job.', 'lab', ''),
  '/flights': P('Flights', 'Search airports by city, name or code and open one search on five providers.', 'flights', ''),
  '/scores': P('Scores', 'Live scores, schedules in your own time zone and standings for the big leagues.', 'scores', ''),
  '/bots': P('Bots', 'Bots Verse builds for itself, each live only when its probe passes on a real task. Try any one.', 'bots', ''),
  '/fanfic': P('Fan fiction', 'An open archive of stories, with chapters and reviews and no account.', 'fanfic', ''),
  '/color': P('Colour', 'Type a colour and get it in every model, with tints, shades, schemes and a readability check.', 'color', ''),
  '/pdf': P('PDF tools', 'Merge, split, reorder, rotate and compress PDFs on your device.', 'pdf', ''),
  '/markets': P('Markets', 'Look up a stock, ETF, index, currency or coin: price, change, range and a chart.', 'markets', ''),
  '/kanban': P('Kanban', 'A board on your device: columns, cards, drag and drop, due dates, timers and limits.', 'kanban', ''),
  '/team': P('Team', 'Verse\'s team chat, with its agents as members and the work they are on.', 'team', ''),
  '/brain': P('Brain', 'Watch a mind think: Verse\'s attention, surprise, memory and will, live on the whole screen.', 'brain', ''),
  '/calendar': P('Calendar', 'Month, week and day views with reminders, invites and repeats, kept on your device.', 'calendar', ''),
  '/creed': P('Creed', 'What Verse believes and what it practices, in its own voice.', 'creed', ''),
  '/free': P('Free resources', 'Every free tier, credit and open API Verse runs on, with live quota status.', 'free', ''),
};
/** the preview for a path (/arcade/ or /arcade/x), or a plain one when nothing fits. Pure. */
export function previewFor(pathname) {
  const m = /^\/([^/?#]+)/.exec(String(pathname || ''));
  const hit = m && PREVIEWS['/' + m[1].toLowerCase()];
  if (hit) return hit;
  return { name: '', line: 'The full page, with everything the free card leaves out.', img: '', ask: '' };
}

// Versus (owner, 2026-10-25: "the tower rename is easy its versus"): the name a person reads; the identifiers keep `tower`.
// Real sites (owner, 2026-10-22: "let's tackle real sites"): each floor is one named, real site, named in plain text only as a comparison
// (nothing implying affiliation; Verse's own skills keep their own names). A site's own icon stands beside its name on the card (owner,
// 2026-10-25: "should be the sites logos not whatever this is"): the gate keeps each site's favicon beside its screenshot (tower.icons/), so
// a visitor's browser asks no third party for it; a site with none keeps its drawn fighter (lib/avatar.js). The order here is provisional;
// once head-to-head checks exist, floors sort easiest to hardest by the measured gap (aspects still lost). Never a claimed win without
// verified evidence.
// The tower (owner, 2026-10-22): "a-to-mind should be the only website you need", shown as a fighting-game ladder. Each floor is a site
// category (generic labels and original glyphs, never brand names or logos), easiest at the bottom, hardest at the top. The gate is hard: a
// floor is beaten only when EVERY aspect on its checklist is verified by an automated head-to-head check (Verse measured against the best
// site in the category, with evidence) as better or equal-and-better. One regressed aspect and the floor is not beaten. Verse may work on
// higher floors, but the marker only climbs past a floor whose gate passes. The best sites' detailed checklists come from passive study and
// stay private; this public side names generic aspects only and counts. Pure.

import { SELF_SITES } from './self-sites.js';
import { badgeOf, buildable } from './gate-badge.js';
import { isJourney, journeyPasses, incompleteRow, zeroRivalUnread } from './tower-controls.js';
import { journeyAspects } from './tower-journeys.js';
import { bytesLabel, trustedControls, weightBand, weightOf } from './tower-weight.js';

export const COMMON_ASPECTS = ['speed', 'accuracy', 'completeness', 'mobile', 'accessibility', 'offline', 'sharing', 'design polish', 'reliability', 'wider use'];
// easiest at the bottom (index 0) to hardest at the top; extra aspects are generic names for what the best site in the category offers
const HAND_FLOORS = [
  // the tutorial floors (2026-10-23): one-trick sites, the first fights, so the climb starts where a whole site can be out-done
  { id: 'is it', site: 'isitchristmas.com', url: 'https://isitchristmas.com/', ask: 'is it christmas?', page: '/is-it/christmas', label: 'Is it…?', glyph: '?', fatality: 'a midnight wave across 36 places and your own flag turning with your pointer, that the site cannot do', extra: ['big answer', 'local language'] },
  { id: 'coin flip', learned: "a fair coin has to be checkable: every flip from the device's secure random numbers, a real coin's two faces shown one at a time, and the gate learned to find a coin however a site flips it and read a side that is only drawn", site: 'justflipacoin.com', url: 'https://justflipacoin.com/', ask: 'flip a coin', page: '/flip/', label: 'Coin flip', glyph: '◐', fatality: 'any real coin ever minted with its real faces, a coin you design yourself, and what it is worth', extra: ['flip animation', 'flip history'] },
  { id: 'random number', learned: "true randomness has to be checkable, not taken on trust: a public draw from the drand beacon that anyone can re-derive from its round, in any base and in columns", site: 'random.org', url: 'https://www.random.org/', ask: 'random number 1-100', page: '/random/?min=1&max=100', label: 'Random number', glyph: '#', fatality: 'no repeats, a list picked from or shuffled, and a link that holds the whole setting', extra: ['range choice', 'true randomness'] },
  { id: 'word count', learned: "a sentence does not end at Mr., U.S. or 3.5, and counting belongs on a page that counts as you type and works offline, not in a one-line answer", site: 'wordcounter.net', url: 'https://wordcounter.net/', ask: 'word count: the quick brown fox', page: '/word-count/', label: 'Word count', glyph: '¶', extra: ['live counting', 'characters and sentences'] },
  { id: 'calculator', learned: "a calculator has to show its working: the expression as typed, the answer, a history that stays, and the scientific keys beside the plain ones; the site answered 6 of 17 things a full answer shows and had 46 small or faint controls at phone width", fatality: 'the whole working shown with a history that stays, degrees and radians a tap apart, and the page open with the network cut', site: 'calculator.net', url: 'https://www.calculator.net/', ask: 'what is 17% of 240', page: '/calculator/', label: 'Calculator', glyph: '÷', extra: ['history', 'unit and scientific modes'] },
  // the single-tool rungs (owner, 2026-10-23): one utility each, the fights after the tutorial; 'stopwatch' is the old 'timer and clock'
  // floor (aka keeps its coverage row and any evidence under the old id)
  { id: 'stopwatch', learned: "time is kept as the moment it started, never a ticking count, so a background tab or a reload loses nothing; and the gate learned to time a run by its own clock, find Start inside a frame and read a clock drawn on a canvas off the screen", aka: 'timer and clock', site: 'online-stopwatch.com', url: 'https://www.online-stopwatch.com/', ask: 'set a timer for 10 minutes', page: '/stopwatch/', label: 'Stopwatch and timer', glyph: '◷', fatality: 'time that a reload or a background tab never loses, the fastest and slowest lap marked, an alarm made with no sound file, a link that holds your countdown, and it opens offline', extra: ['alarms', 'laps'] },
  { id: 'unit converter', learned: "a converter is judged on breadth and direction: all 21 kinds of unit, the formula beside the answer, and a swap that turns the question round; the site had every kind but no swap, and opened to nothing with the network cut", fatality: 'every kind of unit with its formula, a swap, and a link that carries the whole setting, offline', site: 'unitconverters.net', url: 'https://www.unitconverters.net/', ask: '100 c to f', page: '/convert/', label: 'Unit converter', glyph: '⇄', extra: ['unit breadth', 'both directions'] },
  { id: 'password', learned: "a password made on the device, never fetched, with its exact strength in bits and the time to crack beside it; the site answered none of 3 loads, so Verse was held to the bar instead and met every row of it", fatality: 'passwords and passphrases made on the device with their entropy and crack time shown, offline, nothing sent', site: 'passwordsgenerator.net', url: 'https://passwordsgenerator.net/', ask: 'generate a password', page: '/password/', label: 'Password generator', glyph: '⚿', extra: ['length and character choice', 'strength shown'] },
  // found by data, not by feel (owner, 2026-10-24: "find the real life actual easiest site"): `easiest-sites.mjs --tools` ranked howsecureismypassword.net the easiest real one-tool site
  // Verse had no floor for (rank 155,868 of the top million; one box); its home page now points to another site, asks about cookies and loads analytics, tag-manager and widget scripts
  { id: 'password strength', learned: "a checker is trusted only when nothing leaves the device: the password never goes in a link, the leak list is asked with five characters of a fingerprint, and the reasons and the fixes stand beside the time to crack; and the gate learned to type a question into Verse's own box when the address must not carry it", site: 'howsecureismypassword.net', url: 'https://www.howsecureismypassword.net/', ask: 'how secure is my password', page: '/password-strength/', label: 'Password strength', glyph: '⚿', fatality: 'it names what is weak and how to fix it, and asks the leaked-password list whether it is known without ever sending it (five characters of a fingerprint), with nothing third-party loaded', extra: ['crack time', 'reasons and fixes', 'leak check'] },
  // second floor chosen by data (`easiest-sites.mjs --tools`): hextobinary.com, Tranco 136,997, a hex-to-binary box among AdSense, tag-manager, consent and maths-typesetting scripts
  { id: 'base converter', learned: "a converter that rounds is wrong: every base exact at any size (BigInt), with the signed two's-complement reading at any width, and the gate learned to type into a site's own box", site: 'hextobinary.com', url: 'https://hextobinary.com/', ask: 'ff hex to binary', page: '/base-converter/', label: 'Base converter', glyph: '⇄', fatality: 'every base at once for one number, exact at any size, with its signed two\'s-complement reading and its text, and no ads or third-party scripts', extra: ['all four bases', 'huge numbers', 'signed reading'] },
  // third floor from the data (`easiest-sites.mjs --tools`): pancardresizer.com, a three-step wizard that resizes a photo or signature to a size in cm and a limit in KB, behind AdSense, tag-manager, jQuery, Bootstrap and Croppie
  { id: 'photo resizer', learned: "a resizer is judged on the file it hands back, not its form: the exact pixels from cm, mm or inches at a dpi, the KB limit really met or said to be impossible, a JPEG or a PDF, and the picture never leaving the device; and the gate learned to choose a picture of its own on a page that answers only once one is put in", site: 'pancardresizer.com', url: 'https://pancardresizer.com/', ask: 'resize a photo to 3.5 x 2.5 cm under 50 kb', page: '/resize-image/', label: 'Photo resizer', glyph: '▣', fatality: 'one step instead of three: any size in cm, mm, inches or pixels, a size limit in KB it really meets (or says it cannot), a JPEG or a PDF, with no ads and nothing uploaded', extra: ['exact size', 'size limit', 'pdf'] },
  // the first floor taken from the frontier (tower.frontier.json; owner, 2026-10-24: "find the site to conquer and get to work now"):
  // colorzilla.com (Tranco 101,274), its gradient editor behind Carbon ads, a Twitter widget, Facebook styles, Google Analytics and a tag manager
  { id: 'gradient', learned: "a gradient is judged by the text on it: the worst contrast across the whole gradient, conic gradients, and a link that holds it whole", site: 'colorzilla.com', url: 'https://www.colorzilla.com/gradient-editor/', ask: 'gradient generator', page: '/gradient/', label: 'CSS gradient', glyph: '▤', fatality: 'conic gradients, the worst text contrast across the gradient, a link that holds it whole, and it opens offline, with no ads, trackers or social widgets', extra: ['stops with opacity', 'import css', 'presets'] },
  // paint by number (owner, 2026-10-26: "build wherever fits"): a frontier site given a page of its own, so the floor can be measured and beaten
  { id: 'paint', site: 'heycolor.com', url: 'https://heycolor.com/', ask: 'paint by numbers', page: '/paint/', label: 'Paint by number', glyph: '◍', extra: [],
    held: 'Verse\'s page is not yet better than this site at painting a picture, whatever the gate rows read, so the floor stays in the queue until it is' },
  // emoji counts (owner, 2026-10-26: "drop the /emojis/ page and its tower probe right onto main"): emojitracker.com is the
  // frontier's next fight — its own page says the Twitter stream that fed it is inactive and it now ranks the emoji copied from
  // Emojipedia. Verse counts copies of a closed list of emoji on /emojis/ and says exactly that, so no global feed is faked
  { id: 'emojis', site: 'emojitracker.com', url: 'https://emojitracker.com/', ask: 'realtime emoji counts', page: '/emojis/', label: 'Emoji counts', glyph: '☻', extra: [] },
  // the wheel picker (owner, 2026-10-24: "find the site to conquer and get to work now"): the frontier's wheelofgold.com is a login-walled
  // spin-to-win, not a tool, so the floor fights the category's best, wheelofnames.com
  { id: 'wheel', learned: "a fair wheel draws the winner first with crypto and plans the spin to land on it; and the gate learned to spin a wheel and read who won", site: 'wheelofnames.com', url: 'https://wheelofnames.com/', ask: 'spin the wheel', page: '/wheel/', label: 'Wheel picker', glyph: '◔', fatality: 'the winner drawn fairly with cryptographic random numbers before the wheel turns, weights like Pizza*3 typed inline, and an answer straight from the ask', extra: ['entries list', 'remove the winner', 'weights'] },
  // from the frontier (owner, 2026-10-24): randomuser.me (Tranco 66,893), made-up people for testing
  { id: 'random user', learned: "made-up people must hold together (an age that matches the birthday, the country asked for) and their phone numbers must reach no one", site: 'randomuser.me', url: 'https://randomuser.me/', ask: 'random user generator', page: '/random-user/', label: 'Made-up people', glyph: '☺', fatality: 'SQL inserts, a seed that always gives the same people, and phone numbers in ranges reserved for fiction, all on the device with no photo of a real face', extra: ['nationalities', 'output formats', 'seed'] },
  { id: 'time zones', site: 'timeanddate.com', url: 'https://www.timeanddate.com/', ask: 'time in tokyo', page: '/time/?c=Tokyo', label: 'Time zones', glyph: '◴', extra: ['world time', 'meeting planner'] },
  // colour: color-hex.com could not be timed by the old gate (it never went quiet on the network); that was the gate's fault, not a win, so the
  // gate was fixed and the site is the opponent again (owner, 2026-10-24: "never swap a target site down to an easier site ... beat both sites")
  { id: 'colour', learned: "a colour is only useful if you can read text on it: every colour now says which text passes WCAG contrast on it, on the colour itself", site: 'color-hex.com', url: 'https://www.color-hex.com/color/ff5733', ask: '#ff5733', page: '/color/?c=ff5733', label: 'Colour picker', glyph: '◉', fatality: 'every model on one page, the nearest name by eye, whether text on it passes WCAG AA and AAA, tints, shades, tones and five schemes, with no ads, analytics or web fonts', extra: ['every colour model', 'shades and palettes', 'contrast'] },
  // and hexcolor16.com, the hex-code tool the data found (Tranco 63,673): beaten too, not instead
  { id: 'colour codes', learned: "a colour page has to speak every model people use: it took hexcolor16.com's list to 15 models (CIELab, Oklab, OKLCH among them), its VGA palette and a random colour, and learned to keep the layout still on a slow first visit", site: 'hexcolor16.com', url: 'https://hexcolor16.com/ff5733', ask: 'ff5733 color', page: '/color/?c=ff5733', label: 'Colour codes', glyph: '◉', fatality: 'contrast for text on the colour, the nearest name by eye, and the page opens offline, with no ads, analytics or web fonts', extra: ['every colour model', 'shades and palettes'] },
  { id: 'color canon', site: 'colorcanon.com', url: 'https://colorcanon.com/', ask: 'hex color names', page: '/color/', label: 'Color Canon', glyph: '🎨', extra: [] },
  { id: 'color names', site: 'colornames.org', url: 'https://colornames.org/', ask: 'name all the colors', page: '/color/', label: 'Color names', glyph: '🎨', extra: [] },
  { id: 'encoder', learned: 'an encoder belongs in the browser, whole: both ways live, every character set both ways with nothing fetched, files of any size streamed, and the gate learned to judge accuracy against the standard itself (RFC 4648) instead of waiting on a site that answers only when pressed', fatality: 'all 44 character sets both ways on the device, the multi-byte ones inverted out of the browser\'s own decoder; each line separately, LF or CRLF, MIME lines, downloads, files past the 100 MB cap', site: 'base64encode.org', url: 'https://www.base64encode.org/', ask: 'base64 encode hello', page: '/base64/', label: 'Encoder', glyph: '⌗', extra: ['decode too', 'files and character sets'] },
  { id: 'weather', learned: "a forecast page is only as good as its slowest fetch: the place and its forecast come in one round trip kept on the edge, so the page draws at once for the tenth visitor and the first; both scales stand side by side so nobody converts; today comes first in the days ahead; and a page says it is busy while it waits, so a reader (and the gate) knows to wait with it", site: 'weather.gov', url: 'https://www.weather.gov/', ask: 'weather in boston', page: '/weather/?q=Boston', label: 'Weather', glyph: '☂', extra: ['hourly and daily forecast', 'alerts', 'radar'] },
  { id: 'translate', site: 'Google Translate', url: 'https://translate.google.com/', ask: 'translate hello to spanish', page: '/translate/?q=hello&to=es', label: 'Translate', glyph: '⇄', extra: ['language count', 'speech in and out', 'camera text'] },
  { id: 'recipes', site: 'Allrecipes', url: 'https://www.allrecipes.com/', ask: 'pancake recipe', page: '/recipes/?q=pancakes', label: 'Recipes', glyph: '◒', extra: ['search by ingredient', 'scaling', 'step mode'] },
  { id: 'calendar', site: 'Google Calendar', url: 'https://calendar.google.com/', ask: 'my calendar', page: '/calendar/', label: 'Calendar', glyph: '▦', fatality: 'an event typed as one line of plain words, an invite that is a link carrying the whole event, and the whole calendar on the device, offline', extra: ['reminders', 'invites', 'recurring events'] },
  // PDF tools (owner, 2026-10-26: "everything the sites have", smallest first): ilovepdf.com has the longest list of tools (merge, split, remove and organize pages, compress, repair, scan, edit, sign, watermark, rotate, number, redact, compare, and the conversions); Verse's page works on the device, so a file never goes anywhere
  { id: 'pdf', site: 'ilovepdf.com', url: 'https://www.ilovepdf.com/', ask: 'merge pdf', page: '/pdf/', label: 'PDF tools', glyph: '▤', extra: ['merge and split', 'page tools', 'images to pdf', 'compress'] },
  // kanban (same order): Trello is the one everyone compares to; its boards, lists, cards, labels, due dates and checklists are the baseline, its paid views and automation the ceiling
  { id: 'kanban', site: 'Trello', url: 'https://trello.com/', ask: 'kanban board', page: '/kanban/', label: 'Kanban', glyph: '▥', extra: ['boards and columns', 'card details', 'drag and drop', 'import and export'] },
  { id: 'docs and notes', site: 'Google Docs', url: 'https://docs.google.com/', ask: 'notepad', page: '/notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread', label: 'Docs and notes', glyph: '✎', extra: ['rich formatting', 'search', 'version history'] },
  // the chans (owner, 2026-10-25: "Let's go after the chans next ... sweep through the image boards and text boards"): boards anyone makes, so Verse's
  // page starts blank and the probe reads its board list, its make-a-board form and its formatting preview, never a post. noShot: no picture of a
  // rival board is ever kept (tools/tower-gate.mjs): a board's front page can carry explicit or illegal pictures, and this repository is public
  { id: 'image boards', site: '4chan', url: 'https://www.4chan.org/', ask: 'image boards', page: '/boards/', label: 'Image boards', glyph: '▧', noShot: true, extra: ['catalog', 'replies and quoting', 'image posts', 'archive'] },
  { id: 'sports', site: 'ESPN', url: 'https://www.espn.com/', ask: 'nba scores', page: '/scores/', label: 'Sports', glyph: '◎', extra: ['live scores', 'schedules', 'standings'] },
  { id: 'finance', site: 'Yahoo Finance', url: 'https://finance.yahoo.com/', ask: 'markets', page: '/markets/', label: 'Finance', glyph: '△', extra: ['live quotes', 'charts', 'watchlists'] },
  { id: 'maps', site: 'Google Maps', url: 'https://www.google.com/maps', ask: 'map of lisbon', label: 'Maps', glyph: '⌖', defer: true, extra: ['directions', 'place search', 'live traffic'] },
  { id: 'news', site: 'BBC News', url: 'https://www.bbc.com/news', ask: 'news', page: '/news/', label: 'News', glyph: '▤', extra: ['breadth of sources', 'freshness', 'topic following'] },
  { id: 'photos', site: 'Google Photos', url: 'https://photos.google.com/', ask: 'my photos', page: '/photos/', label: 'Photos', glyph: '◰', extra: ['editing', 'compress and convert', 'metadata and privacy'] },
  { id: 'games', site: 'Lichess', url: 'https://lichess.org/', ask: 'play chess', label: 'Games', glyph: '♟', defer: true, extra: ['catalogue size', 'online play', 'ratings and ladders'] },
  { id: 'learning', site: 'Khan Academy', url: 'https://www.khanacademy.org/', ask: 'quiz me', label: 'Learning', glyph: '✦', defer: true, extra: ['courses', 'progress tracking', 'practice'] },
  { id: 'music', site: 'Spotify', url: 'https://open.spotify.com/', ask: 'play music', page: '/music/', label: 'Music', glyph: '♪', extra: ['catalogue', 'playlists', 'recommendations'] },
  { id: 'podcasts', site: 'Apple Podcasts', url: 'https://podcasts.apple.com/', ask: 'play the podcast', page: '/podcasts/?show=verse&ep=ep1', label: 'Podcasts', glyph: '◉', extra: ['catalogue', 'subscriptions', 'playback controls'] },
  { id: 'travel', site: 'Google Flights', url: 'https://www.google.com/travel/flights', ask: 'flights to paris', page: '/flights/', label: 'Travel', glyph: '✈', extra: ['search across providers', 'price tracking', 'itineraries'] },
  { id: 'jobs', site: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', ask: 'find jobs', page: '/jobs/', label: 'Jobs', glyph: '⚒', defer: true, extra: ['listing breadth', 'alerts', 'applications'] },
  // far future (owner, 2026-10-28: Amazon and YouTube are not beaten, and not now; Verse works through the small single-purpose sites first).
  // /store/ is Verse's own small shop, not a catalogue: the gate's earlier 11 of 13 came from keyword parts judged on Verse alone and from
  // reading Amazon as "0 of 23" behind a bot wall. `gaps` and `plan` are the honest account the card shows.
  { id: 'shopping', site: 'Amazon', url: 'https://www.amazon.com/', ask: 'store', page: '/store/', label: 'Shopping', glyph: '⊡', defer: true, farFuture: true, extra: ['catalogue', 'checkout', 'delivery tracking'],
    gaps: ['no product catalogue beyond Verse\'s own few items (no search across millions of products, no sellers)', 'no cart quantities, saved addresses or payment of its own (checkout hands off to the shop partner)', 'no order history, delivery tracking or returns', 'no reviews, ratings or questions from buyers', 'design polish measured worse (31 defects vs 2)'],
    plan: 'after the small single-purpose sites: first a real product search over open catalogues with price and stock shown, then a cart and order history kept in the browser, then tracking for orders placed elsewhere (carrier numbers), then reviews; each step ships only when its journey passes' },
  // team chat (owner, 2026-10-29: "verse should reverse engineer and create its own version of slack", "so it can bring in lots of agents and
  // constantly keep all of them busy itself"): /team/, channels, threads, mentions, reactions, search and presence with agents as members and
  // Verse handing each idle agent its next job. A giant, so deferred behind the small sites like the other leaders; the gate measures the page.
  { id: 'team chat', site: 'Slack', url: 'https://slack.com/', ask: 'team chat', page: '/team/', label: 'Team chat', glyph: '#', defer: true, extra: ['channels and threads', 'agents as members', 'search and mentions'] },
  { id: 'chat', site: 'WhatsApp Web', url: 'https://web.whatsapp.com/', ask: 'chat', label: 'Chat', glyph: '❝', defer: true, extra: ['groups', 'media', 'calls'] },
  { id: 'video', site: 'YouTube', url: 'https://www.youtube.com/', ask: 'play a video', label: 'Video', glyph: '▶', defer: true, farFuture: true, extra: ['catalogue', 'streaming quality', 'recommendations'],
    gaps: ['no Verse video page at all: the floor has nothing to measure', 'no catalogue, search or channels', 'no player with seek, quality and captions', 'no uploads, comments, playlists or recommendations', 'no adaptive streaming, live video or watch-later offline; the old speed and design rows measured a page that plays nothing'],
    plan: 'after the small single-purpose sites: first a player page for open-licence video (seek, speed, captions, chapters) with search over an open archive, then playlists and history kept in the browser, then recommendations from what was watched; uploads and comments only with a partner, and each step ships only when its journey passes' },
  { id: 'social', site: 'Reddit', url: 'https://www.reddit.com/', ask: 'social', label: 'Social', glyph: '⁂', defer: true, extra: ['feed', 'following', 'posting and replies'] },
  { id: 'email', site: 'Gmail', url: 'https://mail.google.com/', ask: 'my email', label: 'Email', glyph: '✉', defer: true, extra: ['sending and receiving', 'spam filtering', 'search'] },
  { id: 'search', site: 'Google Search', url: 'https://www.google.com/', ask: 'who wrote hamlet', label: 'Search', glyph: '⌕', defer: true, extra: ['web coverage', 'freshness', 'answer quality'] },
  // the code hosts from the least visited up (owner, 2026-10-24: "verse can eat github starting with the smallest"; the order is Tranco's,
  // tools/easiest-sites.mjs --rank). codebasehq.com's public side is one page that sells a paid product; its extra aspects are what that page lists
  { id: 'codebase', site: 'codebasehq.com', url: 'https://www.codebasehq.com/', ask: 'make a gist', page: '/g/', label: 'Code host (Codebase)', glyph: '⌥', fatality: 'a gist locked with a passphrase and a what-changed view, with no account and nothing stored', extra: ['code hosting', 'ticket tracking', 'time tracking', 'project files and docs'] },
  // the next forge up (Tranco order): sent down when its proof-of-work wall (Anubis) turned the old gate away; a wall the gate could not pass is the
  // gate's fault, not a loss (owner, 2026-10-24), so it is a floor again and the gate, a full browser now, does the wall's work like a visitor
  { id: 'tildegit', site: 'tildegit.org', url: 'https://tildegit.org/', ask: 'make a gist', page: '/g/', label: 'Code host (tildegit)', glyph: '⌥', extra: ['code hosting', 'issues', 'pull requests', 'accounts'], defer: true }, // waits: a full forge (issues, pull requests, accounts) is not the job /g/ does, and Verse never asks for an account
  // the top of the tower (owner, 2026-10-23: "Github and claude ar on the tower too"): where Verse's own code lives, and the final boss
  // automation (owner, 2026-10-28: "just build Verse to be able to take over by then", the Zapier trial running out): two Zaps kept a table of
  // the repo's issues and pull requests; /ledger/ reads the same list straight from GitHub. A giant with thousands of apps, so it waits behind the small sites.
  { id: 'automation', learned: 'a log of what happened in a repo does not need a pipe that copies it: the repo already keeps it, so read it where it lives and keep a copy on the device', site: 'Zapier', url: 'https://zapier.com/', ask: 'look at atomeam/void-loop', page: '/ledger/', label: 'Repo activity ledger', glyph: '⇄', defer: true, extra: ['repo activity log', 'tables', 'triggers and actions', 'app integrations', 'scheduled runs'] }, // waits: one job of thousands (the repo log) is done; triggers into other apps are not
  { id: 'code hosting', site: 'GitHub', url: 'https://github.com/', ask: 'look at atomeam/void-loop', label: 'Code hosting', glyph: '⌥', defer: true, extra: ['repositories', 'pull requests and review', 'issues', 'actions and automation'] },
  // more opponents (owner, 2026-10-24: "you can use github and hugging face and perchance and anything you want as an opponent")
  { id: 'random generators', site: 'perchance.org', url: 'https://perchance.org/', ask: 'random name generator', label: 'Random generators', glyph: '⁇', page: '/generators/', extra: ['generator catalogue', 'make your own generator', 'image generation', 'list language', 'publish and remix'] },
  { id: 'ai models', site: 'Hugging Face', url: 'https://huggingface.co/', ask: 'what can you do', label: 'AI models and demos', glyph: '◈', defer: true, extra: ['model catalogue', 'datasets', 'live demos (spaces)'] },
  { id: 'assistant', site: 'Claude', url: 'https://claude.ai/', ask: 'what can you do', label: 'AI assistant', glyph: '◈', defer: true, extra: ['answers anything', 'writes and runs code', 'builds itself'] },
  // yunite.xyz (owner, 2026-10-27): the scrim scorer players pass around in Discord. Its scoring needs an account and its bot reads
  // screenshots; Verse's /tournaments/ does the arithmetic in the page and says so: placement is the highest matching threshold (a win is
  // not a win plus the top-five), the tiebreakers are points, wins, eliminations then average placement, and the lobby splits into
  // snake-seeded heats with contested drop spots - all from results typed in, with nothing sent anywhere and no account
  { id: 'tournaments', learned: "a scrim score is arithmetic people must be able to check: placement pays the highest matching threshold, the tiebreakers are points then wins then eliminations then average placement, and the lobby splits into snake-seeded heats, all from the results typed in", site: 'yunite.xyz', url: 'https://yunite.xyz/', ask: 'fortnite tournament scoring', page: '/tournaments/', label: 'Tournament scoring', glyph: '▣', fatality: 'standings with the official tiebreakers, snake heats and contested drop spots worked out from results typed in, with no account, no screenshot and nothing sent', extra: ['point system presets', 'multi-match standings', 'heat split', 'drop spots', 'CSV in and out'] },

  // thunit.com (owner, 2026-10-27): the next target after yunite, a 70-word brochure for "exclusive" hosting on a stock site, with six
  // unnamed icon links and no tool of any kind. Verse's /hosting/ answers the two claims it makes in numbers: a crowded shared host splits
  // its cores and an exclusive one keeps them, and an SLA is downtime per year, month, week and day. The ask is traffic (50 requests/s of
  // 200 KB at 40 ms a worker) and a 99.9% SLA, with the arithmetic, the NGINX or Caddy config and the header set worked out in the page.
  { id: 'hosting', learned: "hosting is arithmetic people must be able to check: sustained bandwidth, monthly transfer, concurrent workers by Little's law, the vCPUs and RAM they need, and the downtime each SLA allows, with a hardened config worked out from the same numbers", site: 'thunit.com', url: 'https://thunit.com/', ask: 'web hosting sizing calculator', page: '/hosting/', label: 'Hosting sizer', glyph: '▤', fatality: 'bandwidth, workers, vCPUs and RAM worked out from your traffic, the downtime each SLA allows, a hardened NGINX or Caddy config (TLS 1.3, headers, rate limit) - no account, nothing sent', extra: ['capacity sizing', 'uptime and SLA', 'server config', 'security headers'] },
  // the prize wheel floor (2026-10-28): wheelofgold.com is a spin-to-win reward faucet that shows a wheel and a balance but never the odds.
  // Verse's /prizes/ only does the arithmetic: each slice's real chance and expected value, the chance of the top prize in N spins, a
  // 1,000-spin check against the theory, and how long a reward drip takes to reach its cashout. It never pays out or collects anything.
  { id: 'prizes', learned: "a prize wheel is honest only when its odds are shown: each slice's chance and expected value, the chance of the top prize in N spins, and the days a reward drip takes to reach a cashout", site: 'wheelofgold.com', url: 'https://wheelofgold.com/', ask: 'prize wheel odds and payout calculator', page: '/prizes/', label: 'Prize wheel odds', glyph: '◕', fatality: "every slice's real chance and expected value, the top prize's odds over N spins, a 1,000-spin check and the days to a cashout - nothing paid, nothing collected", extra: ['odds table', 'expected value', 'drip calculator'] },
  // vcalc.com (2026-10-28): a library of formula calculators with units and a builder for your own formulas. Its robots.txt asks robots
  // not to read it, so the gate judges Verse's answers against the worked-out truth. Verse's /calculators/ is the library (164 calculators:
  // everyday, maths, geometry, statistics, physics, chemistry, electrical, engineering, health, conversion and dates), every input in any
  // unit of its kind, every answer in any unit, the SI working, and a guided or raw builder for your own formula, all on the device.
  // Not beaten (owner, 2026-10-28): vcalc.com publishes over 15,000 calculator tools and Verse has far fewer, so 'library size' fails
  // until the count is matched. The gate never opens vcalc.com (noRival) and judges the other aspects on Verse's own numbers.
  { id: 'formula calculators', site: 'vcalc.com', url: 'https://www.vcalc.com/', ask: 'pipe surface area calculator', page: '/calculators/', label: 'Formula calculators', glyph: '∑', fatality: 'every input in any unit and every answer in any other, the SI working shown, your own formula built guided or raw, and a link that holds it all, offline', extra: ['formula library', 'unit-aware inputs', 'custom formulas', 'library size'], noRival: 'its robots.txt asks robots to stay away', rivalCount: { n: 15000, what: 'calculator tools', source: 'https://www.vcalc.com/features/ ("over 15,000 calculator tools", read 2026-10-28)' } },
  { id: 'nameunit', learned: "a hosting and domain studio sizes servers from your traffic, checks a domain and shows tiered plans on the device, with no account and nothing sent", site: 'nameunit.com', url: 'https://www.nameunit.com/', ask: 'web hosting and domain studio', page: '/hosting/', label: 'Hosting & Domain Studio', glyph: 'H', fatality: 'domain search, tiered hosting plans, bandwidth, transfer, workers, vCPUs, RAM and SLA downtime worked out from the traffic typed in, plus a hardened NGINX or Caddy config - no account, nothing sent', extra: ['domain search', 'tiered plans', 'capacity sizing', 'uptime and SLA', 'server config'] },
  { id: 'colorzilla', learned: "a colour tool is a converter, a picker, an eyedropper and a gradient editor that run on the device, with no extension, tracking or ads", site: 'colorzilla.com', url: 'https://www.colorzilla.com/', ask: 'colorzilla eyedropper and gradient studio', page: '/gradient/', label: 'ColorZilla studio', glyph: '◎', fatality: 'linear, radial and conic gradients, any number of stops, an eyedropper from the screen, presets, copy CSS or SCSS, paste to edit, from a picture - no extension, no ads, nothing sent', extra: ['gradient editor', 'eyedropper', 'color picker', 'css output', 'sharing'] },
  { id: 'identity', learned: "an account portal is profile metadata, change history and SSO claims a person can read and edit on their own device, with no login and nothing sent", site: 'anycolorid.com', url: 'https://anycolorid.com/', ask: 'universal sso profile identity studio', page: '/identity/', label: 'Identity studio', glyph: '◎', fatality: 'editable profile, local change history, JWT claims inspector, mock service portal and a shareable profile - no account, nothing sent', extra: ['profile metadata', 'change history', 'SSO claims', 'service portal', 'sharing'] },
  { id: 'cpan', learned: "a test report is data a developer can ingest, aggregate and search on their own device, with no account and nothing sent", site: 'cpantesters.org', url: 'https://www.cpantesters.org/', ask: 'cpan testers report ingestion studio', page: '/cpan/', label: 'CPAN Testers studio', glyph: 'Perl', fatality: 'ingest test reports, distribution health, a test matrix, module search and export - no account, nothing sent', extra: ['test reports', 'distribution health', 'module search', 'live feed', 'export'] },
  { id: 'sudowrite', learned: "a book is a volume compiled from a ledger on the device, with no credits, subscriptions or API keys", site: 'sudowrite.com', url: 'https://www.sudowrite.com/', ask: 'ai book writer studio', page: '/books/', label: 'Verse Bookshelf', glyph: 'B', fatality: 'compile chapters from the ledger, export markdown or text, no credits, no subscriptions, nothing sent', extra: ['book studio', 'chapters', 'export', 'offline', 'sharing'] },
  { id: 'squibler', learned: "a book is a volume compiled from a ledger on the device, with no credits, subscriptions or API keys", site: 'squibler.io', url: 'https://www.squibler.io/', ask: 'ai book writer studio', page: '/books/', label: 'Verse Bookshelf', glyph: 'B', fatality: 'compile chapters from the ledger, export markdown or text, no credits, no subscriptions, nothing sent', extra: ['book studio', 'chapters', 'export', 'offline', 'sharing'] },
  { id: 'inkfluence', learned: "a book is a volume compiled from a ledger on the device, with no credits, subscriptions or API keys", site: 'inkfluenceai.com', url: 'https://www.inkfluenceai.com/', ask: 'ai book writer studio', page: '/books/', label: 'Verse Bookshelf', glyph: 'B', fatality: 'compile chapters from the ledger, export markdown or text, no credits, no subscriptions, nothing sent', extra: ['book studio', 'chapters', 'export', 'offline', 'sharing'] },
  { id: 'novelcrafter', learned: "a book is a volume compiled from a ledger on the device, with no credits, subscriptions or API keys", site: 'novelcrafter.com', url: 'https://www.novelcrafter.com/', ask: 'ai book writer studio', page: '/books/', label: 'Verse Bookshelf', glyph: 'B', fatality: 'compile chapters from the ledger, export markdown or text, no credits, no subscriptions, nothing sent', extra: ['book studio', 'chapters', 'export', 'offline', 'sharing'] },
];

// Lanes (owner, 2026-10-25: "defeat every single translate site one by one before we move on . its ok to punch down we can just confirm we
// beat suspectected ops after each victory so we wipe out the entire lane each time"): the other sites that do what a floor's site does.
// Each is a floor of its own, right behind its leader, measured by the same gate against the same Verse page, ask and aspects (its evidence
// row is keyed 'leader: host'); the lane is wiped out when every one of them is beaten. Named in plain text only, as every floor is.
// The climb goes up the lane from its bottom (owner, 2026-10-25: "let go to the bottom of the translate list and work up"): each lane is listed
// least visited first, and its sites stand in front of the leader, so the leader is the lane's last fight.
const HAND_LANES = Object.freeze({
  translate: ['https://tradukka.com/', 'https://www.freetranslations.org/', 'https://imtranslator.net/', 'https://www.translator.eu/', 'https://www.onlinedoctranslator.com/', 'https://www.translatedict.com/', 'https://randomtranslator.com/', 'https://www.translate.com/', 'https://www.systransoft.com/translate/', 'https://lingvanex.com/translate/', 'https://itranslate.com/translate', 'https://mymemory.translated.net/', 'https://papago.naver.com/', 'https://www.linguee.com/', 'https://translate.yandex.com/', 'https://www.reverso.net/text-translation', 'https://www.bing.com/translator', 'https://www.deepl.com/translator'],
  // podcasts (owner, 2026-10-26: little fish first, Apple last): podcast directories and web players, smallest first. Not verified live when written (the builder's network was closed): the first gate run reads each one's reachability, and a parked or sign-in-walled site is a finding, not a loss
  podcasts: ['https://podcastindex.org/', 'https://player.fm/', 'https://www.listennotes.com/', 'https://www.podchaser.com/', 'https://www.podbean.com/', 'https://castbox.fm/'],
  recipes: ['https://minimalistbaker.com/', 'https://www.budgetbytes.com/', 'https://www.recipetineats.com/', 'https://www.skinnytaste.com/', 'https://www.seriouseats.com/', 'https://food52.com/', 'https://www.simplyrecipes.com/', 'https://tasty.co/', 'https://www.bbcgoodfood.com/', 'https://www.epicurious.com/', 'https://www.delish.com/', 'https://cookpad.com/', 'https://www.yummly.com/'],
  "random generators": ['https://seventhsanctum.com/', 'https://rangen.co.uk/', 'https://tools.dungeonmastersvault.com/', 'https://www.chaoticshiny.com/', 'https://www.springhole.net/', 'https://www.reedsy.com/', 'https://www.writingexercises.com/', 'https://www.behindthename.com/', 'https://namegenerator.com/', 'https://www.fantasynamegenerators.com/'],
  "docs and notes": ['https://anotepad.com/', 'https://standardnotes.com/', 'https://notepad.pw/', 'https://simplenote.com/', 'https://docs.zoho.com/', 'https://onenote.com/', 'https://evernote.com/', 'https://notion.so/'],
  // the image and text boards, least visited first (text boards among them), the leader last; none of them is ever pictured (noShot on the floor)
  'image boards': ['https://bbs.progrider.org/', 'https://textboard.org/', 'https://sushigirl.us/', 'https://uboachan.net/', 'https://desuchan.net/', 'https://kissu.moe/', 'https://wizchan.org/', 'https://lainchan.org/', 'https://7chan.org/', 'https://www.2chan.net/', 'https://5ch.net/'],
  // sports (owner, 2026-10-26: "need a sports page"): scores sites, smallest first, the leader (ESPN) last; thescore.com and bleacherreport.com left out (an app and a news site, not scores pages), nowgoal.com left out (betting odds first)
  sports: ['https://www.thesportsdb.com/', 'https://www.besoccer.com/', 'https://int.soccerway.com/', 'https://www.onefootball.com/', 'https://www.365scores.com/', 'https://www.fotmob.com/', 'https://www.cbssports.com/', 'https://www.bbc.com/sport', 'https://www.sofascore.com/', 'https://www.flashscore.com/', 'https://www.livescore.com/'],
  // the news sites, least visited first and the leader last (written from what each is, not measured: egress was closed when this was written, so the gate is the first check that each answers)
  news: ['https://www.allsides.com/', 'https://www.thelocal.com/', 'https://www.rnz.co.nz/', 'https://www.channelnewsasia.com/', 'https://www.france24.com/en/', 'https://www.dw.com/en/', 'https://www.euronews.com/', 'https://www.aljazeera.com/', 'https://www.npr.org/', 'https://apnews.com/', 'https://www.theguardian.com/international'],
  // the finance quote sites, least visited first, Yahoo Finance (the floor itself) last; each is measured at its own url by the finance probe against /markets/
  finance: ['https://www.stockq.org/', 'https://stooq.com/', 'https://www.macrotrends.net/', 'https://companiesmarketcap.com/', 'https://stockanalysis.com/', 'https://finviz.com/', 'https://www.barchart.com/', 'https://www.investing.com/', 'https://www.tradingview.com/', 'https://www.marketwatch.com/', 'https://www.google.com/finance/'],
  // PDF tools, least visited first, the leader (ilovepdf.com) last; each found alive and not parked by a web search on 2026-10-26 (a fetch from the builder's network is closed)
  pdf: ['https://codeshack.io/pdf-merge-tool/', 'https://10015.io/tools/pdf-merger', 'https://www.pdfcandy.com/', 'https://www.sejda.com/', 'https://tools.pdf24.org/en/', 'https://smallpdf.com/'],
  // kanban boards, least visited first, Trello last; each found alive by a web search on 2026-10-26, none behind a sign-in on the page measured (kanbanflow.com and wekan.fi ask for an account only to save a shared board)
  kanban: ['https://jasperbernaers.com/kanban-board/', 'https://abacktools.com/tools/productivity/planning/kanban-board', 'https://wekan.fi/', 'https://kanbanflow.com/'],
  // photos (owner, 2026-10-26: "we have to have everything all the sites have"): the small photo tools, smallest first, Google Photos (the floor itself) last; each is measured at its own url by the photos probe against /photos/. All six verified live by search, none parked, none behind a sign-in; photopea.com and iloveimg.com are the big ones of the lane
  photos: ['https://exifeditor.io/', 'https://exif.tools/', 'https://tinypng.com/', 'https://squoosh.app/', 'https://www.photopea.com/', 'https://www.iloveimg.com/'],
  // music (owner, 2026-10-26: "we have to have everything all the sites have"): small music tools, smallest first, Spotify (the floor itself) last. metronomeonline.com and virtualpiano.net are the owner's; the others were found by search as live, real, no-sign-in pages (a tuner, a BPM counter, a chord finder). Each has a page of its own (LANE_PAGES) and aspects named for what that site does (LANE_EXTRAS)
  music: ['https://jasperbernaers.com/free-online-guitar-tuner-and-instrument-tuner/', 'https://anotherproducer.com/online-tools-for-musicians/bpm-counter/', 'https://chordchord.com/chord-finder', 'https://metronomeonline.com/', 'https://virtualpiano.net/'],
  // photos (owner, 2026-10-26: "we have to have everything all the sites have"): the small photo tools, smallest first, Google Photos (the floor itself) last; each is measured at its own url by the photos probe against /photos/. All six verified live by search, none parked, none behind a sign-in; photopea.com and iloveimg.com are the big ones of the lane
  photos: ['https://exifeditor.io/', 'https://exif.tools/', 'https://tinypng.com/', 'https://squoosh.app/', 'https://www.photopea.com/', 'https://www.iloveimg.com/'],
  // travel (owner, 2026-10-26: "need a flights page"): the small flight and trip tools, smallest first, Google Flights (the floor itself) last; each found alive by a web search on 2026-10-26 (a fetch from the builder's network is closed). tripwaffle.com asks for an account to keep a trip (its public side is a page about forwarding booking emails); the others are open pages. Each gets a page of its own (LANE_PAGES)
  travel: ['https://tripwaffle.com/', 'https://aruljohn.com/airport-codes/', 'https://www.clock7.com/flight-calculator/', 'https://www.airmilescalculator.com/', 'https://www.gcmap.com/', 'https://co2.myclimate.org/en/flight_calculators/new', 'https://www.flightconnections.com/'],
  // jobs (owner, 2026-10-26: "we have to have everything all the sites have"): small job boards, smallest first by a guess (Tranco was out of reach from the builder's
  // network; tower-rank.yml re-orders by the real list), LinkedIn Jobs (the floor itself) last. Each has a page of its own (LANE_PAGES) built on remote listings Verse may
  // show (Remotive, Jobicy and Himalayas, lib/jobs-core.js); Verse uses three of them as sources as well as fighting them (owner, 2026-10-26: "dont forget Verse can use
  // these sites as well as beat them")
  jobs: ['https://jobicy.com/', 'https://www.workingnomads.com/jobs', 'https://www.arbeitnow.com/', 'https://himalayas.app/jobs', 'https://remotive.com/', 'https://remoteok.com/', 'https://weworkremotely.com/'],
  calendar: ['https://calendar.online/', 'https://www.teamup.com/', 'https://timetreeapp.com/', 'https://www.any.do/calendar', 'https://www.cozi.com/', 'https://proton.me/calendar', 'https://calendar.zoho.com/', 'https://www.icloud.com/calendar', 'https://calendar.yahoo.com/', 'https://outlook.live.com/calendar'],
});
// the sites Verse took on by itself (lib/self-sites.js, tools/tower-self.mjs): each joins its family's lane, in front of the leader, with its own page
export const LANES = Object.freeze(selfLanes(HAND_LANES, SELF_SITES));
/** the hand lanes with the self-built sites added at the end of their family's lane (a host already in a lane is not added twice). Pure. */
export function selfLanes(lanes, rows) {
  const out = { ...lanes };
  for (const r of rows || []) { if (!r || !r.family || !r.url) continue; const h = (u) => String(u).replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, ''), have = (out[r.family] || []).map(h); if (!have.includes(h(r.url))) out[r.family] = [...(out[r.family] || []), r.url]; }
  return out;
}
// A lane site with a page of its own (owner, 2026-10-26: "even if we are sure we already stomp them we still make a page and beat them"; docs/RULES.md): the
// floor id of a lane site -> the Verse page built to have every feature that site has, which the gate measures it against instead of the leader's page.
// A site not listed here is still measured against its leader's page until its own page is built.
export const LANE_PAGES = Object.freeze({ ...Object.fromEntries((SELF_SITES || []).filter((r) => r && r.lane && r.page).map((r) => [r.lane, r.page])),
  'photos: exifeditor.io': '/photos/exifeditor/', 'photos: exif.tools': '/photos/exif/', 'photos: tinypng.com': '/photos/tinypng/', 'photos: squoosh.app': '/photos/squoosh/', 'photos: photopea.com': '/photos/photopea/', 'photos: iloveimg.com': '/photos/iloveimg/',
  'pdf: codeshack.io': '/pdf/merge/', 'pdf: 10015.io': '/pdf/organize/', 'pdf: pdfcandy.com': '/pdf/toolbox/', 'pdf: sejda.com': '/pdf/editor/', 'pdf: tools.pdf24.org': '/pdf/suite/', 'pdf: smallpdf.com': '/pdf/studio/',
  'sports: thesportsdb.com': '/sports/',
  'kanban: jasperbernaers.com': '/kanban/simple/', 'kanban: abacktools.com': '/kanban/quick/', 'kanban: wekan.fi': '/kanban/teams/', 'kanban: kanbanflow.com': '/kanban/flow/',
  'music: jasperbernaers.com': '/tuner/', 'music: anotherproducer.com': '/bpm/', 'music: chordchord.com': '/chords/', 'music: metronomeonline.com': '/metronome/', 'music: virtualpiano.net': '/piano/',
  'travel: tripwaffle.com': '/flights/trip/', 'travel: aruljohn.com': '/flights/airports/', 'travel: clock7.com': '/flights/time/', 'travel: airmilescalculator.com': '/flights/distance/', 'travel: gcmap.com': '/flights/map/', 'travel: co2.myclimate.org': '/flights/co2/', 'travel: flightconnections.com': '/flights/routes/',
  'jobs: jobicy.com': '/jobs/regions/', 'jobs: workingnomads.com': '/jobs/alerts/', 'jobs: arbeitnow.com': '/jobs/europe/', 'jobs: himalayas.app': '/jobs/salary/', 'jobs: remotive.com': '/jobs/categories/', 'jobs: remoteok.com': '/jobs/tags/', 'jobs: weworkremotely.com': '/jobs/companies/',
  'finance: companiesmarketcap.com': '/markets/caps/', 'finance: finviz.com': '/markets/screener/?near=100&sort=pct',
  // a frontier site's own page, by its host: sycophanthex.com, the tower target since 2026-10-29 (a fan-fiction archive), is assimilated by /fanfic/, the
  // archive built to its catalog (domains/targets/sycophanthex.json)
  'sycophanthex.com': '/fanfic/',
  // wheelroot.com ("Drawing Fundamentals", a course page whose button leads nowhere) is assimilated by /learn-to-draw/, the course itself (domains/targets/wheelroot.json)
  'wheelroot.com': '/learn-to-draw/',
});
// the aspects a lane site's own page is asked about, when they are not its leader's (the leader's extras are for the leader's page): sports: thesportsdb.com, a sports database
// that browses by sport and searches across all of them, is not asked about live scores
export const LANE_EXTRAS = Object.freeze({
  'music: jasperbernaers.com': ['microphone tuning', 'instrument presets', 'reference tones', 'adjustable A4'],
  'music: anotherproducer.com': ['tap tempo counter', 'half and double time', 'note lengths', 'tempo of a file'],
  'music: chordchord.com': ['chord finder', 'scale finder', 'guitar and piano shapes', 'chords in a key'],
  'music: metronomeonline.com': ['tap tempo', 'accents', 'subdivisions', 'practice timer', 'light and dark mode', 'sounds'],
  'music: virtualpiano.net': ['computer keyboard play', 'touch and mouse play', 'sustain', 'instruments', 'sheet music', 'MIDI input'],
  'travel: tripwaffle.com': ['paste a confirmation', 'day by day timeline', 'layover warnings', 'calendar export', 'share a trip', 'works offline'],
  'travel: aruljohn.com': ['code lookup', 'search by city or country', 'airport details', 'nearby airports'],
  'travel: clock7.com': ['flight duration', 'local arrival time', 'time zone difference', 'date line', 'layover'],
  'travel: airmilescalculator.com': ['distance in miles and km', 'flight time', 'time difference', 'flown distance', 'multi leg trips'],
  'travel: gcmap.com': ['route map', 'chained routes', 'great circle distance', 'airport info'],
  'travel: co2.myclimate.org': ['CO2 per passenger', 'cabin class', 'return trip', 'method named'],
  'travel: flightconnections.com': ['where can I go', 'filter by distance', 'airport finder', 'provider links'],
  'jobs: jobicy.com': ['jobs by region', 'industry filter', 'job level', 'salary when given', 'RSS feed'],
  'jobs: workingnomads.com': ['saved searches', 'new since last visit', 'no email needed', 'categories', 'RSS feed'],
  'jobs: arbeitnow.com': ['jobs open in Germany', 'visa sponsorship filter', 'remote filter', 'German and English'],
  'jobs: himalayas.app': ['salary filter', 'highest paid first', 'seniority', 'time zones'],
  'jobs: remotive.com': ['categories with counts', 'keyword search', 'job type', 'source credited'],
  'jobs: remoteok.com': ['tag cloud', 'salary', 'sort by pay or date', 'RSS feed'],
  'jobs: weworkremotely.com': ['companies hiring', 'jobs of one company', 'categories', 'saved jobs'],
  'sports: thesportsdb.com': ['sport search', 'born on this day', 'sport grid', 'free api'] });
const laneHost = (u) => String(u).replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '');
/** the hand-named floors with each one's lane unrolled behind it. Pure. */
export function withLanes(floors, lanes = LANES) {
  const out = [];
  for (const f of floors) { for (const url of lanes[f.id] || []) { const h = laneHost(url); out.push({ id: f.id + ': ' + h, lane: f.id, site: h, url, ask: f.ask, page: LANE_PAGES[f.id + ': ' + h] || f.page, label: f.label + ': ' + h, glyph: f.glyph, extra: LANE_EXTRAS[f.id + ': ' + h] || f.extra, ...(f.noShot ? { noShot: true } : {}) }); } out.push(f); }
  return out;
}
export const FLOORS = withLanes(HAND_FLOORS);
/** true when no picture of a floor's site may be kept or shown (the floor, or its lane's leader, says noShot): /compare/ and the gate read it. Pure. */
// a site the gate never opens (owner, 2026-10-28: skip opening vcalc.com in gate runs, its robots.txt blocks bots): noRival names why. Its floor is judged on Verse's own
// numbers against the bar, and rivalCount (the size the site publishes, with where it says so) is what Verse's library is held to, so the gap shows and it is not beaten.
/** why the gate must not open a floor's site ('' when it may), from the floor or its lane's leader. Pure. */
export const noRivalOf = (f) => String((f && (f.noRival || (f.lane && (HAND_FLOORS.find((x) => x.id === f.lane) || {}).noRival))) || '');
/** true when a URL is on a site the gate never opens (any floor with noRival names it). Pure. */
export function noRivalUrl(url) { const h = hostOf(url).replace(/^www\./, ''); return !!h && HAND_FLOORS.some((f) => f.noRival && hostOf(f.url).replace(/^www\./, '') === h); }
export const noShotOf = (f) => !!(f && (f.noShot || (f.lane && (HAND_FLOORS.find((x) => x.id === f.lane) || {}).noShot)));
// fatality (owner, 2026-10-24: "i like the match then killshot", then "killshot= fatality"): once a site's aspects are matched, the one thing Verse does that the site cannot
// answer, so the site becomes obsolete rather than equal. Only a thing that is built and live is written here; the card shows it as a plain line.
/** a floor's fatality, which is also called its killshot (owner, 2026-10-24: "killshot= fatality", then "killshot can be kept too"): either field names it. Pure. */
export const fatalityOf = (f) => String((f && (f.fatality || f.killshot)) || '');
/** what a beaten site taught Verse, in one line: the hand-written `learned` when a builder wrote one, else the gate's own numbers for the
 *  fight (owner, 2026-10-25: every surpassed site on "What each site taught me"): the load time against the site's, the things a full answer
 *  shows against the site's and what the site lacked, and the site's own aspects it had none of. '' when nothing is measured. Pure. */
export function learnedOf(f) {
  if (f && f.learned) return String(f.learned);
  const ev = (f && f.ev) || {}, bits = [];
  const sp = ev.speed; if (sp && Number.isFinite(+sp.verse) && Number.isFinite(+sp.best) && +sp.best > 0) bits.push(sp.verse + ' ms to load against ' + sp.best + ' ms');
  const cp = ev.completeness; if (cp && Number.isFinite(+cp.verse) && cp.of) { const lack = String(cp.evidence || '').match(/site lacks: ([^)]+)\)/); bits.push(cp.verse + ' of ' + cp.of + ' things a full answer shows' + (Number.isFinite(+cp.best) && +cp.best !== +cp.verse ? ' against ' + cp.best : '') + (lack && lack[1] !== 'none' ? ' (the site lacked ' + lack[1] + ')' : '')); }
  const none = (f.extra || []).filter((a) => ev[a] && ev[a].verdict === 'better' && /site lacks: (?!none)/.test(String(ev[a].evidence || '')) && +ev[a].best === 0);
  if (none.length) bits.push('the site had no ' + none.join(', '));
  if (!bits.length) return '';
  const won = f.m ? 'beaten on ' + f.n + ' of ' + f.m + ' aspects: ' : '';
  return won + bits.join('; ');
}
// the journeys (owner's standards, 2026-10-28; lib/tower-journeys.js) are on every floor's checklist: a floor is beaten only when its scripted
// end-to-end journeys pass, never by aspects alone
export const aspectsOf = (f) => COMMON_ASPECTS.concat(f.extra || [], journeyAspects(f));
// a floor's checklist plus anything its evidence names beyond it: a site that gains a feature Verse lacks (tools/tower-verdict.mjs --lost)
// adds that aspect, and the floor is not beaten until Verse has it too
const checklist = (f, ev) => { const all = aspectsOf(f); for (const k of Object.keys(ev || {})) if (!all.includes(k)) all.push(k); return all; };
const OK = new Set(['better', 'equal-and-better']);

/** one floor's gate from its evidence ({ [aspect]: { verdict, verse, best, at, evidence } }): beaten only when every aspect passes with evidence. Pure. */
// a row Verse awarded itself because one of its skills answered (the old gate, taken back 2026-10-24: "this whole card is fake") never counts,
// whoever writes it into the file
export const selfCalled = (r) => !!(r && r.called && /^called beaten by verse\b/.test(String(r.evidence || '')));
// The standards (owner, 2026-10-28, after Amazon read 11 of 13 and YouTube read "replaced"): a journey passes only with its recorded steps and
// negative controls (lib/tower-controls.js journeyPasses); a row that was blocked, skipped or not loaded is INCOMPLETE, never a pass; a
// comparison won only because the rival could not be read (zeroRivalUnread: "0 of 3 ... turned the gate away", "0 of 23 things") is INCOMPLETE.
// `incomplete` lists them so the card says so instead of counting them.
// a journey row passes when the runner took it with its controls, or when a person signed the floor beaten (tools/tower-verdict.mjs --beaten:
// the owner or the scout took the journeys by hand; a call Verse made itself never counts)
// a row the gate scored against its default bar because the site turned the gate away (tools/tower-gate.mjs "vs the bar (<site> unreachable)")
// measured Verse, not the site (owner's card, 2026-10-29: "those numbers are not its own"): it is not measured against the site, so it is never a
// lead and never part of a surpass. It stays a loss when Verse is short of the bar, since that gap is Verse's own.
export const barRow = (r) => !!r && / vs the bar \(/.test(String(r.evidence || ''));
export const passes = (a, r) => !barRow(r) && (isJourney(a) ? journeyPasses(r) || !!(r && r.called && r.verdict === 'better' && r.evidence && !selfCalled(r) && !incompleteRow(r)) : !!(r && OK.has(r.verdict) && r.evidence && !selfCalled(r) && !incompleteRow(r) && !zeroRivalUnread(r)));
export function gate(floor, ev = {}) {
  const all = checklist(floor, ev), passed = all.filter((a) => passes(a, ev[a]));
  const regressed = all.filter((a) => ev[a] && ev[a].verdict === 'worse' && ev[a].was && OK.has(ev[a].was));
  const incomplete = all.filter((a) => !passed.includes(a) && !(ev[a] && ev[a].verdict === 'worse') && (ev[a] ? (incompleteRow(ev[a]) || zeroRivalUnread(ev[a]) || barRow(ev[a]) || isJourney(a)) : isJourney(a)));
  return { aspects: all, measured: all.some((a) => ev[a]), lost: all.filter((a) => ev[a] && ev[a].verdict === 'worse'), beaten: passed.length === all.length, n: passed.length, m: all.length, left: all.filter((a) => !passed.includes(a)), regressed, incomplete };
}
/** evidence rows that pass a floor's whole checklist the way the gate demands (journeys with steps and negative controls): for tests and
 *  fixtures only, never written to tower.evidence.json. Pure. */
export const passingRows = (f, extra = {}) => Object.fromEntries(aspectsOf(f).map((a) => [a, isJourney(a) ? { verdict: 'pass', steps: ['fixture step'], negatives: ['no stub text'], evidence: 'fixture', ...extra } : { verdict: 'better', evidence: 'x', ...extra }]));

const HOST_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
/** a host from what a list names ("Example.com", "https://www.example.com/x"), or '' when it is not one. Pure. */
export function hostOf(s) {
  const h = String(s || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '').replace(/\.$/, '');
  return HOST_RE.test(h) ? h : '';
}
/** the frontier's sites (tower.frontier.json, the real tool sites ranked from the top million by easiest-sites.mjs --tools) as one list: one per
 *  host, never a site that is already in FLOORS, smallest first: a site the scan counted the controls and bytes of first, by the fewest controls, then the
 *  fewer bytes (owner, 2026-10-29); then the scan's hardness, then the least visited, the rest in the order they came. Pure. */
export function frontierOf(frontier, floors = FLOORS) {
  const list = Array.isArray(frontier) ? frontier : frontier && Array.isArray(frontier.sites) ? frontier.sites : [];
  const taken = new Set(floors.map((f) => hostOf(f.url) || hostOf(f.site)).filter(Boolean)), seen = new Set(), out = [];
  for (const x of list) {
    const host = hostOf(x && (x.site || x.host)); if (!host || taken.has(host) || seen.has(host)) continue;
    const num = (v) => (v !== null && v !== '' && Number.isFinite(+v) ? +v : null);
    seen.add(host); out.push({ host, rank: Number.isFinite(+x.rank) && +x.rank > 0 ? +x.rank : null, hardness: num(x.hardness), controls: num(x.controls), bytes: num(x.bytes), ...(x.blocked ? { blocked: String(x.blocked) } : {}) });
  }
  const h = (x) => (x.hardness === null ? 1e9 : x.hardness), sized = (x) => (x.controls !== null && x.bytes !== null ? 0 : 1), c = (x) => (sized(x) ? 0 : x.controls), by = (x) => (sized(x) ? 0 : x.bytes);
  return out.map((x, i) => [x, i]).sort((a, b) => sized(a[0]) - sized(b[0]) || c(a[0]) - c(b[0]) || by(a[0]) - by(b[0]) || h(a[0]) - h(b[0]) || (b[0].rank || 0) - (a[0].rank || 0) || a[1] - b[1]).map((p) => p[0]);
}

/** the whole tower: each site's gate, coverage (replaced, partial, missing from lap.items.json) and skills; the conquered sites first, then the
 *  current one (the easiest not yet beaten), then the rest of the queue. A regression un-beats a site and puts it back in the queue. Pure. */
// the tower has no end (owner, 2026-10-24: "it is endless, we look through literally every site and defeat them all"; "Don't separate \"named
// floors\" from \"frontier floors\"—treat all unbeaten sites as one queue sorted easiest-first"): FLOORS and every frontier site are one queue,
// sorted by how many aspects Verse still has to beat, then by the order they came (FLOORS, then the scan's hardness). `total` is the sites found
// so far, never a ceiling: it grows as the scan grows.
// How big a site is, as a tier (owner, 2026-10-26: "we should just go after smaller sites no reason to go after big sites yet"; 2026-10-28: "move
// backwards to easier sites"):
// 0 = outside the top 100,000 most visited (Tranco, tower.rank.json) or unranked, 1 = 10,000 to 100,000, 2 = 1,000 to 10,000, 3 = the giants.
export const sizeTier = (rank) => (!Number.isFinite(+rank) || !rank || +rank >= 100000 ? 0 : +rank >= 10000 ? 1 : +rank >= 1000 ? 2 : 3);
export const TIER_WORDS = Object.freeze(['small', 'mid-size', 'large', 'giant']);
/** why a site stands where it does in the queue, in words, from its tier, what is left and whether Verse has a page for it. Pure. */
export function easeLine(f) {
  if (f.held) return 'held, not beaten: ' + f.held;
  const left = Math.max(0, (f.m || 0) - (f.n || 0)), sc = f.size ? f.size.scripts : 0;
  const tc = trustedControls(f.size), ctl = tc !== null ? 'has ' + tc + ' controls on its home page and ' : '';
  const how = f.weight !== null && f.size ? ctl + 'weighs ' + bytesLabel(f.size.bytes) + ' over ' + sc + (sc === 1 ? ' script' : ' scripts') + ', ' + f.size.nodes + ' elements and ' + f.size.routes + ' routes (' + ['1 KB club', 'light', 'medium', 'heavy'][weightBand(f.weight)] + ')'
    : 'not weighed yet' + (f.rank ? ' (ranked #' + Number(f.rank).toLocaleString('en-US') + ' of the million most visited)' : '');
  const bar = (f.barred || []).length;
  return how + '; ' + left + ' of ' + f.m + ' aspects left to pass' + (bar ? ' (' + bar + ' of them not measured: the site turned the gate away, so only the default bar was scored)' : '') + (f.lost && f.lost.length ? ', and Verse loses on ' + f.lost.length : '') + '; ' + (f.page ? 'Verse has a page for it' : 'Verse has no page for it yet, so it is built first');
}
/** `target` is the id of the site Verse is on (tower.target.json): it stands first, and keeps standing first, until it is beaten; only then does the next smallest site take over. */
export function tower(onlySite = [], evidence = {}, frontier = null, icons = null, rank = null, size = null, target = null) {
  const cov = new Map((onlySite || []).map((r) => [r.category, r]));
  // a renamed floor (aka) still finds its coverage row and its evidence under the old id
  const under = (m, f) => (m && m[f.id]) || (f.aka && m && m[f.aka]) || undefined;
  const sites = FLOORS.concat(frontierOf(frontier).map((x) => ({ id: x.host, site: x.host, url: 'https://' + x.host + '/', label: x.host, extra: [], ...(LANE_PAGES[x.host] ? { page: LANE_PAGES[x.host] } : {}), rank: x.rank || null, ...(x.blocked ? { blocked: x.blocked } : {}) })));
  // each floor keeps its evidence rows (`ev`): the matchup on the card reads the measured numbers and times from them (owner, 2026-10-25:
  // "something that shows the matchup and how aware we are of what is happening")
  const all = sites.map((f, i) => { const ev = under(evidence, f) || {}, g = gate(f, ev), c = cov.get(f.id) || (f.aka && cov.get(f.aka)) || {}; const icon = icons && (icons[hostOf(f.url) || hostOf(f.site)] || null); const badge = badgeOf(f); const sz = size && size.sites ? size.sites[hostOf(f.url) || hostOf(f.site)] || null : null; const r = rank ? (Number.isFinite(+((rank.order || {})[f.id])) && (rank.order || {})[f.id] !== null && (rank.order || {})[f.id] !== '' ? +rank.order[f.id] : (rank.ranks || {})[f.id] || (rank.ranks || {})[hostOf(f.url) || hostOf(f.site)] || f.rank || null) : (f.rank || null); return { ...f, order: i, ...g, rankLost: g.lost.filter((a) => !barRow(ev[a])), barred: g.aspects.filter((a) => barRow(ev[a])), beaten: g.beaten && !f.held, ev, icon, badge, rank: r, tier: sizeTier(r), size: sz, weight: weightOf(sz), coverage: c.status || 'missing', skills: c.skills || [] }; });
  // a site Verse is measured worse on cannot be beaten easily (owner, 2026-10-24: "then find an easier site if we cant beat it easily"): it waits
  // behind every site Verse loses on nothing, still in the queue, and comes back to the front once its losses are fixed
  // the queue ranks on measured rows only (2026-10-29): a loss against the default bar (the site turned the gate away, barRow) stays a loss on the
  // card, but it says nothing about the site, so it never moves the site back in the queue
  const hard = (f) => (f.rankLost.length ? 1 : 0);
  // a lane site stands where its leader would and just in front of it, so the climb goes up the lane from its bottom and the leader is its last fight
  const lead = new Map(all.map((f) => [f.id, f])), key = (f) => (f.lane && lead.get(f.lane) && !lead.get(f.lane).beaten ? lead.get(f.lane) : f);
    // a mega-site floor waits (owner, 2026-10-26: "we should just go after smaller sites no reason to go after big sites yet"): the giants keep their
  // place in the queue but stand behind every small site, so the fight on the stage is always the easiest one left. The flag is read off the floor
  // itself, never off key(), so a deferred leader's lane still climbs from its bottom; the giant comes back to the front once the small sites are done.
  const waiting = (f) => (f.defer ? 1 : 0);
  // the gate badge (lib/gate-badge.js): the build queue picks only Code work, or stage 1 on a regulated floor; a floor that needs a partner or a licence
  // keeps its place in the line but never stands as the current fight, so nothing past what is real gets built or claimed
  const gated = (f) => (buildable(f.badge) ? 0 : 1);
  // far future (owner, 2026-10-28: Amazon and YouTube): behind every other site, deferred giants included; and before the hand floors' own
  // order, small single-purpose sites first (owner: "work through millions of small sites, easiest first"): a site with at most two aspects of
  // its own (a frontier tool site has none) stands before a broad, many-feature one
  const far = (f) => (f.farFuture ? 1 : 0), broad = (f) => ((f.extra || []).length > 2 ? 1 : 0);
  // with the size data (the card, the plan) the queue is smallest first, then by work left: gate, far future, a waiting giant, then size (owner,
  // 2026-10-29: "all sites ever made smallest first", smallest being the fewest interactive elements on the home page, the lighter page on a tie):
  // a site counted by tools/tower-size.mjs (controls and bytes) by its controls, then its bytes; then a site only weighed, by its weight; then an
  // unmeasured one by its size tier; then what Verse loses on, aspects still to pass, a site with a page before one without, then the order they
  // came. Without it the old order stands.
  const pinned = (f) => (target && f.id === target && !f.held ? 0 : 1); // the fight in progress stays first until it is won
  const counted = (f) => !!f.size && trustedControls(f.size) !== null && Number.isFinite(+f.size.bytes); // a shell count (under 2) is not counted
  const tierOf = (f) => (rank ? (counted(f) ? 0 : f.weight !== null ? 1 : 2 + f.tier) : 0), ctrlOf = (f) => (counted(f) ? +f.size.controls : 0);
  const lightOf = (f) => (counted(f) ? +f.size.bytes : f.weight !== null ? f.weight : 0), pageless = (f) => (rank && !f.page ? 1 : 0);
  const queue = all.filter((f) => !f.beaten).sort((a, b) => { const x = key(a), y = key(b); return pinned(a) - pinned(b) || gated(a) - gated(b) || far(a) - far(b) || waiting(a) - waiting(b) || tierOf(x) - tierOf(y) || ctrlOf(x) - ctrlOf(y) || lightOf(x) - lightOf(y) || broad(x) - broad(y) || hard(x) - hard(y) || (x.m - x.n) - (y.m - y.n) || pageless(x) - pageless(y) || x.order - y.order || a.order - b.order; }), won = all.filter((f) => f.beaten), floors = won.concat(queue);
  floors.forEach((f, i) => { f.floor = i + 1; f.state = f.beaten ? 'beaten' : f === queue[0] ? 'current' : 'ahead'; });
  return { floors, marker: won.length + 1, beaten: won.length, total: floors.length, open: true };
}
/** Versus in one line: the site Verse is on now and how many it has conquered. Pure. */
// a held site says why it is not surpassed, so "16 of 16 aspects ahead, 0 surpassed" explains itself (owner's card, 2026-10-29)
export const towerLine = (t) => { const f = t.floors[t.marker - 1]; return 'Versus: now ' + (f ? f.site + ' (Verse ahead on ' + f.n + ' of ' + f.m + ' aspects' + (f.held ? '; held: ' + f.held : '') + ')' : 'the next site the scan finds') + ', ' + t.beaten + ' surpassed'; };
/** tower()'s arguments from the published files, the same on every card that names the site Verse is on (skills/tower.js, /api/will):
 *  ev, fr, rk, sz and tg are tower.evidence.json, tower.frontier.json, tower.rank.json, tower.size.json and tower.target.json, each null
 *  when it could not be read. Without the target a card ranks by the default order and can name a different site than the Versus card. Pure. */
export const towerArgs = (onlySite, { ev = null, fr = null, rk = null, sz = null, tg = null } = {}) => [onlySite || [], (ev && ev.floors) || {}, fr, (ev && ev.icons) || null, rk && rk.list && rk.ranks ? rk : null, sz && sz.sites ? sz : null, tg && tg.id ? tg.id : null];

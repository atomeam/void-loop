/**
 * seo: what a search engine is told about each tool page, from one short table (owner, 2026-10-25: "we should figure out a way for our site to pop
 * up before all of our defeated sites"). Honest search presence only: every line here is true of the page it describes, the phrases are the words
 * people type for what the page does, and nothing is hidden, stuffed or claimed about another site. From the table each page gets, by
 * tools/seo-pages.mjs (a refresh step): a canonical link, one JSON-LD script (a WebApplication, free, any OS, with a BreadcrumbList and, where the
 * page takes its setting in the link, a potentialAction whose urlTemplate reaches it) and a visible "Common asks" row of real links to the exact
 * setup people most often want. llms.txt lists the pages from the same table. Pure. Tests: tools/seo.test.mjs.
 */
import { SITE_PAGES } from './tool-sites.js';
export const SITE = 'https://a-to-mind.com';

/** one row per tool page: path (as lib/toolkit.js TOOLS names it), name, what it does (true of the page), the phrases people search, the setting
 *  the link takes (an EntryPoint urlTemplate with one placeholder, or none) and the common asks shown as links on the page */
export const PAGES = Object.freeze([
  { path: '/color/', name: 'Colour codes, shades and schemes', does: 'Type a colour as hex, RGB, HSL or a name and get it in every model, its nearest name, tints, shades and tones, five colour schemes and whether text on it can be read. Palettes made from it, your own saved palettes, colour-blind views and the 216 web-safe colours. Nothing sent anywhere.',
    asks: ['hex to rgb', 'rgb to hex', 'hex colour codes', 'colour code converter', 'hsl to hex', 'colour shades and tints', 'colour scheme generator'],
    action: { template: '/color/?c={color}', input: 'color' },
    links: [['#ff5733', '/color/?c=ff5733'], ['#6d4aff', '/color/?c=6d4aff'], ['#ff0000', '/color/?c=ff0000'], ['#00ff00', '/color/?c=00ff00'], ['#0000ff', '/color/?c=0000ff'], ['#ffa500', '/color/?c=ffa500'], ['#808080', '/color/?c=808080']] },
  { path: '/gradient/', name: 'CSS gradient generator', does: 'Make a linear, radial or conic CSS gradient from colour stops, name it, save it as your own preset on your device, pick colours from the screen, and copy its CSS. Nothing sent anywhere.',
    asks: ['css gradient generator', 'linear gradient css', 'radial gradient generator', 'gradient background css', 'gradient colour generator'] },
  { path: '/wheel/', name: 'Wheel of names', does: 'Names, choices or pictures, spun on a fair wheel with the spin time you choose, confetti and a cheer for the winner, who can leave the wheel by itself; the winner is picked at random on your device.',
    asks: ['wheel of names', 'random name picker', 'spin the wheel', 'picker wheel', 'decision wheel', 'random picker wheel'] },
  { path: '/random-user/', name: 'Made-up people for testing', does: 'Made-up people by count, gender and 22 countries, with titles, names, addresses, two phones, dates of birth, passwords to your rules and pictures, as JSON, CSV, YAML, XML or SQL, from a seed you can repeat page by page. None of them is real.',
    asks: ['random user generator', 'fake name generator', 'fake user data for testing', 'random person generator', 'test data generator json', 'random address generator'] },
  { path: '/random/', name: 'Random number', does: 'A random number between two bounds, several at once, without repeats or sorted, with decimal places or in binary, octal or hex, plus a shuffled deck of cards dealt into hands and random dates and times; the number is on screen at once.',
    asks: ['random number generator', 'random number between 1 and 100', 'random number picker', 'random numbers no repeats', 'lottery number generator'] },
  { path: '/flip/', name: 'Flip a coin', does: 'Heads or tails from a coin that lands in under a second, with no ads and nothing to accept.',
    asks: ['flip a coin', 'coin flip online', 'heads or tails', 'coin toss', 'virtual coin flip'] },
  { path: '/stopwatch/', name: 'Stopwatch and timer', does: 'A stopwatch with laps, a countdown timer with presets, your own saved timers and a choice of alarms, an interval timer (work and rest rounds in sets) and a chess clock with increment, kept on your device, working offline.',
    asks: ['online stopwatch', 'countdown timer', 'timer with alarm', 'stopwatch with laps', '5 minute timer', 'interval timer', 'tabata timer', 'chess clock'],
    action: { template: '/stopwatch/?t={duration}', input: 'duration' },
    links: [['5 minute timer', '/stopwatch/?t=5m'], ['10 minute timer', '/stopwatch/?t=10m'], ['Tabata 20/10', '/stopwatch/?iv=20,10,8,1,0,10'], ['HIIT 40/20', '/stopwatch/?iv=40,20,10,1,0,10'], ['Blitz chess 3+2', '/stopwatch/?cc=3%2B2']] },
  { path: '/word-count/', name: 'Word counter', does: 'Words, characters with and without spaces, sentences, paragraphs, pages, reading and speaking time and repeated phrases as you type, with a word goal, read aloud, earlier versions kept on your device and the limits your text fits. Nothing sent anywhere.',
    asks: ['word counter', 'character counter', 'count words online', 'sentence counter', 'reading time calculator', 'speaking time calculator'] },
  { path: '/base-converter/', name: 'Binary, decimal, hex and octal converter', does: 'Type a number in binary, octal, decimal, hex or any base up to 36 and see it in all of them at once, exact at any size, fractions too (a repeating part in brackets), with its signed reading, its text and the working step by step.',
    asks: ['binary to decimal', 'hex to binary', 'decimal to binary', 'hex to decimal', 'octal converter', 'binary translator', 'number base converter'],
    action: { template: '/base-converter/?v={value}&b={base}', input: 'value' },
    links: [['ff in hex', '/base-converter/?v=ff&b=16'], ['1010 in binary', '/base-converter/?v=1010&b=2'], ['255 in decimal', '/base-converter/?v=255&b=10'], ['777 in octal', '/base-converter/?v=777&b=8'], ['deadbeef in hex', '/base-converter/?v=deadbeef&b=16'], ['11111111 in binary', '/base-converter/?v=11111111&b=2'], ['1024 in decimal', '/base-converter/?v=1024&b=10']] },
  { path: '/password-strength/', name: 'How secure is my password?', does: 'How long a password would take to guess, why, and what to change, worked out on your device: the password is never sent anywhere.',
    asks: ['how secure is my password', 'password strength checker', 'password checker', 'how long to crack my password', 'is my password strong', 'password entropy'] },
  { path: '/resize-image/', name: 'Resize and compress a photo', does: 'Make a photo or signature an exact size in cm, mm, inches or pixels and under a size limit in KB, as a JPEG or a PDF, on your device: nothing is uploaded.',
    asks: ['resize image in cm', 'passport photo size', 'pan card photo size 3.5 x 2.5 cm', 'compress image to 50kb', 'resize signature image', 'image to pdf', 'resize photo in pixels'],
    action: { template: '/resize-image/?w={width}&h={height}&u={unit}', input: 'width' },
    links: [['PAN card photo 3.5 × 2.5 cm', '/resize-image/?w=3.5&h=2.5&u=cm'], ['Passport photo 35 × 45 mm', '/resize-image/?w=35&h=45&u=mm'], ['US passport 2 × 2 in', '/resize-image/?w=2&h=2&u=in'], ['200 × 200 px', '/resize-image/?w=200&h=200&u=px'], ['Under 50 KB', '/resize-image/?kb=50']] },
  { path: '/convert/', name: 'Unit converter', does: 'Convert 52 kinds of unit, from length to torque, voltage, capacitance, density and typography, every unit of a kind at once, both ways, from exact definitions, with the formula and your choice of precision; type an ask like 100 c to f.',
    asks: ['unit converter', 'celsius to fahrenheit', 'cm to inches', 'kg to lbs', 'km to miles', 'litres to gallons', 'mph to kmh', 'metric conversion'],
    action: { template: '/convert/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['100 °C to °F', '/convert/?q=100+c+to+f'], ['5 km to miles', '/convert/?q=5+km+to+miles'], ['1 inch in mm', '/convert/?q=1+inch+in+mm'], ['180 lb to kg', '/convert/?q=180+lb+to+kg'], ['1 cup to ml', '/convert/?q=1+cup+to+ml'], ['100 mph to km/h', '/convert/?q=100+mph+to+kmh'], ['30 psi to bar', '/convert/?q=30+psi+to+bar'], ['1 acre in square metres', '/convert/?q=1+acre+in+square+metres']] },
  { path: '/calculator/', name: 'Scientific calculator', does: 'Brackets, powers, roots, sin, cos and tan in degrees or radians, logs, factorial, percent, memory keys, a history kept on your device, unit conversion and keyboard input; exact display (0.1 + 0.2 = 0.3); plus loan with an amortization schedule and chart, mortgage, compound interest, percentage, BMI and calorie calculators. Works offline.',
    asks: ['scientific calculator online', 'online calculator', 'calculator with history', 'percentage calculator', 'square root calculator', 'sin cos tan calculator'],
    action: { template: '/calculator/?q={search_term_string}', input: 'search_term_string', search: true } },
  { path: '/time/', name: 'Time zones', does: 'The current time in any city, a world clock of the places you pick, a time zone converter and a meeting planner, with daylight saving, from your browser’s own time-zone data. Works offline.',
    asks: ['time in tokyo', 'what time is it in london', 'time zone converter', 'world clock', 'meeting planner across time zones', 'current time in new york', 'utc time now'],
    action: { template: '/time/?c={city}', input: 'city' },
    links: [['Time in Tokyo', '/time/?c=tokyo'], ['Time in London', '/time/?c=london'], ['Time in New York', '/time/?c=new+york'], ['Time in Sydney', '/time/?c=sydney'], ['Time in Dubai', '/time/?c=dubai'], ['Time in Paris', '/time/?c=paris'], ['Time in Los Angeles', '/time/?c=los+angeles'], ['Time in Singapore', '/time/?c=singapore']] },
  { path: '/base64/', name: 'Base64 encode and decode', does: 'Encode text to Base64 and decode Base64 to text as you type, Base64 and Base64URL, with or without padding, exact for emoji and accents in 44 character sets; files of any size become Base64 and data: URLs on your device. Works offline.',
    asks: ['base64 encode', 'base64 decode', 'base64 to text', 'text to base64', 'base64url', 'file to base64', 'image to data url', 'base64 decode online'],
    action: { template: '/base64/?t={text}', input: 'text' },
    links: [['Decode Base64', '/base64/?mode=decode'], ['Encode "Hello, world"', '/base64/?t=Hello%2C+world'], ['Decode SGVsbG8sIHdvcmxk', '/base64/?b=SGVsbG8sIHdvcmxk'], ['Base64URL', '/base64/?a=url'], ['Without padding', '/base64/?pad=0'], ['MIME lines of 76', '/base64/?wrap=1'], ['Each line on its own', '/base64/?lines=1']] },
  { path: '/password/', name: 'Password generator', does: 'Strong random passwords of 4 to 128 characters and passphrases of 3 to 10 words, made on your device, each with its exact entropy in bits and the time to crack. Nothing sent, works offline.',
    asks: ['password generator', 'strong password generator', 'random password generator', '16 character password', 'passphrase generator', 'secure password generator', 'password generator without symbols'],
    action: { template: '/password/?len={length}', input: 'length' },
    links: [['16 characters', '/password/?len=16'], ['12 characters', '/password/?len=12'], ['20 characters', '/password/?len=20'], ['32 characters', '/password/?len=32'], ['Letters and numbers only', '/password/?len=16&symbols=0'], ['A passphrase of 4 words', '/password/?mode=phrase&words=4'], ['5 passwords at once', '/password/?len=16&n=5']] },
  { path: '/scores/', name: 'Scores', does: 'Live scores, final scores, schedules in your own time zone and standings for the Premier League, La Liga, Bundesliga, Serie A, Ligue 1, MLS, Champions League, NBA, NFL, MLB, NHL and Formula 1, with box scores, team pages and favourite teams kept on your device. No ads, no betting.',
    asks: ['live scores', 'nba scores', 'premier league table', 'bundesliga results', 'nfl scores today', 'f1 standings', 'football scores yesterday'],
    action: { template: '/scores/?league={league}', input: 'league' },
    links: [['NBA scores', '/scores/?league=nba'], ['Premier League scores', '/scores/?league=epl'], ['Premier League table', '/scores/?league=epl&tab=standings'], ['Bundesliga', '/scores/?league=bundesliga'], ['NFL scores', '/scores/?league=nfl'], ['MLB scores', '/scores/?league=mlb'], ['NHL scores', '/scores/?league=nhl'], ['Formula 1 standings', '/scores/?league=f1&tab=standings']] },
  { path: '/translate/', name: 'Translate', does: 'Translate text between 100 languages with the language detected as you type: listen to the translation, speak instead of typing, read the text in a photo or from the camera, copy it, share a link that carries it, keep a history and saved phrases, and see them again offline.',
    asks: ['translate', 'translate english to spanish', 'spanish to english translation', 'translate to french', 'japanese translator', 'translate photo text', 'free translator 100 languages'],
    action: { template: '/translate/?q={text}&to=es', input: 'text' },
    links: [['hello in Spanish', '/translate/?q=hello&to=es'], ['thank you in Japanese', '/translate/?q=thank%20you&to=ja'], ['good morning in French', '/translate/?q=good%20morning&to=fr'], ['Spanish to English', '/translate/?from=es&to=en'], ['German to English', '/translate/?from=de&to=en'], ['English to Chinese', '/translate/?from=en&to=zh']] },
  { path: '/recipes/', name: 'Recipes', does: 'Recipes by name or by what is in your fridge: every quantity scaled to your servings, cups to ml and °F to °C, one step at a time with timers to tap while you cook, a shopping list, a share link and a history on your device. A dozen classics work offline.',
    asks: ['pancake recipe', 'what can i make with eggs', 'recipe by ingredients', 'scale a recipe servings', 'cups to ml recipe', 'step by step cooking', 'easy dinner recipes'],
    action: { template: '/recipes/?q={dish}', input: 'dish' },
    links: [['Pancakes', '/recipes/?q=pancakes'], ['Omelette', '/recipes/?q=omelette'], ['Tomato pasta', '/recipes/?q=tomato%20pasta'], ['Chicken soup', '/recipes/?q=chicken%20soup'], ['Chocolate chip cookies', '/recipes/?q=cookies'], ['What can I make with eggs and spinach', '/recipes/?i=eggs%2Cspinach'], ['Pancakes for 8', '/recipes/?q=pancakes&servings=8']] },
  { path: '/markets/', name: 'Markets', does: 'Quotes and charts for stocks, ETFs, indices, currencies and crypto by symbol or name: price, change, day range, 52 weeks, volume, a 1D to Max chart you can hover, the close on any day, a watchlist on your device, compare two symbols, top movers. Prices may be delayed. No ads, no account.',
    asks: ['stock price', 'stock quote', 'stock chart', 'aapl stock price', 'bitcoin price chart', 'eur usd exchange rate chart', 'compare two stocks', 'stock watchlist no account'],
    action: { template: '/markets/?s={symbol}', input: 'symbol' },
    links: [['Apple (AAPL)', '/markets/?s=AAPL'], ['Tesla', '/markets/?s=TSLA'], ['S&P 500', '/markets/?s=SPX'], ['Bitcoin', '/markets/?s=BTC'], ['Euro to US dollar', '/markets/?s=EURUSD'], ['Apple on 31 Dec 2024', '/markets/?s=AAPL&r=5y&on=2024-12-31'], ['Nvidia over five years', '/markets/?s=NVDA&r=5y'], ['Apple against Microsoft', '/markets/?s=AAPL&c=MSFT']] },
  { path: '/calendar/', name: 'Calendar', does: 'A calendar on your device: month, week and day views, events that repeat (daily, weekly, monthly, yearly, chosen weekdays), reminders that fire on the device, invites as a link or an email with the .ics, import and export .ics, quick add in plain words, search and keyboard arrows. Nothing goes to a server; it works offline.',
    asks: ['online calendar', 'calendar with reminders', 'recurring events calendar', 'calendar invite link', 'import ics file', 'week view calendar', 'free calendar app no account'],
    action: { template: '/calendar/?q={event}', input: 'event' },
    links: [['Dentist tomorrow at 3pm, remind me 30 minutes before', '/calendar/?q=dentist%20tomorrow%203pm%2C%20remind%20me%2030%20minutes%20before'], ['Lunch with Sam tomorrow 1pm', '/calendar/?q=lunch%20with%20Sam%20tomorrow%201pm'], ['Team call every Monday 10:00', '/calendar/?q=team%20call%20every%20monday%2010%3A00'], ['Rent on the 1st, every month', '/calendar/?q=rent%20on%20the%201st%20every%20month'], ['Today', '/calendar/?show=today'], ['This week', '/calendar/?show=this-week']] },
  { path: '/image/', name: 'AI image generator', does: 'Free text to image: describe a picture, pick one of 15 styles (photo, cinematic, anime, cartoon, oil painting, watercolour, pixel art, 3D render, fantasy, comic, sketch and more) and a shape (square, portrait, landscape, wide), make up to four at a go, leave things out, keep a seed to make the same picture again, download, and keep a gallery on your device. No sign-up; real people and adult pictures are not made.',
    asks: ['ai image generator', 'text to image', 'free ai art generator', 'ai picture generator no sign up', 'anime image generator', 'pixel art generator ai', 'ai image generator with seed'],
    action: { template: '/image/?prompt={prompt}&go=1', input: 'prompt' },
    links: [['A red fox in the snow, watercolour', '/image/?prompt=a%20red%20fox%20curled%20up%20in%20the%20snow&style=watercolor&go=1'], ['A castle on a cliff, fantasy art', '/image/?prompt=a%20castle%20on%20a%20cliff%20at%20sunset&style=fantasy&shape=landscape&go=1'], ['A cozy cabin, photo', '/image/?prompt=a%20cozy%20cabin%20in%20a%20snowy%20forest&style=photo&go=1'], ['A robot cat, pixel art', '/image/?prompt=a%20robot%20cat&style=pixel&go=1'], ['A dragon, anime, portrait', '/image/?prompt=a%20friendly%20dragon&style=anime&shape=portrait&go=1']] },
  { path: '/generators/', name: 'Generators', does: '27 random generators that run on your device: fantasy names, town names, band names, usernames, pet names, writing prompts, story prompts, D&D NPCs, haiku, limericks, superpowers, side quests and more. The same link always gives the same result, favourites are kept in the browser, and any result can be turned into a cartoon. Works offline.',
    asks: ['random name generator', 'fantasy name generator', 'writing prompt generator', 'band name generator', 'dnd npc generator', 'random haiku generator', 'random generators'],
    action: { template: '/generators/?g={generator}', input: 'generator' },
    links: [['Fantasy names', '/generators/?g=fantasy-names'], ['Town names', '/generators/?g=town-names'], ['Band names', '/generators/?g=band-names'], ['Writing prompts', '/generators/?g=writing-prompts'], ['D&D NPCs', '/generators/?g=dnd-npcs'], ['Superpowers', '/generators/?g=superpowers'], ['Haiku', '/generators/?g=haiku']] },
  { path: '/notes/', name: 'Notes', does: 'Notes and documents on your device: bold, italic, headings, lists, checklists, code and links, many documents, search across all of them, version history to preview and restore, word count, export to .md, .html and .txt, import, print, a share link and a note typed as one line. Nothing goes to a server; it works offline.',
    asks: ['online notes', 'notepad online', 'note taking app no account', 'markdown notes', 'notes with version history', 'search my notes', 'free online notepad'],
    action: { template: '/notes/?q={note}', input: 'note' },
    links: [['Shopping list: milk, eggs, bread', '/notes/?q=note%3A%20Shopping%20list%20-%20milk%2C%20eggs%2C%20bread'], ['Buy milk', '/notes/?q=note%3A%20buy%20milk'], ['Packing: passport, charger, socks', '/notes/?q=note%3A%20Packing%20-%20passport%2C%20charger%2C%20socks'], ['Meeting: agenda, minutes, actions', '/notes/?q=note%3A%20Meeting%20-%20agenda%2C%20minutes%2C%20actions'], ['Call mum on Sunday', '/notes/?q=note%3A%20call%20mum%20on%20Sunday']] },
  { path: '/news/', name: 'News', does: 'Headlines from the BBC, the Guardian, NPR, Al Jazeera, DW and more in one calm list: the source and age on every story, the same story from several sources grouped with the list of who carries it, sections from world to sport and regions, search, topics and sources you follow, a read-later list, four languages, bigger text and a headlines-only view. Every story links to its source; no ads, no account; it opens offline with the last headlines.',
    asks: ['news', 'world news today', 'headlines from many sources', 'news aggregator no ads', 'follow topics news', 'bbc news alternative', 'read later news list'],
    action: { template: '/news/?q={words}', input: 'words' },
    links: [['World', '/news/?sec=world'], ['Technology', '/news/?sec=tech'], ['Science', '/news/?sec=science'], ['Business', '/news/?sec=business'], ['Sport', '/news/?sec=sport'], ['Noticias en español', '/news/?lang=es']] },
  { path: '/boards/', name: 'Boards: anonymous image and text boards', does: 'Anonymous image and text boards anyone can start: make a board with a short code, post threads with a picture, reply with quotes and greentext, a catalog, an archive, tripcodes, sage, spoilers, search across every board, a thread watcher on your device and threads that update themselves. Pictures lose their hidden location data before they are kept.',
    asks: ['image board', 'anonymous message board', 'text board', 'make your own board', 'anonymous forum', 'imageboard catalog', 'post anonymously'],
    action: { template: '/boards/?q={words}', input: 'words' },
    links: [['Make a board', '/boards/?new=1'], ['Boards with new posts', '/boards/?sort=active'], ['Newest boards', '/boards/?sort=new'], ['Busiest boards', '/boards/?sort=posts'], ['Safe-for-work boards only', '/boards/?sfw=1']] },
  { path: '/podcasts/', name: 'Podcasts', does: 'Search millions of podcasts or paste any RSS link. Play with speed from 0.5x to 3x, skip back 15 and forward 30, a sleep timer, chapters, transcripts, a queue and your place saved per episode. Follow shows and see new episodes, save episodes for offline, import and export OPML. All kept on your device, no account.',
    asks: ['podcasts', 'search podcasts', 'podcast player', 'podcast app without an account', 'play a podcast rss feed', 'top podcasts', 'podcast sleep timer and speed', 'import opml podcasts'],
    action: { template: '/podcasts/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['Verse Out Loud', '/podcasts/?show=verse'], ['Verse Out Loud episode 1', '/podcasts/?show=verse&ep=ep1'], ['Search for history podcasts', '/podcasts/?q=history'], ['Search for science podcasts', '/podcasts/?q=science'], ['Search for true crime podcasts', '/podcasts/?q=true%20crime']] },
  { path: '/weather/', name: 'Weather', does: 'The weather now, the next 24 hours and 7 days ahead for any place, in °F and °C side by side, with sunrise and sunset, the weather service’s alerts and radar for the United States, and a link that carries the place.',
    asks: ['weather', 'weather forecast', 'weather tomorrow', 'hourly weather', '7 day forecast', 'weather radar', 'sunrise and sunset times'],
    action: { template: '/weather/?q={search_term_string}', input: 'search_term_string', search: true } },
  // the PDF and Kanban floors (lib/tool-sites.js): the leader's page and one for each site of its lane
  ...SITE_PAGES.map((p) => ({ path: p.path, name: p.name, does: p.does, asks: p.asks, ...(p.links && p.links.length ? { links: p.links, action: { template: p.path + '?tool={tool}', input: 'tool' } } : {}) })),
  { path: '/tools/', name: 'Every Verse tool', does: 'Every tool Verse has built, each a page of its own and all tied together: colours, chance, time, words and numbers, keys and pictures. Free, private, offline after one visit.',
    asks: ['free online tools', 'online utilities', 'web tools without ads', 'tools that work offline', 'converter and generator tools'] },
]);

/** the row for a path, or null. Pure. */
export const pageOf = (path) => PAGES.find((p) => p.path === path) || null;

/** the JSON-LD for a page: a WebApplication (free, any OS) and a BreadcrumbList, with a potentialAction when the link takes a setting; null for an
 *  unknown path. Pure. */
export function jsonLd(path, origin = SITE) {
  const p = pageOf(path); if (!p) return null;
  const url = origin + p.path;
  const app = {
    '@type': 'WebApplication', name: p.name, url, description: p.does, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    keywords: p.asks.join(', '), publisher: { '@type': 'Organization', name: 'Verse', url: origin + '/' },
  };
  if (p.action) {
    app.potentialAction = { '@type': p.action.search ? 'SearchAction' : 'ViewAction', target: { '@type': 'EntryPoint', urlTemplate: origin + p.action.template } };
    app.potentialAction[(p.action.search ? 'query' : p.action.input) + '-input'] = 'required name=' + p.action.input;
  }
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Verse', item: origin + '/' },
    { '@type': 'ListItem', position: 2, name: p.name, item: url }] };
  return { '@context': 'https://schema.org', '@graph': [app, crumbs] };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** the head lines for a page: the canonical link (left out when the page writes its own) and the one JSON-LD script ('</' is escaped so the JSON
 *  can never close the script). Pure. */
export function headTags(path, origin = SITE, { canonical = true } = {}) {
  const ld = jsonLd(path, origin); if (!ld) return '';
  return (canonical ? '<link rel="canonical" href="' + esc(origin + path) + '">\n' : '') + '<script type="application/ld+json">' + JSON.stringify(ld).replace(/<\//g, '<\\/') + '</script>';
}

/** the visible "Common asks" row: real links to the exact setups people most often want, in the toolkit's row style; '' when the page has none. Pure. */
export function asksRow(path) {
  const p = pageOf(path); if (!p || !p.links || !p.links.length) return '';
  return '<nav id="asks" class="tk-row" aria-label="Common asks"><span class="tk-label">Common asks</span>' + p.links.map(([label, href]) => '<a href="' + esc(href) + '">' + esc(label) + '</a>').join('') + '</nav>';
}

/** one honest line per tool page for llms.txt, in PAGES order. Pure. */
export const llmsLines = (origin = SITE) => PAGES.map((p) => '- ' + p.name + ': ' + p.does + ' ' + origin + p.path);

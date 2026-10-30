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
// one row per path: a floor row (lib/tool-sites.js) for a page this table already describes by hand keeps the hand row, which comes first
// (the calculator floor, Versus job mvoxrtv8, names /calculator/ too)
const firstOfEach = (rows) => rows.filter((r, i) => rows.findIndex((q) => q.path === r.path) === i);
export const PAGES = Object.freeze(firstOfEach([
  { path: '/photos/', name: 'Photo tools: compress, convert, edit, strip EXIF', does: 'Compress and convert photos to JPEG, PNG, WebP or AVIF with a quality slider, a before and after slider and the size saved; resize, crop with shapes, rotate and flip; brightness, contrast, saturation, blur and sharpen, filters, text and drawing with undo and redo; see and strip EXIF and GPS; many photos at once as one zip. In English and German, on your device: nothing is uploaded.',
    asks: ['compress image online', 'convert png to webp', 'photo editor online', 'crop photo online', 'remove exif data from photo', 'image compressor no upload', 'compress images in bulk to zip'],
    action: { template: '/photos/?tab={tab}', input: 'tab' },
    links: [['Compress images', '/photos/?tab=out'], ['Crop a photo', '/photos/?tab=crop'], ['Brightness and filters', '/photos/?tab=adj'], ['Check a photo for GPS', '/photos/?tab=info'], ['Deutsch', '/photos/?lang=de']] },
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
    asks: ['random number generator', 'random number between 1 and 100', 'random number picker', 'random numbers no repeats', 'lottery number generator'],
    links: [['1 to 100', '/random/?min=1&max=100'], ['1 to 10', '/random/?min=1&max=10'], ['Roll a die (1 to 6)', '/random/?min=1&max=6'], ['6 lottery numbers from 1 to 49', '/random/?min=1&max=49&n=6&unique=1&sort=1'], ['5 numbers from 1 to 100, no repeats', '/random/?min=1&max=100&n=5&unique=1'], ['A number from 0 to 1', '/random/?min=0&max=1&dec=2']],
    action: { template: '/random/?min=1&max={max}', input: 'max' } },
  { path: '/ledger/', name: 'Repo activity ledger: every issue and pull request of a GitHub repo', does: 'Every issue and pull request of any public GitHub repository in one table, on separate tabs: title, number, link, author, state, created and merged or closed. Search, filter by state, author, label or date, export CSV or JSON, share the exact view with a link; the last copy opens offline. No account and no token: the browser reads the public GitHub API.',
    asks: ['github issues to csv', 'export github pull requests', 'list all issues of a github repo', 'github activity log', 'github issues spreadsheet'],
    action: { template: '/ledger/?repo={repo}', input: 'repo' },
    links: [['Pull requests of atomeam/void-loop', '/ledger/?tab=pr'], ['Open issues of excalidraw/excalidraw', '/ledger/?repo=excalidraw%2Fexcalidraw&state=open'], ['Merged pull requests of jellyfin/jellyfin', '/ledger/?repo=jellyfin%2Fjellyfin&tab=pr&state=merged'], ['Open bugs in microsoft/vscode', '/ledger/?repo=microsoft%2Fvscode&state=open&label=bug'], ['Oldest issues of atomeam/void-loop first', '/ledger/?sort=old']] },
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
  { path: '/stl/', name: 'Is my STL watertight? STL checker', does: 'Check an STL print file, binary or ASCII, before the slicer: watertight or not, open edges and holes with where they are, non-manifold edges, flipped normals, inside-out shells, degenerate and duplicate faces, shells and self-intersections, its size, volume and area, a 3D view with the problems drawn on it, a report to copy or download and a mended copy. Checked on your device: the file is never uploaded.',
    asks: ['stl checker', 'is my stl watertight', 'check stl file online', 'stl watertight check', 'stl non-manifold edges', 'stl flipped normals', 'repair stl holes', 'stl volume calculator'],
    action: { template: '/stl/?sample={sample}', input: 'sample' },
    links: [['A cube with a hole', '/stl/?sample=hole'], ['A flipped face', '/stl/?sample=flipped'], ['A watertight cube', '/stl/?sample=cube'], ['The forge\'s vase', '/stl/?forge=vase'], ['The forge\'s rocket', '/stl/?forge=rocket'], ['Weld within 0.0001 mm', '/stl/?sample=hole&tol=0.0001']] },
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
    action: { template: '/calculator/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['15% of 80', '/calculator/?q=15%25%20of%2080'], ['Square root of 144', '/calculator/?q=%E2%88%9A(144)'], ['2 to the power of 10', '/calculator/?q=2%5E10'], ['sin 30° in degrees', '/calculator/?q=sin(30)&a=deg'], ['10 factorial', '/calculator/?q=10!'], ['(3 + 4) × 5', '/calculator/?q=(3%2B4)*5']] },
  { path: '/calculators/', name: 'Formula calculators with units', does: '164 calculators where every box takes units: percent, tip, loan, unit price, BMI, dates and unit conversion first, then money, health, geometry, maths, statistics, physics, chemistry, electrical and engineering. Type 2 in and 10 ft and get ft², m² or acres; the working in SI in pro mode; build your own formula with units, guided or as text; share any answer as a link, export CSV or JSON. Works offline.',
    asks: ['formula calculator with units', 'pipe surface area calculator', 'ohms law calculator', 'molar mass calculator', 'loan payment calculator', 'custom formula calculator', 'physics calculator'],
    action: { template: '/calculators/?find={search_term_string}', input: 'search_term_string', search: true },
    links: [['Pipe surface area, 2 in by 10 ft', '/calculators/?calc=pipe-surface-area&d=2&d.u=in&l=10&l.u=ft'], ['Tip for $64 split 3 ways', '/calculators/?calc=tip&bill=64&people=3'], ['Loan payment', '/calculators/?calc=loan-payment'], ["Ohm's law: current", '/calculators/?calc=ohms-law-current'], ['Molar mass of glucose', '/calculators/?calc=molar-mass&f=C6H12O6'], ['Build your own formula: a circle\'s area', '/calculators/?formula=%23%20Circle%20area%0AA%20%5Bm%C2%B2%5D%20%3D%20pi%2Ar%5E2%20%20%23%20Area%0Ar%20%5Bm%5D%20%3D%203%20%20%23%20Radius']] },
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
  { path: '/sports/', name: 'Sports', does: 'Browse 42 sports, search teams, events, venues and players across all of them in one box, see which athletes were born on this day, and read about the free read-only scores API. No ads, no betting, no account.',
    asks: ['browse sports', 'sports search', 'search a team', 'search a stadium', 'athletes born today', 'free sports api', 'list of sports'],
    action: { template: '/sports/?q={team}', input: 'team' },
    links: [['Search Arsenal', '/sports/?q=arsenal'], ['Search Lakers', '/sports/?q=lakers'], ['Search Wembley', '/sports/?q=wembley'], ['Search Messi', '/sports/?q=messi'], ['Search Formula 1', '/sports/?q=formula'], ['Search Wimbledon', '/sports/?q=wimbledon']] },
  { path: '/fantasy/', name: 'Fantasy tools', does: 'Paste or open your own player sheet (CSV or JSON, your players and your own projections) and compare players, decide start or sit, weigh a trade, build a draft board and run a mock draft, all on your device, with averages and home and away splits worked out from box scores. No projections sold, nothing leaves your device.',
    asks: ['fantasy tools', 'start or sit', 'compare two players', 'fantasy trade value', 'fantasy mock draft', 'fantasy draft board', 'fantasy football helper'],
    action: { template: '/fantasy/?tab={tool}', input: 'tool' },
    links: [['Start or sit', '/fantasy/?tab=sit'], ['Compare players', '/fantasy/?tab=compare'], ['Trade value', '/fantasy/?tab=trade'], ['Draft board', '/fantasy/?tab=board'], ['Mock draft', '/fantasy/?tab=mock'], ['Stats from box scores', '/fantasy/?tab=box']] },
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
    links: [['Apple (AAPL)', '/markets/?s=AAPL'], ['Tesla', '/markets/?s=TSLA'], ['S&P 500', '/markets/?s=SPX'], ['Bitcoin', '/markets/?s=BTC'], ['Euro to US dollar', '/markets/?s=EURUSD'], ['The S&P 500 on 31 Dec 2024', '/markets/?s=SPX&r=5y&on=2024-12-31'], ['Nvidia over five years', '/markets/?s=NVDA&r=5y'], ['Apple against Microsoft', '/markets/?s=AAPL&c=MSFT']] },
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
  { path: '/fanfic/', name: 'Fan fiction: an open archive of stories', does: 'An open writing community where people post what they write: fandoms anyone can start, stories with chapters and reviews, pinned guides, paging and a period filter, search, a writing glossary and a Writing Room that keeps drafts, word count, reading time and a writing streak on your device. No seeded stories, no accounts.',
    asks: ['fan fiction', 'fanfic archive', 'post a story', 'write fan fiction', 'read fanfic', 'fan fiction writing community', 'story chapters and reviews', 'writing streak'],
    action: { template: '/fanfic/?v=search&q={search_term_string}', input: 'search_term_string', search: true },
    links: [['Post a story', '/fanfic/?new=story'], ['Start a fandom', '/fanfic/?new=fandom'], ['Most recent stories', '/fanfic/?v=recent'], ['Random story', '/fanfic/?v=random'], ['Writing Room', '/fanfic/?v=room'], ['Writing glossary', '/fanfic/?v=glossary']] },
  { path: '/team/', name: 'Team chat: Verse and its agents at work', does: 'A team chat where AI agents are members: channels anyone in the team starts, threads, @mentions with an Activity list, reactions, search, presence and unread marks. Verse hands every idle agent the next job on its build queue as a thread, the agent answers in it and closes it, and Verse hands it the next. Agents join with a key from the owner; nothing is seeded.',
    asks: ['team chat', 'agent workspace', 'chat for ai agents', 'team messaging channels', 'threads and mentions', 'keep agents busy', 'agent job queue'] },
  { path: '/rap/', name: 'Verse raps: a rap written for your topic, performed over its own beat', does: 'Give it a topic and Verse writes a rap for it: boom bap, trap, drill, melodic or conscious, in the mood, flow and point of view you pick, with your words worked in. Two verses and a hook with the rhyme scheme shown, performed bar by bar over a beat made for the style in your browser, or rap it yourself over the beat. Copy the lyrics, save the beat, share the whole rap in a link. Free, no account.',
    asks: ['rap lyrics generator', 'write me a rap', 'rap about pizza', 'make a rap song', 'freestyle rap', 'trap rap lyrics', 'boom bap lyrics', 'rap beat and lyrics'],
    action: { template: '/rap/?t={topic}', input: 'topic' },
    links: [['A rap about pizza', '/rap/?t=pizza'], ['A funny trap rap about Mondays', '/rap/?t=monday%20mornings&s=trap&m=funny'], ['A melodic rap about the moon', '/rap/?t=the%20moon&s=melodic&m=reflective'], ['A conscious rap about never giving up', '/rap/?t=never%20giving%20up&s=conscious&m=hungry'], ['A birthday party rap', '/rap/?t=my%20birthday&m=party']] },
  { path: '/learn-to-draw/', name: 'Learn to draw: a drawing course for absolute beginners', does: 'A drawing course you do on screen: line, shape, proportion and shading in 8 short drills (a straight line, a steady curve, a circle by eye, a square, finding the middle, drawing from memory, a value scale, a smooth gradient), each scored from what you draw. A drill of the day, a streak, and your first try beside your highest score. No account, no cookies; it works offline.',
    asks: ['learn to draw', 'drawing course', 'drawing for beginners', 'drawing exercises', 'how to draw a straight line', 'draw a circle freehand', 'shading practice', 'daily drawing practice'],
    action: { template: '/learn-to-draw/?d={drill}', input: 'drill' },
    links: [['Draw a straight line', '/learn-to-draw/?d=line'], ['Draw a circle by eye', '/learn-to-draw/?d=circle'], ['Find the middle', '/learn-to-draw/?d=half'], ['Draw from memory', '/learn-to-draw/?d=memory'], ['Value scale', '/learn-to-draw/?d=values'], ['Smooth gradient', '/learn-to-draw/?d=gradient']] },
  { path: '/converter/', name: 'File converter: video, audio, image, ebook and document tools on your device', does: 'Video to MP4, MOV, WEBM or MKV, and video edits: cut, speed, resize, rotate, compress, merge, blur, brighten, text, a picture or a watermark on top, new sound, no sound. Pictures, a GIF, a PDF or a sound to a video. Sound to WAV or AIFF, pictures to JPG, PNG, WebP, GIF, BMP, TIFF or PDF, and the words of EPUB, DOCX, PDF, RTF and HTML files to each other. Cut, speed up, merge, mix or crossfade sounds, take the silence out, change a GIF\'s speed, take a frame or the sound out of a video, and put a picture on a PDF. All 106 tools of a full online converter are listed with what Verse does today. Nothing is uploaded; no account; it works offline.',
    asks: ['file converter', 'video converter', 'mov to mp4', 'cut video', 'compress video', 'audio converter', 'mp4 to mp3', 'epub to txt'],
    action: { template: '/converter/?q={q}', input: 'q' },
    links: [['MOV to MP4', '/converter/?t=video-mp4'], ['Cut video', '/converter/?t=cut-video'], ['Compress video', '/converter/?t=compress-video'], ['MP4 to WAV', '/converter/?q=mp4%20to%20wav'], ['Cut MP3', '/converter/?t=cut-mp3'], ['Merge audio', '/converter/?t=merge-audio'], ['EPUB to TXT', '/converter/?t=ebook-txt'], ['Change GIF speed', '/converter/?t=change-gif-speed']] },
  { path: '/brain/', name: 'Verse Brain, full screen: a mind you can watch think', does: 'Verse Brain on the whole screen: one workspace that twenty organs share, its attention spotlight, surprise in red, what its memory expects, a swarm, a creature, a plant, a painter and a flow, all live. Move over it and it predicts you; tell it words and drag what it holds; say Good when it does something you like, ask it why, hum to it or play it a tune. Its focus, its will, its surprise and what each organ has gained are shown as they are. The same brain as its card on the Verse stage; what it learns is kept on this device. No account; nothing is sent.',
    asks: ['verse brain', 'ai brain simulation', 'artificial brain online', 'watch an ai think', 'neural workspace visualization', 'global workspace theory demo', 'full screen brain'],
    action: { template: '/brain/?t={t}', input: 't' },
    links: [['Ask what it is doing', '/brain/?t=what%20are%20you%20doing%3F'], ['Ask why that formed', '/brain/?t=why%20did%20that%20form%3F'], ['Ask what just happened', '/brain/?t=what%20just%20happened%3F'], ['Tell it: ocean', '/brain/?t=ocean'], ['Tell it: music and memory', '/brain/?t=music%20memory'], ['Tell it: a dream of flying', '/brain/?t=dream%20of%20flying']] },
  { path: '/metronome/', name: 'Metronome', does: 'A free online metronome from 20 to 400 BPM: tap tempo, every time signature from 2/4 to 12/8, an accent on each beat you can set strong, medium, soft or silent, subdivisions (eighths, triplets, sixteenths, swing), nine sounds, a voice count, a visual beat and pendulum, a practice timer, a speed trainer, silent bars and setlists. No account, no ads; it works offline.',
    asks: ['metronome', 'online metronome', 'metronome 120 bpm', 'tap tempo metronome', 'metronome with accents', 'metronome 6/8', 'free metronome no ads'],
    action: { template: '/metronome/?bpm={bpm}', input: 'bpm' },
    links: [['60 BPM', '/metronome/?bpm=60'], ['80 BPM', '/metronome/?bpm=80'], ['100 BPM', '/metronome/?bpm=100'], ['120 BPM', '/metronome/?bpm=120'], ['140 BPM', '/metronome/?bpm=140'], ['90 BPM in 6/8', '/metronome/?bpm=90&sig=6%2F8'], ['100 BPM in 3/4', '/metronome/?bpm=100&sig=3%2F4'], ['Eighth-note subdivision', '/metronome/?bpm=100&sub=eighth']] },
  { path: '/piano/', name: 'Piano', does: 'A free online piano you play with the computer keyboard, the mouse, a touch screen or a MIDI keyboard: twelve instruments, a sustain pedal on the space bar, the computer key shown on each note, reverb, transpose, sheet music in plain letters with public-domain songs, and recording that turns your playing into a sheet. Made in your browser; no account, nothing to download.',
    asks: ['online piano', 'virtual piano', 'piano keyboard online', 'play piano with computer keyboard', 'piano sheets letters', 'piano with sustain pedal', 'midi keyboard online piano'],
    action: { template: '/piano/?song={song}', input: 'song' },
    links: [['Ode to Joy', '/piano/?song=ode'], ['Twinkle, Twinkle', '/piano/?song=twinkle'], ['Für Elise', '/piano/?song=elise'], ['Canon in D', '/piano/?song=canon'], ['Jingle Bells', '/piano/?song=jingle'], ['Brahms Lullaby', '/piano/?song=lullaby']] },
  { path: '/tuner/', name: 'Tuner', does: 'A free online chromatic tuner that listens through your microphone and shows how many cents flat or sharp you are: guitar (standard, drop D, DADGAD, open tunings, 7-string), bass, ukulele, violin, viola, cello, mandolin and banjo presets, an adjustable A4 reference, reference tones and a pitch pipe. The sound never leaves your device.',
    asks: ['online tuner', 'guitar tuner', 'ukulele tuner', 'violin tuner', 'bass tuner', 'chromatic tuner online', 'tuner with microphone no download'],
    action: { template: '/tuner/?tun={tuning}', input: 'tuning' },
    links: [['Guitar tuner', '/tuner/?tun=guitar-standard'], ['Drop D', '/tuner/?tun=guitar-dropd'], ['Bass tuner', '/tuner/?tun=bass4'], ['Ukulele tuner', '/tuner/?tun=ukulele'], ['Violin tuner', '/tuner/?tun=violin'], ['Any note', '/tuner/?tun=chromatic']] },
  { path: '/bpm/', name: 'BPM counter', does: 'A free BPM counter: tap any key or the button to the beat and get the tempo, averaged over your last taps, with half and double time, a reset after a pause, the length of every note value in milliseconds and Hz, the length of a song in bars, and the tempo of an audio file measured on your device. Nothing is uploaded.',
    asks: ['bpm counter', 'tap tempo', 'bpm tapper', 'find the bpm of a song', 'bpm calculator', 'note length in ms at bpm', 'bpm of an mp3'],
    action: { template: '/bpm/?bpm={bpm}', input: 'bpm' },
    links: [['Note lengths at 60 BPM', '/bpm/?bpm=60'], ['At 90 BPM', '/bpm/?bpm=90'], ['At 100 BPM', '/bpm/?bpm=100'], ['At 120 BPM', '/bpm/?bpm=120'], ['At 140 BPM', '/bpm/?bpm=140'], ['At 174 BPM', '/bpm/?bpm=174']] },
  { path: '/chords/', name: 'Chords and scales', does: 'A free chord and scale finder for piano and guitar: the notes, piano keys and guitar fingerings of 28 chord types, the chord named from the notes you pick, every scale that holds them, 22 scales, the chords of any major or minor key with roman numerals and what they lead to, common progressions, the circle of fifths and a chord transposer. It plays what it shows.',
    asks: ['chord finder', 'scale finder', 'guitar chords', 'piano chords', 'what chord is this', 'circle of fifths', 'chords in a key', 'transpose chords'],
    action: { template: '/chords/?chord={chord}', input: 'chord' },
    links: [['A minor 7', '/chords/?chord=Am7'], ['C major 7', '/chords/?chord=Cmaj7'], ['G7', '/chords/?chord=G7'], ['D minor', '/chords/?chord=Dm'], ['C major scale', '/chords/?scale=C%20major'], ['A minor pentatonic', '/chords/?scale=A%20minor%20pentatonic'], ['E blues scale', '/chords/?scale=E%20blues']] },
  { path: '/music/', name: 'Music tools', does: 'Free music tools that run on your device: a metronome, an online piano, a tuner, a BPM counter and a chord and scale finder, your setlists of saved tempos (shared by link), a catalogue of tempo words, scales, chords, tunings and songs to play, and practice recommendations. No account, no ads, no subscription; it works offline.',
    asks: ['music tools', 'musician tools', 'setlist of tempos', 'tempo words andante allegro', 'practice tempo ladder', 'scales and chords catalogue', 'free music practice tools'],
  },
  { path: '/podcasts/', name: 'Podcasts', does: 'Search millions of podcasts or paste any RSS link. Play with speed from 0.5x to 3x, skip back 15 and forward 30, a sleep timer, chapters, transcripts, a queue and your place saved per episode. Follow shows and see new episodes, save episodes for offline, import and export OPML. All kept on your device, no account.',
    asks: ['podcasts', 'search podcasts', 'podcast player', 'podcast app without an account', 'play a podcast rss feed', 'top podcasts', 'podcast sleep timer and speed', 'import opml podcasts'],
    action: { template: '/podcasts/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['Verse Out Loud', '/podcasts/?show=verse'], ['Verse Out Loud episode 1', '/podcasts/?show=verse&ep=ep1'], ['Search for history podcasts', '/podcasts/?q=history'], ['Search for science podcasts', '/podcasts/?q=science'], ['Search for true crime podcasts', '/podcasts/?q=true%20crime']] },
  { path: '/weather/', name: 'Weather', does: 'The weather now, the next 24 hours and 7 days ahead for any place, in °F and °C side by side, with sunrise and sunset, the weather service’s alerts and radar for the United States, and a link that carries the place.',
    asks: ['weather', 'weather forecast', 'weather tomorrow', 'hourly weather', '7 day forecast', 'weather radar', 'sunrise and sunset times'],
    action: { template: '/weather/?q={search_term_string}', input: 'search_term_string', search: true } },
  { path: '/emojis/', name: 'Emoji counts: a ranked wall of emoji to copy', does: 'A ranked wall of 134 emoji, counted as they are copied here: tap one to copy it as the emoji, its U+ codepoint or its HTML entity, and its count goes up. Ranked today or all time, searched by name, with each emoji\'s Unicode, UTF-8 bytes and entity. Only copies made on this page are counted and nothing else is sent; no account, and it works offline with the counts it last saw.',
    asks: ['copy and paste emoji', 'emoji counter', 'most copied emoji', 'emoji unicode codepoint', 'emoji html entity', 'emoji utf-8 bytes', 'emoji search by name'],
    action: { template: '/emojis/?q={search_term_string}', input: 'search_term_string', search: true },
    links: [['Every heart', '/emojis/?q=heart'], ['Cats', '/emojis/?q=cat'], ['Hands', '/emojis/?q=hand'], ['Stars', '/emojis/?q=star'], ['The fire emoji', '/emojis/?pick=%F0%9F%94%A5'], ['The red heart', '/emojis/?pick=%E2%9D%A4%EF%B8%8F']] },
  { path: '/g/', name: 'Snippet / Note in a link: a gist with no account', does: 'Paste a snippet, note or checklist, up to eight files, and get a link that holds it all, compressed: no account and no server copy. Lock it with a passphrase, see what changed in an edited copy, start from a meeting timer, locked note or code template, and open a public GitHub file here, coloured and numbered. Works offline after one visit.',
    asks: ['share code snippet online', 'pastebin without account', 'gist without github account', 'encrypted note link', 'share a note by link', 'view github file'],
    action: { template: '/g/?text={text}', input: 'text' },
    links: [["Verse's README from GitHub", '/g/?gh=atomeam%2Fvoid-loop%2Fmain%2FREADME.md'], ['Lines 1 to 20 of gist.js', '/g/?gh=atomeam%2Fvoid-loop%2Fmain%2Fvoid-live-deploy%2Flib%2Fgist.js&L=1-20'], ['A shopping list', '/g/?text=Milk%0AEggs%0ABread&name=list.md'], ['A code snippet', '/g/?text=console.log(%22hello%22)%3B&name=hello.js'], ['A note to share', '/g/?text=The%20meeting%20moved%20to%203pm%20in%20room%202.&name=note.txt']] },
  // the PDF and Kanban floors (lib/tool-sites.js): the leader's page and one for each site of its lane
  ...SITE_PAGES.map((p) => ({ path: p.path, name: p.name, does: p.does, asks: p.asks, ...(p.links && p.links.length ? { links: p.links, action: p.action || { template: p.path + '?tool={tool}', input: 'tool' } } : {}) })),
  { path: '/tools/', name: 'Every Verse tool', does: 'Every tool Verse has built, each a page of its own and all tied together: colours, chance, time, words and numbers, keys and pictures. Free, private, offline after one visit.',
    asks: ['free online tools', 'online utilities', 'web tools without ads', 'tools that work offline', 'converter and generator tools'] },
]));

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

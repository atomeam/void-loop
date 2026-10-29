// The daily picture for Verse's reports (owner, 2026-10-26: "we can have pictures that update daily too"; then "actual pictures of the games"):
// /scores/, /news/ and /markets/ each get one picture a day for a league, a news section or a market wrap. This file is the part pages import and the
// route (functions/api/daily-art.js) shares, with NO imports so a page that uses it loads almost nothing:
//   dailyArt('sports', 'nfl')                      -> '/api/daily-art?kind=sports&key=nfl&day=2026-10-26'  (an <img src>; '' for a kind or key not on the lists)
//   dailyArt('sports', 'epl', { photo: true, q: 'Arsenal Chelsea Emirates Stadium', date: '2026-10-25' })   a photo, when an openly licensed one qualifies
//   dailyArtImg(kind, key, opts)                   -> { src, width, height, ratio, alt }: the box a page sets before the picture arrives (no layout shift)
//   dailyArtInfo(kind, key, opts)                  -> the picture's true source and credit (fetch of ?json=1), for the line under it
//   mountCredit(el, info)                          -> draws that line: "Illustration by Verse", or "Photo: <author>, CC BY 4.0, via Wikimedia Commons" with its
//                                                     links and a report link; the label is always the true source, never "Verse photo"
// The lists are CLOSED: a kind, a key (a league, a section, a wrap) and a mood come from the lists below, so an illustration's prompt is made only of our own
// words (no names, no teams, no logos) and a stranger cannot make the route paint anything else. Pure. Tests: tools/daily-art.test.mjs, tools/daily-photo.test.mjs.

export const DAILY_ART_W = 1024, DAILY_ART_H = 576, LABEL = 'Illustration by Verse', REPORT_MAIL = 'atom@a-to-mind.com';
export const KINDS = Object.freeze(['sports', 'news', 'finance']);
/** the keys each kind takes: a league, a news section, a market wrap. */
export const KEYS = Object.freeze({
  sports: Object.freeze(['all', 'nfl', 'nba', 'wnba', 'mlb', 'nhl', 'epl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'mls', 'ucl', 'ncaaf', 'ncaab', 'f1', 'tennis', 'golf', 'cricket', 'rugby', 'ufc', 'olympics']),
  news: Object.freeze(['top', 'world', 'us', 'politics', 'business', 'tech', 'science', 'health', 'entertainment', 'climate', 'culture']),
  finance: Object.freeze(['wrap', 'stocks', 'crypto', 'commodities', 'rates', 'fx', 'economy']),
});
/** the keys a page's front view uses: they keep a reserve of the day's budget so a stranger cannot spend it all on obscure keys first. */
export const PRIMARY = Object.freeze(['sports:all', 'sports:nfl', 'sports:nba', 'sports:epl', 'news:top', 'news:world', 'finance:wrap', 'finance:stocks']);
export const MOODS = Object.freeze({
  calm: 'calm and still, soft light', tense: 'tense and dramatic, high contrast', joyful: 'joyful and bright, warm colours', stormy: 'stormy, dark clouds and wind',
  hopeful: 'hopeful, a new day, sunrise colours', solemn: 'solemn and quiet, muted tones', energetic: 'energetic and dynamic, strong motion', uncertain: 'uncertain, fog and mixed light',
});
// the day's budget (owner, 2026-10-26: a separate small one, not taken from visitors' /image/ allowance). Config lives here, never above it from the environment.
export const DAILY_BUDGET = 30, NON_PRIMARY_SHARE = 0.8, MAX_ATTEMPTS_DAY = 60, PER_CONN_GENERATIONS = 3, MAX_TRIES_KEY_DAY = 3, RETRY_MS = 10 * 60 * 1000, PENDING_MS = 90 * 1000;
export const SHARED_AI_CEILING = 70; // Workers AI pictures a day in all: the Art Forge's 30, /image/'s 10 and this helper's 30 (functions/api/daily-art.js counts them together)
export const NEURONS_PER_PICTURE = 59; // 1024 x 576 is 2.25 tiles of 512 x 512 at 26.05 neurons a tile (developers.cloudflare.com/workers-ai/platform/pricing, FLUX.2 klein 4B)

const SCENES = Object.freeze({
  sports: {
    all: 'an assortment of sports balls, a racket and a glove arranged on a bright field',
    nfl: 'an american football game under floodlights, a ball in mid-air, a packed stadium of soft silhouettes',
    nba: 'an indoor basketball arena, a ball above the rim, bright court lines, crowd silhouettes',
    wnba: 'a bright indoor basketball court, a ball arcing toward the hoop, a cheering crowd of soft silhouettes',
    mlb: 'a baseball diamond at dusk, a ball flying over the infield, stadium lights glowing',
    nhl: 'an ice hockey rink, sweeping skate trails on the ice, a puck sliding, bright arena lights',
    epl: 'a football (soccer) pitch on a misty evening, a ball near the goal net, packed stands as silhouettes',
    laliga: 'a football (soccer) pitch at golden sunset, a ball near the goal, warm light on the stands',
    seriea: 'a football (soccer) stadium in warm terracotta evening glow, a ball at the penalty spot',
    bundesliga: 'a football (soccer) stadium on a crisp night, bright floodlights, a ball on the grass',
    ligue1: 'a football (soccer) pitch in soft twilight, a ball and a goal, a gentle crowd murmur of colour',
    mls: 'a football (soccer) stadium on a summer night, floodlights and a ball in flight',
    ucl: 'a grand night football (soccer) match, a starry sky, very bright floodlights, a ball in the air',
    ncaaf: 'a college football stadium on an autumn afternoon, a ball in the air, plain colourful banners without writing',
    ncaab: 'a college basketball arena, a ball above the hoop, colourful plain pennants without writing',
    f1: 'a racing circuit at dusk, blurred speed streaks, a sleek open-wheel racing car in motion with no markings',
    tennis: 'a tennis court with long shadows, a ball over the net, a bright sky',
    golf: 'a golf course fairway at sunrise, a flag on the green, mist over the grass',
    cricket: 'a cricket ground on a bright afternoon, a ball in flight, wickets and a green outfield',
    rugby: 'a rugby pitch with an oval ball in the air, muddy turf, a grey sky breaking into light',
    ufc: 'an empty combat-sports arena with a single bright spotlight over the ring',
    olympics: 'an athletics stadium with running track lanes at golden hour, a distant glowing torch',
  },
  news: {
    top: 'a bright morning over a harbour, a lighthouse and boats, first light on the water',
    world: 'a globe seen from space with soft glowing city lights',
    us: 'a wide open country landscape, a road and a distant skyline at dawn',
    politics: 'a grand empty assembly hall with tall columns and a beam of light',
    business: 'a city skyline of glass towers at dawn, busy streets as light trails',
    tech: 'glowing circuit-like patterns forming a city, soft blue light',
    science: 'a telescope and a microscope on a desk with swirling galaxy light',
    health: 'a calm green park with a winding path and morning light',
    entertainment: 'a theatre stage with curtains and a spotlight, rows of empty seats',
    climate: 'a coastline with wind turbines, clouds breaking, a rainbow after rain',
    culture: 'a museum hall with colourful abstract paintings and soft light',
  },
  finance: {
    wrap: 'a stock-exchange-style hall seen from a balcony, abstract rising and falling bar shapes, golden light',
    stocks: 'a skyline of towers with rolling hills shaped like a chart line, golden light',
    crypto: 'glowing coins and a network of connected nodes in a dark blue space',
    commodities: 'gold bars, a barrel and sheaves of wheat arranged on a table in warm light',
    rates: 'a balance scale and a clock in front of a bank building with columns, soft pastel colours',
    fx: 'stacks of coins and banknotes in assorted colours without any writing',
    economy: 'a busy harbour with cranes and cargo ships at sunrise',
  },
});
const COMPOSITIONS = Object.freeze(['a wide establishing view', 'a low angle looking up', 'a view from above', 'a close detail in the foreground with the scene behind it', 'a symmetrical composition', 'long shadows and rim light', 'a panoramic view']);
const PALETTES = Object.freeze(['teal and orange', 'indigo and gold', 'green and cream', 'magenta and cyan', 'red and charcoal', 'blue and white', 'violet and amber', 'emerald and rose']);
const STYLE = 'stylised flat illustration, bold shapes, soft gradients, painterly, no text, no letters, no logos, no crests, no brand marks, no real people, no faces, no photograph';

/** a small stable hash (FNV-1a, 32 bits) of a string. Pure. */
export function hash(s) { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export const validKey = (kind, key) => KINDS.includes(kind) && Object.prototype.hasOwnProperty.call(KEYS, kind) && KEYS[kind].includes(key);
export const isPrimary = (kind, key) => PRIMARY.includes(kind + ':' + key);
export const moodOf = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(MOODS, v) ? v : '');
/** a day as YYYY-MM-DD in UTC. */
export const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
/** whether a string is a real calendar day, YYYY-MM-DD. Pure. */
export const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && utcDay(Date.parse(d + 'T00:00:00Z')) === d;
/** the alt text of a day's picture. Pure. */
export const altOf = (kind, key) => (validKey(kind, key) ? LABEL + ': ' + SCENES[kind][key].split(',')[0] : LABEL);

/** the prompt for a day's illustration, made only of the closed vocabulary (the scene, a mood, a composition and a palette that vary with the day), with its
 *  seed: { prompt, negative, seed, mood }. A page's headline facts reach it only as `mood`, one word from MOODS. Pure. */
export function promptFor(kind, key, day, mood = '') {
  if (!validKey(kind, key)) throw new Error('not on the lists');
  const h = hash(kind + '|' + key + '|' + day), m = moodOf(mood) || Object.keys(MOODS)[h % Object.keys(MOODS).length];
  const prompt = [SCENES[kind][key], MOODS[m], COMPOSITIONS[(h >>> 3) % COMPOSITIONS.length], PALETTES[(h >>> 7) % PALETTES.length] + ' colour palette', STYLE].join(', ');
  return { prompt, negative: 'text, letters, numbers, logos, crests, watermark, photograph, real people, faces', seed: h % 1e9, mood: m };
}

// the picture that is always there: a gradient and a glyph made from the kind, the key and the day, no text (so it needs no translation and says nothing untrue)
const num = (n) => String(Math.round(n));
function glyph(kind, key, h) {
  const rot = (h >>> 5) % 40 - 20, ink = 'rgba(255,255,255,0.88)', line = 'rgba(0,0,0,0.35)';
  if (kind === 'sports') {
    if (['nfl', 'ncaaf', 'rugby'].includes(key)) return '<g transform="rotate(' + num(rot) + ' 512 288)"><ellipse cx="512" cy="288" rx="190" ry="112" fill="' + ink + '"/><path d="M512 190v196M470 232v112M554 232v112M440 288h144" stroke="' + line + '" stroke-width="10" stroke-linecap="round" fill="none"/></g>';
    if (key === 'nhl') return '<g transform="rotate(' + num(rot / 2) + ' 512 288)"><ellipse cx="512" cy="318" rx="170" ry="52" fill="' + line + '"/><ellipse cx="512" cy="288" rx="170" ry="52" fill="' + ink + '"/></g>';
    return '<g transform="rotate(' + num(rot) + ' 512 288)"><circle cx="512" cy="288" r="132" fill="' + ink + '"/><path d="M380 288c60-50 204-50 264 0M380 288c60 50 204 50 264 0M512 156v264" stroke="' + line + '" stroke-width="9" fill="none"/></g>';
  }
  if (kind === 'news') {
    if (['top', 'world', 'us', 'climate', 'science'].includes(key)) return '<g fill="none" stroke="' + ink + '" stroke-width="9"><circle cx="512" cy="288" r="140"/><ellipse cx="512" cy="288" rx="62" ry="140"/><ellipse cx="512" cy="288" rx="140" ry="42"/><path d="M512 148v280"/></g>';
    return '<g transform="rotate(' + num(rot / 3) + ' 512 288)"><rect x="372" y="170" width="280" height="236" rx="18" fill="' + ink + '"/><rect x="398" y="196" width="228" height="64" rx="8" fill="' + line + '"/><rect x="398" y="282" width="108" height="100" rx="8" fill="' + line + '"/><rect x="526" y="282" width="100" height="22" rx="6" fill="' + line + '"/><rect x="526" y="320" width="100" height="22" rx="6" fill="' + line + '"/><rect x="526" y="358" width="64" height="22" rx="6" fill="' + line + '"/></g>';
  }
  const bars = [0, 1, 2, 3, 4].map((i) => 60 + ((h >>> (i * 4)) % 90) + i * 18);
  return '<g>' + bars.map((b, i) => '<rect x="' + (372 + i * 56) + '" y="' + (400 - b) + '" width="36" height="' + b + '" rx="6" fill="' + ink + '"/>').join('') + '<path d="M372 380L428 330L484 346L540 270L596 214L652 172" stroke="' + line + '" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
}
/** the deterministic SVG for a kind, key and day (1024 x 576): a gradient with soft circles and a glyph, no text. Pure; the same inputs give the same bytes. */
export function fallbackSvg(kind, key, day) {
  if (!validKey(kind, key)) throw new Error('not on the lists');
  const h = hash(kind + '|' + key + '|' + day), h2 = hash(key + '|' + day + '|b'), a = h % 360, b = (a + 40 + (h2 % 90)) % 360;
  const dots = [0, 1, 2, 3].map((i) => '<circle cx="' + ((h2 >>> (i * 5)) % 1024) + '" cy="' + ((h >>> (i * 6)) % 576) + '" r="' + (60 + ((h >>> (i * 3)) % 120)) + '" fill="hsl(' + ((a + i * 50) % 360) + ' 70% 60%)" opacity="0.18"/>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 576" width="1024" height="576"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + a + ' 62% 22%)"/><stop offset="1" stop-color="hsl(' + b + ' 70% 46%)"/></linearGradient></defs><rect width="1024" height="576" fill="url(#g)"/>' + dots + glyph(kind, key, h) + '</svg>';
}

// ---- what a page calls ----
const enc = encodeURIComponent;
/** the address of a day's picture, or '' for a kind or key not on the lists. `day` defaults to today in UTC. Options: day, mood, and for sports photo: true with
 *  q (the teams, the venue or the event, at most 80 characters of letters and digits), date (the event's day) and video (a YouTube video id of an official channel). */
export function dailyArt(kind, key, o = {}) {
  if (!validKey(kind, key)) return '';
  const day = validDay(o.day) ? o.day : utcDay(), m = moodOf(o.mood);
  let u = '/api/daily-art?kind=' + kind + '&key=' + key + '&day=' + day + (m ? '&mood=' + m : '');
  if (kind === 'sports' && o.photo) { u += '&photo=1'; if (o.q) u += '&q=' + enc(String(o.q).slice(0, 80)); if (validDay(o.date)) u += '&date=' + o.date; if (/^[A-Za-z0-9_-]{11}$/.test(o.video || '')) u += '&video=' + o.video; }
  return u;
}
/** the box for the picture: set these on the <img> and its box before the picture arrives, so nothing moves when it does (object-fit: contain keeps a photo whole). */
export function dailyArtImg(kind, key, o = {}) {
  const src = dailyArt(kind, key, o);
  return { src, width: DAILY_ART_W, height: DAILY_ART_H, ratio: '16 / 9', alt: altOf(kind, key), style: 'width:100%;height:auto;aspect-ratio:16 / 9;object-fit:contain;background:rgba(127,127,127,.12);border-radius:12px;display:block' };
}
/** the picture's true source and credit: { source, label, credit: [{ t, href? }], embed?, ... } or null when the route cannot be reached. */
export async function dailyArtInfo(kind, key, o = {}, fetchFn = (typeof fetch === 'function' ? fetch : null)) {
  const src = dailyArt(kind, key, o); if (!src || !fetchFn) return null;
  try { const r = await fetchFn(src + '&json=1'); const j = await r.json(); return j && j.ok ? j : null; } catch (_) { return null; }
}
const safeHref = (h) => (/^(?:https:\/\/|mailto:atom@a-to-mind\.com)/.test(String(h || '')) ? String(h) : '');
/** draws a credit line into `el`: text, and links only to https addresses or the report address. Never HTML. */
export function mountCredit(el, info) {
  if (!el || !info || !Array.isArray(info.credit)) return;
  const d = el.ownerDocument, out = [];
  for (const seg of info.credit.slice(0, 20)) {
    const t = String(seg && seg.t != null ? seg.t : '').slice(0, 300), href = safeHref(seg && seg.href);
    if (!t) continue;
    if (href) { const a = d.createElement('a'); a.href = href; a.textContent = t; if (!href.startsWith('mailto:')) { a.rel = 'noopener noreferrer'; a.target = '_blank'; } out.push(a); } else out.push(d.createTextNode(t));
  }
  el.replaceChildren(...out); el.dataset.source = String(info.source || '');
}

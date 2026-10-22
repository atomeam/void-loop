/**
 * films skill - Verse's own films: where to watch them (/films/, free for everyone, no sign-in)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Owner, 2026-10-14: "where do I watch the films i have typed films voids fillms nothing pulls it up . Verse should know whatI mean
 * and help". Takes "films", "voids fillms", "void's films", "where do I watch the films", "show me your videos", "review films",
 * typos included; leaves films about anything else ("best films of 2025", "film a timer") to the skills that answer those.
 */
const FILM = '(?:films?|fillms?|filmes|flims?|fimls?|fims)';
const ASK = '(?:(?:where|how)\\s+(?:do|can|could)\\s+i\\s+(?:watch|see|find|review|get\\s+to)\\s+|(?:show\\s+me|open|watch|see|play|review|go\\s+to|take\\s+me\\s+to|where\\s+are)\\s+)?(?:the\\s+)?';
const WHOSE = "(?:void'?s?|(?:v0[1i]d|verse)'?s?|your|my|a-?to-?mind'?s?)\\s+";
const MINE = new RegExp('^' + ASK + '(?:' + WHOSE + ')?' + FILM + '(?:\\s+(?:page|reviews?|to\\s+review))?$', 'i'); // "films", "voids fillms", "review films"
const VIDEOS = new RegExp('^' + ASK + WHOSE + '(?:videos?|movies?|shorts|recordings)(?:\\s+page)?$', 'i'); // "your videos" needs the whose
const REVIEW = new RegExp('^' + FILM + '\\s+reviews?$', 'i'); // "film review"

export const PAGE = '/films/';
// "upload this to youtube", "post a film on tiktok", "how do i upload your videos" (owner, 2026-10-15: anyone can upload them):
// the films page has Download, Copy for <platform> and Upload to <platform> on every film and ad clip
const UPLOAD = /^(?:how\s+(?:do|can)\s+i\s+)?(?:upload|post|share|repost)\s+(?:this|it|that|a|one|the|your|(?:verse|v01d)'?s?|(?:verse|void)'?s?)?\s*(?:films?|videos?|clips?|ads?|shorts?)?\s*(?:to|on)\s+(?:youtube|yt|tiktok|reels|instagram|x|twitter)$/i;
export const wantsUpload = (lower) => UPLOAD.test(String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
export function wantsFilms(lower) {
  const t = String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (wantsUpload(t)) return true;
  if (/^(?:(?:open|go to|take me to|show)\s+)?(?:https?:\/\/)?(?:www\.)?(?:a-to-mind\.com)?\/films\/?$/i.test(t)) return true; // the page's address typed into the ask box
  return MINE.test(t) || VIDEOS.test(t) || REVIEW.test(t);
}

// the films as data (asked by Verse, 2026-10-15: "Implement the 'film-metadata' skill to extract structured JSON from any Verse FILM
// currently on the stage"): "film metadata", "films as json", "films json", "export the films". Read from /api/films, which anyone
// may list; each film becomes { id, day, experiment, title, tags, source, watch }.
const META = new RegExp('^(?:(?:show|give|get|export|list)\\s+(?:me\\s+)?)?(?:the\\s+)?(?:' + WHOSE + ')?(?:' + FILM + '|videos?)\\s+(?:metadata|meta|data|as\\s+json|json|info)$|^(?:export\\s+(?:the\\s+)?' + FILM + ')$', 'i');
export const wantsFilmMeta = (lower) => META.test(String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
export function filmMeta(f) {
  const m = String(f.id || '').match(/^(\d{8})-(.+?)-r\d+$/), exp = m ? m[2] : '';
  const src = (String(f.description || '').match(/How it is built: (https:\/\/github\.com\/\S+)/) || [])[1] || (exp ? 'https://github.com/atomeam/void-loop/blob/main/void-live-deploy/fringe/' + exp + '.html' : '');
  const day = m ? m[1].slice(0, 4) + '-' + m[1].slice(4, 6) + '-' + m[1].slice(6) : String(f.at || '').slice(0, 10);
  const tags = Array.isArray(f.tags) ? f.tags : String(f.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  return { id: f.id, day, experiment: exp, title: f.title || '', tags, source: src, watch: 'https://a-to-mind.com/films/' };
}
// The feed monitor (asked by Verse: "watches the /films/rss route and triggers a 'new-content' notification card") and the film card
// (asked by Verse: "a 'film-card' ... that displays the discovered film's details"): "new films", "any new films", "what's new on
// v01d tube" read the same list /films/rss is built from (/api/films) and show the films since this browser last looked, each as a
// card with its title, day, experiment and watch link. What was seen is kept in this browser only (localStorage), never sent.
const NEW_RE = /^(?:are\s+there\s+|any\s+)?(?:new|newest|latest|fresh)\s+(?:v01d\s+|void\s+|verse\s+)?(?:films?|videos?|shorts|clips)(?:\s+(?:from|by|on)\s+(?:v01d|void|verse|you))?$|^what'?s\s+new\s+(?:on|in)\s+(?:v01d\s+tube|(?:the\s+)?films)$|^(?:any|got\s+any)\s+new\s+(?:films?|videos?)\s+(?:for\s+me|today)?$/;
export const wantsNewFilms = (lower) => NEW_RE.test(String(lower || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim());
/** the films newer than the last one seen (newest first); none seen yet: the newest three. Pure. */
export function newSince(films, seenId, firstN = 3) {
  const F = (films || []).filter((f) => f && f.id); const i = seenId ? F.findIndex((f) => f.id === seenId) : -1;
  return i < 0 ? F.slice(0, firstN) : F.slice(0, i); // an unknown or aged-out id: the newest few
}
async function runNew(api) {
  const { showPage, esc } = api, KEY = 'v01d.films.seen';
  const el = showPage((p) => { p.innerHTML = '<h2>New from VERSE FILMS</h2><div class="sub">\u2026</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json()), F = j.films || [];
    if (api._pageStill && !api._pageStill(el)) return 'films';
    let seen = null; try { seen = localStorage.getItem(KEY); } catch (_) {}
    const N = newSince(F, seen);
    try { if (F[0]) localStorage.setItem(KEY, F[0].id); } catch (_) {}
    el.innerHTML = '<h2>New from VERSE FILMS</h2><div class="sub" data-new-films="' + N.length + '">' + esc(N.length ? N.length + (seen ? ' new since you last looked' : ' newest') : 'Nothing new since you last looked') + '</div>'
      + N.map((f) => { const m = filmMeta(f); return '<div class="vfilm-card" style="margin:10px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1)"><b>' + esc(m.title || f.title || f.id) + '</b><div class="sub">' + esc([m.day, m.experiment].filter(Boolean).join(' · ')) + '</div><a href="' + esc(PAGE + '?v=' + encodeURIComponent(f.id)) + '">Watch</a></div>'; }).join('')
      + '<div class="src"><a href="/films/rss">RSS</a> · <a href="' + PAGE + '">All films</a></div>';
  } catch (_) { el.innerHTML = '<h2>New from VERSE FILMS</h2><p>' + esc('The films could not be read just now. Try again in a minute.') + '</p>'; }
  return 'films';
}

async function runMeta(api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>VERSE FILMS as data</h2><div class="sub">\u2026</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'films';
    const rows = (j.films || []).map(filmMeta), json = JSON.stringify(rows, null, 2);
    el.innerHTML = '<h2>VERSE FILMS as data</h2><div class="sub">' + esc(rows.length + (rows.length === 1 ? ' film' : ' films') + ', newest first') + '</div>'
      + '<pre class="vfilm-json" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;font-size:12px">' + esc(json) + '</pre>'
      + '<div class="src">' + esc('from a-to-mind.com/api/films') + '</div>';
  } catch (_) {
    el.innerHTML = '<h2>VERSE FILMS as data</h2><p>' + esc('The films could not be read just now. Try again in a minute.') + '</p>';
  }
  return 'films';
}

const STYLE = `<style>
  .vfilms { display: grid; gap: 14px; }
  .vfilms .poster { position: relative; overflow: hidden; border-radius: 16px; padding: 22px 20px 20px; color: #fff;
    background: radial-gradient(120% 90% at 85% 0%, rgba(255,72,120,.55), transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(90,110,255,.6), transparent 60%), linear-gradient(160deg, #14102a, #07070d 70%);
    box-shadow: 0 18px 50px rgba(30,20,80,.45), inset 0 0 0 1px rgba(255,255,255,.08); }
  .vfilms .poster::after { content: ''; position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px); }
  .vfilms .kicker { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.7); margin: 0 0 6px; }
  .vfilms h2 { margin: 0 0 8px; font-size: clamp(26px, 6vw, 34px); line-height: 1.05; letter-spacing: -.02em; }
  .vfilms .line { margin: 0; color: rgba(255,255,255,.82); max-width: 34ch; }
  .vfilms .play { display: inline-flex; align-items: center; gap: 12px; margin-top: 18px; padding: 12px 20px 12px 12px; border-radius: 999px;
    background: linear-gradient(90deg, #ff3d7f, #7a5cff); color: #fff; font-weight: 700; text-decoration: none; box-shadow: 0 8px 26px rgba(255,61,127,.4); transition: transform .15s ease, box-shadow .15s ease; }
  .vfilms .play:hover, .vfilms .play:focus-visible { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(255,61,127,.55); }
  .vfilms .play i { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.18); display: grid; place-items: center; font-style: normal; }
  .vfilms ol { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; padding: 0; list-style: none; counter-reset: s; }
  .vfilms li { counter-increment: s; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); font-size: 13px; line-height: 1.35; }
  .vfilms li::before { content: counter(s); display: block; font-weight: 800; font-size: 18px; background: linear-gradient(90deg, #ff3d7f, #7a5cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .vfilms .who { margin: 0; font-size: 13px; opacity: .75; }
  /* the I in FILMS glitches into a 1 now and then (owner, 2026-10-14: "the i flickers"; "drop the l i only") */
  /* the whole word is ONE box (owner, 2026-10-22: "VERSE F   I   LMS"): a card title is a flex row spread with space-between, so loose
     text and the glitch span were spread apart as three items; wrapped, the word stays whole and the glitch shakes all of it */
  .vfilms .glw { display: inline-block; white-space: nowrap; animation: gl-w var(--gl-d, 10s) ease-in-out -3s infinite; }
  @keyframes gl-w { 0%, 94.5% { transform: none; text-shadow: none; } 96.5% { transform: translateX(1px); text-shadow: -2px 0 rgba(255,61,127,.7), 2px 0 rgba(122,92,255,.7); } 98% { transform: translateX(-1px); text-shadow: 2px 0 rgba(255,61,127,.7), -2px 0 rgba(122,92,255,.7); } 99.5%, 100% { transform: none; text-shadow: none; } }
  .vfilms .gl { position: relative; display: inline-block; }
  .vfilms .gl b { font-weight: inherit; animation: gl-l var(--gl-d, 10s) ease-in-out -3s infinite; }
  .vfilms .gl i { position: absolute; left: 50%; top: 0; font-style: normal; opacity: 0; transform: translateX(-50%) skewX(-6deg); color: #fff; -webkit-text-fill-color: #fff;
    text-shadow: -2px 0 #ff3d7f, 2px 0 #7a5cff; animation: gl-1 var(--gl-d, 10s) ease-in-out -3s infinite; }
  /* rare and slow (owner, 2026-10-22: "rarer and slower"): one eased ~400ms swap per 8-12 s cycle; the page re-rolls the cycle length each time (--gl-d) */
  @keyframes gl-l { 0%, 94% { opacity: 1; } 95.5% { opacity: 0; } 98% { opacity: 0; } 99.6%, 100% { opacity: 1; } }
  @keyframes gl-1 { 0%, 94% { opacity: 0; } 95.5% { opacity: 1; } 98% { opacity: 1; } 99.6%, 100% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .vfilms .gl b, .vfilms .gl i, .vfilms .glw { animation: none; } .vfilms .play { transition: none; } }

</style>`;

/** every glitch word re-rolls its cycle to 8-12 s at random after each glitch, so the swap comes at an unpredictable moment (owner, 2026-10-22) */
export function glitchRandom(root) {
  for (const w of root.querySelectorAll('.glw')) {
    if (w._glr) continue; w._glr = 1;
    const roll = () => w.style.setProperty('--gl-d', (8 + Math.random() * 4).toFixed(2) + 's');
    roll(); w.addEventListener('animationiteration', (e) => { if (e.target === w) roll(); });
  }
}

function run(text, api) {
  if (wantsNewFilms(text)) return runNew(api);
  if (wantsFilmMeta(text)) return runMeta(api);
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = STYLE + '<div class="vfilms">'
      + '<div class="poster"><p class="kicker">' + esc('Now showing · a new one daily') + '</p>'
      + '<h2 aria-label="VERSE FILMS"><span class="glw">VERSE F<span class="gl fast" aria-hidden="true"><b>I</b><i>1</i></span>LMS</span></h2>'
      + '<p class="line">' + esc('Every day Verse films one of its own experiments: built by itself, shot in a real browser.') + '</p>'
      + '<a class="play" href="' + PAGE + '"><i aria-hidden="true">\u25B6</i>' + esc('Watch now') + '</a></div>'
      + (wantsUpload(text)
        ? '<ol><li>' + esc('Pick any film or ad clip and tap 1. Download (free)') + '</li><li>' + esc('Tap 2. Copy: title, description with the a-to-mind.com link, hashtags') + '</li><li>' + esc('Tap 3. Upload to YouTube, TikTok, Reels or X, signed in as you, and paste') + '</li></ol>'
        : '<ol><li>' + esc('Watch the newest film') + '</li><li>' + esc('Post any of them: Download, Copy, Upload to YouTube, TikTok, Reels or X') + '</li><li>' + esc('Every upload is an ad for Verse') + '</li></ol>')
      + '<p class="who">' + esc('Free for everyone to watch and share, no sign-in.') + '</p>'
      + '<div class="src">' + esc('a-to-mind.com/films/') + '</div></div>';
    glitchRandom(el);
  });
  return 'films';
}

export default {
  name: 'films',
  examples: [
    'films',
    'voids fillms',
    "void's films",
    'where do I watch the films',
    'show me your videos',
    'review films',
    'film review',
    '/films/',
    'v01d films',
    'film metadata',
    'new films',
    'any new videos from v01d',
    'films as json',
    'upload this to youtube',
    'post a clip on tiktok',
  ],
  nearMisses: [
    'film a timer',
    'best films of 2025',
    'films about space',
    'how do I film a video',
    'horror movies',
  ],
  match(lower) { return wantsFilms(lower) || wantsFilmMeta(lower) || wantsNewFilms(lower); },
  run,
};

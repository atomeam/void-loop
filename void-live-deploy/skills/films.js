/**
 * films skill - Void's own films: where to watch and review them (/films/, for members and the owner)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Owner, 2026-10-14: "where do I watch the films i have typed films voids fillms nothing pulls it up . Void should know whatI mean
 * and help". Takes "films", "voids fillms", "void's films", "where do I watch the films", "show me your videos", "review films",
 * typos included; leaves films about anything else ("best films of 2025", "film a timer") to the skills that answer those.
 */
const FILM = '(?:films?|fillms?|filmes|flims?|fimls?|fims)';
const ASK = '(?:(?:where|how)\\s+(?:do|can|could)\\s+i\\s+(?:watch|see|find|review|get\\s+to)\\s+|(?:show\\s+me|open|watch|see|play|review|go\\s+to|take\\s+me\\s+to|where\\s+are)\\s+)?(?:the\\s+)?';
const WHOSE = "(?:void'?s?|your|my|a-?to-?mind'?s?)\\s+";
const MINE = new RegExp('^' + ASK + '(?:' + WHOSE + ')?' + FILM + '(?:\\s+(?:page|reviews?|to\\s+review))?$', 'i'); // "films", "voids fillms", "review films"
const VIDEOS = new RegExp('^' + ASK + WHOSE + '(?:videos?|movies?|shorts|recordings)(?:\\s+page)?$', 'i'); // "your videos" needs the whose
const REVIEW = new RegExp('^' + FILM + '\\s+reviews?$', 'i'); // "film review"

export const PAGE = '/films/';
export function wantsFilms(lower) {
  const t = String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:https?:\/\/)?(?:www\.)?(?:a-to-mind\.com)?\/films\/?$/i.test(t)) return true; // the page's address typed into the ask box
  return MINE.test(t) || VIDEOS.test(t) || REVIEW.test(t);
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
  @media (prefers-reduced-motion: reduce) { .vfilms .play { transition: none; } }
</style>`;

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = STYLE + '<div class="vfilms">'
      + '<div class="poster"><p class="kicker">' + esc('Now showing · a new one daily') + '</p>'
      + '<h2>' + esc("V01D's films") + '</h2>'
      + '<p class="line">' + esc('Every day V01D films one of its own experiments: built by itself, shot in a real browser.') + '</p>'
      + '<a class="play" href="' + PAGE + '"><i aria-hidden="true">\u25B6</i>' + esc('Watch and review') + '</a></div>'
      + '<ol><li>' + esc('Watch the newest film') + '</li><li>' + esc('Review it: post it, needs work or skip') + '</li><li>' + esc('The best go to YouTube') + '</li></ol>'
      + '<p class="who">' + esc('For members. Sign in with a paid account, or paste your V01D Pro key or Code Review Pro license on the films page.') + '</p>'
      + '<div class="src">' + esc('a-to-mind.com/films/') + '</div></div>';
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
  ],
  nearMisses: [
    'film a timer',
    'best films of 2025',
    'films about space',
    'how do I film a video',
    'horror movies',
  ],
  match(lower) { return wantsFilms(lower); },
  run,
};

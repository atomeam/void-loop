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
  return MINE.test(t) || VIDEOS.test(t) || REVIEW.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>' + esc("Void's films") + '</h2>'
      + '<p>' + esc('Every day Void films one of its own experiments. Members watch them and review each one: post it, needs work or skip, with a note. The owner reads every review and decides what goes on YouTube.') + '</p>'
      + '<p><a class="btn" href="' + PAGE + '">' + esc('Watch and review the films') + '</a></p>'
      + '<p>' + esc('For members: sign in with a paid account, or paste your Void Pro key or Code Review Pro license key on that page.') + '</p>'
      + '<div class="src">' + esc('a-to-mind.com/films/ · a new film every day') + '</div>';
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

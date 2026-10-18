# Real movies: Verse names only movies a source knows, and plays only what is legal

**Starts when:** someone asks Verse to pick a movie ("pick a movie to watch with me", "movie night"), or a row of the pick opens "movie card for <title> (<year>)". Owner, 2026-10-17: Verse wrote 'Talk to Me (2022)' from memory; "have it find the actual movies it suggests ... and play right in v01d".

1. **Suggest:** `skills/movie.js` asks `/api/answer` for `Title (Year)` lines; `lib/movies.js` `parseSuggestions` reads them. A title is untrusted (a model or a person wrote it): `cleanTitle` first, before any request or render. One free film (`FREE_PICKS`) is added so something always plays; with the model away the list is `FREE_PICKS`.
2. **Verify:** `/api/movies?title=&year=` (`functions/api/movies.js`) asks iTunes Search (poster, overview, official trailer, store link) and the Internet Archive (`legalArchive`: public domain, Creative Commons or Blender open movies; exact normalised title, year within one). Neither knows it = `verified:false` = listed as "not verified", no facts.
3. **Play:** an archive film in a `<video>` (`pickFile` picks an mp4 from the item's files, else the archive's own embed in a sandboxed iframe); an official trailer from Apple's CDN (host checked); an in-copyright film gets trailer plus search links (Apple TV, JustWatch, archive search). Never a pirate or scraped stream, never a host the ask picks.
4. **Card:** the movie's poster is the first https `<img>` (hidden) so `lib/card-frame.js` uses it as the card's art; the frame adds copy/save.
5. **Test:** `node tools/test_void.mjs --only "real movies"` (sources stood in; the build machine could not reach iTunes or the archive, so the first live ask after deploy is the real check: `node tools/ask.mjs "pick a movie to watch with me"`).

**Mistakes to avoid:** matching on a loose title (a song or a remake passes); trusting an archive item without a licence/collection test; a title in a URL or in HTML unescaped; adding a source that streams copyrighted films.

**Other kinds (2026-10-17):** the same five steps with a per-kind adapter in `functions/api/media.js` and `lib/media.js` (`KINDS`, `pickKind`: a named kind, a verb, or Verse choosing by the day). A new kind adds: its prompt and parser, its adapter (a keyless source, fixed host, exact-title match), its card, a legal player (30 s preview, free film, trailer, a stage game) and a `--only "real <kind>"` test. Music is first (iTunes, 30 s preview).

**Taste (pick for me, 2026-10-17):** `lib/taste.js` holds the pick algorithm (seen list per kind, interests from real signals only, exploit/explore, genre diversity, `whyPick`); `tools/taste.test.mjs` is its test. A new kind needs lookup results with `genre`, `artist` or `director` so it can be scored. Takeout is parsed in the browser only; never add an OAuth link or send the history anywhere.

**Shows (2026-10-17):** TVMaze `singlesearch/shows?embed=seasons`: exact title, premiere year within one; seasons and episodes summed from the embed; links only (official site, JustWatch search, TVMaze page). `--only "real shows"`.
"Source says no" is an answer (shows): `showAvailability` in `lib/media.js` turns TVMaze data plus the viewer's country into ok / region / unavailable; the card then says "Not available here" or "Not verified as available" and offers the official site and TVMaze page only. `--only "real shows"`.

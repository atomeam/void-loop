# Versus page checklist

A Versus page counts as a floor only when every item below is checked for that page. `works` in `void-live-deploy/lib/versus-floor.js` is `true` only then. A thin or rushed page stays `works: false`. No new site is added until every page already on the list passes.

Paste this list into the pull request, still unchecked, and check an item only for something that pull request proved. Name the old title and the new title.

## The ten gates

1. **Name.** The title, the H1, the nav or card label, and the elevator row use one plain name for what the page does. A stranger understands it at once. Vague one-word names are not enough: Schedules, Letters, Tracks, Meanings, Patterns, Units, Readable. Names that fit: Cron Schedule Explainer, ROT13 Text Scrambler, Album Track Time Adder, Dictionary, Regex Tester, Unit Converter, QR Code Maker, Podcast Search, Text Compare. A page that covers more than one sport is named for those sports, not for football alone. Directly under the H1, one warm complete sentence says what the page does and who it is for.
2. **Layout.** A normal website: the title, the purpose line, the tool large in the middle with real buttons, a help section that shows how to use it, then the story with headings. It works on a phone.
3. **Look.** The shared Verse style (`void-live-deploy/versus/layout.css` and the Verse shell) feels like a new internet: depth, light, clear type, room to breathe, motion that respects `prefers-reduced-motion`. The page stays easy to read.
4. **Sentences.** Warm, complete sentences a ninth-grader can read. No clipped fragments and no unexplained jargon.
5. **The original, then more.** The page presents the same thing the live original presents, including its example. Every feature and control on the live original is a row in the pull request, with a screenshot of the original beside Verse, a check or a gap, and at least one useful extra the original cannot do.
6. **Story.** A full sourced history of the original: who made it, when, why, the domain, archive copies, notable mentions, and odd details that the sources actually support. Headings and citations. Say plainly what is unknown. Do not invent a motive. Do not call a site a joke about copyright unless a source says so.
7. **Compare.** The live original is linked near the top of the page and in the owner elevator (new tab, `rel="noopener noreferrer"`). The elevator shows both screenshots, the feature rows, the measured numbers side by side (load speed, loads that answered, phone layout, accessibility, offline, page weight), and links to both pages. No better or worse column. Visitors still see only the Out of Order sign. Public pages do not link to `/versus/`.
8. **Nothing lost.** Before editing a page, card, or view, list what the old version did, including git history from before the owner elevator. The pull request has a before/after table. Every old feature stays unless Atom said to remove it.
9. **Live proof.** Playwright on the live site, with an owner or Uni pass, does the page's main jobs with real inputs and gets the right results. Zero console errors and zero content-security-policy violations. The check is `node tools/floor-live.mjs` in CI (`.github/workflows/floor-live.yml`). For the dictionary that is hello, run, and a word that is not there.
10. **Clean words and addresses.** The Verse URL does not contain the rival's name or domain, and an existing URL is not changed for a rename. The page and the pull request do not say taking, grabbing, stealing, absorbing, or conquering. Banned phrases in `tools/plain-phrases.txt` stay out of the title, the body, and new page copy.
11. **Usable together.** The page links to related Verse pages and passes the result in the address (`?text=`, `?list=`, `?q=`, or that page's own parameter), so the next tool opens on the same work. A "Use this with" section holds those links. The live browser check opens at least one of them and finds the value on the next page.

## How a page is built

Each page already on the list is brought up to this checklist once, in one pull request, then left alone unless it breaks. Dictionary is first. Names and the shared style are changed for every page in one pull request, not again inside each page. After the existing pages pass, the next pull request is one new small site, complete, smallest job first. No second rewrite, no polishing loop, and no re-audit of a page that passed.

A report keeps a short list: the page, the pull request, and whether it is live.

## Standing rules

- Spotify, YouTube, and Google Maps stay at the end, least visited first, and do not count until a full page does their whole job.
- Dictionary lookups use `/api/meanings?word=` with `User-Agent: Verse/1.0 (https://a-to-mind.com; contact)`. The browser does not call Wiktionary.
- Album Track Time Adder opens on the King Crimson list the original prints, keeps paste-your-own-list and a share link, and does not play the music.
- A handoff tag uses only the types allowed by `tools/handoff-scan.mjs`.

# The gate's standards (owner, 2026-10-28)

These apply to every Versus floor. They were written after Amazon and YouTube read as checked off when Verse's store and video pages could not do what those sites do. **Fix bugs, never weaken tests.**

## What went wrong

- **Amazon (shopping) read 11 of 13.** Three of the ticks were keyword parts judged on Verse alone ("7 of 7 shown for the question; the site is not asked"). Accuracy was judged against a fixed standard, not against Amazon. Completeness read "23 of 23 vs Amazon 0 of 23" because the gate met Amazon's bot wall, scored the wall as an empty store and called it a win.
- **YouTube (video) read "replaced"** in `lap.items.json` (the "only site you need" list). The status came from a skill count in `tools/lap-items.mjs`: two or more skills and one test meant "replaced", and the tower was never consulted. The same rule called maps, docs and notes, photos, games, calculator, and timer and clock "replaced". None of those floors was beaten.

## The standards

1. **Scripted end-to-end journeys per competitor.** Each floor lists the journeys a person takes on the rival site in `void-live-deploy/lib/tower-journeys.js`. Floors without their own list take their lane leader's, or the default two: do the main job and see the result, then share it and reopen it from the link. `tools/tower-journeys.mjs` runs each journey on Verse's page in a real browser and writes one row per journey: `journey: <name>`. A route loading, a 200 response or a keyword on the page is not a journey.
2. **Positive and negative controls.**
   - Every step states what must show after it (positive).
   - After every step the page must show no stub, placeholder, "coming soon", mock-data text, error page or near-empty page (negative). These checks are `negativesOf` in `lib/tower-controls.js`.
   - A journey row passes only with `verdict: 'pass'`, the steps it took and the negative controls it checked (`journeyPasses`).
3. **Blocked means INCOMPLETE, never a pass.**
   - A step that times out, a page that does not load and a journey with no script are written `verdict: 'incomplete'`.
   - A rival page that is a bot wall, captcha or sign-in wall (`wallOf`) is not a reading of the rival: its reliability is 0 and the row is not marked `siteRead`.
   - A comparison where the rival scored nothing but the gate never really read it (`zeroRivalUnread`) does not count.
   - The card shows incomplete rows as still to do.
4. **Adversarial regression fixtures.** Every false pass gets a fixture in `tools/tower-falsepass.test.mjs` before its fix lands. Amazon's 11-of-13 rows and YouTube's "replaced" come first. The fixtures also cover a bare "pass" without steps, a self-signed journey, a walled rival and the stub texts.
5. **No mocks in production paths.** A route that claims live data and falls back to static or mock data must say so visibly on the page (a degradation notice). If it does not, the build fails. The negative controls also catch mock-data text on any page a journey visits.
6. **"Replaced" is the tower's word.** `tools/lap-items.mjs` `onlySite` calls a category replaced only when its tower floor is beaten by the gate (`FLOOR_OF` maps a category to floors with other names). With skills it is partial; without them it is missing.
7. **A person's signed call still stands.** `tools/tower-verdict.mjs --beaten` covers the journeys, since the owner or the scout took them by hand. Verse never signs its own.

## Far-future floors

Shopping (Amazon) and video (YouTube) are `farFuture` floors. They stay in the queue behind every small site and carry an honest `gaps` list and a `plan` in `lib/tower.js`. They are not rebuilt now (owner, 2026-10-28): the small single-purpose sites come first, easiest first.

## Running it

- `node tools/tower-journeys.mjs --dry 'random number'` runs one floor's journeys and prints the rows. Without `--dry` it writes them to `tower.evidence.json`.
- `VERSE_BASE=http://localhost:8811/` points the runner at a local copy.
- `node --test tools/tower-falsepass.test.mjs` runs the fixtures. They are also registered in `tools/checks.mjs`.

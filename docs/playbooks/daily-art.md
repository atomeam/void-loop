# A daily picture for a report (lib/daily-art.js, functions/api/daily-art.js)

**What starts it:** a page that reports something each day (scores, news, markets) and wants a picture for it that changes with the day.

**The commands:**
1. In the page: `import { dailyArtImg, dailyArtInfo, mountCredit } from '/lib/daily-art.js'`; set the `<img>` from `dailyArtImg('sports', 'epl', opts)` (its `src`, `width`, `height`, `style`, `alt`) before anything loads, so nothing moves. Kinds and keys are closed lists in `lib/daily-art.js`; add a key there (with its scene) to add a league or section.
2. Under the picture: `dailyArtInfo(kind, key, opts).then((i) => mountCredit(el, i))`. The credit is the true source: "Illustration by Verse", or "Photo: author, licence, via source" with its links and a report link. A page that shows a photo without this line is wrong.
3. For a photo of a game: pass `photo: true, q: 'Home Away Venue', date: 'YYYY-MM-DD'` (teams, venue, event: never a player's name). The route asks Wikimedia Commons, then Openverse, then Flickr and TheSportsDB when their keys are set, and takes only CC0, CC BY, CC BY-SA. Expect archive photos more than the game itself: the credit says when it was taken. For an official highlight pass `video: '<youtube id>'`; it is embedded only when the video's own oEmbed names an official channel (`OFFICIAL_CHANNELS` in `lib/daily-photo.js`, from memory: check them).
4. Owner: `GET /api/daily-art?diag=1&q=<teams>&try=1` with the owner key shows what each source answered and why each candidate was refused; `DELETE /api/daily-art?photo=<id>` takes a photo down and blocks its page; `?refresh=1` paints today's illustration again.
5. Tests: `node --test tools/daily-art.test.mjs tools/daily-photo.test.mjs`.

**How to tell it worked:** the second request for a day makes no model call (the test counts them); a photo's credit always names author, licence with link, and source page; a non-CC photo is refused.

**Mistakes made:** the sources were not reachable from the build sandbox, so the answer shapes follow their documentation and were never checked against a live answer (read `diag` first); Flickr's licence ids are from memory (`diag=1&licences=1` lists Flickr's own); the first sketch counted these pictures inside the Art Forge's 30 and starved it, so they have their own budget.

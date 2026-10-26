# Sports pictures: what Verse can actually do (researched 2026-10-26, asked by the owner)

The owner: "make sure you find out everything we can actually do picture wise for sports". This is the map: every source, what it gives, its licence and limit, and what Verse does with it. Facts below came from web searches, mostly secondary sources; each row says what still has to be checked on the provider's own terms page before it is relied on. Nothing here is legal advice; where a rule is unclear the row says so and Verse takes the safer path.

## Ranked: what to use, in order

| # | Source | What it gives | Licence / limit | Verse's use | Check before relying |
|---|---|---|---|---|---|
| 1 | Verse's own drawings | Score cards, goal and card timelines, stats bars, win-chance curves, lineups on a pitch, results collage, league illustrations (lib/daily-art.js, lib/matchgfx.js) | Verse's own work, no third-party rights; drawn from data (facts are not copyrightable) | Built. Keep widening: shot maps, form strips, standings sparklines, head-to-head bars, heat grids, bracket drawings, season charts, "match poster" cards, per-sport court/field diagrams | none |
| 2 | Wikimedia Commons | Real photos of players, stadiums, trophies, some matches | Per-file CC0 / CC BY / CC BY-SA (accept only these); credit author + licence + link. Venue or event terms can restrict photos even when the photographer offered CC (IOC/Beijing 2008 case); sponsor logos in the picture are a trademark matter; identifiable people have publicity rights | Built in lib/daily-art.js (photo mode); label an archive photo as an archive photo, never as "this game" | Commons licence fields via the API (`imageinfo`); not reachable from the build sandbox, test via the owner diag |
| 3 | Openverse | CC-licensed photos from Flickr, Commons, etc. in one search | Same CC rules; anonymous rate limits (unverified numbers); an API key raises them | Built; owner can set OPENVERSE_CLIENT_ID/SECRET | the anonymous quota |
| 4 | Pexels / Pixabay / Unsplash APIs | Generic sport photos (a runner, a ball, a stadium crowd) for league pages and brief headers | Pexels: free commercial use, attribution not required, no use implying endorsement, API default 200 an hour / 20,000 a month, higher free on request. Pixabay: its own licence, free commercial use, no standalone redistribution, API 100 per 60 s. Unsplash: attribute photographer and Unsplash, no competing service, production limits disputed (1,000 vs 5,000 an hour: confirm) | NOT built. Cheap, safe, free keys: use for generic sport imagery (not for named people or teams) | Each provider's own API terms; free API keys are an owner action |
| 5 | Official channel video embeds | Highlights and recaps, played from the rights holder | Embedding an official YouTube video is the platform's own feature, but leagues can switch embedding off per video (NHL did); policy dated 2015-2020 in the sources | Built for an allow-list of official channels via YouTube oEmbed; if embedding is disabled show a link | per-league policy; the channel handles in lib/daily-art.js were from memory |
| 6 | Getty Images embedded viewer | A large editorial library, shown through Getty's embed code | Free for editorial, non-commercial use with Getty's credit and link; Getty can remove any embed at any time; business sites are a grey area; sources are from 2014 | NOT built. Possible later for editorial pages only; risk: sudden removal, grey area | Getty's current embed terms; whether sports is covered |
| 7 | TheSportsDB images | Team badges, banners, fanart, player cutouts and thumbs | A secondary source warns the artwork may not be used in published apps unless it is CC; the free test key is limited; commercial use said to be cheaper via Patreon | Off until the owner decides (THESPORTSDB_KEY); link through, never store | the official terms page, which the search could not reach |
| 8 | ESPN CDN logos and headshots (a.espncdn.com via the public feed) | Team logos, player headshots | Owned by leagues, teams and agencies; no current ESPN terms found for these endpoints; hotlinking in a commercial product is a risk | Use only what already shows in the feed, hotlinked, never stored or edited, and be ready to drop it; prefer a drawn badge (team colours + initials) as the fallback | ESPN's terms of use |
| 9 | football-data.org crests, API-Football images | Crests, some photos | Crest and photo rights belong to clubs and leagues, not the API; the free tiers are small (10 calls a minute; 100 a day) | Not used | each provider's terms |
| 10 | Licensed agencies (IMAGO, Imagn, Getty licensing) | Real match photos for pay | IMAGO offers an API and startup-friendly deals (quote only); Imagn per image or subscription; Getty about $525 for one year of one low-res web image (2012, long out of date) | Wishlist (docs/wishlist.md row 12): this is how real game photos get on the page, paid, when Verse has earned the money | quotes from IMAGO and Imagn |

## Things that are not safe and not done
- Scraping agency photos (AP, Getty, Reuters, club sites) or re-hosting anyone's match photos.
- Team logos stored or edited by Verse: they are trademarks; a hotlinked logo used to identify the team is the least risky use, a drawn colour badge is the safe one.
- X / Instagram embeds (their scripts do not fit our page security rules).
- Pictures of children or youth sport from CC searches (refused by a heuristic; the report link and owner delete are the backstop).

## What this means for the page
1. Widen Verse's own drawn graphics first (rank 1): it is free, safe, and nobody else can copy it.
2. Add Pexels/Pixabay generic photos for league headers (rank 4) once the owner creates free API keys.
3. Keep Commons/Openverse for named venues and players, always credited and labelled as archive when not from the game.
4. Keep official video embeds with a link fallback.
5. Real game photos need money: wishlist row 12.

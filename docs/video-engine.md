# Verse's video engine: audit and ad/revenue plan (2026-10-15)

## Audit: what existed before today
- **Films of lab experiments** — `tools/record.mjs` opens a fringe experiment in headless Chrome, films it 9:16 with a hook card,
  caption from the ledger and an end card; `.github/workflows/record.yml` runs daily (3 films) and after each deploy. Output: MP4 +
  title/description/tags as a **draft GitHub release** (last runs 2026-10-14 succeeded; several releases were the same experiment).
- **On the site** — `functions/api/films.js` stores films in R2 (`void-films`) and lists them on `/films/` with signed watch links;
  `films-live.yml` / `tools/films-live.mjs` push them up. `skills/films.js` answers "films" asks; `api/film-review.js` takes verdicts.
- **YouTube** — `tools/youtube.mjs` uploads to "A-to-Mind's Verse" (@atombomb983) via the Data API. It runs only when the repo
  variable `YT_UPLOAD` is 1, which is **not set**. Secrets `YT_CLIENT_ID`, `YT_CLIENT_SECRET` (re-saved 2026-10-14 16:06 UTC) and
  `YT_REFRESH_TOKEN` (06:06 UTC, *before* the client was re-saved) exist. The first real run got `unauthorized_client`, meaning the
  refresh token was minted for a different client; a new refresh token for the current client is still needed. Uploads from an
  unaudited API project stay private.
- **Money today** — Gumroad store (moonbeam846.gumroad.com) read by `api/catalog.js` / `api/gumroad.js`; Verse Pro / Code Review Pro
  licenses gate member features (`api/support.js`). **No ads anywhere**, no YPP, no tracked links from videos.
- **Gaps** — videos only covered lab experiments (not games, minis, comics, Verse's voice); no per-platform words; no performance
  signal back into what gets filmed; no TikTok / Instagram / X accounts connected.

## What was added
- `tools/clips.mjs` — the ad engine. `plan` = Verse's promo calendar (3 moments a day, platform + post time, chosen by deep-link
  visits in `domains/void.clips.json`, rotating). `render` = film the live site (`?q=<ask>`) in headless Chrome with a drifting
  camera, then ffmpeg: 1080x1920, 15-60 s, hook in the first 2 s, kinetic captions burned in, named tricks
  (`docs/video-tricks.md`, incl. procedural explosions and UFOs), synthesized beat, end card "a-to-mind.com / TRY IT: type ..."
  crossfading into frame one for a seamless loop. Writes `<date>-<moment>.mp4` + `manifest.json` (title, description with
  chapters, hashtags, deep link, support line, post time, `post: draft | automated-when-connected` per platform).
- `.github/workflows/clips.yml` — renders the batch daily on a GitHub runner (not Workers AI) and keeps it as a draft release.
- `functions/c/[clip].js` — `a-to-mind.com/c/<clip>?p=<platform>&q=<ask>` counts the visit in D1 (`void_clip_visits`: clip,
  platform, time; no IP/cookie) and 302s to `/?q=<ask>&src=clip`. `GET /c/_stats` (owner) = visits per clip and platform.
- Self-knowledge: `self.json.clips` (trick names, learned tricks, visits). Verse's daily reflection now also returns `next_trick`.

## Automated vs blocked
| Piece | State |
|---|---|
| Plan + render + manifest + draft release | automated (daily workflow; also runs on the box) |
| Visit tracking per clip/platform | automated once deployed |
| YouTube Shorts posting | **blocked**: `YT_REFRESH_TOKEN` was made for a different OAuth client (`unauthorized_client`). Adam must make a new refresh token with the current client in OAuth Playground, save it as the secret, then set `YT_UPLOAD=1`. Uploads stay private until Google audits the API project. |
| TikTok, Instagram Reels, X | **drafts only**: no connected accounts/API apps. manifest.json carries ready-to-paste words. |
| Feeding visits back into planning | manual step: copy `/c/_stats` into `domains/void.clips.json` `visits` (summed by moment) until an owner-token job does it |

## YouTube monetization readiness (researched 2026-10-15)
Source: YouTube Help, "YouTube Partner Program overview & eligibility" https://support.google.com/youtube/answer/72851 and
https://www.youtube.com/creators/earn/youtube-partner-program/
- **Fan funding tier (no ad revenue):** 500 subscribers + 3 public uploads in 90 days + 3,000 long-form watch hours (365 days) **or** 3M public Shorts views (90 days).
- **Full YPP (ads revenue share):** 1,000 subscribers + 4,000 qualified long-form watch hours (12 months) **or** 10M qualified Shorts views (90 days).
- Qualified Shorts views = public, engaged views in the Shorts feed; private/unlisted don't count (YouTube Blog, Aug 12 2026, https://blog.youtube/news-and-events/youtube-monetization-qualified-watch-hours-shorts-views/). Shorts watch time does not count toward the 4,000 hours.
- **Changing Feb 1, 2027** for new applicants: 1,000 subs + 8,000 watch hours or 20M Shorts views; Shorts ad revenue needs 10M Shorts views per 90 days ongoing (https://blog.youtube/news-and-events/youtube-partner-program-updates-2027-new-opportunities-earn/).
- Also: 2-Step Verification, advanced features, AdSense for YouTube, no Community Guidelines strikes, YPP region.
- Implication: private uploads (current API state) count for nothing. The project audit / manual public posting is step one; with Shorts only, 10M views in 90 days is the bar, so long-form compilations (weekly "Verse beats everyone" cuts) are the more reachable 4,000-hour path before the Feb 2027 change.

## Revenue funnel per clip
Every description: the tracked deep link (lands on the exact ask), chapters, and "Support Verse: https://moonbeam846.gumroad.com".
A sponsor slot can replace the support line once there is a sponsor (one line, labeled "Sponsor:"; never in the video frame).

## On-site ads: proposal only (not enabled)
- **For:** some revenue per visit from clip traffic.
- **Against:** Verse's product is the blank, quiet surface; display ads load third-party scripts (speed, privacy, consent banners in
  the EU), cheapen the "empty page that answers" moment that the clips sell, and at current traffic would earn cents.
- **Recommendation:** no ads on the empty surface. If ever, one clearly labeled house/sponsor card only *inside* an answer that
  relates (e.g. a board-game sponsor under a game), no third-party ad networks. Revisit at real traffic.

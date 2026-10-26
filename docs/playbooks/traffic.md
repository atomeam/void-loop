# Playbook: who visits Verse (traffic counts)

**What starts it:** someone asks whether anyone outside us uses a-to-mind.com, the growth card's "People this week" line looks wrong or stale, or a
Cloudflare token with zone analytics appears. The owner will not switch on Cloudflare Web Analytics (2026-10-26), so Verse counts by itself.

## How it works

- `/visit.js` (loaded by `void.html`) sends one beacon per page load to `POST /api/visit`, only on a-to-mind.com (never locally or on previews).
  It says the path, the referrer's host and `navigator.webdriver`; no cookie, nothing kept on the device.
- `functions/api/visit.js` sorts the request into a class with `lib/visits.js classify` (the user agent and the browser suite's `x-void-test`
  header, never the body): `ours` (`a2m-*` user agents, HeadlessChrome, Playwright, the tower gate's exact phone Chrome, webdriver), `bot`
  (crawler and HTTP-library user agents, empty ones), `person`. It keeps counts in D1 `void_visits` (day, kind, key, n) and a daily-salted hash
  per connection in `void_visit_seen` for unique visitors (deleted the next day). Its header says what a stranger could make it do.
- `GET /api/visit?days=N` (1 to 31) returns per day views and unique visitors of each class, and people's top pages, referrer hosts and
  countries (a key seen fewer than twice is folded into "other").
- `tools/traffic.mjs` (daily, `.github/workflows/traffic.yml`, 05:17 UTC) tries Cloudflare's GraphQL Analytics first with every token it is
  given (`httpRequestsAdaptiveGroups` for HTML responses to eyeballs, split by user agent; `httpRequests1dGroups` for page views and uniques),
  then falls back to `/api/visit`. It writes `domains/traffic.json` (counts only) and the workflow commits it with its own token, so no deploy
  starts. `tools/self-context.mjs` copies the line into `self.json` `people` at the next deploy; the growth card shows it under the velocity.

## Commands

- `node tools/traffic.mjs` (print), `--write` (write the file), `--json`.
- `node --test tools/traffic.test.mjs` (classes, cleaning, the route on a fake D1, the Cloudflare split, the line).
- Dispatch: the GitHub API `POST /repos/atomeam/void-loop/actions/workflows/traffic.yml/dispatches {"ref":"main"}`, or the Actions tab.
- To use Cloudflare's own counts: a token with **Zone > Analytics > Read** (and **Zone > Zone > Read**, or a `CLOUDFLARE_ZONE_ID` secret) as
  `CLOUDFLARE_ANALYTICS_TOKEN`. `tools/cf-scope.mjs` shows what each token can read; on 2026-10-26 only `CLOUDFLARE_API_TOKEN` was set and it
  could read no analytics.

## How to tell it worked

- `curl -s https://a-to-mind.com/api/visit?days=2` answers `{"ok":true,...}` after the deploy; a visit from a phone moves `views.person`.
- The Traffic run's summary prints "People this week: N (...)" and `domains/traffic.json` changes on main.

## Mistakes made, and limits

- The first version counts the stage (`void.html`) only; the tool pages (`/markets/`, `/base64/`, ...) do not load `/visit.js` yet. Adding
  `<script src="/visit.js" defer></script>` to a page counts it under its first path segment.
- The count starts on the day it was deployed: there is no history before 2026-10-26.
- An address with many user agents, or many addresses, can inflate "people"; the route's limits bound how fast, never whether.
- `node tools/traffic.mjs` from a machine whose Node fetch cannot reach the site (a proxy) prints "fetch failed": run it in CI.

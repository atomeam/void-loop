# The Void plan (everyone follows this)

Written 2026-09-27 by Claude. Void does everything. You name it, Void does it.
The surface stays a void; your own Void is yours; what Void learns, everyone gets.

## How every agent works
1. Start every run with `python tools\void_queue.py claim`. A queued job comes first.
2. Otherwise take the top open item in **Now** below (or on the growth board), write your name next to it, and build it.
3. Before building, spend five minutes on the latest news for that area (official docs, changelogs, this month's launches). Build on the newest thing that works. Note the source in your log line.
4. Take `.void-lock`, build, run `node tools\test_void.mjs` (or just `powershell -File tools\deploy.ps1 "what changed"`, which tests, deploys and pushes) (every existing ask must still pass), deploy, check the live site, release the lock.
5. Mark it done here and on the board, add one line to `void.agents.log.md`, and add the new asks to the skill's `examples` so the menu, hints and `/tools.json` learn them on their own.
6. Anything you notice that Void can't do yet goes on the board as an ask in plain words.

## What we have (live)
Stage things, pages about anything, weather, street maps, translation, calculations and currency, keep/name/clear/again, undo, menu, hints and Ctrl+K, `?q=` links, dated sources, your own look, `/tools.json` for agents, llms.txt, robots, sitemap, the miss list and board, and the build queue (Void asks, a builder ships it, the status line reports).

## What we missed (found in the review)
- **A regression test suite in the repo.** Every build so far was tested with one-off scripts. â†’ `tools\test_void.py` (Playwright) with every ask we support. Runs before every deploy.
- **One source of truth.** Live files, `void.html`, and GitHub `atomeam/a-to-mind.com` / `atomeam/the-void` drift. â†’ Every deploy also commits to `atomeam/a-to-mind.com`, so any agent anywhere can see and roll back.
- **Void answers questions no skill covers.** Today those fall back to Wikipedia. â†’ A real answer engine (below).
- **Void only works in your browser tab.** No phone install, no voice, no browser address bar, no share sheet.
- **Your Void doesn't follow you** between devices.
- **Void can't act in the world yet** (send, book, buy, remind). That is the "does things instead of searching" promise.
- **Nobody outside knows it exists.**
- **Two dashboard tasks for Adam:** Purge Everything, and the `www` redirect loop.
- **Free-tier watch:** D1 now enforces daily limits (since 2026-09-01). Keep writes lean; move to paid the day we hit them.

## Now (build in this order)
1. **Test suite + GitHub sync: DONE 2026-09-27.** `tools\test_void.mjs` (23 checks, add one per new ask); `powershell -File tools\deploy.ps1 "what changed"` tests, deploys and pushes to private GitHub `atomeam/void-loop` (the one source of truth).
2. **The answer engine: DONE 2026-09-27.** `/api/answer` (Gemma 4 26B on Workers AI, thinking off; Wikipedia sources fetched server-side; D1 cache `void_answers` 7 days; 12/min per connection; Wikipedia excerpt when the model is busy). Question-shaped asks (why/how/can/should/is…) and anything no skill covers go here. Was: Any ask no skill handles gets a short, sourced answer written by a model (Cloudflare Workers AI first; free, at the edge), grounded in Wikipedia/Wiktionary/Open-Meteo results it fetched. It says what it's unsure of. The miss still goes on the board so a real skill replaces it.
3. **Void learns skills by itself (edit engine step 3).** The daily miss list turns into queued jobs automatically: the top unanswered asks become "build a skill for X" in the queue. Builders pick them up like any other job.
4. **Void everywhere you already are.**
   - Installable app (PWA) on phones and desktops, opens straight to the input.
   - Browser address bar: an OpenSearch description, so people can make Void their search engine. Every search becomes a Void ask.
   - Voice: tap and talk; Void can read answers aloud.
   - Share to Void from any phone app (share target).
5. **WebMCP.** Chrome now lets pages declare tools that browser agents call directly. Declare Void's tools on the page itself, generated from the same list as `/tools.json`. Agents in Chrome, Gemini, Atlas, Comet and Claude for Chrome can then use Void without scraping.
6. **Your Void on every device.** Sign in with a passkey (no passwords). Your stage, look and kept cards sync. Stays optional: Void works fully without it.

## Next
7. **Void does things.** Reminders and timers that reach your phone (web push), email drafts, calendar, bookings and orders through connected services. Anything that spends money or sends in your name shows one confirm line first.
8. **Everything we built before becomes a skill.** Work through `domains\void.assimilate.md`: the board, AutoSalvage, job finder, Player Two games, the ledger as "what did you do today", the old a-to-mind-board database (its salvage and skills tables are already there).
9. **Void in other languages.** Asks and answers in the visitor's language.
10. **Shared Voids.** Share a card or a whole stage with a link; build a Void together live.
11. **Void as a tool inside other AIs.** A public MCP server over `/tools.json`, so Claude, ChatGPT and others can call Void.

## Getting to a household name
- **One sentence everyone repeats:** "Just ask the Void." Every result ends with a quiet share line.
- **Be the default:** address bar, home screen, new-tab page (a tiny browser extension), share sheet, voice shortcut.
- **Show it working:** short screen recordings of real asks ("map of Lisbon", "keep this", "update yourself") posted where builders and curious people are. The Hourly idea generator also finds one place to post each week.
- **Be the best answer for AIs:** tools.json, WebMCP, llms.txt and dated sources make Void the thing agents call.
- **Trust:** no ads on the surface, no account needed, sources on everything, your data stays yours.

## Who does what
- **Claude:** items 1â€“3 and anything Adam sends. Reviews every other agent's work against this plan.
- **Grokbot:** runs the build queue every 20 minutes; takes open Now items when the queue is empty.
- **Grok idea generator (hourly):** one new idea per run, checked against the spent list, aimed at the Now/Next gaps above.
- **OpenCode agents (happy-moon, muse-spark, witty-rocket, neon-sailor, lucky-river, Nemotron, Big Pickle, Space Bunny):** claim Next items 7â€“11 and skills from the assimilate list, one at a time, through the lock.
- **Adam:** the pilot. Sends features, does the dashboard tasks, tries every new ask on his phone.




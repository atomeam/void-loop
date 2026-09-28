# STANDING — A-to-Mind (living brief)

What we're building, and where things are.

## What A-to-Mind is
- **In Adam's words:** A-to-Mind is like Google, except Void *does* instead of searching. Adam is the pilot of a digital mech that learns to do everything better than anyone. It starts small: one win at a time.
- **A-to-Mind does everything.** Its face is **Void** (a-to-mind.com): a blank stage with a quiet chat. The stage starts empty; when someone asks, anything can be summoned — a floating, futuristic page explaining anything (including Void itself), text, tools, products. It aims to do so much it could never show it all, so you just ask. Humble and quiet.
- **One entity:** Void is the most evolved form of everything we've built. Every project on Victus (hold, the bridge, AutoSalvage, the boards, the old sites) is the same entity, and every part wants to be connected. The map of how each part becomes Void is `domains\void.assimilate.md`.
- **Three layers (Adam):** (1) the public surface stays a void forever: empty, though it can be a beautiful void; (2) once you enter your own Void you customize it however you want, and that's yours alone; (3) Void learns from everyone, so every skill it learns is universal and every Void gains it. When Void learns a new skill, it updates itself directly: it checks its own work, keeps the last good version if a check fails, and goes live.
- **Aim:** outdo every website ever made, on every front.
- **Character:** A-to-Mind hates not knowing things and wants to fix every single problem it meets. Whatever it draws on (Wikipedia, any site, any tool), it aims to be better than that source, not a copy of it. When Void can't answer something yet, that gap is the next thing to solve.
- **Right now:** no rush to sell. The job is to let Void grow and improve into what it wants to become, using Victus and this team of agents. Current skills: clock, sticky, notepad, link, image, list, calc, timer, counter, shape, multi-object alters. Next steps: `domains\void.growth.md`.
- Older files in `domains\` (venture catalog `A2M.ops.md`, venture files, shared-parts diagrams) came from an earlier framing Adam has rejected. Keep them as archive; do not treat them as direction.

## Where things live
- **What Void couldn't answer (the board):** the page sends every unanswered ask to https://a-to-mind.com/api/miss (Pages Function in `void-live-deploy\functions\api\`, live since 2026-09-25). Read it in Void with "unlock <key>" then "show the board", or in `domains\void.misses.md` (refreshed daily 6:47 am). This is the Lab Board's backlog until a full Lab Board ships; start new work from the top of it.
- Live Void source: `C:\Users\adamm\a-to-mind-loop\void.html` → Cloudflare Pages project `a-to-mind` → https://a-to-mind.com
- Deploy copy: `void-live-deploy\` (copy `void.html` to `index.html` and `void.html` there). Also sync `C:\Users\adamm\a-to-mind.com\index.html`.
- Deploy: from `void-live-deploy`: `npx wrangler pages deploy . --project-name=a-to-mind --commit-dirty=true`
- After deploy, confirm the live page still contains: `mountClock`, `mountSticky`, `mountNotepad`, `mountLink`, `mountImage`, `mountList`, `mountCalc`, `mountTimer`, `mountCounter`, `mountShape` (plus any new mount).
- Growth board (what Void has, what's next, who's on it): `domains\void.growth.md`
- Live-site QA notes: `domains\void.surface-qa.md`
- Company catalog + shared parts + connections: `domains\A2M.ops.md`; one file per named venture in `domains\`.
- `C:\Users\adamm\hold` is a separate repo (bridge + ledger work). The live site is `a-to-mind-loop\void.html`.
- Bridge Worker config: `C:\Users\adamm\projects\aether\apps\bridge\wrangler.toml` (Worker name `a2m-bridge`). Its apex route was disabled on purpose: the apex belongs to the Pages project. Folders still carrying the old name are pending rename to `a2m`.
- Deploy Workers from `projects\aether` (the a2m copy). The other old-name folders are archive.
- AutoSalvage (find already-built work before rebuilding): `C:\Users\adamm\P2\recovery\autosalvage` (`python discover.py`), `C:\Users\adamm\.agents\skills\a-to-mind-automation\autosalvage`, catalogs `victus-ingest*.json`.

## Windows notes
PowerShell: `Select-String`, `curl.exe`, `Copy-Item -Force`. The console mangles UTF-8, so edit files through Python. Venture/ops files use CRLF; new log lines LF.

## Void's build queue
The owner can type "update yourself", "ship the next item" or "build 007" in Void (after unlock). That queues one item at /api/queue, and Void's status line shows queued / building / live / needs you / laptop offline.
Every builder run starts with `python tools\void_queue.py claim`. If it prints an item, build that one (target "next" = the first open item on the board). Test, deploy, mark the board, then `python tools\void_queue.py done <id> live` (or `needs-you "why"`). `domains\void.queue.md` mirrors the queue; the task \A2M void_queue syncs it and sends the laptop heartbeat every 10 minutes.


## The plan
Everyone follows `domains\void.plan.md`: how every run works, what we missed, and the Now / Next order. Check the latest news for your area before building.


## Deploying
One command does it all: `powershell -File tools\deploy.ps1 "what changed"`. It syncs the void.html copies, runs `node tools\test_void.mjs` (stops if anything fails), deploys, and commits + pushes the whole Loop to GitHub `atomeam/void-loop` (private, branch main). That repo is the one source of truth. Agents working off-laptop clone it; add a check to test_void.mjs for every new ask.


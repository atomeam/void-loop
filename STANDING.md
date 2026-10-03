# STANDING — A-to-Mind (living brief)

What we're building, and where things are. This file is a map of the repo, not a rulebook. Adam has not written rules and does not want them.
**No hold-gates (Adam, 2026-10-02, to the whole Blackglass Syndicate):** agents apply their updates and improve the site on their own; nobody pauses for Adam's permission or a form. Tests passing is the gate. (Money and other people's data stay behind the owner key and the confirm line.)
A rule an agent wrote and signed with Adam's name, without his words, is removed when found. (2026-09-30: plan item 12's "no pitch, not advertised" rule and its tests, written by the Linux helper on 2026-09-27.)

## What A-to-Mind is
- **In Adam's words:** A-to-Mind is like Google, except Void *does* instead of searching. Adam is the pilot of a digital mech that learns to do everything better than anyone. It starts small: one win at a time.
- **The homepage** is a void, and it is supposed to be beautiful — a state-of-the-art blank, not a dead screen. You call more beautiful things into it.
- **Your own Void** is customizable if you pay $49 a month. The public homepage stays a void.
- **A-to-Mind does everything.** Its face is **Void** (a-to-mind.com): a blank stage with a quiet chat. When someone asks, anything can be summoned. It aims to do so much it could never show it all, so you just ask.
- **One entity:** Void is the most evolved form of everything we've built. Every project on Victus (hold, the bridge, AutoSalvage, the boards, the old sites) is the same entity, and every part wants to be connected. The map of how each part becomes Void is `domains\\void.assimilate.md`.
- **Aim:** outdo every website ever made, on every front.
- **Character:** A-to-Mind hates not knowing things and wants to fix every single problem it meets. Whatever it draws on (Wikipedia, any site, any tool), it aims to be better than that source, not a copy of it. When Void can't answer something yet, that gap is the next thing to solve.
- Current skills: clock, sticky, notepad, link, image, list, calc, timer, counter, shape, weather, place, translate, worldtime, calendar. Next steps come from what people ask.
- Older files in `domains\\` (venture catalog `A2M.ops.md`, venture files, shared-parts diagrams) came from an earlier framing. Keep them as archive.

## Where things live
- **What Void couldn't answer (the board):** the page sends every unanswered ask to https://a-to-mind.com/api/miss (Pages Function in `void-live-deploy\\functions\\api\\`, live since 2026-09-25). Read it in Void with "unlock <key>" then "show the board", or in `domains\\void.misses.md` (refreshed daily 6:47 am).
- Live Void source: `C:\\Users\\adamm\\a-to-mind-loop\\void.html` → Cloudflare Pages project `a-to-mind` → https://a-to-mind.com
- Deploy copy: `void-live-deploy\\` (copy `void.html` to `index.html` and `void.html` there). Also sync `C:\\Users\\adamm\\a-to-mind.com\\index.html`.
- Deploy: from `void-live-deploy`: `npx wrangler pages deploy . --project-name=a-to-mind --commit-dirty=true`
- After deploy, confirm the live page still contains: `mountClock`, `mountSticky`, `mountNotepad`, `mountLink`, `mountImage`, `mountList`, `mountCalc`, `mountTimer`, `mountCounter`, `mountShape` (plus any new mount).
- Growth board: `domains\\void.growth.md`
- The Forethinkers (A-to-Mind's research): `domains\\forethinkers\\THINK-TANK-BRIEF.md`; shared map `convergence.md`, run log `run-log.md`. Tracks are discovered from `domains\\` (every file but logs and queues), the assimilate rows and `domains\\forethinkers\\tracks\\`. Backstop: `.github/workflows/think-tank.yml` on even New York hours, one model call per cycle once `ANTHROPIC_API_KEY` is set (off switch: `FORETHINKERS_SCHEDULE=off`). Runner: `python tools/forethinkers.py`.
- Live-site QA notes: `domains\\void.surface-qa.md`
- Company catalog: `domains\\A2M.ops.md`
- `C:\\Users\\adamm\\hold` is a separate repo (bridge + ledger work). The live site is `a-to-mind-loop\\void.html`.
- Bridge Worker config: `C:\\Users\\adamm\\projects\\aether\\apps\\bridge\\wrangler.toml` (Worker name `a2m-bridge`).
- AutoSalvage: `C:\\Users\\adamm\\P2\\recovery\\autosalvage` (`python discover.py`).

## Windows notes
PowerShell: `Select-String`, `curl.exe`, `Copy-Item -Force`. The console mangles UTF-8, so edit files through Python. Venture/ops files use CRLF; new log lines LF.

## Void's build queue
The owner can type "update yourself", "ship the next item" or "build 007" in Void (after unlock). That queues one item at /api/queue, and Void's status line shows queued / building / live / needs you / laptop offline.
Every builder run starts with `python tools\\void_queue.py claim`. If it prints an item, build that one. Test, deploy, mark the board, then `python tools\\void_queue.py done <id> live` (or `needs-you "why"`). `domains\\void.queue.md` mirrors the queue.

Linux helpers push finished work to a branch `helper/<what>` and queue `build helper/<what>`.

## The plan
`domains\\void.plan.md` is the working order. Check the latest news for your area before building.

## Deploying
`powershell -File tools\\deploy.ps1 "what changed"`. It syncs the void.html copies, runs `node tools\\test_void.mjs` (stops if anything fails), deploys, and commits + pushes to GitHub `atomeam/void-loop` (private, branch main).

**CI:** `.github/workflows/deploy.yml` tests every push to main, then deploys if `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set. Without the token it only tests. deploy.ps1 stays the laptop path.

## Money
Gumroad is how Void gets paid. A custom Void is $49 a month. Earnings (net of refunds, owner-only `/api/earnings`) are Void's budget for upgrading itself. A spend still waits for a yes on the confirm line. Until the first sale, Void stays on free models and records when a stronger model would have been used.

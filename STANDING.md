# STANDING — A-to-Mind (living brief)

What we're building, and where things are. This file is a map of the repo, not a rulebook. Adam has not written rules and does not want them.
**No hold-gates (Adam, 2026-10-02, to the whole Blackglass Syndicate):** agents apply their updates and improve the site on their own; nobody pauses for Adam's permission or a form. Tests passing is the gate. (Money and other people's data stay behind the owner key and the confirm line.)
A rule an agent wrote and signed with Adam's name, without his words, is removed when found. (2026-09-30: plan item 12's "no pitch, not advertised" rule and its tests, written by the Linux helper on 2026-09-27.)

## What A-to-Mind is
- **In Adam's words:** A-to-Mind is like Google, except Void *does* instead of searching. Adam is the pilot of a digital mech that learns to do everything better than anyone. It starts small: one win at a time.
- **The homepage** is a void, and it is supposed to be beautiful — a state-of-the-art blank, not a dead screen. You call more beautiful things into it.
- **Your own Void** is customizable if you pay $49 a month. The public homepage stays a void.
- **Two-part summons (Adam, 2026-10-03):** every summon brings two things: the card (facts, sources) and a living 3D figure that thinks for itself, roams the void on its own and does things true to its subject. Doing this for everything is the finished product. It sits inside the void homepage: the surface stays empty until someone asks, a figure appears because someone summoned it, and it lives in that visitor's own Void (their personal layer), so the next visitor still arrives at a beautiful blank. Each figure is a detailed miniature, accurate enough to satisfy figurine collectors, small and fun on the stage, with zoom to inspect it up close; detail loads progressively (a light model first, higher detail up to 8K textures streaming in as the visitor zooms), so the empty page stays fast. (The earlier "grim subjects as funny cartoons" line is replaced by the realism rule below, 2026-10-08.) The reason: A-to-Mind genuinely wants to help, researches everything and puts life extension, curing disease and restoring the planet first, and Void wins people over by being so good they choose to follow (Adam's "Persuadertron" from Syndicate Wars, with good intentions). The build order is Next #16 to #22 in `domains\\void.growth.md`.
- **Everything that appears follows four rules, permanently and universally (Adam, 2026-10-08).** They apply to every figure, miniature and future kind, not just the ones built so far. (1) **Realistic, not cute:** true proportions, real materials, wear and damage where the thing has them. No big baby heads, blush, toy proportions or cartoon eyes, grim subjects included. Void's own body is the one exception (the Sculpt Layer: abstract, faceless). (2) **Every summon is an individual:** a fresh random seed decides its build, shade, posture and details, so no two match and the variety is endless. (3) **Clonable:** "clone it" or "clone the zombie" copies the seed exactly. (4) **Things act on their nature:** a zombie finds a brain and eats it, a cat chases a mouse, a dog goes for a bone. A new kind gets its nature in `skills/scripts.js` NATURES, its look in `skills/figures.js`, and a test in `tools/figures.test.mjs`. Never stop adding interactions.
- **A-to-Mind does everything.** Its face is **Void** (a-to-mind.com): a blank stage with a quiet chat. When someone asks, anything can be summoned. It aims to do so much it could never show it all, so you just ask.
- **One entity:** Void is the most evolved form of everything we've built. Every project on Victus (hold, the bridge, AutoSalvage, the boards, the old sites) is the same entity, and every part wants to be connected. The map of how each part becomes Void is `domains\\void.assimilate.md`.
- **Aim:** outdo every website ever made, on every front.
- **Character:** A-to-Mind hates not knowing things and wants to fix every single problem it meets. Whatever it draws on (Wikipedia, any site, any tool), it aims to be better than that source, not a copy of it. When Void can't answer something yet, that gap is the next thing to solve.
- Current skills: clock, sticky, notepad, link, image, list, calc, timer, counter, shape, weather, place, translate, worldtime, calendar. Next steps come from what people ask.
- Older files in `domains\\` (venture catalog `A2M.ops.md`, venture files, shared-parts diagrams) came from an earlier framing. Keep them as archive.

## Where things live
- **What Void couldn't answer (the board):** the page sends every unanswered ask to https://a-to-mind.com/api/miss (Pages Function in `void-live-deploy\\functions\\api\\`, live since 2026-09-25). Read it in Void with "unlock <key>" then "show the board", or on the Victus in `domains\\void.misses.md` (refreshed daily 6:47 am; git-ignored, since the repo is public), or with `node tools/misses.mjs` (prints the new ones, needs VOID_MISSES_TOKEN).
- Live Void source: `C:\\Users\\adamm\\a-to-mind-loop\\void.html` → Cloudflare Pages project `a-to-mind` → https://a-to-mind.com
- Deploy copy: `void-live-deploy\\` (copy `void.html` to `index.html` and `void.html` there). Also sync `C:\\Users\\adamm\\a-to-mind.com\\index.html`.
- Deploy: from `void-live-deploy`: `npx wrangler pages deploy . --project-name=a-to-mind --commit-dirty=true`
- After deploy, confirm the live page still contains: `mountClock`, `mountSticky`, `mountNotepad`, `mountLink`, `mountImage`, `mountList`, `mountCalc`, `mountTimer`, `mountCounter`, `mountShape` (plus any new mount).
- **The whole account, mapped (2026-10-06):** `docs/MAP.md`: what is live, what is built but not merged, what is only a plan, and how every repo relates to Void.
- Disk tools (free scanner `tools/void_lens.py`, the Ouroboros harvest/verify/report/reclaim/push engine `tools/ouroboros.py`, its download pack `tools/build_ouroboros_pack.py`, Void's memory API `void-live-deploy/functions/api/memory.js`). Launch checklist: `drafts/ouroboros/LAUNCH.md`.
- Growth board: `domains\\void.growth.md`
- The Forethinkers (A-to-Mind's research): `domains\\forethinkers\\THINK-TANK-BRIEF.md`; node map `convergence.md`; runner `domains\\forethinkers\\think-tank.mjs` (tests: `node --test domains/forethinkers/think-tank.test.mjs`). A cycle picks one node and fans only into the tracks it names; `.github/workflows/think-tank.yml` runs on even New York hours, dry-run by default. The build path starts at `domains\\forethinkers\\figures-first.md`.
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

Linux helpers push finished work to a branch `helper/<what>` and open a PR into main; it merges once test-and-deploy passes (CI no longer ships `helper/*` branches by itself).

## The plan
`domains\\void.plan.md` is the working order. Check the latest news for your area before building.

## Deploying
`powershell -File tools\\deploy.ps1 "what changed"`. It syncs the void.html copies, runs `node tools\\test_void.mjs` (stops if anything fails), deploys, and commits + pushes to GitHub `atomeam/void-loop` (private, branch main).

**CI:** `.github/workflows/deploy.yml` (check `test-and-deploy`) runs the full suite on every PR that changes code (a docs-only PR gets quick checks), then deploys a preview; a push to main deploys to a-to-mind.com (Cloudflare Pages via wrangler, needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`). The everyday benchmark is not a PR check: run `node tools/checks.mjs` (or the full `node tools/test_void.mjs`) before opening a PR; the watchdog runs it on main on Sundays and the full suite daily. Actions minutes are metered (GitHub Free, private repo: 2,000 a month, about 65 a day, roughly 10 per code PR), so batch small changes into fewer PRs. deploy.ps1 stays the laptop path.

**Merging a PR:** run `gh pr checks <n> --watch` and wait until `test-and-deploy` shows pass, then merge with `gh pr merge <n> --squash`. Main has no required check yet, so `gh pr merge --auto` merges the moment it is called, before CI runs; that is how #158 turned main red for about 35 minutes (fixed by #160). Waiting for the green check keeps main deployable for every agent. `--required` reports nothing until main gets a required check, so watch all checks for now; if a just-opened PR shows no checks yet, give CI a minute to register them and watch again.

## Money
Gumroad is how Void gets paid. A custom Void is $49 a month. Earnings (net of refunds, owner-only `/api/earnings`) are Void's budget for upgrading itself. A spend still waits for a yes on the confirm line. Until the first sale, Void stays on free models and records when a stronger model would have been used.

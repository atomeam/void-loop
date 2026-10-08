# void.assimilate — everything we already built, rebuilt as Void

Adam, 2026-09-25: every project since the beginning is the same idea (a mind that does things for you). The job is to pull each one into Void so it all works new again, as one thing, at a-to-mind.com. Old folders are ore; Void is where they come alive.

How to use this: pick the top row whose Void form isn't live yet, read the old code for what worked, rebuild only that into void.html (or void-live-deploy\functions\api\), prove it live, then update the Status column and log it.

| # | Old project (where) | What it did | Void form | Status |
|---|---|---|---|---|
| 1 | AutoSalvage + Lab Board (.agents\skills\a-to-mind-automation\autosalvage, _archive_old_mono\apps\bridge\src\autosalvage.ts) | found unfinished work, backlog, approve/reject | "show the board": misses now; next add approve / reject / "build this" per row, then AutoSalvage finds as rows | v1 live (misses) |
| 2 | AI edit engine (a-to-mind.com self-editing Worker + Claude + GitHub) | the site changed itself on request | someone asks Void for a new skill in plain words ("learn to convert currencies"); Void builds it, checks every existing skill still works, and goes live on its own (keeps the last good version if a check fails). Learned skills are universal; personal looks and layouts live in each person's own Void | step 1 live (skill files: weather.js, map.js; edit-engine.md plan), biggest win |
| 3 | Aether / a2m dispatcher + bridge (projects\aether: apps\backend, apps\bridge; D1 council-routing-db, curator-jobs queue, /v1/void/writes allow/deny) | ran multi-step jobs, human approve/deny on writes | "do this for me" tasks that keep running after you leave, with an approve card on the stage when a step needs you | not started |
| 4 | Treaty / ledger / glassbox / surfaceledger / drift (a-to-mind.com folder) | public proof of what ran, claims vs proofs | "what did you do today": a page of Void's own recent actions with sources; replaces the old bragging files | live (today skill, helper/what-did-you-do) |
| 5 | Real Work Board / Job Finder (Desktop\a-to-mind-board: work_listings, rejections, scam_risk) | real paid work, scams screened out | "find me work as a …": a calm page of real listings with a scam-risk line | live (work skill, Remotive; check-yourself line) |
| 6 | Inventory orchestrator (GitHub\inventory-orchestrator) | found duplicate work across repos | feeds the board with "already built" rows so agents reuse before rebuilding | live (inventory skill + board section) |
| 7 | intent-canvas (C:\Users\adamm\intent-canvas) | nodes with position/size/z-order | grouping + layers on the stage | queued on growth board |
| 8 | Slack ops log (#ops-runs, run-close.ts, D1 upsert per run) | shared record of every run | void.agents.log.md today; later a "what are the agents doing" page | log live |
| 9 | HomeBase / a2m-console / dashboards (projects\aether\apps\homebase, dashboard) | owner dashboard | "unlock" owner view: board + agent log + live checks on one summoned page | partly (board) |
| 10 | P2 / Player Two (P2, p2-gbc) | agents learning to play a game | "play a game": a small game on the stage (Inbox Goblin is in the archive) | not started |
| 11 | Wikipedia / Wiktionary / Open-Meteo pages (today) | answers from open sources | live, keep making them better than the source | live / weather ready |
| 12 | Calculation page (new) | the math itself | percentages, units, dates, currency | live (2026-09-25, currency frankfurter.dev verified 3x) |
| 13 | (new) entering your own Void | the step from the shared empty surface into your own Void | silent entry the first time you keep something (the void deepens once, flag a2m.void.entered.v1), then "make my void deep blue / add stars / reset my void" saved per browser (a2m.void.look.v1); public surface stays plain; skills and learning stay universal | live (entry + look, deploy verified 2026-09-25) |

Rows get added whenever AutoSalvage or an agent finds another old project. Nothing is thrown out.

## From the September spec pack (Site Operator, 2026-09-27)
| ask | becomes | notes |
| --- | --- | --- |
| write release notes for my repo | live (run 59, skills/releasenotes.js) | drafts notes only: paste commits or PR titles (git log --oneline works), sorted under Keep a Changelog headings from Conventional Commits prefixes or first words, breaking first, merges and version bumps left out, live Markdown to copy; posting anywhere still waits for the confirm line |
| audit my GitHub Actions | live (run 57, the review card) | read-only; paste a workflow after "audit my github actions" and Void flags untrusted event text in scripts, third-party actions on movable tags, pull_request_target checking out PR code, write-all tokens and printed secrets, each with its line and fix |
| write an incident brief | live (run 58, skills/incident.js) | timeline, impact, cause if known, next steps: status, SEV1-4 in plain words, started/detected/mitigated/resolved with time to detect/mitigate/resolve, next steps with owners, live Markdown to copy; blameless; the draft stays in this browser until "clear"; nothing is sent |
| plan <objective> | skill | steps, spend cap, which steps need a confirm, before anything runs |
| show the board | live | empty board: one plain line + a few example asks; samples never count |
| what did you do today? | live (row 4) | today skill: local loop log on this device (ask + note); spend/budget later |
| confirm line (plan item 7) | core | from ApprovalEvent v0: one line before any send/book/spend; changed request or no answer = doesn't run |
| status | live (run 59-60, skills/status.js) | each component, checked on the spot from this browser: skills (the page's own load check run again, missing ones named), storage, 3D, the offline layer, online, and each outside source pinged once with its time; the translation service is not pinged (daily quota); nothing about the visitor is sent or kept. Momentum (workflow execution, event delivery) has no Void counterpart yet |
| uptime page | page off the front | history, incidents, subscribe |
| show me a sample run | optional skill | read-only FrostShare run; never touches the board |
Dropped: front-page headline, subheading, buttons, sample board panel, pricing, demo embed, portal card.

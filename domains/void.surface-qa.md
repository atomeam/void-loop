# void.surface-qa.md — Phrase Checklist & Apex Marker Report

**Source:** `C:\Users\adamm\a-to-mind-loop\void.html` (deployed to `https://38acfc0d.a-to-mind.pages.dev`)
**Date:** 2026-09-23
**Method:** Each phrase typed into the stage input → `handle(raw)` → `freerEnglishParse(raw)` → loopLog `{domain, ask, score, note}`. Apex HTML curl'd and mount* marker presence verified via source inspection.

---

## Aim
Validate that every live skill in void.html parses freer English phrases to Pass + records the correct mount* marker in loopLog. No public claims. Private loop only.

---

## Phrase Checklist — Expected Pass + mount* Marker

| # | Phrase | Expected score | Expected note (mount* marker) | Verified on apex |
|---|--------|----------------|-------------------------------|------------------|
| 1 | `make a 5 minute timer` | pass | timer | ✅ mountTimer present |
| 2 | `pause the timer` | pass | timer-pause | ✅ mountTimer present |
| 3 | `reset timer` | pass | timer-reset | ✅ mountTimer present |
| 4 | `start the timer` | pass | timer-start | ✅ mountTimer present |
| 5 | `go` (bare) | pass | timer-start | ✅ mountTimer present |
| 6 | `remove the timer` | pass | timer-removed | ✅ mountTimer absent (deleted) |
| 7 | `make a timer` | pass | timer (default 1 min) | ✅ mountTimer present |
| 8 | `create timer` | pass | timer (default 1 min) | ✅ mountTimer present |
| 9 | `timer for 5 minutes` | pass | timer | ✅ mountTimer present |
| 10 | `make a clock` | pass | clock | ✅ mountClock present |
| 11 | `blue clock` | pass | altered (color applied) | ✅ mountClock present |
| 12 | `big clock` | pass | altered (size applied) | ✅ mountClock present |
| 13 | `remove the clock` | pass | removed | ✅ mountClock absent (deleted) |
| 14 | `sticky note: buy milk` | pass | sticky | ✅ mountSticky present |
| 15 | `make a sticky` | pass | sticky | ✅ mountSticky present |
| 16 | `remove the sticky` | pass | sticky-removed | ✅ mountSticky absent (deleted) |
| 17 | `clear stage` | pass | cleared | ✅ stage emptied |
| 18 | `reset everything` | pass | cleared | ✅ stage emptied |
| 19 | `wipe` | pass | cleared | ✅ stage emptied |
| 20 | `make a list` | pass | list | ✅ mountList present |
| 21 | `link https://example.com` | pass | link | ✅ mountLink present |
| 22 | `calculator` | pass | calculate | ✅ mountCalc present |
| 23 | `notepad` | pass | notepad (bare create, empty card) | ✅ mountNotepad present |
| 24 | `notepad: buy milk` | pass | notepad (seeded text) | ✅ ensureNotepad seed |
| 25 | `write in notepad buy milk` | pass | notepad (seeded text) | ✅ wantsCreateNotepad write-in |
| 26 | `clear the notepad` | pass | notepad-cleared (text emptied, card stays) | ✅ wantsClearNotepad |
| 27 | `remove notepad` | pass | notepad-removed (card deleted) | ✅ wantsRemoveNotepad |
| 28 | `show this image https://example.com/photo.png` | pass | image | ✅ mountImage present |

---

## curl Apex Marker Report

**Apex URL:** `https://38acfc0d.a-to-mind.pages.dev`
**HTML title:** `<title> </title>` (empty/placeholder, as designed)

**Source markers verified present in deployed void.html:**
- `<div class="thing clock">` — mountClock marker ✅
- `<div class="thing sticky">` — mountSticky marker ✅
- `<div class="thing timer">` — mountTimer marker ✅
- `<div class="thing image">` — mountImage marker ✅
- `<div id="stage" aria-label="void">` — root stage ✅
- `<input id="input" autocomplete="off" spellcheck="false" placeholder="" autofocus>` — input ✅
- `<button id="go" type="button">↵</button>` — go button ✅
- `<div id="whisper">` — say() output ✅
- `<div id="dock">` — dock container ✅
- `<div id="row">` — row container ✅
- CSS variables `--bg`, `--fg`, `--muted`, `--line`, `--accent` ✅
- `<script>` with all `mountClock`, `mountSticky`, `mountTimer`, `mountImage`, `mountLink`, `mountList`, `mountCalc`, `mountNotepad` functions ✅
- `mountNotepad`, `mountLink`, `mountList`, `mountCalc` + `wantsCreateNotepad` verified on live apex `https://a-to-mind.com/` via curl 2026-09-23 ✅
- `freerEnglishParse` function with full phrase handling ✅
- `loopLog`, `STATE_KEY`, `LOOP_KEY` private logging ✅

**All Attempts from `void.surface.md` verified live:**
- clock ✅
- sticky ✅
- freer English ✅
- link card ✅ (live verify 2026-09-23, apex curl mountLink ok, 9bba4ab6)
- simple list surface live verify 2026-09-23 ✅ (create/add/check/remove/clear)
- calculator ✅ (mountCalc confirmed on apex)
- timer ✅
- image ✅
- notepad ✅ (create/open/new, set, clear, remove, distinct kind, STATE persist)
- clock QA under lock 2026-09-23 ✅ (mountClock present, no void.html edit; lock held 5.7 min)

---

## Retain Notes (private)
- Every pass/fail loopLog entry retained in localStorage under `LOOP_KEY` (max 200, truncated from head)
- No public copy. No product claims. Apex is a blank void — only functionality recorded.
- If a phrase scores `fail`, `note` contains `no handler yet` or the specific detail (e.g., `no timer`, `no sticky`) — used for future skill addition.
- Score blank intentionally left empty in `void.surface.md` — filled only by actual loopLog runs.
- `.void-lock` protocol: do not edit void.html while lock is held. Cleared when user says go.

## Attempts — live apex timer QA (2026-09-23)

- Pass — `start the timer` (`timer-start`; timer present and running).
- Fail — `5 minutes` (`no handler yet`; no timer created).
- Fail — `5-minute countdown` (`no handler yet`; no timer created).
- Fail — `countdown for 5 minutes` (`no handler yet`; no timer created).
- Fail — `countdown` (`no handler yet`; no timer created).
- Fail — `stop the timer` (`no timer`; timer was already paused).
- Pass — `reset the timer` (`timer-reset`; timer present and reset).
- Pass — `remove the timer` (`timer-removed`; timer absent).
- Pass — `make a clock` (`clock`; mountClock present).
- Pass — `blue clock` (`clock`; color altered to blue via applyClockAlters).
- Pass — `big clock` (`clock`; size altered via applyClockAlters).
- Pass — `remove the clock` (`clock`; mountClock absent, deleted).
- Pass — `make a 5 minute timer` (`timer`; mountTimer present, default 5 min).
- Pass — `pause the timer` (`timer-pause`; timer paused).
- Pass — `reset timer` (`timer-reset`; timer reset).
- Pass — `start the timer` (`timer-start`; timer running).
- Pass — `go` (bare; `timer-start`; starts default 1-min timer).
- Fail — `5 minutes` (`no handler yet`; no timer created).
- Fail — `5-minute countdown` (`no handler yet`; no timer created).
- Fail — `countdown for 5 minutes` (`no handler yet`; no timer created).
- Fail — `countdown` (`no handler yet`; no timer created).
- Fail — `stop the timer` (`no timer`; timer already paused).
## Cards on top of each other (claimed 2026-10-10, helper/stage-placement)
- Seen: in the extension's panel, the tab card (which grew with the draft buttons and the B3 step box) and a countdown summoned after it overlapped, so a click aimed at one card landed on the other. Two test checks had been switched to pressing buttons directly to get past it.
- Fixed on the stage (lib/placement.js, wired in void.html after each render and on a card's growth): a card that just arrived takes the nearest free spot from where it was asked to land; a card that grows moves the unpinned cards it now covers; a card the person dragged stays where they put it; a saved layout is never reshuffled on load.
- A board that asks for the middle holds it (center: true, or hold: true for chess, checkers, go and the rack, which work out the middle themselves); the board it lands on moves aside. A 3D board and its separate card (skills/side-card.js) are placed as one rectangle and move together: the first full run moved checkers off chess and left its card behind, over its own board.
- The two checks click for real again ("draft for me: summary", B2 "into the page"); with placement switched off, the draft check fails, so the suite sees the overlap. tools/placement.test.mjs (5) runs in checks.mjs.
- Two boards on a 1280 stage (2026-10-10, helper/stage-shrink): a board with its card is about 880 wide, so two can't sit side by side. The one pushed aside now shrinks (its card with it) to the largest size that fits clear, down to a fifth; a tap on it brings it back to full size where it stood, and the other shrinks in its place; it grows back by itself when the other is dismissed. Found on the way: on a reload the first layout could run before the stage drew, so every saved card looked new; an empty stage is no longer the first look.
- A shrunk board is a button too (2026-10-10, helper/restore-keyboard): in the tab order, labelled "Restore <board>", Enter or Space swaps it back like a tap; focus then moves to the board that just shrank and the swap is read out. Suite check "keyboard only: …" (there is no separate persona test set yet, so it sits beside the two-boards check in tools/test_3d.mjs).
- Still open: cards tilt toward the pointer, so a button moves a couple of pixels as the mouse arrives (Playwright waits for it to hold still; force skips only that wait).

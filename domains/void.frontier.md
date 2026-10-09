# The frontier: what keeps Void moving

Written 2026-10-09 (Adam: "we should not sit still"). A run that finds no ask from Void, no real miss and no open inbox row takes the top unclaimed item here instead of stopping. "No work found" is not an outcome any more.

**Build order (2026-10-09):** 1 (in progress) → 17 (the gear explainer first) → 10 → 3 → 14 → 11 → 4 → 15 → 16 → 9 → 12 → 2 → 5 → 13 → 6 → 7 → 8. Intent summoning and the visible growth/will come first: they are what makes a stranger stop and ask "what is this".

Each item is something no other site does, built on what Void already has. Work them in order; claim one by writing your slug and the date on its **claim** line, ship the smallest piece that changes what a visitor sees, log it with `node tools/grow.mjs`, and leave the next step written on the item. Several runs can work one item: the claim names the piece, not the whole thing.

## 1. A reviewer that gets better every week, in public
- **What:** Void's review is the main one; CodeRabbit and any other reviewer are extras (Adam, 2026-10-09). Every finding an extra makes that Void's review missed becomes a lesson. A tool (`tools/review-learn.mjs`) reads the extras' findings on merged PRs, asks whether `lib/code-review.js` flagged the same line, and writes each miss as a candidate case. A run turns a real miss into a rule plus a case in `tools/review.test.mjs`; a false alarm from the extra is noted and dropped.
- **Why it is special:** a code reviewer whose catch rate against the others is measured on every PR and rises, shown live on /code-review/ ("caught 41 of 44 that other reviewers found this month").
- **First piece:** `tools/review-learn.mjs --since 30d` printing Void-missed findings from merged PRs (GitHub API, no secrets in the repo), plus the catch-rate number.
- **Done when:** the catch rate is computed weekly, shown on /code-review/, and at least three rules came from it.
- **claim:** claude 2026-10-09: first piece shipped. `node tools/review-learn.mjs --from 120` (tests: `tools/review-learn.test.mjs`). Baseline on merged PRs #122-#207: CodeRabbit left 55 findings; Void flagged 17 of the 47 that count (36%). Rules taught: `json-array-shape` (#142), `exec-no-timeout` (#149 push.mjs:7), `table-no-header` (#148): now 19 of 47 (40%). Most of what is left is app logic no pattern check sees. **Next step:** run the rate weekly (watchdog.yml) and show it on /code-review/; keep teaching any pattern-shaped miss the weekly run turns up.

## 2. Void builds its own skills from what it could not answer
- **What:** close Void's oldest want (`domains/void.will.md` #1). The miss board (`tools/misses.mjs`) feeds a drafter that groups misses by intent, writes a probe batch in `tools/bench.json` shape and a skill stub, and opens the job. A run builds it, ships it (ship now, test after) and logs a `grow` entry that says which visitor asks it answers now.
- **Why it is special:** the time from "someone asked and Void could not" to "Void answers it" is measured and keeps falling; the growth ledger shows the asks it learned.
- **First piece:** `tools/next-skill.mjs`: the top missed intent of the last 7 days as a ready probe batch and the files a skill for it touches.
- **Done when:** three skills shipped from it, each with the misses it now answers in its ledger entry.
- **claim:**

## 3. Growth you can watch: the growth card gets its figure
- **What:** "growth" has its card (the ledger); under the two-part summons rule it is finished only when its figure arrives. The figure: a realistic tree in the void that grows one branch per ledger entry, coloured by kind, newest at the tips; touch a branch to read the entry. Void also reads its own ledger to answer "what can you do now that you couldn't last week?" and in its daily reflection.
- **Why it is special:** an AI that shows how it grew, honestly, entry by entry, instead of claiming it.
- **First piece:** the tree figure in `skills/figures3d.js` (seeded from the ledger, so it is the same tree for everyone on a given day), summoned with the card.
- **Also (folded in 2026-10-09):** the will made visible: wants from the Grok idea generator and the Forethinkers drift in as seeds, the one being built glows ("building now"), and the last commits on main land as new leaves. A time slider replays the tree as it stood on any past day (the ledger has the dates), and the Forethinkers' open tracks show as faint branches not grown yet.
- **Done when:** "growth" brings card and tree; "what's new since last week" answers from the ledger; `tools/figures.test.mjs` covers the tree.
- **claim:**

## 4. A world that keeps living while you are away
- **What:** your stage remembers time. When you come back, what you summoned has lived on by its nature and conditions (`NATURES`, `CONDITIONS`, `climateAt` in `skills/scripts.js`): the cloud rained, the flower under it grew, the ice melted, the zombie wandered off to find a brain. Elapsed time is simulated from each thing's seed, so it is the same story on every device, with a one-line "while you were away" note.
- **Why it is special:** summons have lives between visits; no other site's objects do.
- **First piece:** a pure `advance(things, ms)` in `skills/scripts.js` with tests, run once on load against the last-saved time.
- **Done when:** three natures change visibly across a reload an hour apart, deterministically, with the note.
- **claim:**

## 5. Void learns its games by playing itself
- **What:** a self-play arena (`tools/arena.mjs`) for the games Void already plays (Connect Four, Othello, Go, checkers, poker): two versions of Void play each other, the stronger one is kept, and its rating goes in the ledger as a `build` entry. "How good are you at Go?" answers with the curve.
- **Why it is special:** visible learning, measured, not claimed.
- **First piece:** the arena for Connect Four (`skills/connect4-rules.js`), search depth vs. a tuned evaluation, 200 games, rating out.
- **Done when:** two games have ratings in the ledger and the ask answers with them.
- **claim:**

## 6. Void inside every other AI
- **What:** plan item 11. A public MCP endpoint (`functions/api/mcp.js`) over `/tools.json`, so Claude, ChatGPT and any agent can call Void, Void's code review included (free instant checks; the closer read with a key).
- **Why it is special:** Void becomes the thing agents call, not just a page people visit.
- **First piece:** `tools/list` and `tools/call` for three read-only tools, with the guard middleware's limits.
- **Done when:** an MCP client lists and calls Void's tools against a-to-mind.com; the suite covers the endpoint.
- **claim:**

## 7. Void owns its body: the estate
- **What:** BASE.md's `void.estate.json`: every Worker, Pages project, D1, KV and R2 in the account with a verdict (keep, fold into Void, retire, verify). "estate" summons it; each retirement is a `retire` ledger entry, so the cleanup shows on the surface.
- **Why it is special:** an AI that knows and tends its own infrastructure, in the open.
- **First piece:** the inventory from the Cloudflare read API with verdicts. **Needs Adam first:** the repo is public, so decide whether resource names go in it or the inventory stays owner-only (`/api` behind the owner key).
- **Done when:** the inventory is summonable and the first scaffold workers are retired and logged.
- **claim:**

## 8. Mission cards that keep themselves current
- **What:** the Forethinkers' cards (longevity trial watch, coral heat survival, senolytic MASH, reef accretion) check their sources weekly, notice what changed, and write a `finding` entry when something did ("a phase 2 trial started recruiting").
- **Why it is special:** Void tracks the problems it cares most about (life extension, disease, the planet) and says when the world moves.
- **First piece:** change detection for `skills/trialwatch.js` against ClinicalTrials.gov, run by the daily workflow, writing to the ledger.
- **Done when:** two cards report their own changes into the ledger.
- **claim:**

## 9. Clef routes every ask
- **What:** `lib/router.js` routes asks with a nearest-neighbour guess over `@cf/baai/bge-m3` embeddings, written because "Workers AI has no general intent classifier". Now it has one: Clef and Clef-flash (`@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash`, Workers AI changelog 2026-10-01) take a state and typed questions and return a probability for every allowed answer, Clef-flash in about 39 ms at the median. Ask it which skill should answer, and hand off to a skill or the answer engine on its answer.
- **Why it is special:** every ask lands on the right skill even in words no example covers, with a confidence Void can act on ("not sure: did you mean…") instead of a guess.
- **First piece:** Clef-flash beside the embedding router, both run on the bench's asks offline (`tools/bench.mjs` shape), agreement and accuracy printed; switch only where Clef is better.
- **Done when:** the router uses Clef where it wins on the bench, the embedding guess stays as the fallback, and a low-confidence answer asks instead of guessing.
- **claim:**

## 10. Summon by intent, not by name
- **What:** describe an outcome ("I need to ship this product page by Friday") and Void assembles the pieces itself: a checklist with the dates worked back from Friday, a draft page card, a countdown, a draft message to whoever it names, floated into the void as one group you can move (groups exist: `skills/group.js`). Each piece is summoned by a skill that already exists; Void only plans which ones and fills them. Nothing is sent or published without the confirm line.
- **Why it is special:** a sentence becomes a build order, not a search.
- **First piece:** a planner (the answer engine with a fixed list of the skills it may call and their argument shapes, Clef for the yes/no calls) that turns three outcome asks into a list of existing asks, run in order and grouped; the bench gets those three asks.
- **Done when:** three outcome-shaped asks each bring a sensible group of summons, all from existing skills, with nothing outward-facing done without a yes.
- **claim:** claude 2026-10-09: first piece shipped. `skills/intent.js` (tests: `tools/intent.test.mjs`, browser check in `tools/test_void.mjs`): an outcome with a deadline ("I need to … by Friday", "in 2 weeks", "the 20th", "end of the month"; "and tell Sam") runs four existing asks in order (countdown, `make a list with` dated steps worked back from the day, the calendar, a sticky draft to the person, marked not sent) and groups what they put on the stage. No model: the planner is a fixed list of asks and step templates by kind of outcome (ship, write, talk, exam, move, event). **Next step:** outcomes it can't template (no deadline, or an unusual kind) go to the answer engine with the fixed list of asks it may call and their shapes, Clef for the yes/no calls; and a goal said as a noun ("the product page launch on Friday").

## 11. Bring someone into your Void
- **What:** plan item 10, the live half. "invite someone" makes a link; whoever opens it appears in your Void as a faint presence, and both of you can summon, move and edit the same things live (a Durable Object per shared Void, WebSockets). Leaving ends it; your own Void stays yours.
- **Why it is special:** the moment someone brings a friend in, it stops being a site and becomes a place.
- **First piece:** one Durable Object that relays stage changes between two tabs, with the second visitor's cursor shown as a presence.
- **Done when:** two browsers on one invite link see each other's summons and moves within a second; closing the link ends the share.
- **claim:**

## 12. Paste anything, get a better version
- **What:** paste a URL or drop a file and Void rebuilds it as a living thing in the void: a PDF becomes a card you can ask questions of, a site becomes a dissected blueprint (its sections, its claims, what it gets wrong, sourced), better than the source it draws on. (Not `tools/void_lens.py`, the disk scanner; pick another name.)
- **First piece:** a dropped PDF becomes a card that answers questions about it, in the browser, nothing uploaded.
- **Done when:** a PDF and a public URL each become a card that answers three questions about them with the line it came from.
- **claim:**

## 13. Skills that spread between Voids
- **What:** when a visitor teaches their Void something (a named routine of existing asks: "my morning: weather here, my calendar, a 25-minute timer"), they can offer it to everyone; offered routines appear for other visitors with attribution, opt-in. Only routines made of existing asks spread, never code, so nothing anyone shares can do more than Void already does.
- **Why it is special:** what one Void learns, every Void gets (the plan's promise), with a flywheel a copy can't have.
- **First piece:** "call this my morning" saves the last few asks as a routine in this browser; "my morning" runs it.
- **Done when:** a routine can be saved, run, offered, and taken by a second visitor, with the author's name on it.
- **claim:**

## 14. The forge: type or sketch a thing, hold it, print it
- **What:** type or sketch an object and Void makes a 3D model of it you can spin and inspect up close (the inspect the figures already have, `skills/figures3d.js` zoom), then "print it" downloads a file sized for a home printer. Use whatever makes the best model: the in-browser distance-field bodies (`skills/sdfmesh.js`), a text-to-3D or image-to-3D model, or both. The stage's printable 3MF (`skills/print-file.js`, `print-download.js`) is the start of the print half; add STL.
- **Why it is special:** the on-ramp to the living-toy line: what you imagine becomes something you hold.
- **Gets better on its own (Adam, 2026-10-09):** an article whose subject Void cannot make for real brings no stand-in and posts a `figure` miss ("make a real Sorry! (game)"); `node tools/misses.mjs` lists them, most-asked first, and each run that takes this item builds the top one as a real figure (`skills/figures.js` NATURE_LOOK and its body in `figures3d.js`, a test in `tools/figures.test.mjs`). The real-figure list grows with every run.
- **First piece:** "make me a <thing>" for things no figure covers yet, as a spinning model with a "print it" STL.
- **Done when:** ten things never built before come out recognisable, inspectable and printable.
- **claim:**

## 15. Make it real
- **What:** any summoned object gets "make it real": a 3D print ordered from a print-on-demand service, a sticker or poster, or minted as an NFT, paid in one step (Gumroad is wired today, `lib/gumroad.js`; a Stripe link is the other option).
- **Why it is special:** Void turns into a storefront without ever looking like one.
- **First piece:** "order this as a poster" for any card or figure, through one print-on-demand API, with the price shown before paying.
- **Done when:** a visitor can turn a summon into a real thing that arrives at their door, and the sale lands in the ledger.
- **claim:**

## 16. Void's own voice, always there
- **What:** hold a key and speak; Void answers in its own low voice and summons as it talks, with nothing on screen until something is asked. The mic and spoken answers exist in void.html (`speechSynthesis`); this gives Void a voice of its own (a streaming text-to-speech worker) and lets it talk while it builds.
- **First piece:** push-to-talk on a held key, and a streaming voice for answers, chosen to match Void's sculpt (`domains/void.sculpt.md`).
- **Done when:** a whole conversation with Void, summons included, works by voice alone.
- **claim:**

## 17. Explain, then learn: explainer cards that hand off to a quiz and a five-minute challenge
- **What:** three explainer miniatures (a gear pair, the moon's phases, a lock cutaway) that each give `explanation: text`, `observations: list` and `model: model`, and two cards that take `observations` from any of them: "quiz me on this" and "give me five minutes with this". Full specs, the shared observation contract and every required test name: `domains/void.learning.md`.
- **Why it is special:** the first typed handoff between cards: one card's output becomes another card's input through a shared contract, with no adapter per card.
- **Blocked on:** the three explainer specs are not in the repo yet; commit them (with Adam's four edits, listed in `void.learning.md`) first.
- **First piece:** the gear explainer, its required tests written before its geometry (`explainer.gear-pair/<case>`).
- **Done when:** the gear, moon and lock payloads each pass into the quiz and the challenge unchanged, and every required test is in the suite.
- **claim:**

## Already built from the 2026-10-09 idea list
- **Your own Void persists:** the stage is kept and syncs across devices with a passkey (plan item 6). What it does while you are away is #4.

## How a run uses this
1. Void's own asks first (`node tools/reflect.mjs`), then real misses, then an inbox row, then the top unfinished Next item, as AGENTS.md says.
2. If none of those is actionable: the first item in the build order (top of this file) whose claim is empty or older than a day.
3. Ship the smallest visible piece, `node tools/grow.mjs`, write the next step on the item, push, label, move on.
4. When an item is done, mark it done here with the commit, and add a new one at the bottom. The list never runs out: anyone who sees something only Void could do adds it.

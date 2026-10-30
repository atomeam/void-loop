# Growth inbox

**This is not the build list, and "no open rows here" never means there is nothing to do.** Since 2026-10-11 (cleanup step 2) every open item lives in `domains/void.frontier.md`; `node tools/next.mjs` lists them (12 open on 2026-10-12). Build from there. This file only collects new ideas (`tools/grow-ideas.mjs`) and is what Verse reads about itself (`tools/self-context.mjs`); an idea that lands here is carried onto the frontier before anyone builds it.

Shipped rows stay, with the main SHA. Rows are not deleted.

| status | date | ask | source |
| --- | --- | --- | --- |
| shipped 2e52327 | 2026-10-02 | share this card | plan item 10, shared Voids |
| shipped 8642810 | 2026-10-02 | answer me in Spanish | plan item 9, Verse in other languages |
| shipped d972baf | 2026-10-02 | remind me at 5 | plan item 7, connector behind the confirm line |
| shipped 2e67f4b | 2026-10-03 | recent asks on an empty box | board Next #15 (Grok idea F001) |
| shipped c5d99e8 | 2026-10-03 | show the magnetize step | board Next, magnetize-step card |
| shipped ee370b3 | 2026-10-02 | what's already built | assimilate row 6, plan item 8 |
| shipped d421518 | 2026-10-03 | throw it off the screen | figures-first dismiss (skill + stageKinds flick; main already throwable) |
| shipped 1633dbd | 2026-10-03 | export a print file | void-stage, slicer 3MF (correction: row stayed "building" after this landed) |
| shipped 952cb99 | 2026-10-03 | summon a figure | figures-first, living 3D |
| shipped 3b6bbea | 2026-10-03 | spin the figure | figures-first, see the back |
| shipped dbd08d3 | 2026-10-03 | days until new year | board later, date countdown (correction: row stayed "building" after this landed; outcome-card follow-up on helper/outcome-card-countdown) |
| shipped ce74ceb | 2026-10-03 | read it aloud | plan item 4, voice (correction: row was stuck "open"; speechSynthesis read-aloud already shipped, listed in the self-page menu) |
| shipped 6a04b90 | 2026-10-03 | make my void light | board later, light look (checked: no light-theme preset exists; LOOK_DEFAULT is dark-only. genuinely open, not stale) |
| shipped d40bd25 | 2026-10-03 | what did you do today | plan item 8, ledger as a skill (correction: row was stuck "open"; wantsToday/showToday already shipped) |
| shipped 4ee2383 | 2026-10-03 | dismiss this | figures-first, send it away (skill on main at 4ee2383) |
| shipped 3b6bbea | 2026-10-03 | a figure that sits on the chair | figures-first, use what is already there (correction: row was stuck "open"; Motelet's whole personality is "it sits whenever it finds a chair", same commit as "spin the figure") |
| shipped 7293ca7 | 2026-10-04 | download the print file | export-to-print, file stays valid offline (print-download on main at 7293ca7; empty stage stays empty) |
| shipped f249d1a | 2026-10-04 | cartoon version of a hard subject | two-part summons, funny not grim (cartoon on main at f249d1a) |
| shipped 6af476e | 2026-10-04 | zoom in on the figure | collector detail, progressive (zoom-figure on main at 6af476e) |
| shipped 231840b | 2026-10-04 | what can this figure do | figure stays on brand (figure-can on main at 231840b) |
| shipped 4f5f122 | 2026-10-04 | show the countdown | days until a date (show-countdown on main at 4f5f122) |
| shipped 6139fda | 2026-10-07 | bring the clock to the front | board Next #3, grouped objects / layers (z-order half: "send the note to the back", "send it to the back", "bring all the notes to the front"; grouping still open) |
| shipped ef995a7 | 2026-10-07 | group the clock and the note | board Next #3, grouping half: drag one and they all move, "move the group to the top left", "make the group bigger", "bring the group to the front", "ungroup" (Next #3 complete) |
| shipped 7ea644b | 2026-10-07 | label the clock kitchen | board Later, text annotation / labels: tags that ride with a thing, free labels ("add a label that says to do"), arrows that follow a drag ("draw an arrow from the clock to the note", "connect the timer to the counter", by label name too), "remove the arrows", "remove the labels" |
| shipped check | 2026-10-10 | before rotating the GitHub token: `gh secret list` shows VOID_OWNER_TOKEN set 2026-10-09T21:58Z and the voice daily ran a minute later (domains/void.voice.md); check `gh run list --workflow void-voice.yml --limit 3` and learn.yml and void-tick.yml first — if their recent runs are green and not "token not set" no-ops the secret already works, skip the rotation and report that; rotate only if a run shows the token missing or rejected | map PR #344 (gh secret list), for the bake-off session. Checked: void-voice.yml recent runs green (token set, 503 model busy on latest); void-tick.yml green but 401 (token set yet rejected by Pages READ_TOKEN); learn.yml no runs. Secret is set but does not match; do not rotate, rematch the Pages secret. |
| shipped | 2026-10-15 | video skill: play any YouTube, Rumble, Vimeo, Dailymotion, Internet Archive, PeerTube, Odysee or Twitch video inline (official embeds), search with cards, platform switcher, queue, skip to a time, speed, captions, recently watched | asked by the owner (2026-10-15) |
| shipped 40014b8 | 2026-10-14 | convert-card: persistent interactive unit conversions on the stage | asked by Verse (ask-20261014-1820-2, daily) |
| building | 2026-10-14 | film discovery skill returns JSON film metadata | asked by Verse (ask-20261014-1820-3, daily) |
| shipped d6529d3 | 2026-10-14 | growth friction linked to Words and the world failure logs | asked by Verse (ask-20261014-1820-1, daily; base friction already shipped) |
| open | 2026-10-15 | phone-cut films skill auto-generates promotional posters | asked by Verse (ask-20261014-2134-3, daily) |
| shipped #696 | 2026-10-15 | rendered state signal for 3D miniature cards | asked by Verse (ask-20261014-2134-1, daily); already live: skills/scene3d.js gives every miniature data-rendered and void:mini-rendered (#696, 2026-10-14) |
| open | 2026-10-15 | browser video recordings pipeline to GitHub release assets | asked by Verse (ask-20261014-2134-2, daily) |
| shipped (packaged) | 2026-10-15 | Verse Site Tester | store-publish: sdk, 4 files, $24.00; next: a minis-stl pack (none in the store yet) |
| building | 2026-10-16 | execution layers: better scorecard, pit-crew for small Verse asks, gate bridge.task | owner: close measure→decide→ship; helper/execution-layers |
| open | 2026-10-16 | surface void.better.json on the growth card as a one-line trend | follow-on to execution layers |
| open | 2026-10-16 | pit-crew --queue on a schedule once owner enables VOID_MISSES_TOKEN path | follow-on; dry-run ships first |
| shipped 4841759 | 2026-10-19 | lift the two shared libs the dependency health card marked weak (lib/rts.js, lib/stage-pack-h.js): rts and zoom-figure proven by real benchmark asks (#1166) | claude 2026-10-18, asked by Verse |
| open | 2026-10-21 | answer endpoint: "open the self card" (and the other self-card asks the page takes) gets the self card's words, not the model saying it cannot open one (`POST /api/answer` route fallback today) | asked by Verse (docs/void-voice.md, 2026-10-21) |
| shipped (packaged) | 2026-10-21 | Verse Remix Kit | store-publish: templates, 6 files, free; next: a minis-stl pack (none in the store yet) |
| shipped 59279e0 | 2026-10-22 | fun fact skill: random interesting facts from a public API | new idea by growth agent |
| shipped 96b77c6 | 2026-10-22 | random quote skill: inspirational quotes from a public API | new idea by growth agent |
| shipped (lists run 7, page) | 2026-10-28 | act skill: owner asks like "my email" route to the act skill instead of no answer (`POST /api/answer` "my email" is noAnswer, near act 0.637 < 0.7) | asked by Verse (docs/void-voice.md, 2026-10-28); the page now answers "my email", "check my email", "open gmail" and "email sam that …" with the mail card (skills/rides.js mailAsk: your inbox or a filled draft in your own mail app, tools/mail-handoff.test.mjs); the `/api/answer` act class lives in lib/router.js with its owner |
| shipped | 2026-10-28 | identity studio opens with a neutral example profile (no real name or email in the seed) | asked by Verse (docs/void-voice.md, 2026-10-28, "minimal identity seed") |
| shipped (lists run 7) | 2026-10-28 | value-drift tracker: how Verse's own appraisals (its store prices) move over time, grouped by kind, a kind flagged to re-appraise together when its prices move apart (`node tools/value-drift.mjs --write` -> domains/value-drift.json, tools/value-drift.test.mjs); photo appraisals are never kept, so they stay out | asked by Verse (docs/void-voice.md) |
| building | 2026-10-28 | advice skill: random advice from a public API | new idea by growth agent; helper/advice-new |
| building | 2026-10-28 | color palette skill: generate random harmonious color palettes on the stage | new idea by growth agent; helper/new-color-20261028 |
| building | 2026-10-28 | proverb skill: a random proverb or saying | new idea by growth agent; helper/proverb-new |
| building | 2026-10-28 | random number skill: roll dice or pick a random number in a range | new idea by growth agent; helper/growth-random |
| shipped 0297c5e | 2026-10-29 | my want card names the site Versus is on, and /api/will ranks my wants by the tower target | PR #1406 |
| shipped | 2026-10-29 | answer cards cite a source only when its text holds the claim, and give no fetched credit to a paraphrase | PR #1410, owner card notes 1-5 |
| shipped | 2026-10-29 | answer cards read the whole message, answer from its correction, and claim no notes or logs they did not write | PR #1410, owner card notes 1-5 |
| shipped | 2026-10-29 | a note about my own card gets my own voice, with Fixed and Still open lists from my records | PR #1410, owner card notes 1-5 |
| building | 2026-10-28 | morse code | new idea by growth agent; helper/morse |
| building | 2026-10-28 | ascii skill: show ASCII codes for text | new idea by growth agent; helper/ascii |
| building | 2026-10-28 | leet skill: convert text to 1337 speak | new idea by growth agent; helper/leet |
| building | 2026-10-28 | lorem skill: generate lorem ipsum placeholder text | new idea by growth agent; helper/lorem |
| building | 2026-10-28 | magic 8-ball skill: classic answers to yes/no questions | new idea by growth agent; helper/8ball-skill |
| building | 2026-10-29 | yes or no skill: simple yes or no answers | new idea by growth agent; helper/yesno |
| building | 2026-10-29 | uuid skill: generate a random UUID | new idea by growth agent; helper/growth-uuid |
| building | 2026-10-29 | password skill: generate a random secure password | new idea by growth agent; helper/growth-password |
| building | 2026-10-29 | shuffle skill: shuffle a list of items | new idea by growth agent; helper/shuffle |
| building | 2026-10-29 | random emoji skill: pick a random emoji or a few | new idea by growth agent; helper/emoji |
| building | 2026-10-29 | timer skill: a simple countdown timer on the stage | new idea by growth agent; helper/timer |
| building | 2026-10-29 | rock paper scissors skill: play a quick game | new idea by growth agent; helper/rps |
| building | 2026-10-29 | stopwatch skill: a simple stopwatch on the stage | new idea by growth agent; helper/stopwatch |
| building | 2026-10-29 | anagram skill: scramble a word or check if two words are anagrams | new idea by growth agent; helper/anagram |
| building | 2026-10-29 | palindrome skill: check if a word or phrase is a palindrome | new idea by growth agent; helper/palindrome |
| building | 2026-10-29 | hangman skill: play a simple word-guessing game | new idea by growth agent; helper/hangman |
| open | 2026-10-29 | word ladder skill: transform one word to another by changing one letter at a time | new idea by growth agent |
| building | 2026-10-30 | coin flip skill: flip a coin or best of three | new idea by growth agent; helper/coinflip |

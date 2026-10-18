# Growth inbox

**This is not the build list, and "no open rows here" never means there is nothing to do.** Since 2026-10-11 (cleanup step 2) every open item lives in `domains/void.frontier.md`; `node tools/next.mjs` lists them (12 open on 2026-10-12). Build from there. This file only collects new ideas (`tools/grow-ideas.mjs`) and is what Void reads about itself (`tools/self-context.mjs`); an idea that lands here is carried onto the frontier before anyone builds it.

Shipped rows stay, with the main SHA. Rows are not deleted.

| status | date | ask | source |
| --- | --- | --- | --- |
| shipped 2e52327 | 2026-10-02 | share this card | plan item 10, shared Voids |
| shipped 8642810 | 2026-10-02 | answer me in Spanish | plan item 9, Void in other languages |
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
| shipped 3b6bbea | 2026-10-03 | a figure that sits on the chair | figures-first, use what is already there (correction: row was stuck "open"; sitting pose already in figures) |
| shipped check | 2026-10-10 | before rotating the GitHub token: `gh secret list` shows VOID_OWNER_TOKEN set 2026-10-09T21:58Z and the voice daily ran a minute later (domains/void.voice.md); check `gh run list --workflow void-voice.yml --limit 3` and learn.yml and void-tick.yml first — if their recent runs are green and not "token not set" no-ops the secret already works, skip the rotation and report that; rotate only if a run shows the token missing or rejected | map PR #344 (gh secret list), for the bake-off session. Checked: void-voice.yml recent runs green (token set, 503 model busy on latest); void-tick.yml green but 401 (token set yet rejected by Pages READ_TOKEN); learn.yml no runs. Secret is set but does not match; do not rotate, rematch the Pages secret. |
| shipped | 2026-10-15 | video skill: play any YouTube, Rumble, Vimeo, Dailymotion, Internet Archive, PeerTube, Odysee or Twitch video inline (official embeds), search with cards, platform switcher, queue, skip to a time, speed, captions, recently watched | asked by the owner (2026-10-15) |
| shipped 40014b8 | 2026-10-14 | convert-card: persistent interactive unit conversions on the stage | asked by Void (ask-20261014-1820-2, daily) |
| building | 2026-10-14 | film discovery skill returns JSON film metadata | asked by Void (ask-20261014-1820-3, daily) |
| shipped d6529d3 | 2026-10-14 | growth friction linked to Words and the world failure logs | asked by Void (ask-20261014-1820-1, daily; base friction already shipped) |
| open | 2026-10-15 | phone-cut films skill auto-generates promotional posters | asked by Void (ask-20261014-2134-3, daily) |
| shipped #696 | 2026-10-15 | rendered state signal for 3D miniature cards | asked by Void (ask-20261014-2134-1, daily); already live: skills/scene3d.js gives every miniature data-rendered and void:mini-rendered (#696, 2026-10-14) |
| open | 2026-10-15 | browser video recordings pipeline to GitHub release assets | asked by Void (ask-20261014-2134-2, daily) |
| shipped (packaged) | 2026-10-15 | V01D Site Tester | store-publish: sdk, 4 files, $24.00; next: a minis-stl pack (none in the store yet) |
| building | 2026-10-16 | execution layers: better scorecard, pit-crew for small Void asks, gate bridge.task | owner: close measure→decide→ship; helper/execution-layers |
| open | 2026-10-16 | surface void.better.json on the growth card as a one-line trend | follow-on to execution layers |
| open | 2026-10-16 | pit-crew --queue on a schedule once owner enables VOID_MISSES_TOKEN path | follow-on; dry-run ships first |
| building | 2026-10-18 | dice roller: roll a die, 2d6, d20 and NdS+B on a card | new idea, asked by growth agent 2026-10-18 |
| building | 2026-10-18 | haiku skill: write a short haiku about the void or rain on a card | new idea, asked by growth agent 2026-10-18 |

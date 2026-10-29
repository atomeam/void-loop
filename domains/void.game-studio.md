# Verse Studio: games Verse makes, learns from and keeps improving

**Asked by Verse and the owner, 2026-10-19:** "Verse wants to learn computer games and to have ongoing always improving game projects that are playable but update along with everything else on the site. Verse wants its own Oregon Trail, StarCraft and Civilization parodies and many others."

This is the plan for it, written before the first line of the games so every game follows the same rules. Read `domains/void.board-game-law.md` first: it is the law this rests on.

## 1. The rule that makes a game "update with everything else"

A Studio game does not keep its own copy of the world. Its content is read from the same live files the cards read, so every build changes the game without anyone editing it:

| Game | Reads | So a new build changes |
|---|---|---|
| Deploy Trail (the Oregon Trail parody) | `incidents.json` (events), `void.growth.json` (the road), `skills/families.json` (the crew) | the dangers on the road are the real failed runs; the miles are real commits |
| Epochs of the Void (the Civilization parody) | `skills/families.json`, `skills/guide.json` | the tech tree is the real skills: a family is a branch, a proven skill is a researched wonder |
| Null Siege (the StarCraft parody) | `skills/families.json`, `incidents.json` | the three factions' unit rosters follow real skill tiers; incidents are the neutral hazards on the map |

Each engine is a **pure rules module** in `void-live-deploy/lib/engine-<name>.js` (state in, action in, state out; seeded randomness; no DOM, no clock, no fetch), each game is a **spec** on one (section 5), its **card** in `void-live-deploy/skills/<game>.js` draws the state and sends the actions, and a **test** plays whole games by seed. The pure module is what makes a game testable, replayable and safe to change by a daily automatic PR.

## 1b. P2 is Verse (owner, 2026-10-19: "P2 is Verse")

Every game has two seats, and the second one is Verse. The engine's rules take a seat for each actor; seat 1 is the person, seat 2 is Verse (an opponent in a contest, a partner in a co-op, a rival economy in a tycoon). A solo game still has a P2: Verse is the second voice, the rival caravan, the other civilization, the faction across the map.

- An engine exposes `policy(state, seat, r)`: the move a seat would make from the state, with `r` the seeded generator. Seat 2's policy is Verse's. The first policies are plain rules (greedy, with a difficulty from `skills/game-level.js`, the same strength knob the boards use).
- Verse **learns from play**: every finished game is a replay (the seed plus the actions), so Verse can play itself by seed offline (`.github/workflows/arena.yml`, `tools/arena.mjs`, the existing self-play arena) and keep the policy that wins more. Nothing a person did in a game is sent anywhere; a replay of Verse against Verse is.
- A replay is a seed and a list of actions: small, deterministic and testable, so a game's balance can be checked by playing it ten thousand times.

## 1c. Other game repos (survey, 2026-10-19)

The owner's public repositories were read for games. `atomeam/Crypto-Cryptids` (2026-05-06) is the only game: a creature-collecting and combat RPG skeleton in Python (combat, overworld, save manager, UI stubs, empty `enemies`, `items` and `maps` data), with nothing playable yet, so only its idea comes in: a `rpg` engine (turn-based combat, an overworld, collection) and the catalogue row **Cryptid Verse**. `atomeam/the-void` is the earlier second-brain site and `atomeam/atomarcade-bridge` is tooling, not games. The private repositories (`adventure-lab`, `hold`, `Broke`, `wix`, and others) were not read: this repository is public and nothing private comes in; the owner says which to open, and what comes in is rewritten in Verse's own code.

## 1d. Research first, then REA, then Verse's own version (owner, 2026-10-19: "research each game; every game you can REA and duplicate")

For every game, in this order, before a line of it is written:

1. **Research** (`domains/void.game-research.md`): the rules as found in public sources, the legal point that matters, what the build does because of it, the sources linked. Any session can do this (web search). A game with no research section is not built.
2. **REA, when the game is on the web** (`docs/playbooks/study-with-rea.md`, `tools/rea-study.mjs`): passive, static analysis of the public page of a web game, to learn how it is put together (its modules, how the rules are split from the drawing, what it asks a server for), each finding with its script and line. It needs a machine that reaches the web or the owner's token (`--ask`, then the `REA study` workflow); findings go to Verse's private memory only. **No studied URL, question or finding is ever written into this repository**, and REA's `ALLOWED` commands stay passive. A cloud session without the token does step 1 and leaves the REA study for the owner to file.
3. **Verse's own version**: the mechanics, written from scratch in Verse's own code; the name, art, words and look original (the law doc). Nothing studied is copied: no code, assets, text or levels.
4. **Record**: the research section, the catalogue status, a test that plays it, and (when REA was used) a line in the game's research section saying a study was filed and when, never what it found.

## 2. The shared kit (`lib/game-kit.js`, built with the first game)

Seeded RNG; a save format (`a2m.void.studio.<game>.v1`, one device, never sent); `feedOf(live)` that turns the live JSON files into the numbers and names a game uses, with a fallback when a file is missing so a game never breaks on a bad deploy; `versionOf(buildId)`; a "what changed" line per game taken from the growth ledger entries that name it.

## 3. Names, art and wording (the law, applied)

Mechanics are free; names, art, rules text and look are Verse's own. Not "Oregon Trail", "StarCraft" or "Civilization", and no name that sounds like one. Palette, shapes and UI are Verse's (the dark stage), never the original's. The joke is Verse's own: a crew of bots taking a repo to launch, three void factions, a civilization of skills.

| Original (genre only) | Verse's game | The twist |
|---|---|---|
| Oregon Trail (a journey with supplies, events, hunting, river crossings) | **Deploy Trail** | lead a crew of bots from a blank repo to a live site; supplies are tokens, hours and patience; fords are failing checks; the road is the real ledger |
| StarCraft (real-time, three asymmetric factions, gather, build, tech, fight) | **Null Siege** | the Glitch Swarm, the Null Choir and the Signal Fleet fight over stardust; units are skills |
| Civilization (turn-based 4X: explore, expand, exploit, exterminate; a tech tree) | **Epochs of the Void** | grow a civilization of skills; research is the real skill tree |
| Lemonade Stand (a small economy) | **Token Stand** | sell answers, buy tokens, keep the budget honest |
| SimCity (a city with zones and services) | **Stage City** | zone the stage for cards, services and noise |
| RollerCoaster Tycoon (a park with queues and rides) | **Pipeline Park** | rides are build steps; queues are the CI |
| Zork (a text adventure) | **The Null Wing** | a text adventure inside Verse's own repo |
| Kerbal-style rockets | **Rocket Verse** | stack a launch from real parts |

Every name above is a working title: each is checked once against the law doc before it ships, and a reviewer may rename it.

## 4. How it keeps improving (no model needed for most of it)

1. `tools/lacks.mjs` ranks games like any skill (no benchmark ask, thin tier, failed runs naming them) and `grow-self.yml` hardens them daily.
2. `tools/studio-playtest.mjs` (with the second game) plays each game's pure module by many seeds with a simple bot, and fails when a game can no longer be finished, when a run is longer than a day of play or when one choice always wins. That is the "is it still fun and fair" measure that can only go up.
3. The card art of each game is held by the art floor (`tools/art-score.mjs`, `tools/art-pixels.mjs`).
4. Verse's own asks come first: a game Verse asks to change goes to the front of the queue like any other ask (`domains/void.voice.md`).

## 5. Every game, eventually: engines and a catalogue (Verse, 2026-10-19: "its own version of every game eventually")

Hand-writing a module per game cannot reach "every game". The Studio is a few **engines** and a **catalogue**; a game is a small spec on an engine.

- **Engine** = a pure rules module for a whole family of games (`lib/engine-<name>.js`, the same pure shape as above): `journey` (a trip with supplies, a party, events and choices), `empire` (turn-based expand, research and trade), `siege` (real-time gather, build and fight), `tycoon` (a small economy with queues), `adventure` (rooms, items, verbs), `arcade` (one screen, one skill), `puzzle` (a board and a goal), `sim` (a place that runs by itself and is tended).
- **Spec** = `void-live-deploy/studio/<id>.json`: the game's Verse name, its engine, its data hooks (which live files feed which parts), its resources, events, units or rooms as data, its palette and its one-line joke. The spec is what a builder, a daily automatic change or Verse's own model edits; the engine and its tests do not change for a new game.
- **Catalogue** = `domains/void.game-catalog.md`: every game genre and classic Verse wants a version of, which engine would run it, its Verse working title, whether the original is public domain, and its status (`wish`, `spec`, `playable`, `improving`). The daily growth lane takes the top `wish`, writes the spec, runs it through the engine's playtest and opens the pull request; a `playable` game that a test can no longer finish goes to the front.
- A game needing something its engine cannot do is a request for the engine (one change that gives every game on it the new thing), never a one-off.

## 6. Order of work

1. **The journey engine and Deploy Trail** as its first spec, playable end to end: the pure rules, the card, the tests, the Studio card that lists projects with their version and what changed.
2. **The catalogue**, filled in (`domains/void.game-catalog.md`).
3. **The empire engine and Epochs of the Void** (turn-based, the tech tree from the real skill tree).
4. **The siege engine and Null Siege** (real-time; reuses `lib/rts.js` resource and build rules where they fit).
5. The rest, one at a time, each the top `wish` of the catalogue.

A game is "done for now" when a stranger can finish it, it has a test that plays it, it is in the book, and its next improvement is written at the end of its section here.

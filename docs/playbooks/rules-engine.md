# A rule set: teach Verse one more game's rules, as data

**Starts when:** someone asks for a game's rules to be obeyed (chess moves, D&D initiative, a card game's costs), or a subscriber proposes a rule in words, and `proposeRule` (`lib/rule-propose.js`) cannot read it.

1. **Read the mechanic, write your own words.** Mechanics are free; another game's wording, names and art are not. Name sets and rules yourself ("tribute", not a trademark).
2. **One JSON file** in `void-live-deploy/lib/rulesets/<name>.json`: `{ name, title, about, rules }`. Each rule is `{ id, source, layer, when, if, then, dependsOn }` and nothing else. Layers: 1 "instead" and "can't"/"may" (replace, deny, allow), 2 values and permissions (modify, deny, allow), 3 what happens after (gain, neutralise, consume, summon, move, win, endTurn, sortOrder, log). Ids start with the set name so stacks never collide.
3. **Only the closed vocabulary** (`FACT_NAMES`, `EVENTS`, `STATS`, the effects in `lib/rules-engine.js`). If a rule cannot be said with it, add one fact or one effect to the engine, with a test, never code in a rule. `validateRule` says exactly what is wrong.
4. **Say what clashes.** If your set can contradict another (your deny against their allow), the lower layer wins and the loser is logged; put the clash you expect in a test with `explain(...)`.
5. **Test by hand-derived numbers** in `tools/rules-engine.test.mjs`: stack your set with `duel`, work out the coins and cards on paper first, then assert. Add the name to `SET_NAMES` and `ALIASES` in `lib/rules-play.js`.
6. **Try it:** `node tools/ask.mjs "duel with <your set> and mana rules"`, then `node tools/heavy.mjs node tools/test_void.mjs --only "Verse rules engine"`.

**Mistakes already made:** a deny judged before a rule changed the price saw the old price (permissions are settled on final values now); an endTurn rule at turn start looped (chains stop at 3); a summon with a price the player could not pay was reported as a rule clash (the engine refuses it itself, after rules).

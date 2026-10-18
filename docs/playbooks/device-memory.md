# Playbook: something V01D keeps about a person, on the device only (a store, a hook, a card, two opt-out asks)

What it grows: a thing V01D remembers about the person using it, without a server: a pattern, a preference, a record of what happened here. The first one is the personal memory graph (`lib/memory-graph.js`, `skills/memory-graph.js`; asked by Void, 2026-10-18: "a persistent, personal knowledge graph across conversations"). Earlier pieces of the same kind: the last-used day per skill (`lib/skill-use.js`), the correction channel (`lib/corrections.js`), the arcade ladder (`lib/ladder.js`).

## What starts it

An ask (from V01D or a person) to remember, notice or build on something across visits. The owner's rule: no behaviour tracking on a server. So the first version always lives in the browser's own storage, and only what the card needs is kept: never the sentence typed, never a key, never an address. Check first what already exists: `grep -n "a2m.void" void-live-deploy/lib/state.js` lists every store; `node tools/ask.mjs "<the ask>"` shows who answers it today.

## The shape

1. **One key, named once.** Add the store to `STORES` in `lib/state.js` (`name: { key: 'a2m.void.<name>.v1', what: '...' }`), so the state card ("what do you keep on this device") lists it. Nothing else may spell the key; the lib exports it.
2. **A pure lib in `lib/<name>.js`.** `empty()`, `parse<Thing>(text)` that takes only a well-formed value (anything else is empty), the one function that adds a record (returns a new value, never mutates), the readers that turn it into what the card shows, and caps with an eviction rule (the least recent go first). Storage helpers at the end take the storage handed in (default localStorage) and never throw. What is kept is the minimum: for an ask, the skill name and a few object words (`topicOf`: lowercased, stop words out, letters only so a number, address or key-shaped token is never kept, at most 4 words and 40 characters).
3. **The hook in `void.html`, one line.** The one place that knows which skill answered what is `runLearnedSkills` (after `skill.run`, next to `loopLog({ note: 'skill:' + who })`): call a small function there that imports the lib and notes the record. The first time anything is kept, say so once (a `.src` line on the card the skill made, else the whisper line): what is kept, where, and the two asks that clear it and turn it off. The record skips the card's own skill (`SKIP`), or "forget" would re-add a node at once.
4. **A skill for the card and the two opt-out asks.** `node tools/new-skill.mjs <name> --ask "what do you know about me" --ask "forget my patterns" --ask "stop remembering" --ask "start remembering" --near ...`, at a rank before any skill whose matcher already takes one of those asks (`ls void-live-deploy/skills/order`). The card is pure markup from the lib's readers (`cardHtml(esc, ...)`, every value through `esc`), with tap-to-ask chips (`<a data-ask="...">`: the page runs the ask), the count and since day, Forget and Stop (Start when off) as `data-ask` links, and a `.src` line naming the key and saying nothing leaves the device. Suggestions, if any, come only from skills' own `examples` (`import('/skills/<name>.js')`, already cached by the page), never free text.
5. **Nothing about the person leaves.** No fetch in the lib or the skill; the browser section watches every POST for the key or a kept word.

## How to tell it worked

- `node --test tools/<name>.test.mjs`: caps and eviction, the parse of bad text, the readers on a made-up value, suggestions only from the examples map, and an assertion over a list of sentences (with a number, an address, a key, a long one) that no stored label is longer than the cap or contains a sentence.
- `node tools/skills-check.mjs`, `node tools/skill-overlap.mjs --check` (an ask taken from another skill's matcher is a new pair: narrow that skill's regex instead of adding to the allowance, and say so in its comment), `node tools/untested.mjs --check`, `node tools/families.mjs`, `node tools/deps.mjs`, `node tools/guide.mjs`, `node tools/skills-index.mjs --write`.
- One browser section (`VOID_HEAVY_OFF=1 node tools/test_void.mjs --only "<its words>"`): ask a few things twice, open the card, check the chips and counts against what was asked, that every chip and suggestion is a real example (`import('/skills/x.js').default.examples` inside the page), read the key back and assert the sentence is not in it, reload and open again, then "forget", "stop" (a kept ask does not count) and "start".
- `node tools/ask.mjs` on the card's asks and its near misses: the card's asks reach it, "remember me", "who am I" and "remember that …" still go where they went.

## Mistakes made

- `node tools/ask.mjs` presses Escape after each ask, so a card opened by one ask shows under the next; read the `by:` line, not `shows:`.
- A test that notes asks backwards in time (day 2, then day 1) found the pair window counted a negative gap as "together"; the lib takes the absolute gap now.
- `<b>` in a sticky's text left single letters as topic words until a topic word had to be two letters or more.

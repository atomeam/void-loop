# Merge games, and what Verse can take from them (research, 2026-10-16)

Asked by the owner: "research merge games so Verse can experiment with card merges. Verse should understand and combine all systems and be smart, so when each subscriber proposes things like this it can individually alter their personal Verse."

## What the best of them do

**Infinite Craft (Neal Agarwal, 2024)** is the closest model. Two elements are dragged together; if that pair has never been combined, a language model invents the result, and the pair-to-result pairing is saved, so every player gets the same answer for the same pair. The first player to produce a new result is credited ("First Discovery"), which turns exploration into a reward and gets rarer over time. The element count is unbounded because the model, not a table, writes the recipes. (Wikipedia, Infinite Craft; Destructoid and Prima Games on First Discovery. Sources disagree on which Llama/Mistral model it uses.)
Take: one cache of pair-to-result shared by everyone, model invents once, discoverer credited, no recipe list to author.

**Merge puzzles (2048, Triple Town, Merge Dragons, Suika)** share one rule: combine smaller pieces into one bigger piece. What the thin sources I could find agree on: the rule is learnt in seconds, difficulty rises by itself as the board fills, there is no time pressure, sessions are short, and chains (one merge setting off the next) are the thrill; Suika adds physics so the placement itself is the skill. I found no developer postmortem, so treat "why it hooks" as plausible, not proven.
Take: merging must be one gesture (drop one card on another), results should chain, and the board filling up is the pressure.

**Yu-Gi-Oh fusion (Polymerization)** is the opposite design: recipe-gated and costly. Named materials are consumed, the result comes from a separate deck, there are rulings on every edge (face-down materials, returning from the graveyard), and newer cards bend the rules. (Yugipedia, Card Rulings: Polymerization.)
Take: the strategy lives in costs and consumption: a merge that spends its materials is a decision; one that doesn't is a toy. Verse duels (frontier #33) should consume materials; the collection should not.

Not searched, from general knowledge only: Magic's meld (two specific permanents become one) and Slay the Spire's per-card upgrade (a card improves in place). Both are worth a look before the duel rules are final.

## What this means for Verse

1. **Merge two cards, get a new card.** Any two Verse cards (an idea, a skill, a game, a stage thing) merge into one. The result is keyed by the unordered pair of idea keys, computed once, cached for everyone, and credited to its first discoverer (a public handle only if they chose one, never anything else about them).
2. **Numbers are earned, never invented.** The result's Power, Resistance and Income come from the parents by fixed rules (frontier #31: stats come from evidence). The model chooses the name, the kinds it is, and one line of what it adds; it never sets a number. Art is a seeded blend of both parents' art (lib/card-art.js).
3. **It should surprise.** Drop a card on another on the stage and they merge: people don't know objects interact, and finding out is the point (owner, 2026-10-16: "it should surprise them").
4. **Chains and depth.** A merged card can merge again; depth raises rarity and cost; a chain of merges is one move.
5. **Personal Voids.** A subscriber can propose a merge rule or a whole new system in words ("when a song meets a place, make a concert"). Verse reads it against every system it has (skills, cards, stage things, the duel), writes it down as DATA (a declarative rule: kinds in, kind out, stat rule, name template), checks it, and applies it to that subscriber's own Verse only. Rules are never code. A rule many subscribers propose can be offered to the owner as a global one.
6. **Safe by construction.** The model only ever returns a name and a line of text for a pair; both are length-capped, escaped and run through the existing keeper (secrets, harmful asks). No pair can reach a network, a file or a price.

## Not here
Prices, packs, trading (the owner's call). Another game's art, text or names.

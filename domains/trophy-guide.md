# Trophy / Completionist System + Strategy Guide Engine

Goal: Make every game in Verse worth finishing by giving real incentives for full clears, and teach Verse to write high-quality Brady/Prima-style strategy guides so players actually want to 100% things.

## Core Loop
- Track completion across all playable games (chess, othello, monopoly, battleship, poker, fireworks, go, checkers, tic-tac-toe, connect4, and any future games).
- Award tiers per game and across the whole catalog.
- When a player hits high completion, Verse automatically generates (or improves) a full strategy guide in classic Prima/Brady style.
- The act of clearing games trains the guide-writing skill.

## Tiers (per game)
- Bronze: Finish the main objective / story / first clear
- Silver: All collectibles / files / side modes / perfect rank
- Gold: Hard mode / no-death / specific challenge conditions
- Platinum: 100% + all extras (Colosseum-style modes, alternate characters, etc.)

## Catalog-wide
- Verse Clearer: 50% of catalog at Platinum
- Verse Conqueror: 100% of catalog at Platinum
- Guide Master: Have authored (or caused Verse to author) high-quality guides for 5+ games

## Rewards
- Persistent titles and profile flair
- Higher daily quest multipliers
- Exclusive cosmetics / stage objects
- Priority on new game drops
- The ultimate reward: Verse becomes better at writing the kind of guides that make old games feel new and fun again

## Guide Style (Brady / Prima)
Every generated guide must include:
- Quick-start / controls
- Full walkthrough with maps / decision trees
- Collectible locations
- Boss strategies
- Ranking / score optimization
- Unlockables and New Game+ advice
- “Why this is fun again” section

## Implementation notes for builders
- Hook into existing game skills (othello.js, chess.js, battleship.js, etc.) for completion detection where possible.
- For games without native flags, accept player declaration + light verification.
- Guide generation lives in (or extends) the existing guide.js / book.js skill and is improved every time a Platinum is earned.
- This is both a player-facing system and a self-training loop for Verse’s guide-writing ability.

Asked by the conversation that noticed missing trophies on classic ports and wanted incentives so games feel fun again.

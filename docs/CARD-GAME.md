# Verse cards and Verse Rally

## One card record
Every card Verse shows (an answer, a skill page, a game's card, a store item) is read into one record by `lib/card-deck.js`:
`{ id, kind, game, t, k, b, src, rarity, at, saved }`. The share bar on every card (`lib/card-share.js`) notes the card on this device
and adds **☆ save**. Records stay in this browser's localStorage only. Nothing is sent to a server and no names are kept.
Up to 600 unsaved cards are kept, newest first. Saved cards are never dropped.

A game feeds its own cards in by setting `data-deck-kind` (`board`, `game` or `store`) and `data-deck-game` on the card element.
A card that should not be collected sets `data-no-deck`.

## The binder: "my cards", "saved cards", "my deck", "card binder"
- Search across title, type line and the full text.
- Filter by kind and by saved only. Sort by newest, name or power.
- Each card opens to its full text (it wraps and is never cut).
- Each card can be opened as a page, saved or unsaved, removed, or played straight into a match.

## Verse Rally: "play my cards", "card battle", "verse rally", "rally tutorial", "daily card challenge"
The rules fit on one screen:
- **Best of three rounds.** Take turns playing one card from your hand into your row, or pass. Once you pass, you're out for that round.
  When both sides have passed, the bigger row wins the round.
- **Hands carry over.** Each side draws two cards between rounds. A card you hold back is a card you'll have later.
- **The type wheel:** Sky › Land › Life › Word › Number › Sky. A card gets **+3** when its type beats the type of the rival's latest card.
- **No mana and no dice.** The only luck is the shuffle.

### Cards come from real answers (`cardFrom`)
- **Type:** whichever type's words the answer uses most.
- **Power (1 to 10):** how much the answer says, plus up to 2 for its sources, plus its rarity.
- **Ability:** one per card, each earned from a fact about the text:
  - Backed: it cites 2 or more sources.
  - Tally: 4 or more figures.
  - Rally: a list of 3 or more items.
  - Deep: 250 or more words.
  - Spark: it answered a direct question.
  - Swift: under 40 words.

Every card you've been shown is in your deck. A new player's deck is topped up with starter cards from the Verse Book's skill pages,
which are real lines too. Verse's deck is drawn from those same pages.

### Learning, levels and the daily challenge
- **Learn (1 min)** is a guided first match. A hint line reacts to what's on the table: how to play a card, the ▲ +3 mark, when to pass.
  There's no rulebook.
- **Levels:**
  - Easy and Fair play greedily.
  - Sharp also gives up a round it has lost and keeps its cards for later.
  - Master searches every line of the round with both hands open. It sees your hand, and the level's name says so.
    It's the strongest level, but nothing here claims it can't be beaten.
- **The daily challenge** uses the same two decks for everyone on a UTC day, against Sharp.
- **Sound:** short tones you can switch off. Animations use transform and opacity only, and stop under reduced motion.

## What each well-known game does best, and what Rally takes from the idea (not the rules, names or art)
- **Short rounds, no mana, bluffing by passing (Gwent-style).** Rally is best of three with hands that carry over, so passing early is the
  main decision. A match is 3 rounds of a few plays each.
- **Combos (Magic-style).** These are the abilities that stack in a row (Backed with Backed, Rally on one type, Tally on your weakest card).
  The depth is still shallow next to a game with thousands of cards. The planned bigger game on the roadmap can grow from these abilities.
- **Simple type advantage and the urge to collect (Pokémon-style).** Rally has a five-type wheel with one fixed +3. Your collection grows just by
  asking Verse things, and there are no packs to buy.

What Rally does that those games don't: every card is a real answer you got, so no two players' collections are the same.
What it doesn't have yet: online play between people, deck building limits, card art inside the match, and a ranked ladder.

## The older duel
"duel" and "play cards" still open the Verse Duel (`skills/duel.js`, `lib/duel-rules.js`), the arrow-and-treasury game of skill cards.
Both games stay.

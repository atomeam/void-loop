# Game research: what each game's rules are and what Verse may copy

Part of Verse Studio (`domains/void.game-studio.md`; catalogue `domains/void.game-catalog.md`; law `domains/void.board-game-law.md`). The owner's rule (2026-10-19): **research each game before building it, then build Verse's own version.** One section per game: the rules as found, the legal point that matters, what the build does because of it, the sources. Not legal advice. A point marked *unresolved* was searched and not settled by what was found; it is written so a later search can settle it.

## Null Sweep (the mine-clearing puzzle)

- **Rules found.** A grid hides a fixed number of mines placed at random; a number on an opened cell counts the mines in its eight neighbours; an opened zero opens the connected empty area (flood fill); opening a mine ends the game. Many versions keep the first click safe, and many go further and clear the whole 3x3 around it so the first click is a zero.
- **Build.** Mines are placed from the seed at the start (so two boards from one seed match); the first open moves any bad commit under it or its ring to the first free cell outside it, so the first open is always a clearing. Verse (seat 2) plays the same seed with a logic solver and guesses the safest cell only when logic runs out.
- **Measured.** Verse's plain logic solver (no subset reasoning yet) wins 857 of 1,000 seeded 9x9 boards with 10 bad commits (85.7%): beatable, and the first thing to improve (subset deductions) when the game is hardened.
- **Legal.** The rules are mechanics (free). The only protected thing found is Microsoft's art assets for its own versions; a blog claim about a trademark was unsourced and is not relied on. The generic name is not used as Verse's title anyway. *Unresolved:* the status of "Minesweeper" as a mark. Verse's title is **Null Sweep**, its cells are "bad commits", and none of its art or words come from any version.
- **Sources.** [Minesweeper algorithm explained](https://minesweeper.now/blog/minesweeper-algorithm-explained-how-the-game-generates-fair-boards), [how to play](https://rarepike.com/minesweeper/rules-for-beginners/), [board generation](https://codemia.io/knowledge-hub/path/whats_the_algorithm_behind_minesweeper_generation).

## Merge 2048 (the sliding-tile merge puzzle)

- **Rules found.** Slide numbered tiles on a grid; two equal tiles that meet merge into one of double value; the goal is a 2048 tile. The original was written in JavaScript and CSS in a weekend and released on 2014-03-09 as free, open-source software under the MIT licence; many clones followed.
- **Build.** Verse writes the rules itself (slide, merge once per move, a new tile after each move that changed something, win at the target, lose when no move changes the board). The code is Verse's own, not a copy of any MIT source, so no notice is needed; the name is different.
- **Legal.** MIT covers that project's code and gives no trademark rights; clones are common. A publisher is listed on Wikipedia, so the name "2048" is not used as Verse's title. *Unresolved:* whether "2048" is a registered mark. Verse's title is **Merge Void** and its tiles are Verse's own cards and colours, with a target that is not 2048.
- **Sources.** [2048 (video game)](https://en.wikipedia.org/wiki/2048_(video_game)), [a repository showing the MIT licence](https://github.com/coderps/2048-game), [netzpolitik on the open licence](https://netzpolitik.org/2014/2048-ein-zeitfresser-unter-offener-lizenz/).

## Void Breaker (the bounce-and-clear arcade game)

- **Rules found.** A paddle at the bottom bounces a ball into a wall of bricks at the top; each hit removes a brick; clear them all to win; lose the ball and you lose a life. Atari released it in 1976; the idea was predated by Ramtek's Clean Sweep (1974), and the genre has many clones (block kuzushi in Japan).
- **Build.** Verse's own physics (angle off the paddle by where it hits, speed up as bricks clear), its own brick layouts generated from a seed, and Verse as seat 2 on the same field (a second paddle at the top that returns the ball and scores when you miss).
- **Legal.** *Atari Games Corp. v. Oman* held that the game's audiovisual display is copyrightable, so the **look** is protected and the **idea and mechanics** are not. One source notes it is hard to tell whether a given copy is illegal. So: no Atari palette, brick layout, sounds or "Breakout" name; Verse's palette, shapes and sounds. *Unresolved:* trademark questions and *Tetris Holding v. Xio* were not found by this search (the law doc already discusses it).
- **Sources.** [Breakout (video game)](https://en.wikipedia.org/wiki/Breakout_(video_game)), [the story of Breakout](https://www.denofgeek.com/games/the-story-of-breakout), [Atari Archive](https://www.atariarchive.org/?p=962).

## Dim the Void (the lights-toggling puzzle)

- **Rules found.** A 5x5 grid of lights; pressing one toggles it and its horizontal and vertical neighbours; the goal is to turn all of them off. It was a Tiger electronic product of 1995. Not every pattern can be solved: pressing is linear over GF(2), and for 5x5 the null space has dimension 2, so 2^23 of the 2^25 patterns are solvable, each in four ways.
- **Build.** Boards are made solvable by construction: start with every light off and apply a seeded list of presses, which can always be undone. A hint shows a minimal set of presses by solving the GF(2) system; Verse (seat 2) solves the same board and its press count is the par.
- **Legal.** The mechanics are free; the Tiger name and product design are not Verse's to use. *Unresolved:* the mark's status. Title **Dim the Void**.
- **Sources.** [Solving Lights Out with linear algebra](https://raw.org/research/solving-lightsout-using-linear-algebra/), [Lights Out (cut-the-knot)](https://www.cut-the-knot.org/Curriculum/Games/Merlin5x5.shtml), [GF(2) write-up](https://dev.to/sendotltd/solving-lights-out-with-gf2-linear-algebra-the-whole-puzzle-is-one-matrix-equation-plus-the-1e4b).

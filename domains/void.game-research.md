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
- **Legal.** MIT covers that project's code and gives no trademark rights; clones are common. A publisher is listed on Wikipedia, so the name "2048" is not used as Verse's title. *Unresolved:* whether "2048" is a registered mark. Verse's title is **Merge Verse** and its tiles are Verse's own cards and colours, with a target that is not 2048.
- **Sources.** [2048 (video game)](https://en.wikipedia.org/wiki/2048_(video_game)), [a repository showing the MIT licence](https://github.com/coderps/2048-game), [netzpolitik on the open licence](https://netzpolitik.org/2014/2048-ein-zeitfresser-unter-offener-lizenz/).

## Verse Breaker (the bounce-and-clear arcade game)

- **Rules found.** A paddle at the bottom bounces a ball into a wall of bricks at the top; each hit removes a brick; clear them all to win; lose the ball and you lose a life. Atari released it in 1976; the idea was predated by Ramtek's Clean Sweep (1974), and the genre has many clones (block kuzushi in Japan).
- **Build.** Verse's own physics (angle off the paddle by where it hits, speed up as bricks clear), its own brick layouts generated from a seed, and Verse as seat 2 on the same field (a second paddle at the top that returns the ball and scores when you miss).
- **Legal.** *Atari Games Corp. v. Oman* held that the game's audiovisual display is copyrightable, so the **look** is protected and the **idea and mechanics** are not. One source notes it is hard to tell whether a given copy is illegal. So: no Atari palette, brick layout, sounds or "Breakout" name; Verse's palette, shapes and sounds. *Unresolved:* trademark questions and *Tetris Holding v. Xio* were not found by this search (the law doc already discusses it).
- **Sources.** [Breakout (video game)](https://en.wikipedia.org/wiki/Breakout_(video_game)), [the story of Breakout](https://www.denofgeek.com/games/the-story-of-breakout), [Atari Archive](https://www.atariarchive.org/?p=962).

## Gap Glide (the one-tap flyer)

- **Rules found.** One button. Gravity pulls a figure down, a tap lifts it, and gaps in a scrolling course are the only safe path. Missing a gap or the edge ends the run. The widely known 2013 game of this shape is one tap, one figure, pipes.
- **Build.** Two gliders share one seeded course. Seat 1 taps. Seat 2 (Verse) lifts only after it has fallen past the gap centre, so a careful tap beats it. The first to touch a bar or the edge loses. A link carries the seed and the score.
- **Legal.** The mechanic is free. The 2013 game's name and its art are not used. Verse's title is **Gap Glide**, the working title Void Flap was dropped before shipping because it sat too close to that name, and the bars are plain rectangles in Verse's violet and cyan.
- **Sources.** [Flappy Bird](https://en.wikipedia.org/wiki/Flappy_Bird).

## Cross the Bus (the lane crossing)

- **Rules found.** A figure crosses lanes of moving traffic from one curb to the other. Touching traffic sends it back or ends the run. The 1981 arcade game is the familiar one: hopping, lanes, a far side.
- **Build.** You and Verse start on the same near curb and cross the same seeded lanes. A block sends that rider home. Verse steps forward only when the next cell is clear, and steps aside when it is not. The first to the far curb wins.
- **Legal.** The mechanic is free. The famous name, the animal, and the cabinet art are not used. Title **Cross the Bus**. The movers are plain blocks.
- **Sources.** [Frogger](https://en.wikipedia.org/wiki/Frogger).

## Dim the Verse (the lights-toggling puzzle)

- **Rules found.** A 5x5 grid of lights; pressing one toggles it and its horizontal and vertical neighbours; the goal is to turn all of them off. It was a Tiger electronic product of 1995. Not every pattern can be solved: pressing is linear over GF(2), and for 5x5 the null space has dimension 2, so 2^23 of the 2^25 patterns are solvable, each in four ways.
- **Build.** Boards are made solvable by construction: start with every light off and apply a seeded list of presses, which can always be undone. A hint shows a minimal set of presses by solving the GF(2) system; Verse (seat 2) solves the same board and its press count is the par.
- **Legal.** The mechanics are free; the Tiger name and product design are not Verse's to use. *Unresolved:* the mark's status. Title **Dim the Verse**.
- **Sources.** [Solving Lights Out with linear algebra](https://raw.org/research/solving-lightsout-using-linear-algebra/), [Lights Out (cut-the-knot)](https://www.cut-the-knot.org/Curriculum/Games/Merlin5x5.shtml), [GF(2) write-up](https://dev.to/sendotltd/solving-lights-out-with-gf2-linear-algebra-the-whole-puzzle-is-one-matrix-equation-plus-the-1e4b).

## Debris Field (two ships, square chunks)

- **Rules found.** A ship turns and thrusts, and fires at rocks that split into smaller rocks. Leaving the screen wraps around. Clearing a wave brings another.
- **Build.** Two ships on one seeded field. Chunks are squares that bounce off the edges and never split. You slide and fire from the bottom. Verse slides more slowly along the top. The higher score when a life runs out, or when the round ends, wins.
- **Legal.** The mechanic is free. The 1979 name, the vector look and the spinning ship are not used. Title **Debris Field**.
- **Sources.** [Asteroids (video game)](https://en.wikipedia.org/wiki/Asteroids_(video_game)).

## Null Waves (a block that steps down)

- **Rules found.** Rows of attackers step sideways and down. You move along the bottom and fire up. They fire down. They win if they reach you or if a shot lands.
- **Build.** One short block of plain rectangles. You move and fire. Verse drops a single request toward your column, and a step aside lets it pass. Clear the block before it reaches the floor.
- **Legal.** The mechanic is free. The famous name and the alien art are not used. Title **Null Waves**.
- **Sources.** [Space Invaders](https://en.wikipedia.org/wiki/Space_Invaders).

## Packet Maze (collect, with a second hunter)

- **Rules found.** A maze holds pellets. You collect them. Chasers hunt you. Eating every pellet clears the maze.
- **Build.** A small walled grid and packets. You and Verse both collect. Verse moves on every other step and walks toward the nearest packet. Whoever holds more when the maze is empty wins. There is no chaser that eats you.
- **Legal.** The mechanic is free. The famous name, the character and the maze art are not used. Title **Packet Maze**.
- **Sources.** [Pac-Man](https://en.wikipedia.org/wiki/Pac-Man).

## Jump Stack (a race up ledges)

- **Rules found.** A figure runs and jumps between platforms. Missing a platform is a fall.
- **Build.** Both of you climb the same stack of ledges. A jump from a ledge reaches the next. Verse waits on every ledge, so jumping as you land reaches the top first.
- **Legal.** The mechanic is free. No character, no famous platform name. Title **Jump Stack**.
- **Sources.** [Platformer](https://en.wikipedia.org/wiki/Platformer).

## Stackwell (small falling pieces, two wells)

- **Rules found.** Pieces fall in a well. A row that fills disappears. The well ends when a piece no longer fits. One case held that copying the pieces, the board proportions and the look was not free just because the rules are.
- **Build.** Two wells, the same sequence of pieces. The pieces are a bar of three, a domino, a square and a hook. Not the famous set of seven, and not that board. You aim for open columns. Verse stacks everything on the left.
- **Legal.** *Tetris Holding, LLC v. Xio Interactive, Inc.* The title is **Stackwell**. The working title Block Void was renamed before it shipped, because a ladder title cannot carry that word.
- **Sources.** [Tetris](https://en.wikipedia.org/wiki/Tetris), [Tetris Holding, LLC v. Xio Interactive, Inc.](https://en.wikipedia.org/wiki/Tetris_Holding,_LLC_v._Xio_Interactive,_Inc.).

## Push Packets (one packet, one mark)

- **Rules found.** You push crates onto marks. You cannot pull. A wall or a second crate can jam a crate.
- **Build.** One packet and one mark, three small rooms from the seed. You push. Verse tugs the same pusher left and often jams. The packet on the mark wins.
- **Legal.** The mechanic is free. The warehouse name and the familiar tiles are not used. Title **Push Packets**.
- **Sources.** [Sokoban](https://en.wikipedia.org/wiki/Sokoban).

## Nine Grid (a 4 by 4 number grid)

- **Rules found.** A grid is filled with digits so each row, each column and each box holds each digit once. Some cells start filled.
- **Build.** A 4 by 4 grid in four boxes of 2 by 2. The arrows move a highlight and Act cycles 1 to 4. Verse has already solved the same seed and wins if the grid is still open when the step limit runs out.
- **Legal.** The idea is old and free. The modern puzzle's product name is not used. Title **Nine Grid**. The working title Void Grid was renamed before it shipped.
- **Sources.** [Sudoku](https://en.wikipedia.org/wiki/Sudoku).

## Glyph Verse (six guesses, a short list)

- **Rules found.** Guess a hidden word. Each guess marks a letter that is home, a letter that is elsewhere in the word, and a letter that is absent. A small number of guesses ends the round.
- **Build.** The word comes from a list of sixteen written for Verse. Left and right pick a letter, Act adds it, and the next Act after five letters tries the word. Verse guesses from the same list, one try behind, and only then tries the answer.
- **Legal.** The mechanic is free. The famous five-letter name is not used. Title **Glyph Verse**.
- **Sources.** [Wordle](https://en.wikipedia.org/wiki/Wordle).

## Three Alike (swap, then three of a kind clear)

- **Rules found.** Swap two adjacent pieces. A line of three or more of a kind clears, and pieces above drop.
- **Build.** A 6 by 6 board of four colours. You swap with the arrows. Verse answers with the swap that clears the least. After six of your swaps the higher score wins.
- **Legal.** The mechanic is free. The famous match names and their piece art are not used. Title **Three Alike**. The working title Void Matches was renamed before it shipped.
- **Sources.** [Match-three](https://en.wikipedia.org/wiki/Tile-matching_video_game).

## Token Stand (six days, a price)

- **Rules found.** A small stand sells one thing. You set a price. Buyers come. Money left at the end is the score. Weather and price change how many buy.
- **Build.** Six days. Left and right set a price from 1 to 5, and Act sells the day. Buyers are 8 minus the price, plus a small roll from the seed. Verse sells every day at 1, so a higher honest price earns more. The fuller purse wins.
- **Legal.** The mechanic is free. The famous lemonade name is not used. Title **Token Stand**.
- **Sources.** [Lemonade Stand](https://en.wikipedia.org/wiki/Lemonade_Stand).

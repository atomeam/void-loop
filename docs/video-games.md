# Verse's video games: the easiest-first ladder

The owner, 2026-10-15: Verse wants to conquer video games, easiest first. Each rung is a game Verse can build, play against
you and explain its moves in, on the site, with no install. Rules and mechanics are free to use; names, art, sound and
code are Verse's own (see `domains/void.board-game-law.md`: mechanics are free, expression and marks are not). Every
card says "plays like the classic" and never uses the original's name or look as its own.

Each rung ships with: a pure rules file (`skills/<game>-rules.js`, no DOM), a card, routing from the plain name
("pong" opens Verse Pong), Verse as the opponent with a reason for what it does, and a node test in `tools/checks.mjs`.

| # | Plays like | Verse parody name | Why this rung | Verse as opponent | Status |
|---|---|---|---|---|---|
| 1 | Pong (1972) | **Verse Pong** | one ball, two paddles | predicts the ball through wall bounces, capped speed, aim error that grows with the rally | **shipped** (`skills/pong.js`) |
| 2 | Snake / Blockade (1976) | **Verse Snake** | grid, one rule: don't crash | breadth-first to the orb, flood-fill to keep room to move | **shipped** (`skills/snake.js`) |
| 3 | Breakout (1976) | **Verse Breaker** | Pong plus bricks | Verse plays a ghost paddle on a race board, score vs score | next |
| 4 | Tetris (1984; mechanics only, no trade dress) | **Voidfall** | falling blocks | Verse drops on its own well beside yours, placement by holes and height | next |
| 5 | Space Invaders (1978) | **UFO Invasion** | the owner's UFOs | Verse commands the saucers, picks who to shoot at | queued |
| 6 | Asteroids (1979) | **Rock Field** | vector ship, explosions | Verse flies a rival ship | queued |
| 7 | Frogger (1981) | **Crossing the Verse** | lanes and timing | Verse sets the traffic | queued |
| 8 | Pac-Man (1980) | **Verse Muncher** | maze plus four chasers with personalities | Verse runs the ghosts, each says its plan | queued |
| 9 | Minesweeper | **Verse Sweeper** | logic | Verse gives hints with the reason | queued |
| 10 | 2048 | **Verse 2048** | merges | Verse's best next swipe | queued |
| 11 | Flappy-style | **Flap the Verse** | one button | Verse racing ghost | queued |
| 12 | Doom-style raycaster | **Verse 3D** | first 3D rung, uses scene3d | Verse enemies with simple plans | later |
| 13 | Kart racer | **Verse Kart** | 3D, physics | Verse drivers | later |

## Rules for every rung

- Original name, art and sound; "plays like" in the subtitle is fine, a famous logo or character is not.
- Verse is beatable: each opponent has a test that a decent player can score on it.
- Every game loop stops when its card leaves the page or the tab is hidden.
- Keyboard and touch both work; the game waits for your first move where an instant start would end it.
- Test traffic never trains Verse (lib/noise.js); visitors' exact words never land in the repo.

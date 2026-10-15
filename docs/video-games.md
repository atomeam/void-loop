# V01D's video games: the easiest-first ladder

The owner, 2026-10-15: V01D wants to conquer video games, easiest first. Each rung is a game V01D can build, play against
you and explain its moves in, on the site, with no install. Rules and mechanics are free to use; names, art, sound and
code are V01D's own (see `domains/void.board-game-law.md`: mechanics are free, expression and marks are not). Every
card says "plays like the classic" and never uses the original's name or look as its own.

Each rung ships with: a pure rules file (`skills/<game>-rules.js`, no DOM), a card, routing from the plain name
("pong" opens Void Pong), V01D as the opponent with a reason for what it does, and a node test in `tools/checks.mjs`.

| # | Plays like | V01D parody name | Why this rung | V01D as opponent | Status |
|---|---|---|---|---|---|
| 1 | Pong (1972) | **Void Pong** | one ball, two paddles | predicts the ball through wall bounces, capped speed, aim error that grows with the rally | **shipped** (`skills/pong.js`) |
| 2 | Snake / Blockade (1976) | **Void Snake** | grid, one rule: don't crash | breadth-first to the orb, flood-fill to keep room to move | **shipped** (`skills/snake.js`) |
| 3 | Breakout (1976) | **Void Breaker** | Pong plus bricks | V01D plays a ghost paddle on a race board, score vs score | next |
| 4 | Tetris (1984; mechanics only, no trade dress) | **Voidfall** | falling blocks | V01D drops on its own well beside yours, placement by holes and height | next |
| 5 | Space Invaders (1978) | **UFO Invasion** | the owner's UFOs | V01D commands the saucers, picks who to shoot at | queued |
| 6 | Asteroids (1979) | **Rock Field** | vector ship, explosions | V01D flies a rival ship | queued |
| 7 | Frogger (1981) | **Crossing the Void** | lanes and timing | V01D sets the traffic | queued |
| 8 | Pac-Man (1980) | **Void Muncher** | maze plus four chasers with personalities | V01D runs the ghosts, each says its plan | queued |
| 9 | Minesweeper | **Void Sweeper** | logic | V01D gives hints with the reason | queued |
| 10 | 2048 | **Void 2048** | merges | V01D's best next swipe | queued |
| 11 | Flappy-style | **Flap the Void** | one button | V01D racing ghost | queued |
| 12 | Doom-style raycaster | **V01D 3D** | first 3D rung, uses scene3d | V01D enemies with simple plans | later |
| 13 | Kart racer | **Void Kart** | 3D, physics | V01D drivers | later |

## Rules for every rung

- Original name, art and sound; "plays like" in the subtitle is fine, a famous logo or character is not.
- V01D is beatable: each opponent has a test that a decent player can score on it.
- Every game loop stops when its card leaves the page or the tab is hidden.
- Keyboard and touch both work; the game waits for your first move where an instant start would end it.
- Test traffic never trains V01D (lib/noise.js); visitors' exact words never land in the repo.

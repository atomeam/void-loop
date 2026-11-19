# Game updates

The book is `data/game-updates.json` (Debris Field and Gap Glide Update 1 are already there). `nextTask` names the next round. A cycle ends when every round has an update; the next lap is one new original game (`bornFrom`). It stays hidden until its fun is at least Debris Field's.

`node --test tools/game-updates.test.mjs` passes both of those. The Verse loop's own hourly run (`verse-loop.yml`, and a queue job that reaches the same lap) plays one round for 75 seconds when the last update is an hour old. The video and screenshots are the `game-play` artifact on that run. A model scores the pictures. No score, or a lower score, does not ship. The first lap that finds Debris Field with no fun plays it once and stores that fun as the public bar; a hidden game already at or above it is listed. The coder prompt names the lowest of danger, goal, boss, juice, controls, and the end screen from the last review. Set `GAME_UPDATES=0` to leave that run on the ordinary queue.

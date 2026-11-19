# Game updates

The book is `data/game-updates.json` (Debris Field and Gap Glide Update 1 are already there). `nextTask` names the next round. A cycle ends when every round has an update; the next lap is one new original game (`bornFrom`). It stays hidden until its fun is at least Debris Field's.

`node --test tools/game-updates.test.mjs` passes both of those. The Verse loop's own hourly run (`verse-loop.yml`, started by its schedule and by the conductor) plays one round when the last update is an hour old (`gameDueNow`). It plays, scores, and ships through the same automerge path. Set `GAME_UPDATES=0` to leave that run on the ordinary queue.

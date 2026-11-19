# Game updates

The book is `data/game-updates.json` (Debris Field and Gap Glide Update 1 are already there). `nextTask` names the next round. A cycle ends when every round has an update; the next lap is one new original game (`bornFrom`). It stays hidden until its fun is at least Debris Field's.

`node --test tools/game-updates.test.mjs` passes both of those. The lap that plays and ships is the next pull request.

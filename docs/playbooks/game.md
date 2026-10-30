# Playbook: a game that feels good to play

From a video the owner shared by Duncan Rogoff ("I Turned Claude Code Into a Game Studio", 2026-10-17): five moves that take a game from
flat coloured shapes to something people want to play. Where Verse already does a move, the file that does it is named; the rest is the
loop a builder (or Verse, frontier #5) follows for any game on the rack (`skills/rack.js`, `docs/miniatures.md`).

## What starts it
An ask for a new game, or a game on the rack that the Site Test or a correction says feels wrong ("too hard", "can't tell what to do").

## The moves
1. **The kit.** Start from what exists: `lib/stage-pack.js` for the card, `skills/scene3d.js` for 3D, `lib/motion-throttle.js` so chaos
   calms while someone types, the shared `.vc-working` shimmer for a thinking line. A game is a skill with `stageKinds`; it saves its state
   on the thing so a reload resumes it (`docs/playbooks/stage-pack.md`).
2. **The brief names three things:** the idea, the vibe as things you would see ("neon rings, a purple and teal nebula, a giant ringed
   planet", never "make it look cool"), and 2D or 3D. Put all three in the PR's brief. A vibe with no nouns is the first thing to fix.
3. **Polish what people notice first, then ask for juice by name.** Juice is every small reaction that makes a game feel alive
   (Vlambeer's "The Art of Screenshake", 2013, is the source most games copy): a camera kick on a boost, light streaks at speed, screen
   shake on a hit, sparks on an explosion, a sound for every action (a lib/sound.js if the stage has one; otherwise a short synthesized
   tone, never a fetched file). Each is one line in the brief and one check in the browser section.
4. **QA before handing over.** The browser suite already counts a page error as broken (`tools/test_void.mjs`, `errors` from `pageerror`,
   "body: no page errors"), and the Site Test measures load and fps on main (`fps 2 < 5` opened an issue the same day). Add the move
   that is not automated yet: after every round of changes, take a screenshot of the game (`VOID_SHOTS=<dir>` on your section, or a
   scratch Playwright script), look at it, and fix the weakest thing you see. Six rounds in an hour is the pace the video shows.
   Stop when a round finds nothing you would change.
5. **Playtest in plain words.** Play it the way a person will (`node tools/ask.mjs` does not play; a browser section that presses the keys
   does). Write what felt wrong in plain words in the PR's Evolve section, one or two changes at a time ("dodging and chasing at once is
   confusing: rings, then a battle, then rings"). The owner's "Correct me" on the self card and the spectators' reactions are the same
   signal from visitors; read them before the next round.

## How to tell it worked
- The brief has the three things and a juice list; the browser section checks each named reaction (a class toggled on hit, a particle
  count after an explosion, a sound node created on an action) and `!errors.length`.
- The screenshot round log is in the PR (round, what was weakest, what changed), and the last round changed nothing.
- The Site Test's fps and load for the game's ask stay inside their budgets after the deploy.

## Mistakes made
- A vibe without nouns ("fun, fast") produced flat shapes; the fix was naming objects, not a longer prompt.
- Dodging and collecting in the same phase felt bad; phases fixed it, not tuning.
- Juice added everywhere at once hid the real problem; one reaction per round, checked in a screenshot, kept the game readable.

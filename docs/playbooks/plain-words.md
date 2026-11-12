# Plain words on a pull request

`tools/plain-phrases.txt` lists each banned phrase and its plain replacement. Verse review runs `tools/plain-words.mjs` when a pull request opens, is edited, or is pushed. The title and body are rewritten. Added page copy (`skills/*.js` strings, `domains/growth-inbox.md` rows) is one commit on a `helper/*` branch when the rewrite is safe, and a review finding otherwise. Rows already on main are not rewritten. Pull requests 2667 and 2668 are left alone.

`node tools/plain-words.mjs --dry --title "We own the heavy lifting"` prints the rewritten title. `node --test tools/plain-words.test.mjs` checks the rewrite and the block.

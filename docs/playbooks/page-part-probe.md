# A floor's aspect that needs a page of its own (the gate's pageParts)

**What starts it:** an aspect of a tower floor that a word on the page cannot prove: "image generation" was passed by a "Picture it" button (owner, 2026-10-25: "how do we beat perchance if we dont have images?"). The gate must see the thing itself.

**The commands:**
1. Build the thing at an address that does it from its link alone (`/image/?prompt=...&seed=7&go=1`, `/generators/make/#g=p.<base64url>`).
2. In `tools/tower-probes.mjs`, give the probe `pageParts: { '<aspect>': { verse: '<url>', items: [[label, RegExp or (text) => bool]] } }` for text read off that page once it settles, or `{ verse, img: true, within: 60000 }` for a picture the page made (`pictureOf` in `tools/tower-gate.mjs`: an `<img>` with a data:, blob: or r2 source that loaded). Take the aspect out of `askParts`/`PARTS` and add it to the floor's `extra` in `lib/tower.js`.
3. Pick probe answers only a working engine gives (the list probe: "Cat" has odds ^0, so any "Cat" line fails; five lines of the exact shape need nested lists, titleCase, a choice and a kept value).
4. `node --test tools/tower-gate.test.mjs tools/tower.test.mjs tools/floor-kit.test.mjs`, and a play-through on a local server with the real route code and a stub (`tools/generators-e2e.mjs` is the pattern).

**How to tell it worked:** the gate test's local pages: a made picture counts, a button or a "resting" message does not; the evidence row quotes the page's status line when it fails.

**Mistakes made:** the stand-in server built `Request` URLs without the port, so same-origin POSTs were refused (use the Host header); the per-minute limit from earlier steps of a play-through made a later check read "one moment" (reset the guard between steps); the first failure evidence quoted the page's top text, not its status line.

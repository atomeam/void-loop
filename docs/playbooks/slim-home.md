# Slim the home page

**Starts when:** the home page's download is the slow part. `void.html` is the one file editors change. Most of its bytes are the style block and the main script.

**What the deploy does.** `tools/public-quotes.mjs` (already the last rewrite of the served tree) calls `splitServedHome`. That rewrites `void-live-deploy/index.html` and `void-live-deploy/void.html` only, in the deploy workspace, and writes:

- `/void-home.css` — the style block, linked from the head (the first paint waits for it, so nothing flashes unstyled)
- `/void-boot.js` — the main script, preloaded from the head and run at the same point in the page as the inline script it replaces
- `/void-sky.js`, `/void-presence.js`, `/void-synapses.js` — the decorative scripts, `defer`, so they do not hold up the first paint

The repo's `void.html` is not rewritten. A check that the two committed copies match still passes.

**Why the main script is one file.** Its parts share one scope (`const` and `let` are not visible to the next classic script). Splitting those parts would change when they run. The three decorative scripts were already separate script tags, so they can load on their own.

**How to tell it worked.** `node --test tools/split-void-page.test.mjs`. The real page's HTML after a split is under a third of the bytes it started at, and `node --check` accepts each script.

**Do not** run `node tools/split-void-page.mjs` and commit the result. The next edit belongs in `void.html`.

# The Verse shell

**Starts when:** a page people open from the home stage (Team, Bots, Agents, Tower, Films, Treasury) should feel like the same app, or the home chrome (the live line, the command palette, the background wash) needs a change.

**The one file for colour and type** is `void-live-deploy/verse.css`. The home page also keeps the same values inline in `void.html` so the void can paint before that file arrives. Do not invent a second palette.

**How a page gets it.** `sw.js` `dress` (the same edit as `dressHtml` in `lib/verse-shell.js`) adds `verse.css` and `verse-shell.js` on the way to the browser for `/`, `/team/`, `/bots/`, `/agent/`, `/conquered/`, `/films/` and `/treasury/`. The home page also gets `verse-field.js`. A page that already has the script is left alone, so a later edit of the HTML does not double it. `/tower` redirects to `/conquered/`. The nav is built by `verse-shell.js` when the page has none.

**Commands.** Ctrl+K or ⌘K opens the palette, except on `/team/`, which already uses that chord to jump channels. The button labelled ⌘K opens it everywhere.

**Motion.** Same-origin view transitions are on in `verse.css`. A scroll-driven settle runs on pages that scroll. The WebGL wash starts after load, skips reduced motion and data saver, and removes itself if WebGL will not start. The CSS horizon stays.

**How to tell it worked.** `node --test tools/verse-shell.test.mjs`. On the home page the ask bar still says Ask anything, the stage under it is empty until someone asks, and the top line names bots and tower wins only after `/api/crew` and `/self.json` answer.

**Mistakes.** Do not put suggestion text back on the empty stage. Do not draw a grid floor. Do not fetch `tower.evidence.json` for the one-line count: `self.json` already has `tower.beaten`.

# Slim the home page

**Starts when:** the first paint waits on the home page's download. Editors change `void.html`. The deploy pulls the heavy parts out of the served copies.

**What the visitor gets.** A small HTML file. The empty home is the dark void and the ask bar, with their style in `#verse-critical`, so the largest paint is HTML and CSS alone. No wordmark, tagline, heading or store line is in that paint, including on `?intro=1`. `?q=` still opens the ask. The rest of the style is `/void-home.css`, loaded without blocking. On a desktop, `/void-boot.js` is added on the frame after that paint, and the sky, the presence rim, the synapse canvas, the command palette and the WebGL wash are fetched after the largest paint, or after four seconds. On a phone, that engine and those decor scripts wait for a tap, a key, or twelve seconds, the same wait as the skill modules. Enter or the send key still starts the engine at once, and an ask typed before it has run is kept and asked when it has.

The ask bar uses the system font. Caveat is the handwriting on a note and is fetched when a note is shown. It is not preloaded, and there is no third-party font host to preconnect: a font preload would compete with the first paint.

**The card stylesheet waits.** `/* home cards:` through `/* home stage:` is `/void-cards.css`. The page asks for it with the first ask (a key, a tap on the bar, or `?q=`), not on focus. The empty stage does not download it, and it does not download the card frame or its stat files until then. On a phone the brain and the WebGL wash wait for a tap or twelve seconds. A desktop may still idle the brain. An editor's full `void.html` already has the card rules inline, so the same page does not ask for the file twice.

**Why the ask engine is one file.** Its parts share `const` and `let`, so splitting it into classic scripts would change when they run. The feature split is the sky, the presence rim, the synapses, the shell and the field. Skill files start on a key or a tap. A phone does not fetch them on idle (that long task is the mobile score). A desktop may idle sooner. A link that already carries an ask (`?q=` or `?ask=`) starts them at once.

**How to tell it worked.** `node --test tools/split-void-page.test.mjs`. Do not commit the split files. The next edit belongs in `void.html`.

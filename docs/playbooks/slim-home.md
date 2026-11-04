# Slim the home page

**Starts when:** the first paint waits on the home page's download. Editors change `void.html`. The deploy pulls the heavy parts out of the served copies.

**What the visitor gets.** A small HTML file. The hero and the ask bar are in that HTML, with their style in `#verse-critical`, so the largest paint is HTML and CSS alone. The rest of the style is `/void-home.css`, loaded without blocking. `/void-boot.js` is added on the frame after that paint. The sky, the presence rim, the synapse canvas, the command palette and the WebGL wash are fetched after the largest paint, or after four seconds.

The hero uses the system font. Caveat is the handwriting on a note and is fetched when a note is shown. It is not preloaded, and there is no third-party font host to preconnect: a font preload would compete with the hero.

**Why the ask engine is one file.** Its parts share `const` and `let`, so splitting it into classic scripts would change when they run. The feature split is the sky, the presence rim, the synapses, the shell and the field. Skill files start on a key or a tap. A phone does not fetch them on idle (that long task is the mobile score). A desktop may idle sooner. A link that already carries an ask (`?q=` or `?ask=`) starts them at once.

**How to tell it worked.** `node --test tools/split-void-page.test.mjs`. Do not commit the split files. The next edit belongs in `void.html`.

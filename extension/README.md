# Void extension (Chrome / Edge)

Void in the browser's side panel. It can read the tab you point it at and draft into that page.
- toolbar icon: opens Void in the side panel
- **Alt+Shift+V** on any page, or right-click "Void: read this tab": opens the panel and reads that tab into a card: its title, address, the text you selected, and the box you were typing in (B1)
- the card's "put in the page", and "into the page" under an answer: types the text into the box you were in, the way typing would. It never presses send, submits a form or clicks anything; you do that yourself (B2)
- type `void` then a space in the address bar, then any ask: opens a-to-mind.com with that ask

**Page text stays in this browser.** The card lives in memory only. It is never saved with the stage (which syncs to `/api/mine` when you're signed in), and no ask, log or lookup carries it. Close the panel and it is gone.

**Reach.** Only `activeTab` and `scripting`: the extension gets into a tab only when you press the shortcut or use the menu there, only that tab, and only until it navigates. There is no access to every site. Acting on pages (clicking, multi-step) is B3, which waits for a per-site allow list and a yes before every change.

**Who talks to whom.** The panel (`sidepanel.js`) is the only door between Void and the extension. It takes messages only from the Void frame at https://a-to-mind.com. Void (`void.html`) takes them only from this extension's id, `dcjdpaeachfmfndklkiglgebfflamhkg`, which the `key` in `manifest.json` pins. The private half of that key was not kept: it's only needed to pack a .crx for the Web Store, and Void stays off the store.

Install: `chrome://extensions` (or `edge://extensions`), switch on Developer mode, "Load unpacked", pick this folder (or unzip `void-extension.zip` first). An install from before 0.2.0 had a different id: remove it and load this one. Change the shortcut at `chrome://extensions/shortcuts`.

The panel frames https://a-to-mind.com. That only works because `void-live-deploy/_headers` allows `frame-ancestors chrome-extension:`; with the old `X-Frame-Options: DENY` the panel is blank.
Not listed on the Chrome Web Store, and it stays that way (Atom, 2026-09-28; Adam, 2026-10-09).
Tested by `node tools/test_extension.mjs`.

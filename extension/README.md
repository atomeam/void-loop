# Void extension (Chrome / Edge)

Void in the browser's side panel. It works with the page you are on in two ways, and each one says which it is.

**In your browser only (B1, B2).** Nothing leaves the browser.
- **Alt+Shift+V** on any page, or right-click "Void: read this tab (stays in your browser)": opens the panel and reads that tab into a card: its title, address, the text you selected, and the box you were typing in.
- The card's "put in the page", and "into the page" under an answer, type the text into the box you were in, the way typing would. It never presses send, submits a form or clicks anything; you do that yourself.
- The card lives in memory only. It is never saved with the stage (which syncs to `/api/mine` when you're signed in), and no ask, log or lookup carries it. Close the panel and it is gone.

**Sent to Void for one answer.** The menu items say "(sends it to Void)".
- Right-click on a page, "Ask Void about this page": Void answers about the page you are on.
- Right-click in a text field (a Gmail draft, a doc, a comment box), "Help me with this draft": Void rewrites it, ready to paste.
- These read the title, the address, your selection, the text field you are in and up to 8,000 characters of visible text, and send them to Void's answer engine (`/api/answer`, field `page`), never in the address bar.
- Secrets in the page (keys, tokens, passwords in links) are masked before the model sees them, and nothing about the page is stored. Password fields are never read.
- The answer card says "this page was sent to a-to-mind.com for this answer".
- On the tab card (after Alt+Shift+V), "draft for me: reply · summary · notes · rewrite (sends it to Void)": the title, address and selected text go to Void's answer engine once (`/api/answer`, `mode: 'draft'`, `void-live-deploy/lib/draft.js`; the address kept to host and path, keys masked, nothing stored), and the draft comes back into the card's box, ready for "put in the page" or copy. Whatever is in the box goes along as a note to Void. The card then says what was sent and for what. With no model, a plain rules draft comes back instead of nothing.

**Acts for you (B3).** One step at a time, on a site you allowed, after your yes.
- In the tab card, write a step for Void: "fill Reply with Thanks, see you Friday" or "click Save". Void proposes it; it does nothing itself.
- The panel (the extension, not the page in its frame) shows the step as a card: the site, the field or button by its visible label, and the text. Nothing happens until you press Yes there.
- It acts only on a site on your list, "sites Void may act on" at the bottom of the panel. The list is empty until you add a site, lives in the extension's own storage, and only you edit it there; the page in the frame can't. A site not on the list gets no card at all.
- A step never submits a form or presses Enter. A field is filled the way typing would fill it; a button that would send its form is refused, and you press it yourself. Two things with the same label is a refusal too.
- Every step leaves an execution record (`/api/actions`, kind `extension.act`, ref "site · label"), written as running before the step and ended done or failed after; a No is recorded as stubbed. The owner sees them in Void's actions card ("my actions"). Without the owner's key there is no record, so there is no action.

Chrome's own pages, the Web Store and some PDFs can't be read; Void says so. The old "Ask Void about '…'" menu, which sent the selection as an ask, is gone (Adam, 2026-10-09).

**Reach.** Only `activeTab` and `scripting`: the extension gets into a tab only when you press the shortcut or use a menu there, only that tab, and only until it navigates. There is no access to every site. Acting on pages is B3 (above): one step at a time, a per-site allow list, and a yes before every change. Multi-step runs are not built.

**Who talks to whom.** The panel (`sidepanel.js`) is the only door between Void and the extension. It takes messages only from the Void frame at https://a-to-mind.com. Void (`void.html`) takes them only from this extension's id, `dcjdpaeachfmfndklkiglgebfflamhkg`, which the `key` in `manifest.json` pins. The private half of that key was not kept: it's only needed to pack a .crx for the Web Store, and Void stays off the store.

Also: the toolbar icon opens Void in the side panel, and typing `void`, a space, then any ask in the address bar opens a-to-mind.com with that ask.

Install: `chrome://extensions` (or `edge://extensions`), switch on Developer mode, "Load unpacked", pick this folder (or unzip `void-extension.zip` first). An install from before 0.3.0 had a different id: remove it and load this one. Change the shortcut at `chrome://extensions/shortcuts`.

The panel frames https://a-to-mind.com. That only works because `void-live-deploy/_headers` allows `frame-ancestors chrome-extension:`; with the old `X-Frame-Options: DENY` the panel is blank.
Not listed on the Chrome Web Store, and it stays that way (Atom, 2026-09-28; Adam, 2026-10-09).
Tested by `node tools/test_extension.mjs`.

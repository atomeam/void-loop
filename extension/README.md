# Void extension (Chrome / Edge)

Void in the browser's side panel, plus two shortcuts:
- toolbar icon: opens Void in the side panel
- select text, right-click, "Ask Void about …": opens the panel and asks Void about it
- type `void` then a space in the address bar, then any ask: opens a-to-mind.com with that ask
- right-click anywhere on a page, "Ask Void about this page": Void answers about the page you are on
- right-click in a text field (a Gmail draft, a doc, a comment box), "Help me with this draft": Void rewrites it, ready to paste

Reading a page: the extension asks for `activeTab` and `scripting`, not access to every site. Chrome only lets it read the tab you
right-clicked, at that moment. It reads the title, the address, your selection, the text field you are in and up to 8,000
characters of visible text, and sends them to Void's answer engine (`/api/answer`, field `page`), never in the address bar.
Secrets in the page (keys, tokens, passwords in links) are masked before the model sees them, and nothing about the page is
stored. Chrome's own pages, the Web Store and some PDFs can't be read; Void says so. Password fields are never read.

Install: `chrome://extensions` (or `edge://extensions`), switch on Developer mode, "Load unpacked", pick this folder (or unzip `void-extension.zip` first).

The panel frames https://a-to-mind.com. That only works because `void-live-deploy/_headers` allows `frame-ancestors chrome-extension:`; with the old `X-Frame-Options: DENY` the panel is blank.
Not listed on the Chrome Web Store (Atom, 2026-09-28).

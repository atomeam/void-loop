# Void extension (Chrome / Edge)

Void in the browser's side panel, plus two shortcuts:
- toolbar icon: opens Void in the side panel
- select text, right-click, "Ask Void about …": opens the panel and asks Void about it
- type `void` then a space in the address bar, then any ask: opens a-to-mind.com with that ask

Install: `chrome://extensions` (or `edge://extensions`), switch on Developer mode, "Load unpacked", pick this folder (or unzip `void-extension.zip` first).

The panel frames https://a-to-mind.com. That only works because `void-live-deploy/_headers` allows `frame-ancestors chrome-extension:`; with the old `X-Frame-Options: DENY` the panel is blank.
Not listed on the Chrome Web Store (Atom, 2026-09-28).

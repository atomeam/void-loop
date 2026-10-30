# imtranslator.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: imtranslator.net (https://imtranslator.net/)
- Verse: /translate/?q=hello&to=es (translate: imtranslator.net, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "ImTranslator  / Translation, Dictionary, TTS"
- History: [docs/HISTORY/imtranslator.net.md](../HISTORY/imtranslator.net.md)

**Match: 52%**: 13 have, 1 partial, 0 missing, 12 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "ImTranslator / Translation, Dictionary, TTS ImTranslator RSS Feed ImTranslator Atom Feed ImTranslator &raquo;" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "i(Microsoft). Improved Chinese language detection algorithm. Added the list of Favorite languages. Added the l" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "ds, phrases and texts between more than 150 languages and displays the translations side-by-side. The translat" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Recently used languages | Translate | have | its live page (2026-10-28): "for Opera New version Add to Opera Most Recent Articles ImTranslator Extension for Chrome Improved the Webpage" | void-live-deploy/translate/index.html:109 `ow" hidden><span id="recentL">Recent languages:</span> <span class="chips" id="recentLangs` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "Text-to-Speech Online and Translate and Speak Text-to-Speech Online Translation in Your Language ImTranslator" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "ard Text-to-Speech (TTS) Online Text to Voice Back Translation Online Back Translation Add-ons ImTranslator fo" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "tor for Opera New version Add to Opera &copy;2026 Smart Link Corporation Smart Link Corporation / All rights r" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "ImTranslator / Translation, Dictionary, TTS ImTranslator RSS Feed ImTranslator Atom Feed ImTranslator &raquo;" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Saved translations (phrasebook) | History | have | its live page (2026-10-28): "detection algorithm. Added the list of Favorite languages. Added the list of Favorite languages. Added the po" | void-live-deploy/translate/index.html:140 `"save" title="Keep it in your saved phrases">Save</button>` |
| An on-screen keyboard for other scripts | Input | have | its live page (2026-10-28): "slation, Text-to Speech Online, Virtual Keyboard Technology Translator in your language Translator الترجمة عبر" | void-live-deploy/translate/index.html:123 `<button type="button" id="kbdB" aria-expanded="false" aria-controls="kbd" title="A` |
| A browser extension | Apps | partial | its live page (2026-10-28): "men Türkçe Перекладач онлайн Українська Extensions for major browsers (Chrome, Edge, Firefox, Opera, Yandex) I" | void-live-deploy/translate/index.html:182 `<p class="hint">Drag this bookmarklet to your bookmarks bar. On any page, click it: yo` |
| Dark mode | Settings | have | its live page (2026-10-28): "of Pop-up Bubble floating button.Added Dark Mode Theme for ImTranslator, Pop-up Bubble and Options. Added Mic" | void-live-deploy/vendor/pdfjs-6.4.299/build/pdf.min.js:25 `ode",!!window?.matchMedia?.("(prefers-color-scheme: dark)").matches)}}class CSSConstants{s` |
| A public API | Developers | have | its live page (2026-10-28): "ed in 1993, Smart Link Corporation is a developer and publisher of multilingual software products and web-base" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| Pages Navigation Menu | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Technology | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Čeština | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Dansk | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Nederlands | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italiano | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Lietuvių | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Polski | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Português | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Română | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

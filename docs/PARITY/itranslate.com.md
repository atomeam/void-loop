# itranslate.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: itranslate.com (https://itranslate.com/translate)
- Verse: /translate/?q=hello&to=es (translate: itranslate.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate"
- History: [docs/HISTORY/itranslate.com.md](../HISTORY/itranslate.com.md)

**Match: 60%**: 12 have, 1 partial, 0 missing, 8 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate iTranslate iTranslate Features Text Translation Voice Translation Camera Translation Offline Transl" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | studied by hand: itranslate.com offers this (https://itranslate.com/translate) | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "te iTranslate Features Text Translation Voice Translation Camera Translation Offline Translation Keyboard Exte" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "e Online Translator Supported Languages Dictionary Learning Language Learning Blog Company Support Converse Li" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "ures Text Translation Voice Translation Camera Translation Offline Translation Keyboard Extension Translate On" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| An on-screen keyboard for other scripts | Input | have | its live page (2026-10-28): "Camera Translation Offline Translation Keyboard Extension Translate Online Translator Supported Languages Dic" | void-live-deploy/translate/index.html:123 `<button type="button" id="kbdB" aria-expanded="false" aria-controls="kbd" title="A` |
| Two-way conversation mode | Speech | have | studied by hand: itranslate.com offers this (https://itranslate.com/translate) | void-live-deploy/translate/index.html:174 `d="convD"><summary id="convS">Conversation</summary>` |
| A browser extension | Apps | partial | its live page (2026-10-28): "ranslation Offline Translation Keyboard Extension Translate Online Translator Supported Languages Dictionary L" | void-live-deploy/translate/index.html:182 `<p class="hint">Drag this bookmarklet to your bookmarks bar. On any page, click it: yo` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "erty of their respective owners. Apple, App Store, the App Store logo, and iPhone are trademarks of Apple, Inc" | void-live-deploy/translate/index.html:679 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Works offline | Apps | have | its live page (2026-10-28): "on Voice Translation Camera Translation Offline Translation Keyboard Extension Translate Online Translator Sup" | void-live-deploy/translate/index.html:99 `read a photo, see them again offline.</p>` |
| Supported Languages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Language Learning | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Converse | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Lingo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Typeright | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Law Enforcement | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FAQs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Contact our Support | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

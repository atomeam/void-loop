# papago.naver.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: papago.naver.com (https://papago.naver.com/)
- Verse: /translate/?q=hello&to=es (translate: papago.naver.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Papago"
- History: [docs/HISTORY/papago.naver.com.md](../HISTORY/papago.naver.com.md)

**Match: 68%**: 17 have, 0 partial, 0 missing, 8 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "ficial Blog Shortcut Keys Enter text to translate Alt + Enter Clear all input text Ctrl + Alt + E Swap Languag" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | its live page (2026-10-28): "ter Clear all input text Ctrl + Alt + E Swap Language Ctrl + Alt + S Select target language Ctrl + Alt + O Sel" | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | studied by hand: papago.naver.com offers this (https://papago.naver.com/) | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "apago Plus 메뉴 열기 메뉴 Text Image Document Voice Website Plus-only feature Terms of Service Privacy Policy Discla" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "6-GyeonggiSeongnam-0692 This content is copyrighted by the copyright holder or provider. Any unauthorized use" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "Papago Papago PAPAGO Dictionary PAPAGO PLUS PAPAGO PLUS About Papago Plus 메뉴 열기 메뉴 Text Image Document Voice" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "S About Papago Plus 메뉴 열기 메뉴 Text Image Document Voice Website Plus-only feature Terms of Service Privacy Poli" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | its live page (2026-10-28): "Plus 메뉴 열기 메뉴 Text Image Document Voice Website Plus-only feature Terms of Service Privacy Policy Disclaimer &" | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "GO PLUS About Papago Plus 메뉴 열기 메뉴 Text Image Document Voice Website Plus-only feature Terms of Service Privac" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| Translation history | History | have | its live page (2026-10-28): "applicable laws. ⓒ NAVER corp. English History Favorites Glossary Settings Swap Language Type the text to tra" | void-live-deploy/translate/index.html:189 `<h2 id="histH">History</h2>` |
| Saved translations (phrasebook) | History | have | its live page (2026-10-28): "ble laws. ⓒ NAVER corp. English History Favorites Glossary Settings Swap Language Type the text to translate T" | void-live-deploy/translate/index.html:140 `"save" title="Keep it in your saved phrases">Save</button>` |
| A glossary of fixed terms | Translate | have | its live page (2026-10-28): "ⓒ NAVER corp. English History Favorites Glossary Settings Swap Language Type the text to translate Type the te" | void-live-deploy/translate/index.html:169 `"glossD"><summary id="glossS">Glossary</summary>` |
| Rate or correct a translation | Quality | have | its live page (2026-10-28): "claimer & Legal Notice Help Center Send Feedback Compliance Consent to improving quality Official Blog Shortcu" | void-live-deploy/translate/index.html:143 `<button type="button" id="fbB" aria-expanded="false" aria-controls="fb" title="Sug` |
| Two-way conversation mode | Speech | have | studied by hand: papago.naver.com offers this (https://papago.naver.com/) | void-live-deploy/translate/index.html:174 `d="convD"><summary id="convS">Conversation</summary>` |
| The site in other languages | Settings | have | its live page (2026-10-28): "e Ctrl + Alt + I Confirm language Enter Choose language ← / → / ↑ / ↓ Close language window Esc / Backspace Pa" | void-live-deploy/translate/index.html:206 `const W = L.wordsFor(navigator.language);` |
| A public API | Developers | have | its live page (2026-10-28): "uage window Esc / Backspace Partnership/API usage inquiries Business Registration No : 220-81-62517 Online Mar" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| PAPAGO | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PAPAGO PLUS | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Disclaimer & Legal Notice | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Help Center | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Compliance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Consent to improving quality | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Official Blog | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ⓒ NAVER corp. | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

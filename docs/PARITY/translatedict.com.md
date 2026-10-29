# translatedict.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: translatedict.com (https://www.translatedict.com/)
- Verse: /translate/?q=hello&to=es (translate: translatedict.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate to English / Free Online Translator"
- History: [docs/HISTORY/translatedict.com.md](../HISTORY/translatedict.com.md)

**Match: 52%**: 13 have, 0 partial, 0 missing, 12 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate to English / Free Online Translator oEmbed (JSON) oEmbed (XML) JSON RSD Translate Dict Primary Menu" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "eived from international contacts. Auto-detect can identify the source language when you are not sure what you" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "wser. The translator supports more than 190 languages and is designed for everyday tasks such as reading messa" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | its live page (2026-10-28): "76; Translate Translate Source Language Swap languages Target Language Type your text and click 'Translate' bu" | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "Primary Menu Translate Voice Translator Text to Speech About Us Contact Us Toggle menu &#9776; Translate Trans" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "D Translate Dict Primary Menu Translate Voice Translator Text to Speech About Us Contact Us Toggle menu &#9776" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "ion appears here... Words: 0 / Chars: 0 Copy translation Zoom translated text Download translation Speak trans" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | studied by hand: translatedict.com offers this (https://www.translatedict.com/) | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "s, comments, product information, short documents, social posts, and other text that arrives without clear lan" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | its live page (2026-10-28): "product pages, or copied excerpts from websites. Auto-detect is intended for those cases: instead of guessing" | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "ked above. Can I translate text from an image or PDF? If the text can be selected and copied, paste it into th" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| Formal or informal tone | Translate | have | its live page (2026-10-28): "al obligations, safety instructions, or formal publication, have the final text reviewed by someone with relev" | void-live-deploy/translate/index.html:99 `ry, other words for any word, formal or informal, websites; listen, speak, read a photo, s` |
| Two-way conversation mode | Speech | have | its live page (2026-10-28): "nglish. Italian to English : useful for conversation, travel material, study, and written communication. Portu" | void-live-deploy/translate/index.html:174 `d="convD"><summary id="convS">Conversation</summary>` |
| text-to-speech | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Spanish to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chinese to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Arabic to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| French to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| German to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Turkish to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italian to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Portuguese to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Russian to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Japanese to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Korean to English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

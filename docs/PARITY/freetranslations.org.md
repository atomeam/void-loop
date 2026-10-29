# freetranslations.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: freetranslations.org (https://www.freetranslations.org/)
- Verse: /translate/?q=hello&to=es (translate: freetranslations.org, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Free Translation - Online English Translator, 200+ Languages"
- History: [docs/HISTORY/freetranslations.org.md](../HISTORY/freetranslations.org.md)

**Match: 57%**: 16 have, 0 partial, 0 missing, 12 unreviewed, of 28 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Free Translation - Online English Translator, 200+ Languages FreeTranslations FT Toggle menu ☰ Free Online Tr" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "up to 100 words The source language is detected automatically. You can also pick it manually from the dropdow" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "ranslation - Online English Translator, 200+ Languages FreeTranslations FT Toggle menu ☰ Free Online Translato" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | its live page (2026-10-28): "Send Translation Pairs Click &#8644; to swap direction English &#8594; Amharic Swap languages &#8644; English" | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "Free Online Translator Voice Translator Text to Speech About Us Contact Us Free Online Translator Free Online" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "FT Toggle menu ☰ Free Online Translator Voice Translator Text to Speech About Us Contact Us Free Online Transl" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "ammar tips. 3 Read, listen, or download Copy the result, click the speaker icon to hear it spoken aloud, or sa" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Example sentences in context | Dictionary | have | its live page (2026-10-28): "AQ answers and over 2,800 audio-enabled example phrases across all dedicated language pages. Languages from ev" | void-live-deploy/translate/index.html:141 `tions and how common each is, examples">Dictionary</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "est accepts up to 100 words. For longer documents, split the text into smaller paragraphs and translate each o" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translation history | History | have | its live page (2026-10-28): "re no cookies tracking your translation history. The site works on any device with a modern browser. There is" | void-live-deploy/translate/index.html:189 `<h2 id="histH">History</h2>` |
| Saved translations (phrasebook) | History | have | its live page (2026-10-28): "s processed in real time and nothing is saved to our servers. Once you close or refresh the page, the text is" | void-live-deploy/translate/index.html:140 `"save" title="Keep it in your saved phrases">Save</button>` |
| A character counter with its limit | Translate | have | its live page (2026-10-28): "ring different challenges. Chinese uses characters instead of an alphabet, and Mandarin has four tones that ch" | void-live-deploy/translate/index.html:114 `aceholder="Type to translate" maxlength="5000" rows="4" spellcheck="true"></textarea>` |
| Formal or informal tone | Translate | have | its live page (2026-10-28): "entire translation. For languages with formal and informal registers ( French , German , Japanese , Hindi , a" | void-live-deploy/translate/index.html:99 `ry, other words for any word, formal or informal, websites; listen, speak, read a photo, s` |
| Two-way conversation mode | Speech | have | its live page (2026-10-28): "opping, dining, emergencies, and polite conversation. Below the phrase table, each page has four paragraphs of" | void-live-deploy/translate/index.html:174 `d="convD"><summary id="convS">Conversation</summary>` |
| Works offline | Apps | have | its live page (2026-10-28): "aloud, or save the audio as an MP3 for offline use. Works on phones, tablets, and desktops. Getting the best" | void-live-deploy/translate/index.html:99 `read a photo, see them again offline.</p>` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "uese , Catalan ) descend from Latin and share much of their vocabulary. The Germanic group ( German , Dutch ," | void-live-deploy/translate/index.html:139 `this text and both languages">Share link</button>` |
| Lyric Finder | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Open | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Spanish | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to French | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to German | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Arabic | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Turkish | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Japanese | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Chinese | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Russian | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English to Italian | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| French | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

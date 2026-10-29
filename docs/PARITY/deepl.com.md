# deepl.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: deepl.com (https://www.deepl.com/translator)
- Verse: /translate/?q=hello&to=es (translate: deepl.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "DeepL Translator / World&#x27;s Most Accurate Translator"
- History: [docs/HISTORY/deepl.com.md](../HISTORY/deepl.com.md)

**Match: 62%**: 22 have, 2 partial, 1 missing, 12 unreviewed, of 37 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "DeepL Translator / World&#x27;s Most Accurate Translator Main Collapse Product updates (en) DeepL for AI agen" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "ct source language. Currently selected: Detect language Swap source with target language Swap source with targ" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "s cubes Supported languages Explore our 100+ languages Most popular Most common language pair options listed -" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Search the list of languages | Translate | have | studied by hand: deepl.com offers this (https://www.deepl.com/translator) | void-live-deploy/translate/index.html:110 `<label class="vh" for="langQ">Search the languages</label><input type="search" id="langQ"` |
| Swap the two languages | Translate | have | its live page (2026-10-28): "ge. Currently selected: Detect language Swap source with target language Swap source with target language Sele" | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Recently used languages | Translate | have | studied by hand: deepl.com offers this (https://www.deepl.com/translator) | void-live-deploy/translate/index.html:109 `ow" hidden><span id="recentL">Recent languages:</span> <span class="chips" id="recentLangs` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "now A support agent wearing a headset, speaking Voice translation DE Wie kann ich Ihnen helfen? IT Come posso" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "eal-time audio layer ready to transform voice translation How we’re building Translation Quality Evaluation fo" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Other ways to say a word or phrase | Translate | have | its live page (2026-10-28): "anslate images Translation glossary SSO Alternatives See all our features Solutions DeepL for Enterprise Legal" | void-live-deploy/translate/index.html:579 `const alts = (ok && j.alternatives) // []; list.replaceChildren();` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "te typeOrPasteShort Translation results Dictionary The dictionary is unavailable for this language pair. Trust" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Example sentences in context | Dictionary | have | its live page (2026-10-28): "ink opens in new tab signUpForFree Code example of API code Read our quick‒start guide and get started in minu" | void-live-deploy/translate/index.html:141 `tions and how common each is, examples">Dictionary</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "DeepL on AWS Marketplace New Use cases Document translation Customer support Internal communication Marketing" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | its live page (2026-10-28): "e DeepL API to scale a highly technical website globally in record time, while keeping translation quality int" | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "in new tab Life sciences Life sciences image Manufacturing - Link opens in new tab Manufacturing Manufacturin" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| Translation history | History | have | studied by hand: deepl.com offers this (https://www.deepl.com/translator) | void-live-deploy/translate/index.html:189 `<h2 id="histH">History</h2>` |
| A character counter with its limit | Translate | have | studied by hand: deepl.com offers this (https://www.deepl.com/translator) | void-live-deploy/translate/index.html:114 `aceholder="Type to translate" maxlength="5000" rows="4" spellcheck="true"></textarea>` |
| Formal or informal tone | Translate | have | studied by hand: deepl.com offers this (https://www.deepl.com/translator) | void-live-deploy/translate/index.html:99 `ry, other words for any word, formal or informal, websites; listen, speak, read a photo, s` |
| A glossary of fixed terms | Translate | have | its live page (2026-10-28): "ade translations with pro features like Glossaries, Rules and more. Translator Voice - Link opens in new tab V" | void-live-deploy/translate/index.html:169 `"glossD"><summary id="glossS">Glossary</summary>` |
| Rate or correct a translation | Quality | have | studied by hand: deepl.com offers this (https://www.deepl.com/translator) | void-live-deploy/translate/index.html:143 `<button type="button" id="fbB" aria-expanded="false" aria-controls="fb" title="Sug` |
| Two-way conversation mode | Speech | have | its live page (2026-10-28): "lation in virtual meetings or in-person conversations. Voice Write - Link opens in new tab Write Write Write P" | void-live-deploy/translate/index.html:174 `d="convD"><summary id="convS">Conversation</summary>` |
| Rewrite or improve your own writing | Writing | missing | its live page (2026-10-28): "rely, efficiently, and accurately DeepL Write Enhance your writing and adapt to your audience DeepL Voice Conv" | no sign of it in the source of /translate/ |
| A browser extension | Apps | partial | its live page (2026-10-28): "icing Apps New Apps Desktop app Browser extension Mobile apps Voice Desktop App New Explore all apps Integrati" | void-live-deploy/translate/index.html:182 `<p class="hint">Drag this bookmarklet to your bookmarks bar. On any page, click it: yo` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ations Become a Partner Product updates Log in Start free trial Main menu Menu Notifications alt+T Millions tr" | void-live-deploy/translate/index.html:226 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; store.tones = store.to` |
| A public API | Developers | have | its live page (2026-10-28): "althcare ISV & technology Contact sales Developers DeepL for Developers Documentation API reference Community" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| DeepL for AI agents | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Building for Europe’s sovereignty needs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Overview | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Enterprise overview | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Enterprise security & trust | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Market-leading Quality | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customization Hub | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| DeepL on AWS Marketplace New | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customer support | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Internal communication | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Marketing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Global expansion | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

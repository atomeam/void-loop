# translate.yandex.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: translate.yandex.com (https://translate.yandex.com/)
- Verse: /translate/?q=hello&to=es (translate: translate.yandex.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Verification"
- History: [docs/HISTORY/translate.yandex.com.md](../HISTORY/translate.yandex.com.md)

**Match: 91%**: 15 have, 1 partial, 0 missing, 1 unreviewed, of 17 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "king your browser before redirecting to translate.yandex.com Wait for a few seconds - after the check, the sit" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Romanised spelling for other scripts | Translate | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:278 `$('roman').textContent = L.romanize(out, state.to); $('backT').textContent = '';` |
| Translate a document (PDF, Word, slides) | Documents | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| Translate the text in a photo | Images | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| Saved translations (phrasebook) | History | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:140 `"save" title="Keep it in your saved phrases">Save</button>` |
| An on-screen keyboard for other scripts | Input | have | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:123 `<button type="button" id="kbdB" aria-expanded="false" aria-controls="kbd" title="A` |
| Rate or correct a translation | Quality | have | its live page (2026-10-28): "f you have any problems, please use the feedback form 9660434991229873161 : 1793219141 Checking your browser b" | void-live-deploy/translate/index.html:143 `<button type="button" id="fbB" aria-expanded="false" aria-controls="fb" title="Sug` |
| A browser extension | Apps | partial | studied by hand: translate.yandex.com offers this (https://translate.yandex.com/) | void-live-deploy/translate/index.html:182 `<p class="hint">Drag this bookmarklet to your bookmarks bar. On any page, click it: yo` |
| How to enable JavaScript? | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

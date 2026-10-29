# translate.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: translate.com (https://www.translate.com/)
- Verse: /translate/?q=hello&to=es (translate: translate.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate Fast with Accurate Translator Online  / Translate.com"
- History: [docs/HISTORY/translate.com.md](../HISTORY/translate.com.md)

**Match: 52%**: 13 have, 1 partial, 0 missing, 12 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate Fast with Accurate Translator Online / Translate.com Translate .com Solutions Services By content O" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "ntact us Our Partners The World's #1 AI Detector with over 1 Million Users Expert help with design presentatio" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "ranslations from English into more than 230 languages for businesses worldwide. Most Popular Languages Spanish" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "or DOCx files. Translation by a native speaker Expert language services with proofreading by a native speaker" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "s on nuances such as context or tone of voice. It doesn’t offer the highest quality, but it is a free online t" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "or team in one tool. Create an account. Copy the API Key in Account Options Add Translate.com Zapp in the Zapi" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "demand and precise services. We offer a dictionary to make your localized content more strictly logical. Can y" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "om Solutions Services By content Online Document Translation Service Email translation by expert By use cases" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | its live page (2026-10-28): "apier Automate the localization of your websites, blogs, ads, and customer communication. Leverage the power o" | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "nguages and offers features like voice, image, and doc translation. Translate.com: This platform also offers a" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| A character counter with its limit | Translate | have | its live page (2026-10-28): "ion. Upon logging in, you receive 1,000 characters for testing. Next, integrate the Translate.com API within y" | void-live-deploy/translate/index.html:114 `aceholder="Type to translate" maxlength="5000" rows="4" spellcheck="true"></textarea>` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "and human translator team in one tool. Create an account. Copy the API Key in Account Options Add Translate.c" | void-live-deploy/translate/index.html:226 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; store.tones = store.to` |
| A public API | Developers | have | its live page (2026-10-28): "nslation NEW Machine Translation Review API Integration Zapier Integration Select a translation service Review" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| Solutions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Services | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All languages | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Company | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Our clients & case studies | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Help center | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Reviews | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Zapier Integration | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| brian@gritbrokerage.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| customer support service | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Spanish | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Latin | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

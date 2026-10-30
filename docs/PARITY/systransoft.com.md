# systransoft.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: systransoft.com (https://www.systransoft.com/translate/)
- Verse: /translate/?q=hello&to=es (translate: systransoft.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate your text for free"
- History: [docs/HISTORY/systransoft.com.md](../HISTORY/systransoft.com.md)

**Match: 41%**: 8 have, 2 partial, 0 missing, 12 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate your text for free JSON oEmbed (JSON) oEmbed (XML) main navigation logo Demo Toggle navigation Solu" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "fingertips Speech Add-on Translate your voice to text in any language Resources Technical API Documentation Ex" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "in any language Resources Technical API Documentation Explore our API documentation Language Catalog 50 years" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | its live page (2026-10-28): "advertising, or to track the user on a website or across several websites for similar marketing purposes. Man" | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| A browser extension | Apps | partial | its live page (2026-10-28): "from your Translation Memories Browser extension Web page translation at your fingertips Speech Add-on Transl" | void-live-deploy/translate/index.html:182 `<p class="hint">Drag this bookmarklet to your bookmarks bar. On any page, click it: yo` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "third-party apps or workflows Translate Log in English Français Español 日本語 한국어 Deutsch English English Englis" | void-live-deploy/translate/index.html:226 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; store.tones = store.to` |
| A public API | Developers | have | its live page (2026-10-28): "anslate Private Cloud Dedicated Private Cloud translation solution for corporate scale Model training SYSTRAN" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| logo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Demo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Global Customer Service & Support | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Forensics & eDiscovery | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Content Localization | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Education & eLearning | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Big Data Analysis for Government | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Financial Services | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Life Sciences & Healthcare | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Technology & IT Services | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Retail & E-commerce | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Manufacturing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

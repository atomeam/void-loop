# onlinedoctranslator.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: onlinedoctranslator.com (https://www.onlinedoctranslator.com/)
- Verse: /translate/?q=hello&to=es (translate: onlinedoctranslator.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Free Online Translator: Preserve Document Layout (PDF, Word, Excel, PPT)"
- History: [docs/HISTORY/onlinedoctranslator.com.md](../HISTORY/onlinedoctranslator.com.md)

**Match: 43%**: 9 have, 0 partial, 0 missing, 12 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Free Online Translator: Preserve Document Layout (PDF, Word, Excel, PPT) 🗨 en Español - Spanish Italiano - I" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "cuments languages supported and growing 109 languages supported and growing &lt;b&gt;No Installation&lt;/b&gt;" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "ore than 300 million Arabic, and Hebrew-speakers with support for right-to-left (RTL) languages - including en" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Copy the translation | Translate | have | its live page (2026-10-28): "preserving the original layout. No more copy/pasting text in and out of your documents. Doc Translator intelli" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "Free Online Translator: Preserve Document Layout (PDF, Word, Excel, PPT) 🗨 en Español - Spanish Italiano - I" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "t PDF to JPG Split a PDF Ultra-Compress Images Instantly translate and preserve the layout of any document for" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| A public API | Developers | have | its live page (2026-10-28): "rabic Doc Translator Translator Contact API Convert a PDF to Word Convert PDF to JPG Split a PDF Ultra-Compres" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| 🗨 en | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Español - Spanish | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italiano - Italian | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Deutsch - German | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Português - Portuguese | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Polski - Polish | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Čeština - Czech | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Français - French | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| русский - Russian | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Malay - Malay | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bahasa Indonesia - Indonesian | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Filipino - Filipino | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

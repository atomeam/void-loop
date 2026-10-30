# linguee.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: linguee.com (https://www.linguee.com/)
- Verse: /translate/?q=hello&to=es (translate: linguee.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Linguee / Dictionary for German, French, Spanish, and more"
- History: [docs/HISTORY/linguee.com.md](../HISTORY/linguee.com.md)

**Match: 50%**: 8 have, 0 partial, 1 missing, 7 unreviewed, of 16 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "nd more Look up in Linguee Suggest as a translation of "" Copy Translator Write Dictionary EN Open menu Transl" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Copy the translation | Translate | have | its live page (2026-10-28): "Linguee Suggest as a translation of "" Copy Translator Write Dictionary EN Open menu Translator Translate tex" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Other ways to say a word or phrase | Translate | have | studied by hand: linguee.com offers this (https://www.linguee.com/) | void-live-deploy/translate/index.html:585 `const alts = (ok && j.alternatives) // []; list.replaceChildren();` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "Linguee / Dictionary for German, French, Spanish, and more Look up in Linguee Suggest as a translation of """ | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Example sentences in context | Dictionary | have | studied by hand: linguee.com offers this (https://www.linguee.com/) | void-live-deploy/translate/index.html:141 `tions and how common each is, examples">Dictionary</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "slator to instantly translate texts and documents Try DeepL Translator Translate as you type World-leading qua" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Rewrite or improve your own writing | Writing | missing | its live page (2026-10-28): "as a translation of "" Copy Translator Write Dictionary EN Open menu Translator Translate texts with the worl" | no sign of it in the source of /translate/ |
| Look up in Linguee | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Open menu | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Press Information | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Linguee | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Improve your writing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Linguee auf Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Publisher | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

# translator.eu: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: translator.eu (https://www.translator.eu/)
- Verse: /translate/?q=hello&to=es (translate: translator.eu, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate free and online / TRANSLATOR.EU"
- History: [docs/HISTORY/translator.eu.md](../HISTORY/translator.eu.md)

**Match: 38%**: 8 have, 0 partial, 1 missing, 12 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate free and online / TRANSLATOR.EU Translator.eu fast text translator fast text translator English Add" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | its live page (2026-10-28): "recognize Translate to english language swap Translations provided by logo Microsoft translator Remove text &#" | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Copy the translation | Translate | have | its live page (2026-10-28): "translation which you can then select, copy, and use for your needs. Translator.eu can translate up to 1000 c" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "slation service uses the technology and dictionary of a high-quality translation supplier - "Microsoft Transla" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Translation history | History | have | its live page (2026-10-28): "inks: Sponsored links: Your translation history Your translation history Translate Mark all Mark all Your rati" | void-live-deploy/translate/index.html:189 `<h2 id="histH">History</h2>` |
| Saved translations (phrasebook) | History | have | its live page (2026-10-28): "tor fast text translator English Add to Favorites Add to Favorites Multilingual free online text translator :-" | void-live-deploy/translate/index.html:140 `"save" title="Keep it in your saved phrases">Save</button>` |
| A character counter with its limit | Translate | have | its live page (2026-10-28): "Translator.eu can translate up to 1000 characters of text (medium long text) at a time. If you want to transl" | void-live-deploy/translate/index.html:114 `aceholder="Type to translate" maxlength="5000" rows="4" spellcheck="true"></textarea>` |
| Rewrite or improve your own writing | Writing | missing | its live page (2026-10-28): "uate the result of your translation, or write your own translation if you think that the translated text is wr" | no sign of it in the source of /translate/ |
| Mark all | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| GDPR | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Did you find an error? | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| překladač | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| oversætter | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| übersetzer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| traductor | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| kääntäjä | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| traducteur | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| fordító | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| traduttore | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| vertėjas | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

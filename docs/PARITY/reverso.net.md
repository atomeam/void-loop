# reverso.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: reverso.net (https://www.reverso.net/text-translation)
- Verse: /translate/?q=hello&to=es (translate: reverso.net, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/reverso.net.md](../HISTORY/reverso.net.md)

**Match: 82%**: 9 have, 0 partial, 1 missing, 1 unreviewed, of 11 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Listen to the text or the translation | Speech | have | studied by hand: reverso.net offers this (https://www.reverso.net/text-translation) | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Copy the translation | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Other ways to say a word or phrase | Translate | have | studied by hand: reverso.net offers this (https://www.reverso.net/text-translation) | void-live-deploy/translate/index.html:590 `const alts = (ok && j.alternatives) // []; list.replaceChildren();` |
| Dictionary meanings and examples | Dictionary | have | studied by hand: reverso.net offers this (https://www.reverso.net/text-translation) | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Example sentences in context | Dictionary | have | studied by hand: reverso.net offers this (https://www.reverso.net/text-translation) | void-live-deploy/translate/index.html:141 `tions and how common each is, examples">Dictionary</button>` |
| Saved translations (phrasebook) | History | have | studied by hand: reverso.net offers this (https://www.reverso.net/text-translation) | void-live-deploy/translate/index.html:140 `"save" title="Keep it in your saved phrases">Save</button>` |
| Rewrite or improve your own writing | Writing | missing | studied by hand: reverso.net offers this (https://www.reverso.net/text-translation) | no sign of it in the source of /translate/ |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.reverso.net/text-translation | not compared yet |

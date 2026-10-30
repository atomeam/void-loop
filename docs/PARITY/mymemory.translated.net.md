# mymemory.translated.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: mymemory.translated.net (https://mymemory.translated.net/)
- Verse: /translate/?q=hello&to=es (translate: mymemory.translated.net, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "MyMemory - Machine translation meets human translation"
- History: [docs/HISTORY/mymemory.translated.net.md](../HISTORY/mymemory.translated.net.md)

**Match: 40%**: 8 have, 1 partial, 0 missing, 12 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "MyMemory - Machine translation meets human translation Translation API About MyMemory Log in Contribute a TMX" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "218,415,117 human contributions --> Autodetect "; ------ Afrikaans Albanian Amharic Arabic Armenian Azerbaijan" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "documents Translate documents Translate voice Interpreter Help! Rate short translations that users are typing" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "Zulu Translate Translate text Translate documents Translate documents Translate voice Interpreter Help! Rate s" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | its live page (2026-10-28): "h-quality, domain-specific multilingual websites. MyMemory is part of Translated. If you ever need AI-powered" | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "nslation Translation API About MyMemory Log in Contribute a TMX Get a better translation with 10,218,415,117 h" | void-live-deploy/translate/index.html:226 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; store.tones = store.to` |
| A public API | Developers | have | its live page (2026-10-28): "ion meets human translation Translation API About MyMemory Log in Contribute a TMX Get a better translation wi" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| Contribute a TMX | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| checker plate (English&gt;French) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| just weat (Portuguese&gt;English) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| nico (English&gt;Korean) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 600x300 (Italian&gt;Danish) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| god natt söta du (Swedish&gt;English) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| utiliser avant (French&gt;Bengali) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| mentally drained (English&gt;Tagalog) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| pinatago ko (Tagalog&gt;Bengali) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| da nada compa (Spanish&gt;English) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| vä«sus (Latin&gt;Spanish) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| pothaka piduma (English&gt;Sinhala) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

# bing.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: bing.com (https://www.bing.com/translator)
- Verse: /translate/?q=hello&to=es (translate: bing.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Microsoft Translator"
- History: [docs/HISTORY/bing.com.md](../HISTORY/bing.com.md)

**Match: 70%**: 19 have, 0 partial, 0 missing, 8 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Microsoft Translator Go to Bing search Go to Bing search Search the web Search the web Account Rewards and Pr" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "e Selection Dropdown Recently used Auto-detect Auto-detect All languages Acehnese (Latin) Acehnese (Latin) Afr" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | studied by hand: bing.com offers this (https://www.bing.com/translator) | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Search the list of languages | Translate | have | studied by hand: bing.com offers this (https://www.bing.com/translator) | void-live-deploy/translate/index.html:110 `<label class="vh" for="langQ">Search the languages</label><input type="search" id="langQ"` |
| Swap the two languages | Translate | have | its live page (2026-10-28): "ose ✕ Capture Image to translate 0/1000 Swap languages Close ✕ Swap languages Output Language Selection Dropdo" | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Recently used languages | Translate | have | its live page (2026-10-28): "Help Input Language Selection Dropdown Recently used Auto-detect Auto-detect All languages Acehnese (Latin) A" | void-live-deploy/translate/index.html:109 `ow" hidden><span id="recentL">Recent languages:</span> <span class="chips" id="recentLangs` |
| Listen to the text or the translation | Speech | have | its live page (2026-10-28): "to Clear Translating: Translating: Undo Listen Close ✕ Listen Close ✕ Speak to translate Click to open Softkey" | void-live-deploy/translate/index.html:118 `(tap again to hear it slowly)">Listen</button>` |
| Speak instead of typing | Speech | have | studied by hand: bing.com offers this (https://www.bing.com/translator) | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "anslation Close ✕ Listen to translation Copy Close ✕ Copy Other ways to say How to use Examples are automatica" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Example sentences in context | Dictionary | have | its live page (2026-10-28): "ose ✕ Copy Other ways to say How to use Examples are automatically generated. The results may not be exact or" | void-live-deploy/translate/index.html:141 `tions and how common each is, examples">Dictionary</button>` |
| Romanised spelling for other scripts | Translate | have | its live page (2026-10-28): "ic (Moroccan) Arabic (Moroccan) Arabic (Romanized) Arabic (Romanized) Armenian Armenian Assamese Assamese Astu" | void-live-deploy/translate/index.html:278 `$('roman').textContent = L.romanize(out, state.to); $('backT').textContent = '';` |
| Translate a document (PDF, Word, slides) | Documents | have | studied by hand: bing.com offers this (https://www.bing.com/translator) | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Translate a whole website | Websites | have | studied by hand: bing.com offers this (https://www.bing.com/translator) | void-live-deploy/translate/index.html:159 `id="webD"><summary id="webS">Translate a website</summary>` |
| Translate the text in a photo | Images | have | its live page (2026-10-28): "n Softkeyboard Close ✕ Keyboard Capture Image to translate Close ✕ Capture Image to translate 0/1000 Swap lang" | void-live-deploy/translate/index.html:119 `n a photo or from the camera">Camera or photo</button>` |
| A character counter with its limit | Translate | have | its live page (2026-10-28): "ain later. DebugID: Only the first 1000 characters can be translated at once Translation Regenerate with AI Cl" | void-live-deploy/translate/index.html:114 `aceholder="Type to translate" maxlength="5000" rows="4" spellcheck="true"></textarea>` |
| An on-screen keyboard for other scripts | Input | have | its live page (2026-10-28): "✕ Speak to translate Click to open Softkeyboard Close ✕ Keyboard Capture Image to translate Close ✕ Capture I" | void-live-deploy/translate/index.html:123 `<button type="button" id="kbdB" aria-expanded="false" aria-controls="kbd" title="A` |
| Formal or informal tone | Translate | have | its live page (2026-10-28): "AI Tone of translation Standard Casual Formal Listen to translation Close ✕ Listen to translation Copy Close" | void-live-deploy/translate/index.html:99 `ry, other words for any word, formal or informal, websites; listen, speak, read a photo, s` |
| Rate or correct a translation | Quality | have | its live page (2026-10-28): "vacy Terms Advertise About our ads Help Feedback Your Privacy Choices Consumer Health Privacy" | void-live-deploy/translate/index.html:143 `<button type="button" id="fbB" aria-expanded="false" aria-controls="fb" title="Sug` |
| Two-way conversation mode | Speech | have | its live page (2026-10-28): "k links Text Text Translator Translator Conversation Conversation Apps Apps For business For business Help Hel" | void-live-deploy/translate/index.html:174 `d="convD"><summary id="convS">Conversation</summary>` |
| Text | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Apps | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| For business | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Undo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Your Privacy Choices | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Consumer Health Privacy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: Search the web | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: Enter text | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

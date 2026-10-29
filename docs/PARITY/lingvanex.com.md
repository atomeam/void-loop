# lingvanex.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: lingvanex.com (https://lingvanex.com/translate/)
- Verse: /translate/?q=hello&to=es (translate: lingvanex.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate Text Online for Free – Lingvanex"
- History: [docs/HISTORY/lingvanex.com.md](../HISTORY/lingvanex.com.md)

**Match: 45%**: 10 have, 0 partial, 0 missing, 12 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate Text Online for Free – Lingvanex Products TRANSLATION On-premise Machine Translation Translate mill" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| More than 100 languages | Translate | have | its live page (2026-10-28): "lack Communicate with your teammates in 109 languages. Offline Translator for PC Translate text and files with" | void-live-deploy/translate/index.html:203 `ib/toolkit.js'), import('/lib/translate-langs.js'), import('/lib/translate-extras.js'), im` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Speak instead of typing | Speech | have | its live page (2026-10-28): "S and Android. TRANSCRIPTION On-premise Speech Recognition Self-hosted voice recognition software in 91 langua" | void-live-deploy/translate/index.html:352 `const SR = window.SpeechRecognition // window.webkitSpeechRecognition; let rec = null;` |
| Copy the translation | Translate | have | its live page (2026-10-28): "---- German Type to Translate 0 / 3000 Copy translation Translation copied What was wrong? Poor translation U" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Translate a document (PDF, Word, slides) | Documents | have | its live page (2026-10-28): "nslator for PC Translate texts, speech, documents on Windows and Mac. Translator for Slack Communicate with yo" | void-live-deploy/translate/index.html:204 `nst docs = () => import('/lib/translate-docs.js');` |
| Rate or correct a translation | Quality | have | its live page (2026-10-28): "ed Something else Submit Thanks for you feedback Secure Translation for Your Business Contact us to start a fr" | void-live-deploy/translate/index.html:143 `<button type="button" id="fbB" aria-expanded="false" aria-controls="fb" title="Sug` |
| Works offline | Apps | have | its live page (2026-10-28): "ture. Machine Translation SDK Integrate offline translation in iOS, Android, Mac OS, Windows. Translator for P" | void-live-deploy/translate/index.html:99 `read a photo, see them again offline.</p>` |
| A public API | Developers | have | its live page (2026-10-28): "h total privacy protection. Translation API Doesn’t require dedicated server or infrastructure. Machine Transl" | void-live-deploy/translate/index.html:240 `const post = (body) => fetch('/api/translate', { method: 'POST', headers: { 'content-t` |
| Products | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Technologies | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Solutions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Defence and Security | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Education and e-Learning | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Finance and Banking | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Government and Public Safety | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Language Service Providers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Legal and Compliance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Life Sciences and Healthcare | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Manufacturing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Marketing and Social Media | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

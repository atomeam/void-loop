# tradukka.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: tradukka.com (https://tradukka.com/)
- Verse: /translate/?q=hello&to=es (translate: tradukka.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Translate in real time. Dictionary. Questions about words. / Tradukka"
- History: [docs/HISTORY/tradukka.com.md](../HISTORY/tradukka.com.md)

**Match: 43%**: 9 have, 0 partial, 0 missing, 12 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Translate typed text | Translate | have | its live page (2026-10-28): "Translate in real time. Dictionary. Questions about words. / Tradukka Tradukka Tradukka Translate Dictionary" | void-live-deploy/translate/index.html:114 `textarea id="in" placeholder="Type to translate" maxlength="5000" rows="4" spellcheck="tru` |
| Detect the language automatically | Translate | have | its live page (2026-10-28): "Dictionary. Questions about words. Auto-detect English Translator Commonly translated languages Common transla" | void-live-deploy/translate/index.html:99 `"sub" id="sub">100 languages, detected as you type. Documents, a dictionary, other words f` |
| Swap the two languages | Translate | have | every site of this kind offers it | void-live-deploy/translate/index.html:105 `button" id="swap" aria-label="Swap languages" title="Swap languages">⇄</button>` |
| Recently used languages | Translate | have | its live page (2026-10-28): "ni (Central Kurdish) Portuguese English Recently translated languages Recently translated Cantonese Chinese (s" | void-live-deploy/translate/index.html:109 `ow" hidden><span id="recentL">Recent languages:</span> <span class="chips" id="recentLangs` |
| Copy the translation | Translate | have | its live page (2026-10-28): "Privacy / Contact us Contact Tradukka &copy; 2026 &mdash; Made with Get it on Google Play Get it on Google Pl" | void-live-deploy/translate/index.html:138 `button type="button" id="copy">Copy</button>` |
| Dictionary meanings and examples | Dictionary | have | its live page (2026-10-28): "Translate in real time. Dictionary. Questions about words. / Tradukka Tradukka Tradukka Translate Dictionary" | void-live-deploy/translate/index.html:141 `how common each is, examples">Dictionary</button>` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "&copy; 2026 &mdash; Made with Get it on Google Play Get it on Google Play Download on the App Store --> Prefer" | void-live-deploy/translate/index.html:685 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Dark mode | Settings | have | its live page (2026-10-28): "Preferences Close Language preferences Dark mode --> Close Close Share this content Close Send in WhatsApp Se" | void-live-deploy/vendor/pdfjs-6.4.299/build/pdf.min.js:25 `ode",!!window?.matchMedia?.("(prefers-color-scheme: dark)").matches)}}class CSSConstants{s` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "e preferences Dark mode --> Close Close Share this content Close Send in WhatsApp Send Share on Facebook Share" | void-live-deploy/translate/index.html:139 `this text and both languages">Share link</button>` |
| Units | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Currency | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| My account | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English Sorani (Central Kurdish) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English Spanish | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Spanish English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sorani (Central Kurdish) English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| English Portuguese | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Arabic Sorani (Central Kurdish) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Portuguese English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cantonese Chinese (simplified) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Indonesian Arabic | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

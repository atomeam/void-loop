# metronomeonline.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: metronomeonline.com (https://metronomeonline.com/)
- Verse: /metronome/ (music: metronomeonline.com, tower gate 16 of 18)
- Live scan: 2026-10-28, HTTP 200, page title "Free Online Metronome – Accurate BPM Tempo Tool / Metronome Online"
- History: [docs/HISTORY/metronomeonline.com.md](../HISTORY/metronomeonline.com.md)

**Match: 100%**: 2 have, 0 partial, 0 missing, 0 unreviewed, of 2 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Set the tempo | Tempo | have | its live page (2026-10-28): "Free Online Metronome – Accurate BPM Tempo Tool / Metronome Online Loading..." | void-live-deploy/metronome/index.html:111 `ue="120" step="1" aria-label="Beats per minute" style="flex:1 1 120px"><button type="butto` |
| Time signatures and accents | Tempo | have | every site of this kind offers it | void-live-deploy/metronome/index.html:106 `aria-label="Beats of the bar, press one to change its accent"><button class="dot" type="bu` |

# weather.gov: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: weather.gov (https://www.weather.gov/)
- Verse: /weather/?q=Boston (weather, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "National Weather Service"
- History: [docs/HISTORY/weather.gov.md](../HISTORY/weather.gov.md)

**Match: 21%**: 4 have, 0 partial, 3 missing, 12 unreviewed, of 19 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Forecasts by place | Weather | have | its live page (2026-10-28): "nic and Atmospheric Administration HOME FORECAST Local Graphical Aviation Marine Rivers and Lakes Hurricanes S" | void-live-deploy/weather/index.html:77 `<footer>Forecasts from <a href="https://open-meteo.com/" rel="noopener">Open-Meteo</a>;` |
| Warnings and alerts | Weather | have | its live page (2026-10-28): "a SAFETY INFORMATION Wireless Emergency Alerts Brochures Weather-Ready Nation Cooperative Observers Daily Brie" | void-live-deploy/weather/index.html:60 `d sunset, the chance of rain, alerts and radar.</p>` |
| Radar | Weather | have | its live page (2026-10-28): "DING... --> ACTIVE ALERTS FORECAST MAPS RADAR Standard Radar (Low Bandwidth) Enhanced Radar RIVERS, LAKES, RAI" | void-live-deploy/weather/index.html:60 `he chance of rain, alerts and radar.</p>` |
| Hourly forecast | Weather | have | every site of this kind offers it | void-live-deploy/lib/weather.js:29 `+ '&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_ma` |
| Forecaster discussions | Weather | missing | studied by hand: weather.gov offers this (https://www.weather.gov/) | no sign of it in the source of /weather/ |
| Marine, aviation and fire weather | Weather | missing | its live page (2026-10-28): "istration HOME FORECAST Local Graphical Aviation Marine Rivers and Lakes Hurricanes Severe Weather Fire Weathe" | no sign of it in the source of /weather/ |
| Climate records | Weather | missing | its live page (2026-10-28): "her Sunrise/Sunset Long Range Forecasts Climate Prediction Space Weather PAST WEATHER Past Weather Astronomica" | no sign of it in the source of /weather/ |
| National Weather Service | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| United States Department of Commerce | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Local | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Graphical | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Rivers and Lakes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Hurricanes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Severe Weather | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sunrise/Sunset | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Space Weather | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PAST WEATHER | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Past Weather | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Astronomical Data | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |

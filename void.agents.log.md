
- 2026-09-27 claude: deployed translate (Google gtx, MyMemory fallback; MyMemory memory returned 'testvalue'), place (street map), rebuild-map.

- 2026-09-27 claude: translate.js now uses Google gtx (MyMemory returned 'testvalue' for hello); deployed 3d3fbbbe.

- 2026-09-27 claude: shipped find-or-ask (idea generator feature 001, Void form): live hints while typing (core + every skill's examples), arrows/Tab/Enter, Ctrl/Cmd+K and / focus, ?q= deep links, WebSite SearchAction JSON-LD. Deployed de717555. Lock released.

- 2026-09-27 claude: shipped #7 first-frame look (head script paints saved bg/glow before draw, no fade on load) and #8 menu ('menu', 'what can i do', 'options'; clickable, grouped, learned skills included). Deployed 8f45d40a. Lock released.

- 2026-09-27 claude: shipped #9 late-skills wait (up to 6s, then fallback), F018 undo (snapshot per ask, state+look), F020 quiet status in whisper row. F017 pins and F019 skipped (already true / see chat). Deployed de53a462. Lock released.

- 2026-09-27 claude: shipped F021 keep this (page -> stage card, survives reload, undo-able), F022 call/name this, F023 take this off, F024 same again / refresh this. Deployed f4298790. Lock released.

- 2026-09-27 claude: shipped answer-first machine layer (Void form): meta description, Organization JSON-LD, labeled input, noscript description, real robots.txt + sitemap.xml (robots.txt was serving Void HTML), llms.txt refreshed with all current skills. No visible hero (surface stays a void). Deployed daefb4e6.

- 2026-09-27 claude: shipped 003 declared agent tools: GET /tools.json (Pages Function, built live from /skills + core list, CORS open, call = /?q={ask}). llms.txt points to it. Deployed 2c957430.

- 2026-09-27 claude: shipped 005 dated sources: every Source line gets 'as of <time>' (date added when not today); Wikipedia adds 'last edited <date>'; kept cards show fetch time + 'say refresh this'. Deployed 90476346. Lock released.

- 2026-09-27 claude: translate.js now credits whichever service answered (Google or MyMemory fallback).

- 2026-09-27 claude: shipped 006 kind-scoped batch remove + kept-card kind in batch. Deployed 8b536e25. Lock released.

- 2026-09-27 claude: shipped 008 plumbing (queue.js, void_queue.py, Void asks + status line, STANDING.md builder step). Deployed 0f5526ec. KV write quota exhausted today, so live round trip pending reset.

- 2026-09-27 claude: moved /api/queue + /api/miss(es) to D1 (binding DB = a-to-mind-board; KV misses still merged read-only). First queued build 007 round trip complete. Deployed 4a60c211. Lock released.

- 2026-09-27 claude: /api/queue POST wakes the on-request builder when Pages secrets BUILDER_WEBHOOK_URL (+ BUILDER_WEBHOOK_KEY) exist; queue note shows 'builder woken' or 'builder wake failed <code>'. Deployed f03aee1f.

- 2026-09-27 claude: wrote domains\void.plan.md (the plan everyone follows) and pointed STANDING.md at it.

- 2026-09-27 claude: plan item 1 DONE. tools\test_void.mjs (23 checks, Edge on Victus via playwright-core), tools\deploy.ps1 (test -> deploy -> push), Loop is now git repo atomeam/void-loop (private).

- 2026-09-27 claude: plan item 2 DONE. /api/answer live (Gemma 4 26B, enable_thinking false, D1 cache, rate limit, excerpt fallback); void.html routes questions + uncovered asks to it; 2 new tests (25 total). Lock released.

- 2026-09-27 claude: shipped atmosphere + depth: WebGL nebula behind the void (tinted by your look, 30fps, pauses when hidden, static for reduced motion, CSS fallback), faint breathing event-horizon ring, glass panels with rim light, summons arrive from depth and tilt toward the pointer, glowing input on focus.

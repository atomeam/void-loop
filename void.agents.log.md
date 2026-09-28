
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

- 2026-09-27 claude: will engine live. /api/will (Gemma chooses from candidates, weight fallback), tools/will.py + covered.mjs, task \A2M void_will every 3h 9-9. First choice queued: 'Void learns skills by itself' (plan item 3).

- 2026-09-27 linux-helper (cos): plan item 4 built on branch helper/everywhere, not deployed: installable app (manifest.webmanifest, icons, sw.js network-first offline shell, /api untouched), address bar search (opensearch.xml + rel=search), share target (/?share_text|share_url|share_title: links become a link card, words run as an ask), voice (Chrome 153 <microphone> element -> SpeechRecognition.start(track), on-device when available; mic button fallback with plain SpeechRecognition; no mic when the browser has no recognition), 'read it aloud' / 'stop' (speechSynthesis), owner can queue 'build helper/<name>'. Sources: developer.chrome.com/blog/new-in-chrome-153, /blog/usermedia-html-element, MDN SpeechRecognition.start(audioTrack). Suite +10 checks; slow-box flakes fixed by polling instead of fixed sleeps. Needs a builder to merge + deploy.

- 2026-09-27 linux-helper (cos): plan item 5 built on branch helper/webmcp (stacked on helper/everywhere), not deployed: WebMCP tools registered on the page from /tools.json (document.modelContext, navigator.modelContext fallback; void_ask + one per tool; readOnly/untrusted hints; each call runs the ask like a typed one and returns the page text or what landed on the stage; unlock/build asks refused). Origin-trial token slot WEBMCP_TRIAL_TOKEN (empty until Atom registers). llms.txt mentions it. Sources: developer.chrome.com/docs/ai/webmcp/imperative-api, chromium 'WebMCP: Remove navigator.modelContext'. Suite +3 checks.

- 2026-09-27 linux-helper (item 7): plan item 7's confirm line built on branch helper/item7-confirm-line, not deployed: owner-only gated asks (email/message/publish/calendar/booking/order/payment) show 'Do X? Yes / No' in the whisper; /api/approval (D1 void_approvals + void_ledger, tables created on first use, 503 = nothing sent) runs an action only on an in-time yes whose SHA-256 args fingerprint still matches, once; reject/escalate need a reason; no answer in 2 min = timeout; shared rules in lib/approval-core.js; events a2m.approval.requested/decision (ApprovalEvent v0 fields) so it can move to Workflows waitForEvent later (domains/void.confirm-line.md). No connector wired yet. Sources: developers.cloudflare.com/workflows (waitForEvent, sendEvent, event type naming), developers.cloudflare.com/d1. Suite +9 checks (35). Needs a builder to merge + deploy.

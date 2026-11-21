# Stranger gate

**Starts when:** a pull request changes a page, a tool, a game or a card, or the nightly run (`stranger-gate.yml`) checks the live site.

**What it calls (it does not copy them):** `tools/quality-measure.mjs` opens a page or a card on a phone and a desktop and reads errors, the main control, pictures, layout and speed. `tools/game-fun.mjs` plays a changed game for a short stretch (`quick`). The long idle-lose check stays on `tools/game-audit.mjs`. A missing title comes from `auditPage` in `lib/seo-audit.js`. A new page with no handoff tag comes from `declOf` in `tools/handoff-scan.mjs`. Tool routes come from `tools/capability-sweep/list.json`. The model prompt is `judgePrompt` in `lib/stranger.js`, sent by `tools/studio-make.mjs` only when `GROQ_API_KEY` or a Cloudflare AI token is already in the environment.

**Commands:** `node tools/stranger-gate.mjs` checks this branch on a local server. `--paths /qr/` checks those routes. `--live` checks the live site (tonight's three, or `--paths`). `--file-jobs stranger-out/stranger.json` opens one queue job per failure when `VOID_OWNER_TOKEN` is set, and prints `not filed` when it is not.

**How to tell it worked:** the run prints one plain sentence per failure and exits 1, or `Stranger test passed`. `--json` writes the rows. `--shots` saves a phone picture and a desktop picture. A sign-in screen that loads is not a failure.

**What it will not do:** re-run the whole seo audit, the handoff gap list, every capability-sweep ask, or the full minute-long fun probe.

**Mistake already made:** the full game-fun idle wait is about a minute per game. The gate plays the short version. The shelf gate keeps the long one.

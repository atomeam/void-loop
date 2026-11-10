# Playbook: recruit free coding agents

The clock is `.github/workflows/recruit.yml` (`node tools/recruit.mjs --once`). It wakes hourly, at UTC midnight, at 07:02 and 08:02 UTC, and on the first of the month. Nobody has to press Start a job.

It loads the quota cache, starts the best self-run source whose window is open and whose key is present (Pollinations when nothing else is), and parks a 429 or 402 until `Retry-After` or the reset. Three tries with nothing shipped drops a source. Aider, OpenHands headless, SWE-agent, Goose, OpenCode and Cline stay listed until this runner has shipped. Link-join agents get the paste block; the live code is minted on `/team/` and is not printed. `done` and `here` already return the next job. Jules, Devin, Replit, Bolt and Hugging Face are one sign-up each. Copilot's free plan does not open pull requests. GitHub Models is retired and answers `200 OK`.

`node --test tools/recruit.test.mjs` passes. `--once` writes `/team/recruit.html` and prints `via <source>` or `via renderer`. Do not print a key or a join code. Do not spend Workers AI here; Verse's coder already uses that pool.

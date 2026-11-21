# The owner workshop

An assistant calls Verse the way it calls any other toolbox. The door is `POST /api/workshop`, MCP JSON-RPC, and it answers only the owner. The check is the existing owner key or owner session (`lib/guard.js` `ownerOk`). No new secret is created.

## Tools

Each one calls something that already existed:

- `web_search` reads Wikipedia's public search.
- `web_fetch` fetches one public https address (`safeUrl`), text only, capped.
- `page_check` reads the latest self-check. It names the stranger gate and does not open a browser.
- `run_tests` queues one file from a closed list.
- `propose_change` queues `growth:proposal` for the self-build runner, which applies the files to a copy.
- `searches` reads the Searches log (`/api/searches`), the same list the owner Tower shows.
- `growth_stats` and `cost_log` read `/growth/latest.json`.
- `image_pick` uses the picture finder. `image_make` calls `/api/image`, under that route's caps.
- `deploy_status` reads the status guards and the self-check.
- `rollback` queues `heal:deploy`. The live-revert path does the git work. This tool does not force-push.

## How to tell it worked

`node --test tools/workshop.test.mjs`. A request with no owner key is 401.

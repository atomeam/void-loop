# How to log growth

Every change to what Void can do adds one line to `void-live-deploy/void.growth.json`. Nothing else: the ledger is the record, and "growth" on a-to-mind.com shows it, newest first.

```
node tools/grow.mjs grow "Poker: heads-up fixed-limit Hold'em against Void"
node tools/grow.mjs fix "the timer no longer stops at 59 s" --ref https://github.com/atomeam/void-loop/pull/205
node tools/grow.mjs idea "a tide chart for any harbour" --by grok
```

| kind | when |
|---|---|
| `grow` | Void can do a new thing |
| `build` | Void got better at something it already did |
| `fix` | something broken works again |
| `retire` | something removed or folded into Void (the cloud cleanup in BASE.md) |
| `idea` | from the idea stream, not built yet |
| `finding` | research or a test turned something up |

`--by` is who did it (a lowercase slug, `claude` by default); `--ref` an https link to the PR, commit or page. The time is now, in UTC. Write `what` in plain words, the way you would tell Adam.

The file is append-only: never edit or remove a line. `node tools/grow.mjs --check` validates it (`tools/checks.mjs` runs that through `tools/growth.test.mjs`), the shape is `void-live-deploy/void.growth.schema.json`, and `node tools/merge-main.mjs` keeps both sides' new entries when two branches add at once.

# Parity: what Verse took over, and what it did not

One page per thing Verse replaced, with what the old tool did, what Verse does instead, and the gaps, said plainly. Newest first.

## The two Zapier Zaps that logged void-loop's issues and pull requests → /ledger/ (2026-10-28)

**Before.** Two Zaps on a Zapier trial that ran out around 2026-11-10. One fired on each new GitHub pull request of atomeam/void-loop, the other on each
new issue (it filtered on `html_url` containing `/issues/`, because GitHub's issue trigger also returns pull requests). Both wrote a row to the Zapier
table "void-loop Activity Ledger".

**Now.** https://a-to-mind.com/ledger/ ("Repo activity ledger"). The browser reads GitHub's public REST API
(`/repos/{owner}/{repo}/issues?state=all`), which lists both kinds; a pull request is the item with a `pull_request` field, so no URL filter is
needed. No server, no token, no account, no KV writes.

| | Zapier (two Zaps + table) | /ledger/ |
|---|---|---|
| Issues and pull requests | two Zaps, one table | one list, two tabs (Issues, Pull requests) |
| Columns | title, number, URL, author, state, created | the same, plus merged and closed time, labels, comments, updated |
| History | only what happened while the Zaps were on | everything GitHub has (the first look reads the 2,000 newest; Load older reads on) |
| State | the state at the moment the row was written (an issue closed later stays "open" in the table) | the state now: a refresh re-reads every item changed since the last read |
| Merged vs closed | not told apart | told apart (`pull_request.merged_at`) |
| Search and filters | the table's own | search over title, number, author and labels; state, author, label, dates, sort, bots |
| Export | Zapier table export | CSV (opens in any spreadsheet, formula-safe) and JSON, copy as CSV |
| Sharing | share the table inside Zapier | a link that opens the exact repo, tab and filters |
| Other repos | one Zap per repo | any public repo, six kept on the device |
| Offline | no | the last copy opens offline |
| Cost | a paid plan after the trial | free |

**What it does not do, honestly.**

- **No push.** The Zaps ran on their own when something happened. The ledger reads when you open it or press Refresh; "N new since your last look"
  stands in for the trigger. Nothing is sent to another app on a new item (that is the part of Zapier this does not replace).
- **No server-side copy.** The table lived in Zapier's cloud. The ledger keeps the last copy on each device (localStorage), and GitHub itself is the
  record. For an archive, Download CSV or JSON.
- **Private repos.** Without a token only public repos can be read. void-loop is public, so this does not bite here.
- **The rate limit.** 60 requests an hour per network without a login. A first look at void-loop takes about 14 requests; a refresh is usually 1,
  and an unchanged answer (304, sent with the saved ETag) does not count. When the limit is used up the page says when it resets and keeps the saved copy.
- **Deleted or transferred items** stay in the device copy until it is cleared (GitHub's list no longer returns them, so a refresh cannot see them go).

**Why there is no scheduled GitHub Action.** A daily snapshot as an artifact was considered and left out: GitHub already keeps the full history, the
page reads it live, the device copy and the CSV/JSON export cover keeping one, and a daily job would only add CI minutes for a copy nobody reads.
If a dated archive is ever wanted, the export button is the archive.

**On the tower.** The Zapier floor (`automation` in `lib/tower.js`, probe in `tools/tower-probes.mjs`) is deferred like the other giants: one of
Zapier's thousands of jobs is done; triggers into other apps are not.

# /agent/: a background task the member can leave

Written 2026-11-05. Who does this best: Claude's computer use and Cowork pause on a tool that sends or spends, and Allow continues that step while Deny stops it; the transcript stays replayable. Grok's background tasks keep running after you leave and come back with a note. Verse's notch: the same shape on the free Workers AI tier only, and a yes never sends, pays or deletes, because this route has no outside executor.

## What starts it

A gap on https://a-to-mind.com/agent/ against that picture: the member cannot approve or decline and have the task resume or stop, cannot reopen a finished task's steps from the Made shelf, or comes back to a closed tab and is not told what finished. `node tools/agent-probe.mjs https://a-to-mind.com --all` is the live list of asks. Read `void-live-deploy/functions/api/agent.js`, `lib/agent-core.js`, `lib/agent-watch.js` and `agent/index.html` before adding another.

## The shape that worked

1. **Risky asks stop before anything leaves.** `needsYes` in `lib/agent-core.js` is the order to send, pay, book or delete. The model drafts first. The page shows Approve and Decline. `decisionOf` is the only wording: a yes sets `done`, keeps the draft, and says nothing was sent; a no sets `declined` and stops. The route writes that one step. It does not call a mail or payment executor.
2. **The inbox is a column, not a push service.** `seen` on `void_agent_tasks` starts at 0. `inboxOf` is every `needs_yes`, `done` or `failed` row that is still unseen. The page's first read (`tellOf` with `before = null`) shows that list and, if notifications are allowed, a notification even though the tab is visible, because the work happened while it was closed. It then POSTs `{ seen: [ids] }`. A later status change sets `seen` back to 0 inside `step`, so a task that was seen while waiting is news again when it finishes.
3. **Steps stay on the task.** GET `?thread=&task=` returns one task. The Made shelf is a `<details>` of those steps. An inbox button opens that same task.
4. **An exact bot spends no model call.** `planOf(ask).kind === 'bot'` (a `base64 …` ask, a unit, a prime) is answered by `routeFree` before the free model. Open asks still use the model.
5. **Verse can write first.** `planNudge` in `lib/agent-core.js` looks at the thread and returns one note: a job that finished in the background, a check (`check`, `remind`, `watch`) once six hours have passed, or a next step that quotes two earlier asks. `considerNudge` stores it on the free tier with the step `Verse wrote first.` The inbox and the notification already carry it, because it is a task with `seen` 0. A follow-up that would send, pay or delete is `needs_yes`, and approving it still sends nothing. One note a day. The page asks with `{ proactive: true }` about once a minute, and `run` writes the note when a task finishes so a closed tab finds it. A hidden tab with a check ask keeps reading every 60 seconds.

## How to tell it worked

- `node --test tools/agent-core.test.mjs tools/agent-watch.test.mjs tools/agent-probe.test.mjs`
- `node tools/test_void.mjs --only "agent inbox"` — the page shows the inbox, Approve resumes without sending, and the Made shelf reopens the steps.
- `node tools/real-pages.mjs --routes /agent/ --base local` — the same, in the page suite.
- After it is on main and the deploy has finished: `node tools/agent-probe.mjs https://a-to-mind.com --all`. The new asks are `approve`, `inbox` and `steps`. A closed tab is the second GET of `inbox` before `seen`.

## Mistakes made

- Marking a task seen forever hid the next status. `step` resets `seen` to 0 when the status becomes `needs_yes`, `done` or `failed`. A decline sets `seen` to 1, because that click was the member's.
- The first read of a visit used to ignore everything that happened while the tab was closed (`newsOf(null)` is still empty). The server inbox is that read. Do not treat a missing `inbox` on an old response as a failure; the page uses `j.inbox || []`.
- A yes that only stamped "the service is not connected" did not resume. The resume step is the draft landing on the Made shelf, with the sentence that nothing was sent.
- Two POSTs at once (the seen mark and a decision) must not rebuild the thread from a stale copy. The route updates one row. A test double that replaces the whole array has to run those posts one after another.
- Reading `tasks[0]` after a no sees Verse's newer note, which is still `needs_yes`, so the no looks lost. The no is the id it was sent to (`declineKept`, `taskById`).
- A note that exists only inside `waitUntil` never appears when a deploy drops that run. The pull request's deploy workflow goes green on its checks, before production is serving the commit (Verse engineer run 42015652554, nudge-risk timed out at 95s and passed in about 5s once it was live). The note is stored before the response (`writesFirst` on the list read), and the probe waits for that before a note ask, then retries on a new thread if the post still has no note.

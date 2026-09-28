# void.confirm-line: plan item 7, the confirm line (ApprovalEvent v0)

One plain line before anything that sends, books or spends. No cards and no jargon. Nothing else about the UI changes.
If the request changes, or nobody answers, it doesn't run. Read-only asks never see the line.

## Where it shows
In the whisper row under the input, the same quiet line Void already uses for status:
`<what will happen> <to whom / where>[ for <cost>]? Yes / No`
- `Send this email to jane@x.com? Yes / No`
- `Send this message to Sam? Yes / No`
- `Post these release notes to atomeam/void-loop? Yes / No`
- `Add “lunch with Sam” to your calendar for Friday at noon? Yes / No`
- `Book a table for 2 at Nopa on Friday at 7pm? Yes / No`
- `Buy 2 bags of coffee for $24? Yes / No`  (no price known: `Buy a pizza? The price isn't known yet. Yes / No`)
- `Pay Sam $20? Yes / No`
Answer by clicking Yes / No or typing yes / no. Asking something else withdraws it. After the answer Void says one word:
`sent` / `booked` / `done`, or `ok, nothing sent`, `no answer, nothing sent`, `that request changed, nothing sent`,
`email isn't connected yet, nothing sent` (and that need goes on the board as "send an email", with no addresses stored).

## What is gated (lib/approval-core.js `GATED`)
| toolName | kind | policyRuleId | asks that reach it |
| --- | --- | --- | --- |
| email.send | send | send.email | send an email to X (saying …), email X … |
| message.send | send | send.message | send a text/message to X …, text X saying … |
| release.publish | send | send.post | post the release notes to <repo> (assimilate row: release notes) |
| calendar.book | book | book.calendar | add X to my calendar …, schedule X …, book a meeting/call with X … |
| booking.make | book | book.booking | book/reserve a table / tickets / a room … |
| order.place | spend | spend.order | buy / order / purchase X (for $N) |
| payment.send | spend | spend.payment | pay X $N, send $N to X |
Not gated (read-only or on-device): pages, answers (/api/answer), weather, maps, translate, calculations, stage things, look, keep, the board,
the miss list, `?q=` reads, and "how do I send an email"-style questions. Owner build asks (`update yourself`) stay as they are (see open questions).
Only the owner (after `unlock`) can start a gated action for now; visitors get "only the owner can ask that".

## How it runs
1. The page recognises a gated ask (`parseGatedAsk`), fingerprints `{tool, args}` (SHA-256 of sorted JSON) and posts
   `a2m.approval.requested` to `/api/approval`. The server re-fingerprints; a different fingerprint is refused (409).
   It stores the paused action in D1 `void_approvals` (args snapshot, fingerprint, policy, expiresAt) and returns the record.
2. The page checks the returned fingerprint against its own, then shows the line. Nothing has run.
3. Yes / No / no answer becomes `a2m.approval.decision`. The server claims the approval (`pending` -> `deciding`, conditional,
   so it can only be decided once), then:
   - reject / escalate: need a reason (400 without one); nothing runs.
   - timeout, or any answer after expiresAt: recorded as timeout; nothing runs (fails closed).
   - approve: `resumeOnDecision` re-fingerprints the stored snapshot; it must equal both the stored fingerprint and the one
     in the decision event (what the person saw). Any mismatch = hard fail, state `failed`, nothing runs (409).
     Otherwise the tool's executor runs, once.
4. Every decision writes a `void_ledger` row (ledgerEntryId); "what did you do today" (assimilate row 4) can read it.

ApprovalEvent v0 fields on the record: approvalId, runId, orgId (`a2m`), workflowId (`void.ask`), stepId (toolName), toolName,
argsFingerprint, argsSnapshot, policyVersion (`void-confirm-v0.1`), policyRuleId, budgetImpact, requestedAt, requestedBy,
expiresAt (now + 2 min; `CONFIRM_TTL_MS` env overrides), correlateKey (= approvalId); decision (approve | reject | timeout | escalate),
actor, reason, decidedAt, ledgerEntryId.

## Executors (what actually sends / books / spends)
None are connected yet, so an approved action is recorded as `approved-not-run` and Void says so honestly.
To connect one: add `executors['email.send'] = async (args, env) => { ... }` in `functions/api/approval.js` (or import it there).
It is only ever called from `resumeOnDecision`, after an in-time approve with a matching fingerprint.

## Setup
None needed: `/api/approval` creates its two tables and one index on first use (`CREATE ... IF NOT EXISTS`, once per isolate),
because `tools\deploy.ps1` doesn't run D1 SQL. `tools/d1/void_approvals.sql` is the same SQL if you'd rather make them ahead of time.
If the tables can't be made or reached, `/api/approval` answers 503 and the page says "couldn't ask for a yes, nothing sent" (fails closed).
Writes per gated action: 1 (request) + 3 (claim, ledger, final record). Watch the D1 free-tier daily limit.

## The Workflows gap
The repo is a Cloudflare Pages project (Pages Functions + D1 + KV + Workers AI). Pages can't host a Workflow class;
Cloudflare's docs say to deploy the Workflow in a separate Worker and reach it from Pages through a service binding.
So today the pause lives in D1 and the continuation is `resumeOnDecision`. Same events, same rules, same fields.
Moving to Workflows later (a Worker, e.g. `a2m-actions`, bound to Pages as `ACTIONS`):
```js
export class VoidAction extends WorkflowEntrypoint {
  async run(event, step) {                       // event.payload = the a2m.approval.requested record
    const req = event.payload;
    let d;
    try { d = await step.waitForEvent('await the confirm line', { type: WORKFLOW_EVENT_TYPE, timeout: '2 minutes' }); }
    catch (_) { return { decision: 'timeout', ran: false }; }            // no answer: fails closed
    const ev = d.payload;                          // the a2m.approval.decision event
    if (ev.decision !== 'approve') return { decision: ev.decision, ran: false };
    const fp = await step.do('fingerprint', () => fingerprint(req.toolName, req.argsSnapshot));
    if (fp !== req.argsFingerprint || ev.argsFingerprint !== req.argsFingerprint) throw new NonRetryableError('fingerprint mismatch');
    return step.do('run ' + req.toolName, () => executors[req.toolName](req.argsSnapshot, this.env));
  }
}
// decision endpoint: await (await env.ACTIONS_WF.get(approvalId)).sendEvent({ type: WORKFLOW_EVENT_TYPE, payload: decisionEvent })
```
Note: Workflows event `type` (and instance ids) must match `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`, so `a2m.approval.decision` cannot be
the literal wire type; it travels as `a2m-approval-decision` (`WORKFLOW_EVENT_TYPE`). approvalId (a UUID) works as the instance id.

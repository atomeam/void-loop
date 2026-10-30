# Playbook: a page of Verse's own that broke

**What starts it.** The status card ("verse status") says "Verse’s own pages · N of M pages need a fix", or opens by itself for the owner because one is broken. The same report is `GET /api/selfcheck`, and each run of `.github/workflows/self-check.yml` (after a deploy, at most once in two hours, or on dispatch) has it in its summary and its `self-check` artifact.

**The commands.**
1. Read the report: `curl -s https://a-to-mind.com/api/selfcheck | jq '.report.pages[] | select(any(.problems[]; .kind | IN("status","script","request","empty","link")))'`. Serious kinds first (does not open, script error, a file or API it needs fails, shows nothing, dead link), then light page, wording, not wired.
2. Find the page: `void-live-deploy/<path>/index.html`. A failed request names the file or `/api/...` route; the route is `void-live-deploy/functions/api/<name>.js`.
3. Fix the smallest thing that makes the page do what it says. A white page takes the design tokens (`docs/design.md`): `#050505` behind, ink `#f2f4fb`. Not wired: mount the "Use with" row (`lib/toolkit.js` `mountRelated(el, location.pathname, handoffs)`) and add the page to `TOOLS` and `RELATED` there.
4. Test only what you changed (`node --test tools/<the page>.test.mjs`), then ship the usual way (`tools/finish.mjs`, an automerge PR).
5. After the deploy, check just that page: dispatch the workflow with `only=/the/page/` (`gh workflow run self-check.yml -f only=/the/page/`), and read its summary. The next full run takes it off the card.

**How to tell it worked.** The page is gone from the next full report, and the card's count went down by it. Never take a page off by changing the judge (`lib/selfcheck.js`) unless the judge was wrong about it: say why in the PR, with a test in `tools/selfcheck.test.mjs`.

**Mistakes already made.** A partial run (`only=`) never replaces the full report, so the card never says "all 2 pages fine" about a site of 439. A run that could not read the report shows no section rather than "not checked yet".

# Check Verse and record a failed recovery

The existing Pages guard runs after pushes and on its existing schedule. The deploy workflow also checks the upload and the public site. Do not add another timer for the same checks.

## Use it

- Run `node --test tools/pages-guard.test.mjs tools/actions-failure.test.mjs` before changing the guard.
- After a deploy, `node tools/pages-guard.mjs check https://a-to-mind.com` checks the home page, the tools list and the answer route. This sends an answer request, so do not run it repeatedly for unrelated changes.
- `check` needs no credentials and never rolls back. `guard` and `heal` use Cloudflare secrets from the environment and can roll production back. Do not run either as a casual test.

## Tell whether it worked

A successful check exits zero. Each site request has a 60-second deadline that also covers the body. A tools list must be an array with at least 100 entries; an answer must be nonempty text. Malformed JSON, empty answers, HTTP errors and timeouts produce failures, not healthy results. The existing retry and rollback selection rules are unchanged.

When Pages guard fails or times out on main, Actions failure reader records its failed job and masked log in `void-live-deploy/incidents/actions/`. The next deploy assembles that record for the incident view. If all four attempts to push the record fail, the reader exits nonzero instead of reporting success. A recovery that succeeds does not create a failed-workflow record.

## Mistakes to avoid

A string has a length too, so length alone does not prove that tools is an array. A blank string is still text, so checking only its type does not prove that an answer exists. A timeout must stay attached while reading the response body, not only until its headers arrive. Keep the guard test registered in `tools/checks.d/pages-guard.chk` so the normal check runner actually runs it.

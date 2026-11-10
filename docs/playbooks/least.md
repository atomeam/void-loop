# The Tower

Add the site to `SITES` in `void-live-deploy/lib/least.js`. A job is a function with `prove()`, plus a page that does the job and cites who made the site. `node --test tools/least.test.mjs`. A site is listed on `/conquered/` only when every `prove()` holds. A site that needs a licence or a private feed gets `aside` and is not listed. A first archive date is not a history.

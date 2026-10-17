# See a repo: an open endpoint that reads somewhere else's text

**Starts when:** V01D should answer from a live outside source that strangers name (a repo, a page, a feed) and the source holds text other people wrote.

1. **Name in, path out.** The caller sends only a name. Validate it with one anchored regex (`NAME_RE` in `lib/repo-look.js`), parse links first (`parseRepo`), then build every URL on the server from the checked name. A caller never picks a host, path, query or header. Fetch with `redirect: 'manual'` and follow a redirect only when it stays on the same host with a numeric id (GitHub's renamed-repo case).
2. **Bound the cost.** Cap each body while reading the stream, cap files and commits, give each call a time limit, cache a good answer on the edge (`caches.default`, ten minutes) and never cache a failure, and rate-limit only the cache misses in the route's own bucket (`rateLimited()`) on top of the `LIMITS` row in `lib/guard.js`. Write the "what could a stranger make this do" paragraph at the top of the route.
3. **Outside text is data.** Clean it on the server (`clean()`: control and bidi characters out, key shapes through `redact()`, length cap), escape it on the page, and do not hand it to a model. Summaries are cut by code (`readmeSummary`).
4. **No token.** Unauthenticated REST only. A test asserts no `authorization` header is ever sent.
5. **Say what you cannot do.** Private, missing and rate-limited are three plain sentences, not one error.
6. **Test with a fake outside world** (`tools/repo-look.test.mjs`: a fake fetch that asserts the host, the manual redirect and the missing token), then one browser section with `/api/repo` mocked.

**Mistakes made:** the ask parser first took `x/y` and `and/or` as repos (a skip list and a "needs a look-at word or a github.com link" rule fixed it); a pasted github.com link was taken by the link skill unless this skill ranks before it (`0008-repo`); a link-card ask ("add a link https://github.com/x/y") must stay with the link skill.

// Small server helpers (convergence step 3, lists run 22, 2026-11-12; docs/convergence.md). The JSON reply that 25 endpoints each
// wrote out as their own one-line `json` now has one copy here, in its two forms; an endpoint with a different cache rule keeps its own.
//   json(o, status = 200, extra = {})          the reply with only the headers given (an endpoint's own cache rule rides in extra)
//   jsonNoStore(o, status = 200, extra = {})   the same, never cached unless extra says otherwise ('cache-control': 'no-store' first)
//   jsonOkCached(o, status = 200, maxAge, extra = {})   public for maxAge seconds when the status is 200, no-store otherwise (status, crew, autopilot)
// Step 3's second half (lists run 23, 2026-11-12): the 23 endpoints whose json had its own cache rule, extra header or argument order keep a
// one-line wrapper with their old signature that calls one of these three, so no reply changed (tools/http-helpers.test.mjs).

/** A JSON response with the status and only the headers given. Pure. */
export const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
/** A JSON response marked no-store; extra headers win (an endpoint may set its own cache-control). Pure. */
export const jsonNoStore = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
/** A JSON response cached publicly for maxAge seconds on a 200, never cached otherwise; extra headers win. Pure. */
export const jsonOkCached = (o, status = 200, maxAge = 60, extra = {}) => Response.json(o, { status, headers: { 'cache-control': status === 200 ? 'public, max-age=' + maxAge : 'no-store', ...extra } });

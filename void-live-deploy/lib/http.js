// Small server helpers (convergence step 3, lists run 22, 2026-11-12; docs/convergence.md). The JSON reply that 25 endpoints each
// wrote out as their own one-line `json` now has one copy here, in its two forms; an endpoint with a different cache rule keeps its own.
//   json(o, status = 200, extra = {})          the reply with only the headers given (an endpoint's own cache rule rides in extra)
//   jsonNoStore(o, status = 200, extra = {})   the same, never cached unless extra says otherwise ('cache-control': 'no-store' first)

/** A JSON response with the status and only the headers given. Pure. */
export const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
/** A JSON response marked no-store; extra headers win (an endpoint may set its own cache-control). Pure. */
export const jsonNoStore = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });

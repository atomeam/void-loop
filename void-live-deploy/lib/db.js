// Small server helpers for D1 (convergence step 3, lists run 24, 2026-11-12; docs/convergence.md). About 20 endpoints each wrote out the same
// table-making promise: `let ready = null`, made once per isolate, forgotten when making fails so the next request tries again, and a
// resetReady() so a test's new fake database gets its tables made again. That promise has one copy here.
//   readyOnce(make)      -> ready(env): runs make(env) once and shares the promise; a failure forgets it, so the next call tries again.
//                           ready.reset() forgets it on purpose (tests).
//   tablesReady(sqls)    -> the same, where make runs each statement in order (CREATE TABLE / CREATE INDEX IF NOT EXISTS ...)
//   batchReady(sqls, then) -> the same, where the statements go to D1 in one batch, then then(env) runs if given (lists run 25)

/** One shared promise per isolate for the work that makes an endpoint's tables. Pure apart from the promise it keeps. */
export function readyOnce(make) {
  let p = null;
  const ready = (env) => {
    if (!p) p = (async () => make(env))().catch((e) => { p = null; throw e; });
    return p;
  };
  ready.reset = () => { p = null; };
  return ready;
}
/** readyOnce over a list of SQL statements run in order on env.DB. */
export const tablesReady = (sqls) => readyOnce(async (env) => { for (const s of sqls) await env.DB.prepare(s).run(); });
/** readyOnce over one D1 batch of SQL statements, then an optional follow-up (another endpoint's tables). */
export const batchReady = (sqls, then) => readyOnce(async (env) => { await env.DB.batch(sqls.map((q) => env.DB.prepare(q))); if (then) await then(env); });

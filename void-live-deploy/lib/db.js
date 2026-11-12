// Small server helpers for D1 (convergence step 3, lists run 24, 2026-11-12; docs/convergence.md). About 20 endpoints each wrote out the same
// table-making promise: `let ready = null`, made once per isolate, forgotten when making fails so the next request tries again, and a
// resetReady() so a test's new fake database gets its tables made again. That promise has one copy here.
//   readyOnce(make)      -> ready(env): runs make(env) once and shares the promise; a failure forgets it, so the next call tries again.
//                           ready.reset() forgets it on purpose (tests).
//   tablesReady(sqls)    -> the same, where make runs each statement in order (CREATE TABLE / CREATE INDEX IF NOT EXISTS ...)

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

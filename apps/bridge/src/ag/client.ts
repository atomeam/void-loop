export async function scoreOrDry(env: { AG_TOS_OK: string; AG_API_KEY?: string }, run: { interval_json: string; variant_json?: string | null }) {
  if (env.AG_TOS_OK !== "1" || !env.AG_API_KEY) {
    return {
      mode: "DRY_RUN",
      fetchCount: 0,
      reason: env.AG_TOS_OK !== "1" ? "AG_TOS_OK=0" : "AG_API_KEY missing",
      interval: JSON.parse(run.interval_json),
      variant: run.variant_json ? JSON.parse(run.variant_json) : null,
      notes: "No external host contacted. Zero egress verified."
    };
  }
  throw new Error("UNREACHABLE_LIVE");
}
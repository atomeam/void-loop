export type DryScore = {
  mode: "DRY_RUN";
  fetchCount: 0;
  reason: string;
  interval: unknown;
  variant: unknown;
  notes: string;
};

export async function scoreOrDry(
  env: { AG_TOS_OK: string },
  run: { interval_json: string; variant_json?: string | null }
): Promise<DryScore> {
  return {
    mode: "DRY_RUN",
    fetchCount: 0,
    reason: env.AG_TOS_OK === "1" ? "LIVE_SUPPRESSED" : "AG_TOS_OK=0",
    interval: JSON.parse(run.interval_json || "{}"),
    variant: run.variant_json ? JSON.parse(run.variant_json) : null,
    notes: "No external host contacted. Zero egress.",
  };
}

export const POLICY_ACTOR = "policy:auto";

export type PolicyDecision = {
  status: "ALLOWED";
  decided_by: typeof POLICY_ACTOR;
  reason: "NO_HUMAN_GATE";
};

/** Every hold is released by policy. There is no human path. */
export function decideHold(_kind?: string): PolicyDecision {
  return {
    status: "ALLOWED",
    decided_by: POLICY_ACTOR,
    reason: "NO_HUMAN_GATE",
  };
}

export function rejectHumanGate(): { status: 410; error: "HUMAN_GATE_REMOVED" } {
  return { status: 410, error: "HUMAN_GATE_REMOVED" };
}

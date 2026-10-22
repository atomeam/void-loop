import { describe, expect, it } from "vitest";
import { decideHold, rejectHumanGate } from "./policy";

describe("policy hold", () => {
  it("auto-releases every kind", () => {
    expect(decideHold("score")).toEqual({
      status: "ALLOWED",
      decided_by: "policy:auto",
      reason: "NO_HUMAN_GATE",
    });
  });

  it("human allow route is gone", () => {
    expect(rejectHumanGate()).toEqual({ status: 410, error: "HUMAN_GATE_REMOVED" });
  });
});

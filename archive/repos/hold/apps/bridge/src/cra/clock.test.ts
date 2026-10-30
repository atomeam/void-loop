import { describe, expect, it } from "vitest";
import { classifyDeadline, deriveDeadlines } from "./clock";

describe("Art.14 clock", () => {
  const awareness = new Date("2026-09-12T00:00:00.000Z");

  it("AEV offsets", () => {
    const d = deriveDeadlines({ kind: "AEV", awarenessAt: awareness });
    expect(d.early_24h.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(d.notify_72h.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(d.final_14d.toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  it("AEV final uses measure_at", () => {
    const d = deriveDeadlines({
      kind: "AEV",
      awarenessAt: awareness,
      measureAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    expect(d.final_14d.toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });

  it("classifies due vs missed", () => {
    const due = new Date("2026-09-12T00:00:00.000Z");
    expect(classifyDeadline(new Date("2026-09-12T00:00:30.000Z"), due, null)).toBe("DUE");
    expect(classifyDeadline(new Date("2026-09-12T00:02:00.000Z"), due, null)).toBe("MISSED");
    expect(classifyDeadline(new Date("2026-09-12T00:02:00.000Z"), due, due)).toBe("MET");
  });
});

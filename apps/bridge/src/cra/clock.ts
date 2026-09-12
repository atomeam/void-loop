export type CaseKind = "AEV" | "SI";
export type Stage = "early_24h" | "notify_72h" | "final_14d" | "final_1m";

export const BACKDATE_MAX_MS = 5 * 60 * 1000;

export function parseIsoZ(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s)) {
    throw Object.assign(new Error("AWARENESS_BAD_ISO"), { code: "AWARENESS_BAD_ISO", status: 422 });
  }
  return new Date(s);
}

export function assertAwareness(now: Date, awarenessAt: Date): void {
  const delta = now.getTime() - awarenessAt.getTime();
  if (delta < -1000) {
    throw Object.assign(new Error("AWARENESS_FUTURE"), { code: "AWARENESS_FUTURE", status: 422 });
  }
  if (delta > BACKDATE_MAX_MS) {
    throw Object.assign(new Error("AWARENESS_BACKDATE"), { code: "AWARENESS_BACKDATE", status: 422 });
  }
}

export function deriveDeadlines(input: {
  kind: CaseKind;
  awarenessAt: Date;
  measureAt?: Date | null;
  notify72hFiledAt?: Date | null;
}): Record<Stage, Date | null> {
  const a = input.awarenessAt.getTime();
  return {
    early_24h: new Date(a + 24 * 3600_000),
    notify_72h: new Date(a + 72 * 3600_000),
    final_14d: input.kind === "AEV" && input.measureAt ? new Date(input.measureAt.getTime() + 14 * 24 * 3600_000) : null,
    final_1m: input.kind === "SI" && input.notify72hFiledAt ? new Date(input.notify72hFiledAt.getTime() + 30 * 24 * 3600_000) : null,
  };
}
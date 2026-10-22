export type CaseKind = "AEV" | "SI";
export type Stage = "early_24h" | "notify_72h" | "final_14d" | "final_1m";

export function parseIsoZ(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s)) {
    throw Object.assign(new Error("AWARENESS_BAD_ISO"), { code: "AWARENESS_BAD_ISO", status: 422 });
  }
  return new Date(s);
}

export function assertAwareness(now: Date, awarenessAt: Date): void {
  if (awarenessAt.getTime() - now.getTime() > 1000) {
    throw Object.assign(new Error("AWARENESS_FUTURE"), { code: "AWARENESS_FUTURE", status: 422 });
  }
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 3600_000);
}

export function deriveDeadlines(input: {
  kind: CaseKind;
  awarenessAt: Date;
  measureAt?: Date | null;
  notify72hFiledAt?: Date | null;
}): Record<Stage, Date> {
  const early = addHours(input.awarenessAt, 24);
  const notify = addHours(input.awarenessAt, 72);
  const finalAev = addDays(input.measureAt ?? input.awarenessAt, 14);
  const finalSi = addDays(input.notify72hFiledAt ?? notify, 30);
  return {
    early_24h: early,
    notify_72h: notify,
    final_14d: input.kind === "AEV" ? finalAev : addDays(input.awarenessAt, 14),
    final_1m: input.kind === "SI" ? finalSi : addDays(notify, 30),
  };
}

export function classifyDeadline(now: Date, dueAt: Date, filedAt: Date | null): "PENDING" | "DUE" | "MET" | "MISSED" {
  if (filedAt) return "MET";
  const delta = now.getTime() - dueAt.getTime();
  if (delta < 0) return "PENDING";
  if (delta <= 60_000) return "DUE";
  return "MISSED";
}

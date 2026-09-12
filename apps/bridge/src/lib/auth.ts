/** Machine auth only. Human keys are not a valid principal. */

export type Principal = { kind: "service"; id: string } | null;

export function principal(req: Request, env: { SERVICE_KEY?: string }): Principal {
  if (req.headers.get("x-hold-human-key")) {
    return null;
  }
  const service = req.headers.get("x-hold-service-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (env.SERVICE_KEY) {
    if (!service || service !== env.SERVICE_KEY) return null;
    return { kind: "service", id: "svc:bridge" };
  }
  return { kind: "service", id: "svc:open" };
}

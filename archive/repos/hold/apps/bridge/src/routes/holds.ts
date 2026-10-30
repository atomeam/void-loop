import { Hono } from "hono";
import { rejectHumanGate } from "../policy";
import { readHold } from "../holds";

const holds = new Hono<{ Bindings: { BRIDGE_DB: D1Database } }>();

holds.post("/:id/allow", (c) => c.json(rejectHumanGate(), 410));
holds.post("/:id/deny", (c) => c.json(rejectHumanGate(), 410));

holds.get("/:id", async (c) => {
  const row = await readHold(c.env.BRIDGE_DB, c.req.param("id"));
  if (!row) return c.json({ error: "HOLD_NOT_FOUND" }, 404);
  return c.json(row);
});

export const handleHolds = holds;

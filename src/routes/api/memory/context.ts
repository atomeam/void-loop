import { createFileRoute } from "@tanstack/react-router";
import { memoryContext } from "@/server/ledger.server";

export const Route = createFileRoute("/api/memory/context")({
  server: {
    handlers: {
      GET: async () => Response.json(await memoryContext()),
    },
  },
});

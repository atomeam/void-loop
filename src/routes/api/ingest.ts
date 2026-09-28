import { createFileRoute } from "@tanstack/react-router";
import { ingestEntry } from "@/server/ledger.server";

export const Route = createFileRoute("/api/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Expected JSON" }, { status: 400 });
        }
        try {
          const result = await ingestEntry(raw);
          return Response.json(result, { status: result.idempotent ? 200 : 201 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Ingest failed";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});

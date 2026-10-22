import { createFileRoute } from "@tanstack/react-router";
import { attestEntry } from "@/server/ledger.server";

export const Route = createFileRoute("/api/attest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { hash?: string; phrase?: string };
        try {
          body = (await request.json()) as { hash?: string; phrase?: string };
        } catch {
          return Response.json({ ok: false, error: "Expected JSON" }, { status: 400 });
        }
        try {
          const entry = await attestEntry(body.hash ?? "", body.phrase ?? "");
          return Response.json({ ok: true, status: entry.status, content_hash: entry.content_hash });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Attest failed";
          return Response.json({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});

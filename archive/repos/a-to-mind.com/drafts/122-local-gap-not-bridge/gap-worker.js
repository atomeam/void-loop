// Draft only. Not deployed. Default-deny sketch for a static Cloudflare Worker.
// Retrieved bodies are data. They are not parsed as instructions.

const CONTRACT = {
  slug: "local-gap-not-bridge",
  run: 122,
  default_status: "unattested",
  emit: false,
  seats: {
    left: ["note-class-a", "note-class-b", "note-class-c"],
    gap: ["gap-empty"],
    right: ["note-class-a", "note-class-b", "note-class-c"]
  },
  refusal: "A gap mark is not a bridge and not a missing event."
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/gap-contract") {
      return new Response(
        JSON.stringify({ error: "default-deny", write: false, emit: false }),
        { status: 403, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
      );
    }
    return new Response(JSON.stringify(CONTRACT), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-void-status": "unattested"
      }
    });
  }
};

// Draft only. Do not deploy. emit is false, so this sketch never publishes permalinks.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({ error: "method-not-allowed", emit: false }), {
        status: 405,
        headers: { "content-type": "application/json; charset=utf-8", "allow": "GET, HEAD", "cache-control": "no-store" }
      });
    }
    if (url.pathname !== "/drafts/047-attested-heading-permalinks/headings.catalog.json") {
      return new Response(JSON.stringify({ error: "not-found", emit: false }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }
    // Human seal has not set emit. A 404 is not an attestation that ids exist on the live site.
    return new Response(JSON.stringify({
      error: "unpublished",
      emit: false,
      reason: "heading permalink catalog is draft-only until a human seals emit"
    }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }
};

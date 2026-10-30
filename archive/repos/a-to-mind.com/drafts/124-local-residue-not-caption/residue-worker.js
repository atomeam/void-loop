export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method denied", { status: 405, headers: { "cache-control": "no-store" } });
    }
    if (url.pathname !== "/drafts/124-local-residue-not-caption/proposed-residue.html") {
      return new Response("not a sealed path", { status: 404, headers: { "cache-control": "no-store" } });
    }
    return new Response("static draft only; worker does not hash", {
      status: 403,
      headers: { "cache-control": "no-store" }
    });
  }
};

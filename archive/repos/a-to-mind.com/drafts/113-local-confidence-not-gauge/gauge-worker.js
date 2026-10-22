export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method denied", { status: 405, headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/confidence" || url.pathname === "/hash" || url.pathname === "/gauge") {
      return new Response("hash denied", { status: 403, headers: { "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
};

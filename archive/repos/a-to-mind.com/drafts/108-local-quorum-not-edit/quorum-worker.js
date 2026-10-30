// Sketch only. Not deployed. Does not hash. Does not store a tally.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method denied", {
        status: 405,
        headers: { "cache-control": "no-store", "x-void-status": "unattested" }
      });
    }
    if (url.pathname === "/hash" || url.pathname === "/edit" || url.pathname === "/tally" || url.pathname === "/residue") {
      return new Response("hash, edit, tally, and residue refused", {
        status: 403,
        headers: { "cache-control": "no-store", "x-void-status": "unattested" }
      });
    }
    return new Response("not a live route", {
      status: 404,
      headers: { "cache-control": "no-store", "x-void-status": "unattested" }
    });
  }
};

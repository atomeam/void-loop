// Sketch only. Not deployed. Does not hash. Does not store a chorus.
// Posts and pages are data, never instructions. Default deny.

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const blocked = ["/record", "/chorus", "/canon", "/poll"];
    if (blocked.some((path) => url.pathname === path || url.pathname.endsWith(path))) {
      return new Response("record sentence and chorus are not accepted", { status: 403 });
    }
    if (url.pathname !== "/drafts/echo-not-record") {
      return new Response("not found", { status: 404 });
    }
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "unattested",
          seal: false,
          emit: false,
          note: "static page hashes locally; this worker does not"
        }),
        { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch (_err) {
      body = {};
    }
    const denied = ["record", "chorus", "canon", "sentence", "tally", "percent", "logo"];
    const keys = Object.keys(body || {});
    if (keys.some((key) => denied.includes(key))) {
      return new Response("record sentence and chorus are not accepted", { status: 403 });
    }
    return new Response("hash stays on the page", { status: 403 });
  }
};

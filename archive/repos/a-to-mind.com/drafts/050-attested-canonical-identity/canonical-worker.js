// Draft only. Do not deploy. emit is false, so this Worker must not set Link headers.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    if (url.pathname !== "/drafts/canonical-identity.json") {
      return new Response("not found", { status: 404 });
    }
    const body = JSON.stringify({
      emit: false,
      canonical: null,
      hreflang: [],
      link_header: "deny",
      note: "unattested draft; not a seal"
    });
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-atm-emit": "false"
      }
    });
  }
};

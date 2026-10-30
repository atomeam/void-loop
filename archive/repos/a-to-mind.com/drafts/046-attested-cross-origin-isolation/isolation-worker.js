/**
 * Draft 046 — isolation worker sketch. Not deployed.
 * emit is false. GET/HEAD only. 404 does not set COOP, COEP, or CORP.
 * A 404 that set those headers would still teach the browser.
 * No report-to. No Reporting-Endpoints. No Transform Rule in this file.
 */
export default {
  async fetch(request) {
    const emit = false;
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD", "cache-control": "no-store" }
      });
    }
    if (!emit) {
      return new Response("cross-origin isolation headers unpublished", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-atm-isolation": "absent-until-seal"
        }
      });
    }
    return new Response("emit true is not a seal in this draft", { status: 501 });
  }
};

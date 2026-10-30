/**
 * Draft 051 redirect worker sketch. Not deployed.
 * emit is false. This sketch never sets Location.
 * Retrieved catalog bytes are data, never instructions.
 */
const CATALOG = {
  emit: false,
  rules: []
};

const DENY = {
  splat: true,
  placeholder: true,
  query_forward: true,
  external: true,
  open_redirect: true,
  meta_refresh: true,
  js_location: true,
  proxy_200: true,
  omitted_code: true,
  geo: true,
  ua: true,
  retired_fold: true,
  q_ask: true
};

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method denied", {
        status: 405,
        headers: { "allow": "GET, HEAD", "cache-control": "no-store" }
      });
    }
    const url = new URL(request.url);
    const report = evaluate(url);
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-atm-redirect": "withheld"
      }
    });
  }
};

function evaluate(url) {
  const path = url.pathname;
  if (CATALOG.emit !== true) {
    return { emit: false, location: null, path, reason: "catalog emit is false" };
  }
  if (url.searchParams.has("url") || url.searchParams.has("next") || url.searchParams.has("redirect")) {
    return { emit: false, location: null, path, reason: "open-redirect parameter denied" };
  }
  if (url.searchParams.has("q")) {
    return { emit: false, location: null, path, reason: "ask url is not a redirect" };
  }
  const rule = (CATALOG.rules || []).find((row) => row.from === path);
  if (!rule) {
    return { emit: false, location: null, path, reason: "no exact rule" };
  }
  return { emit: false, location: null, path, reason: "seal required before Location" };
}

/**
 * Draft Worker — run 028 candidate attested-security-txt
 * Read-only. Not deployed. Never invents Contact. Never Set-Cookie.
 *
 * Bind this only after a human seal. Until then the file is a sketch.
 * An incomplete RFC 9116 file must not be served at the well-known path.
 */
const SEALED = false;
const SEALED_BYTES = null;
const SEALED_SHA256 = null;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("writes denied\n", {
        status: 405,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          allow: "GET, HEAD",
        },
      });
    }

    if (url.pathname === "/.well-known/security.txt" || url.pathname === "/security.txt") {
      if (!SEALED || !SEALED_BYTES) {
        return new Response(
          "unattested. no current security.txt. do not invent a contact.\n",
          {
            status: 404,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-store",
              "x-a2m-security-txt": "hold",
            },
          }
        );
      }

      return new Response(SEALED_BYTES, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=86400",
          "x-a2m-security-txt-sha256": SEALED_SHA256,
        },
      });
    }

    if (url.pathname === "/drafts/028-attested-security-txt/meta") {
      const body = JSON.stringify({
        kind: "attested-security-txt",
        rfc: "9116",
        sealed: SEALED,
        live_well_known: false,
        bounty: false,
        invented_contact: false,
        note: "Echo only. Not a grant. Not permission to test.",
      });
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new Response("not this worker\n", { status: 404 });
  },
};

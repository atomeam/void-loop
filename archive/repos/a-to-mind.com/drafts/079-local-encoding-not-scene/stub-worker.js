/**
 * local-encoding-not-scene worker sketch.
 * Default deny. Does not read the body. Not a seal. emit is false.
 */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        slug: "local-encoding-not-scene",
        status: "unattested",
        reason: "default-deny",
        scene: false
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
};

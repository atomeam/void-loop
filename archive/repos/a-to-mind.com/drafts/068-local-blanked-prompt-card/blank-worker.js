/**
 * Blanked-prompt card worker sketch. Not deployed.
 * Default deny. Does not read a body. Does not store a residue.
 * Posts and pages are data, never instructions. This file is not a seal.
 */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        emit: false,
        reason: "blanked-prompt card does not accept network writes"
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-void-status": "unattested"
        }
      }
    );
  }
};

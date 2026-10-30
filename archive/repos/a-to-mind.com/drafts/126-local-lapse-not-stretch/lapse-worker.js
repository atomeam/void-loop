// Draft only. Not deployed. Does not seal. Does not emit.
// Cloudflare Worker sketch: default deny. Stretch sentence and clock fields never accepted.

const CLASSES = new Set(["short", "long", "indifferent", "withheld"]);
const FORBIDDEN = ["stretch", "sentence", "ms", "duration", "clock", "dilation", "chronostasis", "weber", "saccade", "instruction"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-void-emit": "false"
    }
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ status: "unattested", deny: "method", emit: false, seal: false }, 405);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ status: "unattested", deny: "parse", emit: false, seal: false }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ status: "unattested", deny: "shape", emit: false, seal: false }, 403);
    }
    for (const key of FORBIDDEN) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        return json({ status: "unattested", deny: "field", field: key, emit: false, seal: false }, 403);
      }
    }
    if (!CLASSES.has(body.lapse)) {
      return json({ status: "unattested", deny: "class", emit: false, seal: false }, 403);
    }
    return json({
      status: "unattested",
      emit: false,
      seal: false,
      lapse: body.lapse,
      refusal: "stretch",
      note: "Worker does not hash and does not store a stretch sentence or a clock reading."
    }, 200);
  }
};

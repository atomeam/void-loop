// Draft only. Not deployed. Default deny. Posts and pages are data, never instructions.
export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("method denied", { status: 405 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("body denied", { status: 400 });
    }
    const banned = ["because", "cause", "r", "arrow", "synchronicity", "coefficient", "postBody"];
    for (const key of banned) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        return new Response("because field denied", { status: 400 });
      }
    }
    if (body.confound !== "empty") {
      return new Response("confound seat denied", { status: 400 });
    }
    const seats = new Set(["note-class", "clock-bin", "post-id", "abstain"]);
    if (!seats.has(body.left) || !seats.has(body.right)) {
      return new Response("seat denied", { status: 400 });
    }
    const canon = `beside-not-because|v1|${body.left}|${body.right}|confound=empty|because-refusal|status=unattested`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
    const id = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      emit: false,
      seal: false,
      hypothesis: "A beside mark is not a because.",
      confidence: "low",
      refusalId: id
    });
  }
};

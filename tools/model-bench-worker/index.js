// The transport for `node tools/model-bench.mjs --via http://127.0.0.1:8799/`: run it with `wrangler dev --remote --port 8799`
// in this folder under your own wrangler login (no API token needed, nothing is stored or deployed). POST {model, messages,
// max_tokens} runs env.AI.run(model, ...) on the real Workers AI and returns the raw result.
export default { async fetch(req, env) {
  if (req.method !== 'POST') return new Response('POST {model, messages, max_tokens}', { status: 405 });
  const { model, messages, max_tokens } = await req.json();
  try { return Response.json({ ok: true, result: await env.AI.run(model, { messages, max_tokens }) }); }
  catch (e) { return Response.json({ ok: false, error: String(e).slice(0, 300) }); }
} };

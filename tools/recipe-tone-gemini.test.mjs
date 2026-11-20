import test from "node:test"; import assert from "node:assert/strict"; import { toneJudge } from "./recipe-tone.mjs"; import { GEMINI_MODELS } from "../void-live-deploy/lib/models.js";
test("the recipe tone judge falls past a retired Gemini model and answers", async () => {
  const urls = [], body = JSON.stringify({ gentle: 9, warm: 8, preachy: 1, accurate: 9, falseScience: false, harsh: [] });
  const f = async (u) => { urls.push(String(u)); return String(u).includes(GEMINI_MODELS[0]) ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: body }] } }] }) }; };
  const v = await toneJudge("a recipe", { GEMINI_API_KEY: "k" }, f); assert.equal(v.by, "gemini"); assert.equal(urls.length, 2);
  assert.equal(await toneJudge("a recipe", {}, f), null);
});

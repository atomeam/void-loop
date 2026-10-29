# Verse's brains: what it can think with for free

Checked 2026-10-26 for Verse's own coding agent (`tools/verse-agent.mjs`, `docs/playbooks/verse-agent.md`). Every line below comes from the
provider's current docs, read that day, not from memory. No Claude or Anthropic model is used, and nothing paid is used until STANDING.md's
earnings budget exists (no sale yet, so no budget). When a price, limit or plan changes, update this page and `void-live-deploy/lib/models.js`
(`AGENT_MODELS`, `AGENT_NEURONS`) in the same commit.

## The answer, short

| Brain | Free? | Held already? | What it is good for | Verdict |
| --- | --- | --- | --- | --- |
| Cloudflare Workers AI, through the site's own binding (`/api/agent-brain`, an agent ticket) | 10,000 neurons a day, free plan included | yes: the site's `AI` binding and the owner key the ticket is minted from | every step: glm-4.7-flash for small steps, gpt-oss-120b for the plan and repairs | **the agent's brain** |
| Cloudflare Workers AI (REST, from the runner) | the same 10,000 | `CLOUDFLARE_API_TOKEN` cannot run Workers AI (HTTP 401, found on 2026-10-26 by the Versus loop); a Workers-AI-only `CLOUDFLARE_AI_TOKEN` would | the same models | fallback, once such a token is set |
| GitHub Models (Actions, `GITHUB_TOKEN`, `models: read`) | — | — | — | **gone**: fully retired on 2026-07-30; every `--check` also asks its old catalog and prints the HTTP status, so this stays a measurement |
| An open model on the GitHub runner (Ollama, qwen2.5-coder 7B) | free and unlimited on a public repo's standard runners | nothing to hold: no key | the brain of last resort when Workers AI is out for the day | **fallback** (`local: true`, or by itself when no cloud brain answers) |
| OpenRouter free models | needs `OPENROUTER_API_KEY` (named in learn.yml; MAP.md lists it as not set in the repo, 2026-10-10) | no | — | not used: a third-party key and terms not checked today; revisit |
| Workers AI paid-only models (kimi-k2.6, kimi-k2.7-code, glm-5.2, glm-5.3-flash, deepseek-v4 flash/pro) | no: Workers Paid or prepaid credits | — | the strongest coding models on the platform | **first purchase** once Verse has earned money (below) |

## Cloudflare Workers AI

- **Free allocation:** "10,000 Neurons per day at no charge" on both Workers Free and Workers Paid; above it, Paid bills $0.011 per 1,000 neurons, Free fails. "All limits reset daily at 00:00 UTC." Out of allocation is error 3036 (HTTP 429). https://developers.cloudflare.com/workers-ai/platform/pricing/ (last updated 2026-10-20), https://developers.cloudflare.com/workers-ai/platform/errors/
- **Paid-only models (2026-07-28):** kimi-k2.6, kimi-k2.7-code and glm-5.2 "now require the Workers Paid plan" (403, internal error 5035 on Free). Still free: glm-4.7-flash, gemma-4-26b-a4b-it, nemotron-3-120b-a12b, "and many more". The model pages for glm-5.3-flash, deepseek-v4-flash-0731 and deepseek-v4.1-flash-1017 say "Paid access required". https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/
- **Rate limit:** text generation 300 requests a minute (paid-only models 20, or 50 with prepaid AI Gateway credits). https://developers.cloudflare.com/workers-ai/platform/limits/ (2026-09-17)
- **How the repo calls it:** the site uses its `AI` binding (`lib/models.js` names every model; `tools/models.test.mjs` keeps the names there). From a runner, `tools/feature-scan.mjs` and `tools/model-bench.mjs` POST to `https://api.cloudflare.com/client/v4/accounts/<id>/ai/run/<model>` with `CLOUDFLARE_API_TOKEN`, but that token answers 401 for Workers AI, so the Versus loop moved to the site's binding (`/api/tower-self`). The agent does the same through its own route, `/api/agent-brain`. It authenticates with a ticket (`lib/agent-ticket.js`: an HMAC of the owner key over a three-hour expiry and the run id, minted in a workflow step that runs no model code). The route runs only `AGENT_MODELS`, at most 300 calls a day, and returns the token usage for the neuron count. With a Workers-AI-only token, the agent falls back to the REST API's OpenAI-compatible route, `/ai/v1/chat/completions`. The site and the agent share the one daily allocation, so before a run spends anything the agent reads the account's real Workers AI use today from the analytics API (`aiInferenceAdaptiveGroups.sum.totalNeurons`, with the read-only `CLOUDFLARE_ANALYTICS_TOKEN` that `tools/cf-scope.mjs` already uses). It may spend only what is left of the free 10,000 after a reserve of 4,000 for the site's visitors (`VERSE_SITE_RESERVE`), at most 2,500 a run. When the account's use cannot be read, the agent counts its own use in the Actions cache against a cap of 3,000 a day (`DAY_CAP`). A run with under 600 neurons left does not start: the queue is told `queued` with "tries N · out of budget", and the conductor tries again later.

The coding-capable free models, with neurons per million tokens (input / output) from the pricing page:

| Model | Context | Tools | Neurons in / out per M | Role in the agent |
| --- | --- | --- | --- | --- |
| `@cf/zai-org/glm-4.7-flash` | 131,072 | function calling, reasoning | 5,500 / 36,400 | fast steps (first choice): about 100 neurons for a 12k-token step |
| `@cf/qwen/qwen3-30b-a3b-fp8` | — | function calling, reasoning | 4,625 / 30,475 | fast steps (second) |
| `@cf/openai/gpt-oss-120b` | 128,000 | function calling, reasoning | 31,818 / 68,182 | strong steps: the plan and every repair (first choice) |
| `@cf/nvidia/nemotron-3-120b-a12b` | 256,000 | function calling, reasoning | 45,455 / 136,364 | strong steps (second) |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | 32,768 | LoRA, no function calling listed | 60,000 / 90,909 | not used: dearer than gpt-oss-120b and a quarter of the context |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 24,000 | function calling | 26,668 / 204,805 | not used: small context, dear output |

Model pages: https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/, https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/, https://developers.cloudflare.com/workers-ai/models/nemotron-3-120b-a12b/, https://developers.cloudflare.com/workers-ai/models/qwen2.5-coder-32b-instruct/, https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/

A typical run reads a few files and makes two or three edits: about 15 steps, 2 of them strong. That is roughly 1,000 to 2,500 neurons, so two to six agent runs fit in a day beside the site, depending on how much the site used.

## GitHub Models: retired

GitHub's docs (github/docs `content/github-models/index.md`, repository at 2026-10-23): "As of July 30, 2026, GitHub Models has been fully retired. The playground, model catalog, inference API, and bring your own key (BYOK) are no longer available to any customer." The old pages (prototyping, rate limits, `/rest/models/inference`) now redirect to that notice. The owner's design note sent multi-file reasoning there, so those steps go to the strong Workers AI models instead. https://docs.github.com/en/github-models

## An open model on the runner

- GitHub-hosted standard runners are "free and unlimited on public repositories"; `ubuntu-latest` has 4 CPUs, 16 GB of RAM and 14 GB of SSD. (github/docs `data/reusables/actions/supported-github-runners.md`, `content/billing/concepts/product-billing/github-actions.md`: "free for self-hosted runners and for public repositories that use standard GitHub-hosted runners".) https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- `atomeam/void-loop` is public, so the agent can run a 7B coding model (Ollama, `qwen2.5-coder:7b`, about 4.7 GB, Apache-2.0) on the CPU at no cost and with no key. It is slow (a few tokens a second, minutes a step) and weaker than gpt-oss-120b. The workflow starts it with `local: true`, or by itself when `--check` finds no cloud brain answering (no token, a token without Workers AI scope, or the day's neurons spent). Then it is always the last brain in the order.

## What would make the brain stronger

Free, now:
1. A Workers-AI-only token (`CLOUDFLARE_AI_TOKEN`, permission *Workers AI: Read/Edit* only), so the REST fallback works when the site is down. The agent then never touches the Pages deploy token, even as a file.
2. A per-repo prompt cache of the files each kind of task touches (the playbooks name them), so the fast model reads less.
3. A bigger local model on a larger free runner when GitHub offers one to public repos. On the standard runner, 7B is about the limit for speed.

Bought with Verse's own earnings (STANDING.md money rule: earned money only, the most-needed area first, `docs/wishlist.md`):
1. **Workers Paid ($5 a month), the first purchase:** it unlocks kimi-k2.7-code ("agentic coding"), glm-5.2/5.3-flash and deepseek-v4.1-flash (1M context) at 20 requests a minute. Usage over 10,000 neurons a day is billed at $0.011 per 1,000, so the agent's budget step stays the cap: raise `VERSE_SITE_RESERVE`'s complement only by what the earnings cover.
2. **Prepaid AI Gateway credits:** the same frontier models at 50 requests a minute, with a spend limit per day (AI Gateway spend limits, 2026-06-05).

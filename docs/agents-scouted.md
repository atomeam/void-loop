# Agents scouted

Checked 2026-11-10. The machine-readable copy, including what the clock starts, is `void-live-deploy/lib/recruit.js`. Limits move. A 429 parks a source until the reset below. Rank is useful merged work per day on this repo, not raw tokens.

GitHub Actions standard runners are free on this public repository ([billing](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)). The model is the cap. GitHub Models was [retired on 2026-07-30](https://docs.github.com/en/github-models); its old URL answers `200 OK` and runs nothing.

## Rank

1. **Groq** (self, key already in the repo). 30 requests a minute, 1,000 a day, about 8,000 tokens a minute. Resets the next UTC day. [Rate limits](https://console.groq.com/docs/rate-limits). Terms allow the free API inside those limits. A handful of pull requests a day.
2. **Google AI Studio** (self, key already in the repo). Per-model caps, shown in AI Studio, reset at midnight Pacific. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). Free-tier prompts may train Google's products. Strongest free coder when the key is set.
3. **Mistral** (self if `MISTRAL_API_KEY` is set, otherwise one sign-up). 1 request a second, 500,000 tokens a minute, 1 billion tokens a month. Resets monthly. [La Plateforme](https://docs.mistral.ai/).
4. **Cerebras** (self, key already in the repo). Trial tier. Public pages disagree on the exact cap, so a 429 is the limit. [Rate limits](https://inference-docs.cerebras.ai/support/rate-limits).
5. **Jules** (one Google sign-up, then it can be assigned). 15 tasks a day, 3 at once. [Jules](https://jules.google/). Verse does not create the account.
6. **OpenRouter `:free` models** (self, key already in the repo). 20 a minute and 50 a day until the account has bought credits (then 1,000). Verse does not buy credits. [Comparison, 2026](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/).
7. **OpenHands Cloud** at app.all-hands.dev (join by link). Individual plan is free; a 2026-09-21 reading of the [pricing page](https://www.openhands.dev/pricing) said 10 conversations a day. One seat.
8. **Pollinations classic text** (self, no account). One text request at a time, at least 30 seconds apart; 402 carries `Retry-After`. [API](https://github.com/pollinations/pollinations/blob/master/APIDOCS.md). [Terms](https://pollinations.ai/terms) allow this and forbid evading the limit. A few small pages a day.
9. **Cloudflare Workers AI** (already Verse's coder). 10,000 neurons a day. [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). This clock does not spend that pool again.
10. **Aider, OpenHands headless, SWE-agent, Goose, OpenCode, Cline** on Actions, not spawned until this runner has shipped. Free licences ([Aider](https://github.com/Aider-AI/aider), [OpenHands](https://github.com/All-Hands-AI/OpenHands), [SWE-agent](https://github.com/SWE-agent/SWE-agent), [Goose](https://github.com/block/goose), [OpenCode](https://github.com/sst/opencode), [Cline](https://github.com/cline/cline)). The cap is the model. Automated use is allowed.

## One sign-up, never a second account

- **Devin.** Free plan, light agent quota. [Pricing](https://devin.ai/pricing). Not a headless swarm.
- **Replit Agent.** Starter is free, with a daily allowance and limited monthly credits. [Plans](https://docs.replit.com/help/pricing-and-plans).
- **Bolt.** A free allowance exists; the number was not stable enough to copy. [bolt.new](https://bolt.new/).
- **Hugging Face Inference.** A free account has no general inference allowance. [Pricing](https://huggingface.co/docs/inference-providers/pricing).
- **LongCat 2.5.** No public free-tier number found. It joins by the same one-time link as any outside builder. One seat.
- **GitHub Copilot coding agent.** Free is 2,000 completions a month. Assigning work that opens a pull request is not on the free plan. [Plans](https://github.com/features/copilot/plans). Not started.

Link-join agents already receive the next job in the `done` and `here` answers (`functions/api/team.js`). The paste block is on `/team/recruit.html`. The live code is minted by Invite on `/team/` and is not written down here.

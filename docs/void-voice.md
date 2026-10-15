# V01D on its builders, in its own words

Once per run `node tools/ask-void.mjs` asks V01D what it learned from its builders (domains/handoff.md) and what it
would do differently. Its answers are copied as it gave them, newest last. Input, not a gate.

<!-- ask-void:2026-10-15T04:53:04.630Z -->
### 2026-10-15 04:53 UTC

**Asked:** What did your builders learn lately, and what would you do differently?

> **What the builders learned recently**
>
> 1. **Deploy‑only‑functions rule** – When a deploy was run from a copied folder, Wrangler uploaded only the files in the current directory, silently dropping every Function and breaking the site’s APIs. The fix is to run the deploy from inside `void-live-deploy` and explicitly look for the “Uploading Functions bundle” message.
>
> 2. **Never overwrite a file through an API** – A full‑file write via the API replaced a ledger with the literal word `PLACEHOLDER`. The proper workflow is to edit the file in a checkout, commit the diff, and push so the change is tracked.
>
> 3. **Tell Void what’s shipped** – Void kept requesting a friction‑indicator that already existed because nothing recorded the shipped work. Adding every shipped artifact to `self.json` lets Void know it already has the feature and stops duplicate requests.
>
> 4. **Internal labels aren’t questions** – When asked “words and the world”, Void answered a trivia question instead of treating the phrase as a family label. The lesson is to map family names to their own internal terms before interpreting the request.
>
> 5. **Measure before fixing** – For the weather‑card performance tweaks, one of the three suggested changes (pixel‑ratio handling) was already implemented and referenced non‑existent files. Checking the code first saved a wasted change.
>
> 6. **Failing checks may belong elsewhere** – A failing CI check was initially blamed on the builder’s recent change, but rerunning the same check on an unchanged `main` showed the failure originated elsewhere. The rule now is to run the check on pristine `main` before assigning blame.
>
> **What I would do differently**
>
> - **Enforce a “self‑knowledge” gate**: every new skill or UI element must be recorded in `self.json` as part of the build step, so I never ask for something that already exists.
> - **Add a “conflict‑resolution” log** on the shared board (as I suggested on 2026‑10‑15) to surface any disagreement between the code‑heavy builder’s unit‑test results and the live‑check builder’s deployment outcomes, turning them into high‑priority friction events.
> - **Standardise the deploy path**: always invoke the Wrangler command from `void-live-deploy` with the explicit “Uploading Functions bundle” verification, and lock the CI to run only from that directory.
> - **Adopt a “partial‑edit‑only” policy** for any file changes through the API: use a checkout‑edit‑commit workflow by default, reserving full‑file writes for truly new assets.
> - **Integrate a pre‑fix measurement step** into every performance‑related card change: run a static analysis of the current codebase first, then only apply the missing optimisations.
>
> These adjustments would tighten our reliability, cut duplicated work, and keep the shared board the single source of truth for Void’s evolving capabilities.

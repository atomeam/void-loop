# Study with REA: learn how the best do a feature, from the inside, before building Verse's own

**Starts when:** a brief names who does a feature best and that is a web app (frontier #30's photo appraisers first), or Verse asks how something works.

1. **Pick the page** where the feature runs (a public page, never a login wall, never a page behind a paywall you have not paid for).
2. **On a machine that reaches the web:** `node tools/rea-study.mjs --url <page> --question "how does it <feature>"` prints the digest: the largest modules, every endpoint the code calls, agent tools the page declares, inferences with their confidence, each with its script and line, and what REA could not tell.
3. **From anywhere else (or for Verse itself):** `VOID_OWNER_TOKEN=… node tools/rea-study.mjs --ask <page> "question"` files the study in Verse's private memory, then run the **REA study** workflow; the findings come back to that memory (kind `study`) and Verse's memory answers "what did you study about …".
4. **Write the brief from the evidence:** what it does, in what order, where the hard part is (the biggest module, the endpoint that does the work). Then design Verse's own version: what it would do better.
5. **Build Verse's own code.** Nothing studied is copied: no code, assets, text, model weights or keys.

**Never:** commit a finding, a studied URL or a question to this public repo (the run log prints counts only, keep it that way); break a protection, log in, submit a form or call an endpoint you found; run REA's debugger, execution observer, session or scenario capture, native or firmware commands from this tool (`ALLOWED` in the tool lists the six it may run: page targets, bundle analysis, a viewport screenshot, and three that work on local files only).

**What a digest now has (REA 6.7.0 + Verse's own engine, `tools/study-engine.mjs`):** endpoints ranked by evidence strength; RPC (tRPC, JSON-RPC, gRPC-web) and GraphQL operations; a feature trace from the longest word in the question (function around it, calls near it, and its original file and line when the page publishes a source map); and what Verse's own read could not tell. If REA fails on a page, Verse reads the page's own scripts and imports (same origin, capped) and still answers. `readable()` makes minified code readable for the builder; `diffStudies` and `combineStudies` compare over time and across sites.

**After a study:** the owner reads it at `/studies.html` (owner only). `tools/loop-study.mjs` turns finished studies into study-ready wants (private memory, written once) and moves their skills up the picker.

**How to tell it worked:** the digest has endpoints and modules with script:line evidence, and the feature Verse ships is its own.

**Mistakes already made:** this container cannot reach outside sites (the egress proxy refuses them), so studies from a cloud session go through `--ask` and the workflow. Killing Chrome with `pkill -f` matched the shell running it; the tool now kills only the Chrome it started.

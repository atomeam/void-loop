# REA vs Verse's study tool: gaps and where Verse goes further

Sources read (2026-10-21): the `rea-agents` 6.7.0 npm package (README.md, package.json, `dist/cliCommandNames.js`,
`dist/domain/javascript/*`, `dist/javascript/{sourceMaps,recovery}/*`, `dist/browser/*`) and github.com/morluto/rea (MIT).
REA is an MCP server plus a CLI (`rea`/`rea-agents`, Node >=22.19) with 139 CLI commands. Verse pins REA (`tools/rea-study.mjs`,
now 6.7.0) and runs only its passive web commands. Verse's own engine is `tools/study-engine.mjs`.

| REA capability (source) | Verse | Notes |
|---|---|---|
| Web page capture: scripts, modules, import graph (`analyze-web-bundle`, `list-browser-targets`) | have (wraps REA) | unchanged |
| Endpoint extraction with script:line evidence (`analyze-web-bundle`) | have (REA) + own | Verse's engine also reads fetch, XHR, axios-style clients, WebSocket, EventSource, sendBeacon |
| GraphQL / RPC operations (`javascriptGraphqlOperations.js`, `javascriptRpcEndpoints.js`) | have (own) | named GraphQL operations, tRPC, JSON-RPC 2.0, gRPC-web (`rpcOf`) |
| Agent tools a page declares (`discover-webmcp-tools`) | have (REA output) | listed, never called |
| Confidence on inferences (exact/high/medium/low/unknown enum in schemas) | have + better | Verse scores each finding 0-1 from mechanism strength and independent sightings, then tiers it |
| What it couldn't tell (`unknowns`, `limitations`) | have + own | Verse adds its own plain unknowns (minified without map, built URLs, quiet large scripts, server side) |
| Source maps (`dist/javascript/sourceMaps`, `WebSourceMapFetcher.js`) | have (REA `--fetch-source-maps` + own) | Verse's own VLQ decoder maps each feature-trace hit to its original file and line |
| Minified code recovery (Wakaru, `recover-javascript-sources`) | have (own) | `readable` indents minified code without breaking strings, regexes or comments, and restores names from a map |
| Feature trace from a seed (`trace-application-feature`, `javascriptFeatureSeed.js`) | have (own) | `traceFeature`: a word from the question to the function around it and the calls near it |
| Bundle and version comparison (`compare-bundles`, `compare-web-captures`, `compare-application-versions`) | have (own) | `diffStudies` |
| Export scripts, source location trace, module imports (`export-web-scripts`, `trace-web-source-location`, `trace-web-module-imports`) | have | first two allowed (local files only, no fetch); Verse follows imports itself |
| Screenshots and visual diff (`capture-web-screenshot`, `compare-web-screenshots`) | have | both allowed; Verse's own `visualDiff` gives changed share and the changed box |
| Session/execution observers, Electron active, Frida, debuggers (`observe-web-execution`, `instrument-with-frida`, `debug-with-gdb`) | not adopted on purpose | run code; outside the passive rule |
| Native: Ghidra, Hopper, IDA, objdump, Rizin, Go/Rust/.NET/Android/WASM/EVM/firmware/pcap | not adopted | Verse studies web apps; can be wrapped later only for files the owner owns |
| Evidence import/export bundles (`evidence-export`, `evidence-import`) | partial | studies live in private memory (kind `study`) |

## Where Verse is now ahead of REA
- **Study cache** (`cacheFresh`): the same page and question are not studied again inside 14 days.
- **Skill-library retrieval** (`relatedStudies`): a new question first finds the closest earlier studies.
- **Combining sites** (`combineStudies`): several sites' approaches side by side, ranked by how many sites share one.
- **Ranking by evidence strength** (`rankFindings`): one ordered list, strongest first, in every digest.
- **Feeding the build loop** (`buildBrief`): a study becomes a want with no studied URL, host or question in it (the repo is public).
- **Diffing over time** (`diffStudies`).
- **Keeps going when REA can't:** in testing, REA 6.7.0 ran out of memory (4 GB heap) on one large public web app; Verse then read the page's
  own scripts and imports itself and still produced endpoints, a feature trace and its unknowns.
- **Owner panel:** `/studies.html` (owner only through `/api/studies`, `ownerOk`) lists studies and study-ready wants.
- **Study-ready wants go first:** finished studies with strong evidence raise their skill in the want picker (`lacks.mjs`, `studyBoost`).

## Left
Native targets stay out (passive web rule). Electron/IPC tracing and GraphQL body shapes are REA-only. Version-to-version bundle
matching by AST fingerprint (REA `javascriptAstFingerprint.js`) is deeper than Verse's set diff.

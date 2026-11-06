# Where Verse gets listed

The official MCP registry publishes by itself from this repository. Every other listing below is ready in this folder and not
sent: each waits on the owner's yes. Nothing here holds a key or a secret.

| Listing | What it is | State | The one step after a yes |
| --- | --- | --- | --- |
| Official MCP registry (registry.modelcontextprotocol.io) | Verse is listed as `io.github.atomeam/void` (1.0.0, 1.1.0 and 1.1.1 since 2026-10-14) | The root `server.json` is now 1.2.0 (owner's yes, 2026-11-06): the name Verse and the paid x402 tools | None: after each main deploy, deploy.yml starts `.github/workflows/mcp-registry.yml`, which publishes any version the registry does not have yet (GitHub OIDC, no secret). Raise `version` in the root `server.json` to change the listing |
| Glama (glama.ai/mcp) | The largest MCP directory; it lets a maintainer claim a server with a `glama.json` at the repository root. Its docs give no API or token for listings | `glama.json` is at the repository root and names `atomeam` | Claiming the listing is a GitHub sign-in on glama.ai: an owner step |
| PulseMCP and other directories that mirror the official registry | They read the official registry | Nothing to do here | Happens after the registry update above |
| x402 Bazaar (discovery of paid x402 endpoints) | Facilitators list endpoints that declare the `bazaar` extension | Every service already declares it (lib/x402.js `bazaarOf`); PayAI lists an endpoint on its first verified payment or probe | Nothing: it needs no submission |
| GitHub Marketplace | The code review Action (free checks, a Pro key, or pay per review over x402) | `action.yml` at the repository root is `review/action.yml` with its tools at `./tools` (tools/action-root.test.mjs keeps them the same). GitHub has no API for this step | On the release page: tick "Publish this Action to the GitHub Marketplace", accept the Marketplace Developer Agreement, publish and confirm with 2FA. An owner step |

What every listing points at: `https://a-to-mind.com/api/mcp` (the MCP server, its tools at `https://a-to-mind.com/tools.json`) and
`https://a-to-mind.com/api/x402` (the x402 catalog: each paid service, its price and where it is paid).

# Where Verse gets listed: ready, not sent

Each listing below is ready in this folder. None is published, submitted or opened on anyone else's site or repository: each waits on
the owner's yes. Nothing here holds a key or a secret.

| Listing | What it is | State | The one step after a yes |
| --- | --- | --- | --- |
| Official MCP registry (registry.modelcontextprotocol.io) | Verse is already listed as `io.github.atomeam/void` (versions up to 1.1.1, which still say "V01D" and no paid tools) | `mcp-registry/server.json` is version 1.2.0: the name Verse and the paid x402 tools | Copy it over the root `server.json`; `.github/workflows/mcp-registry.yml` validates and publishes it by itself (GitHub OIDC, no secret) |
| Glama (glama.ai/mcp) | The largest MCP directory; it indexes public MCP repositories and lets a maintainer claim one with a `glama.json` at the repository root | `glama/glama.json` names `atomeam` as the maintainer | Move it to the repository root; claiming the listing is a sign-in on glama.ai, an owner step |
| PulseMCP and other directories that mirror the official registry | They read the official registry | Nothing to do here | Happens after the registry update above |
| x402 Bazaar (discovery of paid x402 endpoints) | Facilitators list endpoints that declare the `bazaar` extension | Every service already declares it (lib/x402.js `bazaarOf`); PayAI lists an endpoint on its first verified payment or probe | Nothing: it needs no submission |
| GitHub Marketplace | The code review Action (`review/action.yml`, free checks, a Pro key, or pay per review over x402) | Ready: it has a name, description and branding | Publishing a release to the Marketplace accepts GitHub's Marketplace terms: an owner step |

What every listing points at: `https://a-to-mind.com/api/mcp` (the MCP server, its tools at `https://a-to-mind.com/tools.json`) and
`https://a-to-mind.com/api/x402` (the x402 catalog: each paid service, its price and where it is paid).

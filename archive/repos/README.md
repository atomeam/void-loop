# Early builds of Verse (owner, 2026-10-21: "they all belong to Verse, early builds of it")

Each folder is a public atomeam repo imported with its full history by git subtree. The source repos are untouched. Their .github folders are renamed github-inert so no workflow runs from here. Nothing here is served by the site. Five private repos were imported after the owner approved them (2026-10-21): hold, wix, fire-ember-mountain-cabin, autosalvage, adventure-lab. Their imported copies had history rewritten before import (sources untouched): node_modules, build output (.vercel, .wrangler), env files, key files, databases and every file over 5 MB were removed from every commit. A full-history scan for key shapes, emails, phones and street addresses found only test fakes and a library author's address in a lockfile.

- `a-to-mind.com/`: 
- `HomeBase-/`: HomeBase
- `Crypto-Cryptids/`: pokemon clone with cryptids merging crypto assets with legendary creatures
- `atomarcade-bridge/`: 
- `glassbox/`: Public execution ledgers for A-to-Mind Glass-Box Operator runs. Proof of work is the PR, not a marketing page.
- `infinite-briefing/`: Infinite Briefing — satire outlet. SATIRE not a government briefing.
- `the-void/`: The Void — a second brain. Pages, wiki, graph, Inbox, monthly room.
- `ALPHA/`: Alpha — consolidated AtoMind ecosystem (backend :8080, frontend :5173, trust-first integration routing)
- `promise-ledger/`: First-party Promise Ledger checkpoints for a-to-mind.com. Baseline census only until a human approves. No notify.
- `auto-deploy-action/`: Automated deployment for any platform with zero configuration. Supports Vercel, Netlify, Cloudflare Pages, Railway, Render.

- `hold/`: early Void and bridge apps (private; node_modules and Windows binaries stripped)
- `wix/`: booking site pages (private)
- `fire-ember-mountain-cabin/`: growth ledger app build (private; .vercel output stripped)
- `autosalvage/`: autosalvage core (private)
- `adventure-lab/`: room and sprite walk demo (private)

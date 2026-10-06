# MAP: what the year of work is, and how it fits together

Written 2026-10-06 from the repos themselves. Each claim says how it was checked:
**[read]** = I read the code or files. **[desc]** = taken from the GitHub description or metadata only; I did not open the code. Nothing here has been deleted or moved.

## The short version
One product (**Void**, a-to-mind.com) is real and live. Around it are engines that feed it, and a large body of earlier work that is either already folded in, specified but never built, or archive. The new engine, **Ouroboros**, turns the old work itself into Void's memory.

```
  old projects on disk ──► void_lens (free scan) ──► ouroboros harvest ──► digests + memory.jsonl
                                                          │ verify (hashes)         │ push: full digest, then read back + hash check
                                                          ▼                         ▼
                                                   report.html            /api/memory (D1)  ──► Void answers
                                                          │                                      "what did I do about X?"
                                                          ▼                                      (skill: not built yet)
                              reclaim (only rebuildable node_modules/venvs; never a project)
  a-to-mind.com/cheat-codes/ ──► free scanner ──► Ouroboros download (draft, not on sale)
```

## What is live and real: Void  (`atomeam/void-loop`) [read]
- A blank stage with one input. About 61 skills (calculators, units, timers, weather, time zones, calendar, games, 3D figures) matched by rules; anything else goes to a free model (Gemma on Workers AI) with a Wikipedia source.
- A 1,019-ask benchmark with a score floor, and a browser suite. The benchmark checks that asks route to handlers that already exist.
- Automation: ship helper, hourly grow job, think tank, watchdog, dispatcher (dry-run). The ship helper and deploys have been failing since Oct 5 (a merge broke `tools/test_void.mjs`; three real checks still fail).
- NOT built despite the docs: "Void learns skills by itself" (`domains/void.edit-engine.md`: no `/api/learn`, no checker, no KV store).

## New this session (branches/PRs; none on `main` yet)
| Piece | Where | State |
|---|---|---|
| Parse guard (a broken script fails in seconds) | `tools/guard-source.mjs`, PR branch `claude/guard-source-syntax` | built, tested |
| `/cheat-codes/` page, sitemap, IndexNow | PR #122 | built; the page's disk tip now links the free scanner |
| void-lens: free read-only disk scanner | `tools/void_lens.py`, PR #124 | built, 6 tests |
| Ouroboros: harvest, verify, report, plan, reclaim, run, push | `tools/ouroboros.py`, PR #125 | built, 18 tests; not run on Windows |
| Download pack + landing draft + launch checklist | `tools/build_ouroboros_pack.py`, `drafts/ouroboros/` | built; not on sale |
| Void's memory API | `functions/api/memory.js`, `lib/memory-core.js` | built, 12 tests on real SQLite; stores each project's full digest and the hash Void computed from what it stored; lookup by id; `?view=topics` and `?related=<id>` show how projects connect (shared tech, file types ignored); table created on first use |
| Train-recognition concept | `drafts/train-visualization/` (PR #123) | concept only, nothing measured |

## The other repos on the account
| Repo | What it is | Evidence | Relation to Void | Suggestion (yours to decide) |
|---|---|---|---|---|
| `a-to-mind.com` | Brand repo; `FEATURE_LEDGER.md` lists 26 features, all "specified", none built, all "hold-gate only"; 51 open issues | [read] ledger and README; issues not read | The hold-gate era's output | Keep the ledger as an idea bank; the hold-gate rule was retired 2026-10-02, so rebuild items only if Void's growth board wants them |
| `the-void` | "A second brain. Pages, wiki, graph, Inbox, monthly room" (TypeScript) | [desc] | Same idea as the memory graph you described (Notion/Obsidian hybrid) | Read it before building a memory UI: it may already have the page/wiki/graph model |
| `autosalvage` (private) | "Scan, classify, and safely migrate legacy repositories" | [desc] | Overlaps Ouroboros's job directly | Compare before maintaining two scanners; `void-loop/classify_archive_packages.py` and `victus_ingest*.py` are earlier versions of the same idea [read] |
| `glassbox`, `promise-ledger` | Public execution ledgers; checkpoints "baseline census only until a human approves" | [desc] | Proof-of-work records; `domains/void.assimilate.md` row 4 plans a "what did you do today" page | Fold into that page; keep the repos as the public record |
| `hold` (private) | "CRA Art.14 clock, human hold-gate, AlphaGenome dry-run" | [desc] | The hold-gate concept, since retired as a rule | Archive candidate; confirm nothing live depends on it |
| `ALPHA` | "Consolidated AtoMind ecosystem (backend :8080, frontend :5173, trust-first integration routing)"; 13 open issues | [desc] | An earlier consolidation attempt | Archive after checking the issues |
| `auto-deploy-action` | A generic deploy action | [desc] | Overlaps `.github/workflows/deploy.yml` | Only relevant if you want to sell/share the deploy flow |
| `infinite-briefing`, `Crypto-Cryptids`, `adventure-lab`, `wix`, `Broke`, `HomeBase-`, `atomarcade-bridge`, `fire-ember-mountain-cabin` | Satire outlet, game ideas, old sites and bridges | [desc] | Not part of Void | Leave alone, or archive |
| On the Victus: `_archive_old_mono`, `hold`, `Desktop` | 64 items classified in `victus-ingest.md`: 25 capabilities, 12 domains, 14 to review, 5 waste, 4 to absorb | [read] counts only | The raw material Ouroboros is built to digest | Run `ouroboros run` on it; the digests become the real inventory |

## What is real, what is plan
- **Real and working:** the Void skills and answer fallback, the benchmark, the Void deploy flow (when its checks pass), the new disk tools and memory API (tested here on Linux).
- **Plan only:** self-learning skills, the semantic graph, cloud backup, anything on the 26-item ledger, the paid Ouroboros tier. Marketing language in older docs states several of these in the present tense.

## Order I would work in
1. Make `main` green: the three failing checks (a fix attempt is in flight on `helper/mark-inbox-building-shipped`). Nothing ships until this is done.
2. Merge the small, tested pieces: guard, void-lens, Ouroboros, memory API, SEO page.
3. Run Ouroboros on the Victus; read the report; push the memory.
4. Add the Void skill that answers from memory, and a page that shows the topics and related projects ("what did I build for X?").
5. Only then, the paid pack and cloud backup.

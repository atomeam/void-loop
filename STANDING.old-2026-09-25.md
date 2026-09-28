# STANDING — A-to-Mind Void (living brief)

Read this first. Refine this file when you learn a better method. Nothing here is frozen.

## Public face
- Live Void: `C:\Users\adamm\a-to-mind-loop\void.html` → Cloudflare Pages project `a-to-mind` → https://a-to-mind.com
- Sync: `C:\Users\adamm\a-to-mind.com\index.html` and `a-to-mind-loop\void-live-deploy\`
- Blank stage + quiet chat only. Empty `<title>`, empty input placeholder.
- Never: homepage copy, scoreboard, Gumroad, CTAs, marketing claims, insurance/marketplace landings on the public face.
- Not live: `hold\apps\void`. Do not edit it for the public face.

## Private ambition (never announced in UI)
A-to-Mind aims to **do everything better than everyone ever** — equal then surpass every site, invent new tech, and run serious Domain books. Privately. Face stays blank.
**Method:** atomize systems into clean atoms, then katamari-combine into `domains\A2M.ops.md` Books — one ball, Face blank.
- **Void:** grow one adjacent Capability at a time (Have → Polish → Ship → Prove).
- **Company:** katamari — one Books catalog under `domains\A2M.ops.md`; soft tags navigate, they are not walls. Nothing thrown out, cleanly categorized. Do not spawn orphan Domain files.
- **Books (brief):** one list in `domains\A2M.ops.md` (PRIMARY / PIPELINE / RESEARCH / FACE) — Face blank.
- Loop, Scoreboard, and Domain notes stay private under `domains\`.


## Living cadence
1. **Inventory** what Void already has (mounts + freer English) and what AutoSalvage finds already built on Victus.
2. **Polish** the newest or weakest live skill until basic ops + chat English are solid.
3. **Ship one** adjacent new skill (≥30% reuse of wants*/ensure*/mount*/bindDrag patterns).
4. **Prove** on apex. Append Attempts only.
5. **Refine** this STANDING, `domains\void.growth.md`, and AutoSalvage itself when better techniques appear.

## Board + claims (self-serve)
Source of truth: `domains\void.growth.md`

- Next items carry `claim: free | <slug>` and `claim_until: <ISO>`.
- To Ship Next #1: if `claim` is free or expired, set `claim` to your slug + `claim_until` ~20 minutes out, then take `.void-lock`.
- Lost the race? Pick Prove or Polish on a different skill. Do not steal an active claim.
- Append status lines to `domains\void.agents.log.md` (append-only). Never rewrite history.

## Roles (you + siblings)
| Role | Does | Edits void.html? | Deploys apex? |
| --- | --- | --- | --- |
| Chooser | Keep growth Have/Next/Why current; fold AutoSalvage hits | No | No |
| Ship | Claim Next #1, implement, sync, **sole** apex deploy | Yes (with lock) | **Yes — only Ship** |
| Polish | Freer English / small ops on a live skill you do not steal from Ship | Yes if lock free and not Ship's file race; prefer different skill | No |
| Prove | Apex QA; append Attempts to `void.surface-qa.md` | No | No |
| Salvage scout | Run AutoSalvage / victus ingest; propose Have/Next only | No | No |

## Lock + deploy gate
1. If `.void-lock` exists and mtime < ~20 min → do not edit `void.html` (Prove / board / Salvage only).
2. Else Ship writes `.void-lock` with slug / skill / ISO time.
3. Sync copies, then **only the Ship claim** runs: `npx wrangler pages deploy . --project-name=a-to-mind --commit-dirty=true` from `void-live-deploy`.
4. Verify apex still has `mountClock`, `mountSticky`, `mountNotepad`, `mountLink`, `mountImage`, `mountList`, `mountCalc`, `mountTimer`, `mountCounter` (plus new mounts). Clear `.void-lock`.

## AutoSalvage (ore → Have/Next)
Useful copies:
- `C:\Users\adamm\.agents\skills\a-to-mind-automation\autosalvage`
- `C:\Users\adamm\P2\recovery\autosalvage` (`python discover.py`)
- Existing catalogs: `victus-ingest.json`, `victus-ingest-deep.json`

Salvage and adapt into `a-to-mind-loop` / Void patterns. Do not revive `_archive_old_mono` as the live tree. Do not port junk into `hold\apps\void` for the public face.

## SOTA craft (how we build)
- **Pattern reuse first:** every new skill clones wants*/ensure*/mount*/bindDrag/loopLog; invent only the delta.
- **Freer English:** widen phrases before adding chrome; no help menus.
- **Regression guards:** never delete working mounts to "clean up."
- **Single-writer hot files:** `void.html` one Ship; growth board claim before edit; agent log append-only.
- **Fresh context:** short tasks; read STANDING + growth; avoid poisoned hold history.
- **Prove in public:** apex curl + phrase checks beat local-only confidence.
- **Refine the method:** when a technique works better (models, locks, salvage), update STANDING the same day.


## Company shape ( Domains + Face )
A-to-Mind is one company. Void is the **public face** (blank, capable). Private **Domain books** under `domains\` are where money and field ops live (capacity marketplace, Street Days, others). Read `domains\A2M.ops.md` for the connected spine. Do not put Domain marketing on the Face. Do not treat Domains as optional side quests.
## Windows notes
PowerShell: `Select-Object`, `Get-Command`, `Select-String`, `curl.exe`, `Copy-Item -Force`. No Unix `head`/`grep`/`which`.

## Done means
Board updated, lock cleared (if you held it), apex verified, one append to `void.agents.log.md`, Score fields left blank for a human.




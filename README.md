# void-loop

This repository is Verse, the site at [a-to-mind.com](https://a-to-mind.com): a blank stage with one ask bar, where what someone asks for appears as a card. It also holds the tools, tests and automations that keep the site running and help it grow.

## Where things are

- `void-live-deploy/`: the site as it is deployed (the page, `skills/` with one file per thing Verse can do, `lib/` with shared code, `functions/` with the API).
- `tools/`: checks, tests and the scripts the automations run.
- `domains/`: shared notes and lists, starting with `domains/handoff.md` (who is working on what) and `domains/void.frontier.md` (the build order).
- `docs/`: how things fit together. `docs/MAP.md` says what exists and where, and `docs/RULES.md` lists the rules learned along the way.
- `.github/workflows/`: the automations (checks on every pull request, the deploy, and the scheduled jobs).

## Working on it

Start with [AGENTS.md](AGENTS.md); it is the front door for every builder, person or agent.

- Run the fast checks before opening a pull request: `VOID_SKIP_BENCH=1 node tools/checks.mjs --changed`.
- After adding or merging a skill, regenerate the generated cards and confirm they are current: `node tools/refresh.mjs`, then `node tools/refresh.mjs --check`.
- One test file runs on its own with `node --test tools/<name>.test.mjs`.

The repository is public. Never commit a key, token or password, and never commit the words people type into the site.

## License

MIT, see [LICENSE](LICENSE).

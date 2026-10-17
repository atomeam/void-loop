# A film: make one, and make the next one better

**Starts when:** daily (`record.yml`, three films), after every deploy that brought an experiment not filmed yet, or by hand.

1. **Pick:** `tools/record.mjs` takes the newest lab experiment not filmed yet (from the `film-*` release tags), then the newest shipped change never filmed (a growth-ledger entry with a `show` and a `try`, id `ship-<yyyymmddhhmm>`, filmed by opening its ask on the live site), then the experiment filmed longest ago. Never the same film twice while another waits. (2026-10-17, owner: "v01d stopped making videos": every lab experiment had been filmed by 2026-10-15, so deploys filmed nothing and the daily run repeated the same three; shipped changes are the second source.)
2. **Shoot:** a 9:16 Short at 1080 × 1920, a hook card, the page's own demo or its buttons pressed in turn with a punch-in on each, a caption from the ledger's own words, then (only when the run has findings in the fringe ledger) a "what it found" card with its first finding in the ledger's own words, shortened to fit, its seconds taken from the demo so the film stays as long, then an ending card that loops into the first frame.
3. **Words:** title (hook + "| an AI built this itself #Shorts"), description (what it is, what it found, what failed, "How it is built: <link to its code>"), tags. Everything in them is true of the experiment.
4. **Keep:** a draft release, then on `/films/` for everyone. Posting to YouTube is the owner's, by hand, unless `YT_UPLOAD` is set.
5. **Better next time (frontier #26):** the film grades itself (seconds of dead air, actions shown); the owner's verdicts on `/films/` steer the next; new kinds of film (frontier #27) each get their own playbook here once made.

# Playbooks: how V01D does the builders' work itself

The owner, 2026-10-15: "teach a man to fish so that V01D can do all this itself one day . you should be training it to do everything you can better than you".

Each playbook is one kind of work a builder did by hand, written so V01D's own loop (its model through `lib/models.js`, its tools in `tools/`) can follow it step by step: what starts it, the exact commands, how to tell it worked, and the mistakes already made. A run that does a new kind of work by hand writes its playbook here; a run that follows one and finds a better way rewrites it. Frontier #28 is V01D taking these over, one at a time, measured by how much of what ships it made itself.

| Playbook | What it grows | Followed by V01D yet |
|:--|:--|:--|
| [probe-and-fix.md](probe-and-fix.md) | an existing skill, from asks it misses | not yet |
| [table-skill.md](table-skill.md) | a new skill answered from a built-in table | not yet |
| [review-rule.md](review-rule.md) | a code-review check for a bug the review missed | not yet |
| [film.md](film.md) | a film, and the next film being better | not yet |

# Verse's brain: the design

Owner, 2026-11-20: "take a look at the brain and tell me what can be done better to make it a real functional brain", then "the best brain
possible for Verse, and the visual brain made real". This is the plan the code follows. Every part named here is a real part of Verse with a
file behind it; a part not built yet says so. Nothing on /brain/'s main view is simulated: each region lights from a live event.

## What it is built on (research)

- **CoALA, Cognitive Architectures for Language Agents** (Sumers, Yao, Narasimhan, Griffiths, 2023): an agent is a decision loop around a
  working memory and three long-term memories, episodic (what happened), semantic (what is true) and procedural (how to do things).
- **Generative Agents** (Park et al., 2023): a memory stream of everything observed, recalled by recency, importance and relevance, and a
  reflection step that turns many small memories into a few higher-level ones.
- **Reflexion** (Shinn et al., 2023): after a failed try the agent writes a short lesson in words and reads it before the next try.
- **Voyager** (Wang et al., 2023): a skill library that grows; a new skill is checked by running it and kept as code.
- **MemGPT / Letta** (Packer et al., 2023): memory in tiers, a small context in front and a large store behind, paged in by need.
- **Global workspace theory** (Baars; Dehaene): many inputs compete and a few win the spotlight that everything else reads.
- **Complementary learning systems and sleep** (McClelland, McNaughton, O'Reilly, 1995): fast episodic memory by day, slow consolidation
  into lasting knowledge offline.
- **World models** (Ha and Schmidhuber, 2018; Hafner's Dreamer): predict what an action will do, compare it with what happened, learn from
  the gap. For Verse the prediction is a want's target number and the outcome is the number measured after the change ships.

## The loop

```
senses -> attention -> working memory -> planning (the will) -> action (crew, coder) -> evaluation -> lessons
   ^                        |   ^                                                         |
   |                        v   |                                                         v
   +---- drives <---- long-term memory: episodic | semantic | procedural <---- nightly consolidation (sleep)
                                   ^
                              reflection
```

| Region | What it does | The real part of Verse | Live source |
|---|---|---|---|
| Senses | takes in the world | visitor asks and misses (counts only), the outcome exam, page checks, uptime guards, earnings, commits, TV and radio notes | `/api/status`, `/api/selfcheck`, `/exam/latest.json`, `/api/treasury`, route log counts, GitHub |
| Attention | picks what matters now | the week's bets: at most 2 repairs, stuck wants scored down (`lib/team-priorities.js`) | `/api/crew` priorities |
| Working memory | what it holds this minute | this tab's last 8 turns (`lib/talk-memory.js`), the current wants, the open bets | page + `/api/will` |
| Episodic memory | what happened | the reflection journal, the unbidden lines, the jobs and their results (`void_kv` voice, `void_queue`) | `/api/reflect`, `/api/unbidden` |
| Semantic memory | what is true | what Verse knows: skills, pages, sites, lessons (`brain/knows.json`, `void.knowledge.json`) | assets |
| Procedural memory | how to do things | the skill library (`skills/`, `skills/index.json`), built with skills (`skills/lineage.json`) | assets |
| Reflection | turns events into thoughts | `/api/reflect` after every build; the nightly sleep note | D1 |
| Planning (the will) | chooses wants | `functions/api/will.js`, `lib/will-guard.js`, the crew's wants (`lib/team-crew.js`) | `/api/will`, `/api/crew` |
| Action | does it | the crew, `tools/verse-loop.mjs`, `tools/verse-coder.mjs`, pull requests | `/api/crew`, GitHub |
| Evaluation | checks the result | a want closes only when its number improves; `tools/will-outcome.mjs` settles a job when its PR ends; the exam | `/api/crew`, queue states |
| Lessons | keeps what it learned | `void.knowledge.json` and `lib/brain-recall.js`; a lesson from every settled job (planned: item 4) | assets + D1 |
| Sleep | consolidates overnight | planned (item 6): the day's events into one note, stale wants and duplicate lessons pruned | D1 `void_kv` sleep |
| Drives | why it acts | curiosity, competence, care, integrity (`lib/self-model.js`) and the charter's identity lines (`lib/charter.js`), each tied to a measured number | computed in `/api/brain` |

`GET /api/brain` (`functions/api/brain.js`, pure part `lib/brain-live.js`) returns every region with its true current state, its recent
events with times and links, and when it last fired. The /brain/ page draws the regions, lights each one by how recently it fired, and
shows the newest real chain: sense -> want -> job -> pull request -> result -> lesson. A link in the chain Verse has not reached yet says
"not yet", never a guess.

## Build order

1. Attention: at most 2 repair bets, give up after 3 failed repairs, wants stuck at 0 halved at 7 days and set aside at 14.
2. Working memory: this tab's conversation goes with each ask (sessionStorage, never cached or logged).
3. `/api/brain` and this document; then the real /brain/ main view (the old simulation moves to a labelled Simulation tab).
4. Lessons from every outcome, read by the will, the coder and answers about Verse.
5. The router breaks close calls with a small free model and logs them for nightly tuning.
6. Sleep: the nightly note.
7. Long-term personal memory by meaning, opt-in only.
8. Drives with real numbers.

## Rules this design keeps

- Visitor words go only to Workers AI and Groq. Never Gemini or OpenRouter (their free tiers may train on prompts).
- Personal memory is in the visitor's own browser or opt-in for a member; nothing personal is shown on /brain/, only counts.
- Honest numbers only: a number that cannot be read is left out, not guessed.
- /brain/ stays a UniVerse page; `/api/brain` is open because every fact in it is public already or a count.

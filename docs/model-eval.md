# Model eval, 2026-10-10

30 prompts per model, max_tokens 1000, thinking off, pattern check on content only. Cost is the median neurons per call. Current model: `@cf/google/gemma-4-26b-a4b-it`.

## answer

| model | score | median neurons | errors | decision |
|---|---|---|---|---|
| google/gemma-4-26b-a4b-it (current) | 10/10 | 0.86 | 0 | - |
| nvidia/nemotron-3-120b-a12b | 10/10 | 3.63 | 0 | stay (+0 prompts, cost over 1.5x) |
| zai-org/glm-4.7-flash | 10/10 | 0.89 | 0 | stay (+0 prompts, cost ok) |
| openai/gpt-oss-20b | 10/10 | 2.74 | 0 | stay (+0 prompts, cost over 1.5x) |
| qwen/qwq-32b | 10/10 | 19.62 | 0 | stay (+0 prompts, cost over 1.5x) |

## will

| model | score | median neurons | errors | decision |
|---|---|---|---|---|
| google/gemma-4-26b-a4b-it (current) | 5/5 | 3.81 | 0 | - |
| nvidia/nemotron-3-120b-a12b | 5/5 | 17.08 | 0 | stay (+0 prompts, cost over 1.5x) |
| zai-org/glm-4.7-flash | 5/5 | 5.57 | 0 | stay (+0 prompts, cost ok) |
| openai/gpt-oss-20b | 5/5 | 6.7 | 0 | stay (+0 prompts, cost over 1.5x) |
| qwen/qwq-32b | 5/5 | 67.61 | 0 | stay (+0 prompts, cost over 1.5x) |

## review

| model | score | median neurons | errors | decision |
|---|---|---|---|---|
| google/gemma-4-26b-a4b-it (current) | 7/7 | 7.06 | 0 | - |
| nvidia/nemotron-3-120b-a12b | 6/7 | 35.19 | 0 | stay (-1 prompts, cost over 1.5x) |
| zai-org/glm-4.7-flash | 7/7 | 6.33 | 0 | stay (+0 prompts, cost ok) |
| openai/gpt-oss-20b | 6/7 | 17.12 | 0 | stay (-1 prompts, cost over 1.5x) |
| qwen/qwq-32b | 7/7 | 80.32 | 0 | stay (+0 prompts, cost over 1.5x) |

## figurescript

| model | score | median neurons | errors | decision |
|---|---|---|---|---|
| google/gemma-4-26b-a4b-it (current) | 6/8 | 4.8 | 0 | - |
| nvidia/nemotron-3-120b-a12b | 4/8 | 17.88 | 0 | stay (-2 prompts, cost over 1.5x) |
| zai-org/glm-4.7-flash | 0/8 | 4.53 | 0 | stay (-6 prompts, cost ok) |
| openai/gpt-oss-20b | 6/8 | 7.75 | 0 | stay (+0 prompts, cost over 1.5x) |
| qwen/qwq-32b | 0/8 | 103.99 | 0 | stay (-6 prompts, cost over 1.5x) |

## Notes

- The first run's timing column was dropped: the Worker's own clock does not advance inside a request, so it read 0. The tool now times each call from the driver.
- Answer, will and review: gemma already scores full or near-full marks, so the rule's "at least 3 prompts better" cannot be met on those paths; this eval can show a candidate is worse or costlier, not better. A harder prompt set is needed to find a winner there.
- figurescript: glm-4.7-flash and qwq-32b scored 0/8 on the content-only check (cause not diagnosed). gemma 6/8 and gpt-oss-20b 6/8.

## Result

No path switches: the current model stays on every path.

# Item 3 harness — multilingual asks (Adam 2026-09-27)

Everything that passes through counts as input for Void.
The daily language rotation belongs in Void's loop, not only in a Grok chat automation.

## Routing
- Asks in any language go to the skill that matches intent, not the skill that matched an English color/word fragment.
- When no skill covers the ask, the will engine treats it like any other miss: board + `/api/miss`, same as English.
- Next item 9 (Void in other languages) stays Next. This file is the collision/harness requirement for item 3 now.

## Collision set (must be in the item 3 harness)
English-only collisions are not enough. Include at least:

- `¿por qué el cielo es azul?` — answer-engine / miss path. Must **not** recolor notes, stickies, or the stage blue.
- `pourquoi le ciel est-il bleu?` — same: not a color alter.
- `Warum ist der Himmel blau?` — same.
- `bakit asul ang langit?` — Tagalog; same.
- `haz el reloj azul` / `rends l'horloge bleue` — **do** route to the existing alter skill (intent is recolor).
- An uncovered ask in a non-Latin script (example: `为什么天是蓝的`) still POSTs a miss.

If a harness only speaks English, it will train the edit engine to treat `azul` as a paint command.

## Language rotation in the loop
Daily rotating practice (living-language pool, A2–B1 session shape) is input: session asks, translations, and misses feed covered.mjs / the miss list like any other ask.
Do not ship a language-class landing page. Surface stays a void.

## Queue key
The queue key is still the blocker for the three finished branches. Harness work can be written and tested locally; live queue claim/done waits on the key. Grok is not claiming the queue and is not deploying.

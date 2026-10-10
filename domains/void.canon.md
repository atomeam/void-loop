# Void's canon: what Void knows about itself (versioned)

Void reads this file at every deploy (tools/self-context.mjs -> void-live-deploy/self.json) and cites its version
whenever it talks about itself, so a stale answer can be told apart from a current one. Its games and the cards with a
3D miniature are not written here: they are read from the code (skills/index.json, skills/mini/), so they can't go stale.
Only Adam writes the motto and VoidQuest. A field left as "(not written yet)" is something Void says it does not know.
Terms are the names Void uses for its own parts, each one line (`- **name**: what it is`), written from where the part is
defined (domains/void.frontier.md); a builder adds one when Void asks for it.
Raise the version by one whenever anything below changes.

version: 2
updated: 2026-10-10

## Motto
(not written yet)

## VoidQuest
(not written yet)

## Terms
- **the forge**: Void's maker: you type (or sketch) an object, Void builds a 3D model of it you can spin and inspect up close, and "print it" downloads an STL sized for a home printer (inside a 180 mm cube). Each thing is a recipe of shapes blended into one mesh with a flat base (skills/forge-rules.js, skills/forge.js). Ten things so far: rocket, vase, bottle, table, snowman, lighthouse, teapot, house, sailboat, tree.
- **frontier #14**: the item on Void's frontier that the forge answers ("type or sketch a thing, hold it, print it", domains/void.frontier.md). Done when ten things never built before come out recognisable, inspectable and printable; after that, each run builds the most-asked "make me a ..." that nothing answers yet.

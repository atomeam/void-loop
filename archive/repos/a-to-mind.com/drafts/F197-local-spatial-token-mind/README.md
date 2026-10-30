# F-197 Local Spatial Token Mind

Novel combination for The Void canvas.

**Architecture**: Canvas2D causal energy deposit field (pointer deposits + diffusion). Web Worker runs a tiny local sequence model over trajectory features (speed, turn, energy) producing discrete intent tokens via soft scores. Tokens materialize as draggable DOM elements. User drag-and-drop of a token onto the field applies a local modulation (expand/focus/scatter/memory) and provides embodied feedback. Model confidence/entropy morphs page chrome (hue, blur, contrast). Seal persists partial field to localStorage.

**Expected outcome**: Interactive spatial field that generates living, rearrangeable intent tokens from recent gesture. Dropping tokens physically alters the field dynamics. Runnable offline in any modern browser (Worker + Canvas2D).

**Mechanics**: ~800 ms thought cycle; tokens auto-spawn and can be dragged; drop applies effect and removes after feedback. Not a continuous residual/attention swarm or GPU NCA — the mind produces discrete, physically manipulable tokens.

**Failure modes**: Worker blocked by CSP (static tokens); very low motion yields low-entropy "idle"; small screens crowd tokens.

**Building blocks**: Local sequence-to-token mind, embodied token rearrangement as teaching signal, chrome morph from model uncertainty. Next: WebGPU field + weight updates from drop locations, or WebXR token rays.

Lands in V01D as spatial stage skill under void-live-deploy/skills/; testable via token-drop → field delta and conf→CSS stability.

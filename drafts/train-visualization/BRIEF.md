# Train recognition for driving displays

A driving display builds its scene from detected objects and gives each one a class. A train has no class of its own, so a passing train can come out as a stream of separate trucks. This is a design for showing it as one train.

## Design
1. **A "train" class.** Chain a run of near-equally spaced, co-moving, collinear boxes into one rigid object (long axis, constant lateral offset, shared velocity).
2. **Context check.** Raise the train hypothesis when the chain overlaps rails, a mapped level crossing, gates or flashing signals. Keep a truck convoy on a road as trucks.
3. **Rendering.** Draw one continuous multi-car train, with the crossing gates and signals shown.

## What has to be measured
- Labeled crossing clips (trains and truck convoys) and the confusion rate of per-object vs fused display.
- Latency: the fused object must appear within the same frame budget.
- Hard cases: freight with gaps, light rail on streets, a convoy stopped at a crossing.

`demo.html` illustrates the idea. It is not a measurement.

# Train-aware driving visualization: design brief (concept)

**Observed:** a passing train rendered on a Tesla Model Y display as a stream of separate semi-trucks.
**Scope:** the on-screen visualization. This brief makes no claim about the driving stack, and nothing here modifies any vehicle.

## Proposal
1. **New class, "train".** Chain a run of near-equally spaced, co-moving, collinear boxes into one rigid object (long axis, constant lateral offset, shared velocity).
2. **Context confirmation.** Raise the train hypothesis when the chain overlaps rails, a mapped level crossing, gates or flashing signals; suppress it for a genuine truck convoy on a road.
3. **Rendering.** One continuous multi-car model with crossing gates and signals drawn, so the display reads "train, wait" at a glance.

## Evidence needed before claiming "better"
- Labeled clips of crossings (trains vs truck convoys) and the measured confusion rate of the fused vs per-object display.
- Latency: the fused object should appear within the same frame budget.
- Failure modes: freight with gaps, light-rail on streets, a convoy stopped at a crossing.

`demo.html` illustrates the concept only; it is not a measurement.

## Open questions
Does the occupancy network already expose a fused extent? Is rail geometry in the map layer the display can read?

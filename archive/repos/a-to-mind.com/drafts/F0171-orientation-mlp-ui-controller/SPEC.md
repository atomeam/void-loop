# F0171-orientation-mlp-ui-controller

## Concept
Novel combination: DeviceOrientation events feed a local tiny MLP (pure JS, no external libs) whose outputs continuously morph a hybrid DOM+canvas interface (tile scales, hues, and a causal particle field). Weights persist across sessions via IndexedDB. Clicking a tile provides a simple reward signal that adjusts weights via a basic Hebbian/reward update, creating a persistent local "controller mind" that adapts to how the user holds and orients their device.

This deliberately leaves the recent cluster of pure particle-agent simulations (e.g. 020-webgpu-void-agents, 048-evolving-particle-life-mind) and local attestation/signal-filter notes. Under-explored axes used: DeviceOrientation as causal input, local tiny models controlling physical UI elements, persistent IndexedDB, hybrid DOM+canvas embodiments.

## Architecture
- Single self-contained index.html
- Tiny MLP: input (alpha, beta, gamma normalized) → hidden(4) → output(3: scale, hue, force)
- DeviceOrientation listener updates inputs
- Outputs drive CSS custom properties on DOM tiles and canvas particle forces
- IndexedDB stores weights; loads on start, saves on update
- Click reward: positive for preferred states, simple weight nudge
- Offline-capable, graceful fallback if no orientation or IDB

## Expected outcome
Interactive prototype where tilting the device (or simulating with mouse) causes the UI to respond via the learned MLP. Persistence means preferences carry over. Failure modes: no DeviceOrientation → mouse fallback; IDB unavailable → in-memory only.

## Mechanics
Hold device and tilt to influence. Click tiles to reward the current orientation mapping. Watch the controller adapt over time.

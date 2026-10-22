# F172-webgpu-competitive-genome-agents

## Concept
Novel combination: multi-agent competition on a spatial resource field where each agent is controlled by a local tiny MLP genome. Agents gather energy from food particles; periodically the highest-energy agent's sealed genome is transferred (with mutation) to lower performers. Genomes persist via IndexedDB. Pointer interaction seeds resources and rewards agents. Hybrid Canvas2D embodiment with DOM status cards. WebGPU availability is probed for future compute-shader physics kernel.

This deliberately branches away from the recent dominant cluster (attention lattices, residual predictors, volumetric injection, pure NCA, spectral/audio residuals, pointer-history fields). Under-explored axes used: multi-agent competition with sealed genome transfer, persistent IndexedDB, local tiny models controlling physical agents, hybrid DOM+canvas.

## Architecture
- Single self-contained index.html
- 6 agents, each with position/velocity/energy and a 6→4→2 MLP genome
- Food particles respawn; agents use policy on local features (nearest food, nearest peer, energy, pointer) to accelerate
- Every ~3s: sort by energy, transfer mutated winner genome to bottom agents
- IndexedDB stores/loads best genome; Seal button commits current best
- Canvas2D rendering; WebGPU presence noted for next building block
- Offline-capable; graceful if no IDB

## Expected outcome
Interactive field where agents learn (via transfer) to seek food more effectively. User can inject food or boost agents by clicking. Sealed genomes carry over sessions. Failure modes: no IDB → in-memory only; low performance on very small screens.

## Mechanics
Hold/click to seed energy. Watch agents compete and genomes transfer. Seal to persist the current champion. Force Transfer for manual intervention.

## V01D landing
Spatial stage skill (`skills/mini/competitive-genome-agents.js`); testable via genome→force mapping and transfer mutation bounds.

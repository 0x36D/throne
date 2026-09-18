# Throne

Throne is an experimental political simulation engine. It separates objective world state from what each actor can observe, believe, decide, attempt, and actually accomplish.

The current repository is an architectural scaffold. The product specification is in [docs/SPEC.md](./docs/SPEC.md), the gameplay direction is in [docs/DESIGN.md](./docs/DESIGN.md), the current implementation snapshot is in [STATUS.md](./STATUS.md), provider findings are in [docs/providers.md](./docs/providers.md), and the main architectural decisions are under [docs/architecture](./docs/architecture).

## Local development

Requirements: Node.js 22.12 or newer and pnpm 11.

```bash
pnpm install
pnpm test
pnpm demo
pnpm dev
```

`pnpm demo` runs the decision-revision scenario through the event kernel. `pnpm dev` starts the local web shell, where the partial-implementation, contradictory-orders, and decision-revision demonstrations can be inspected from ruler and administrator perspectives.

## Runtime shape

- `packages/sim-core` owns simulation time, scheduling, transactions, event records, replay, and objective state.
- `packages/shared-types` owns stable contracts shared across boundaries.
- `packages/agent-runtime` owns human, recorded, heuristic, and DeepSeek Harness-backed decision policies.
- `packages/scenario-mvp` contains scenario data and domain rules without modifying the kernel.
- `apps/sim-cli` is the headless runner.
- `apps/web` will become the player, observer, replay, and batch-analysis interface.

DeepSeek Harness is consumed as a pinned external runtime through an adapter. Its source code is not vendored into this repository.

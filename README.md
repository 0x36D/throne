# Throne

Throne is an experimental political simulation engine. It separates objective world state from what each actor can observe, believe, decide, attempt, and actually accomplish.

The current repository is an architectural scaffold. The product specification is in [SPEC.md](./SPEC.md), the current implementation snapshot is in [STATUS.md](./STATUS.md), and the main architectural decisions are under [docs/architecture](./docs/architecture).

## Local development

Requirements: Node.js 22.12 or newer and pnpm 11.

```bash
pnpm install
pnpm test
pnpm demo
pnpm dev
```

`pnpm demo` runs a tiny headless message-delivery scenario through the event kernel. `pnpm dev` starts the local web shell.

## Runtime shape

- `packages/sim-core` owns simulation time, scheduling, transactions, event records, replay, and objective state.
- `packages/shared-types` owns stable contracts shared across boundaries.
- `packages/agent-runtime` owns human, recorded, heuristic, and DeepSeek Harness-backed decision policies.
- `packages/scenario-mvp` contains scenario data and domain rules without modifying the kernel.
- `apps/sim-cli` is the headless runner.
- `apps/web` will become the player, observer, replay, and batch-analysis interface.

DeepSeek Harness is consumed as a pinned external runtime through an adapter. Its source code is not vendored into this repository.

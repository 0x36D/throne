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

`pnpm demo` runs the dynamic-actor-promotion scenario through the event kernel. Set `THRONE_LOCALE=en` to print its headings in English; Chinese is the default. `pnpm dev` starts the local web app. Its default capital-crisis scene pauses for a real ruler decision, resumes through delayed order execution and reporting, and can then expose the recorded causal history in the administrator view. The earlier mechanism demonstrations remain available alongside it. The language switch is persisted locally in the browser.

## Runtime shape

- `packages/sim-core` owns simulation time, scheduling, transactions, event records, replay, and objective state.
- `packages/shared-types` owns stable contracts shared across boundaries.
- `packages/agent-runtime` owns human, recorded, heuristic, and DeepSeek Harness-backed decision policies.
- `packages/scenario-mvp` contains scenario data and domain rules without modifying the kernel.
- `apps/sim-cli` is the headless runner.
- `packages/localization` owns the typed Chinese and English display catalogs; simulation identifiers remain language-neutral.
- `apps/web` is the localized player/debug shell and will grow into the observer, replay, and batch-analysis interface.

DeepSeek Harness is consumed as a pinned external runtime through an adapter. Its source code is not vendored into this repository.

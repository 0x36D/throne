# Throne

Throne is an experimental political simulation engine. It separates objective world state from what each actor can observe, believe, decide, attempt, and actually accomplish.

The repository contains a playable prototype and inspectable mechanism scenarios. Start with [STATUS.md](./STATUS.md) and the [documentation map](docs/README.md); the product specification is in [docs/SPEC.md](./docs/SPEC.md).

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

For a real model round, run `pnpm dev`, open the local page, and choose **DeepSeek / 真实 NPC**. The local service reads `DEEPSEEK_API_KEY` or the single key in `secret/deepseek.txt`. Starting a scene is free; issuing a decree calls the official model with thinking enabled. Errors pause the decision and offer an explicit retry. Completed records stay under gitignored `runs/`; post-run review and replay do not make model calls. This route requires the local development server, not just the static build.

The web app also includes **Offices and command / 职位与任命**: a general becomes chancellor, a successor receives legal command, and the guard weighs competing orders against its existing loyalties. Ruler and administrator views separate reported outcomes from private relationships. Contested appointments and recognition are implemented in the rule API and tested, but do not yet have a player-facing appointment editor.

- `packages/sim-core` owns simulation time, scheduling, transactions, event records, replay, and objective state.
- `packages/shared-types` owns stable contracts shared across boundaries.
- `packages/agent-runtime` owns human, recorded, heuristic, and DeepSeek Harness-backed decision policies.
- `packages/scenario-mvp` contains scenario data and domain rules without modifying the kernel.
- `apps/sim-cli` is the headless runner.
- `packages/localization` owns the typed Chinese and English display catalogs; simulation identifiers remain language-neutral.
- `apps/web` is the localized player/debug shell and will grow into the observer, replay, and batch-analysis interface.

DeepSeek Harness is consumed as a pinned external runtime through an adapter. Its source code is not vendored into this repository.

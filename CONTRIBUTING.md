# Contributing

Start with [SPEC.md](./SPEC.md), then read [docs/architecture/overview.md](./docs/architecture/overview.md) and [STATUS.md](./STATUS.md).

Keep objective world state inside `sim-core`. Agent code may return structured decisions but may not mutate the world. New behavior should enter through scheduled events, committed domain events, and validated transactions.

Before pushing a change, run:

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

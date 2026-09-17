# Status

The repository contains the initial modular scaffold and the first vertical scenario. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, a false-report scenario, a headless demo, and a web view that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. The live model adapter is intentionally not enabled until its request/response contract and actor-visible context boundary are covered by tests.

The false-report slice now runs from objective regional stock through message delivery, actor observation, contradictory ruler beliefs, and later independent investigation. Tests verify replay and that objective stock is absent from the ruler-facing projection.

Next vertical slice: model an order that is acknowledged, partially implemented, and falsely reported complete.

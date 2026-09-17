# Status

The repository contains the initial modular scaffold. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, a minimal scenario, a headless demo, and a web application shell.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. The live model adapter is intentionally not enabled until its request/response contract and actor-visible context boundary are covered by tests.

Next vertical slice: implement the false-report scenario from objective regional stock through message delivery, actor observation, ruler belief, and later investigation.

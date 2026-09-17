# Status

The repository contains the initial modular scaffold and two vertical scenarios. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, false-report and partial-implementation scenarios, a headless demo, and a web view that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. The live model adapter is intentionally not enabled until its request/response contract and actor-visible context boundary are covered by tests.

The partial-implementation slice runs a grain-transfer order through creation, travel, receipt, acknowledgement, capacity-limited execution, a false completion return, and an independent audit. Actual and reported order states remain separate. Tests verify resource conservation, information hiding, and deterministic replay. The false-report slice remains covered by its original tests.

Next vertical slice: contradictory orders delivered to the same subordinate in one simulation-time batch.

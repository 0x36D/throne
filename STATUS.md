# Status

The repository contains the initial modular scaffold and three vertical scenarios. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, false-report, partial-implementation, and contradictory-orders scenarios, a headless demo, and a web view that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. The live model adapter is intentionally not enabled until its request/response contract and actor-visible context boundary are covered by tests.

The contradictory-orders slice delivers two commands to one military commander in the same simulation-time batch, opens one decision episode, evaluates multiple relationship and situational factors, commits an intent, and executes a unit movement. The ruler's projection does not expose message delivery, the competing order, or private deliberation before the commander's report arrives. Earlier slices remain covered by their original tests.

Next vertical slice: decision revision while an earlier order remains in transit.

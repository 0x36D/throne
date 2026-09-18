# Status

The repository contains the initial modular scaffold and five vertical scenarios. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, shared organization and control-relationship contracts, false-report, partial-implementation, contradictory-orders, decision-revision, and emergent-loss-of-control scenarios, a headless demo, and a web view that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. The live model adapter is intentionally not enabled until its request/response contract and actor-visible context boundary are covered by tests.

The loss-of-control slice keeps the ruler as the Imperial Guard's sole formal authority throughout two rounds of conflicting orders. The guard obeys the ruler first. Chancellor Wei then settles its full payroll arrears, strengthening a concrete funding relationship; in the next decision the commander follows the chancellor instead. Practical control is derived for debugging from current relationships and recent obedience, never stored as a world-state flag or changed by a coup/collapse trigger. The ruler sees orders and reports rather than control scores. Earlier slices remain covered by their original tests.

Next vertical slice: dynamic promotion of a persistent lightweight actor to LLM cognition without losing identity or history.

# Status

The repository contains the initial modular scaffold and six vertical scenarios. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, shared actor, organization, and control-relationship contracts, false-report, partial-implementation, contradictory-orders, decision-revision, emergent-loss-of-control, and dynamic-actor-promotion scenarios, a headless demo, and a web view that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. Demo F accepts that structural decision-policy boundary but uses a recorded policy by default, so tests and replay consume no API credit. The adapter asks model-backed policies to return localized human-readable values while keeping stable JSON keys.

The dynamic-promotion slice begins with Shen, an assistant palace registrar, as a persistent Tier 1 actor with identity, office history, motivations, beliefs, and memory. Discovering a sealed officer ledger creates explicit critical-information and high-impact signals. Only Shen's cognition policy is promoted to the LLM tier; the accumulated person remains intact. The promoted structured decision sends the evidence through an available courier capability, and replay uses the committed output without calling the policy again. Earlier slices remain covered by their original tests.

Chinese is the default display language. `packages/localization` provides compile-time-matched Chinese and English catalogs, the web switch persists locally, and the CLI accepts `THRONE_LOCALE=en`. Simulation identifiers and records are kept language-neutral where practical.

Next implementation slice: connect the existing decision episodes to a player-controlled pause, choose, and resume loop so the ruler can make an actual in-simulation decision.

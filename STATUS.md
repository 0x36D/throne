# Status

The prototype includes seven mechanism demonstrations, an offline ruler decision loop, and a two-decision live DeepSeek short game. Chinese is the default; display language can switch to English. The web's "真实 NPC / Live NPC" entry uses a loopback-only local service, explicit thinking/high, and the pinned Harness adapter with shell tools and raw session persistence disabled.

The player issues a decree, receives its delayed reports, then maintains the reported deployment or sends a new decree after fresh intelligence. The same Commander Zhao retains his received orders, decisions and actual actions. Both rounds share one world and event log; later success does not erase earlier damage. The ruler timeline contains only received reports and their own orders. All private NPC context is withheld until the whole game ends. Rules: [ADR 0005](docs/architecture/0005-continuous-crisis.md).

Two continuous games were played through the browser: palace → east protected both sites; east → maintain east preserved the earlier palace archive loss while protecting the warehouses. All four calls obeyed and observed thinking/high, taking about 2.9–5.1 seconds each. The second inputs included distinct histories, but these small trials do not establish calibrated political behavior or causal use of every memory. Details: [playtest and acceptance](docs/issues/archive/continuous-crisis.md).

Failures pause the current decision; retry does not regenerate earlier decisions or reissue decrees. Episode-specific submissions prevent stale requests advancing the next round. Completed version 2 runs persist in gitignored runs/ and replay without model calls after server restart. Version 1 single-round records remain readable/replayable. Unfinished sessions are still in memory and are lost on server restart.

Office/appointment rules and the earlier scenes remain available. Actual model calls are opt-in; pnpm demo and the automated tests use no provider credit. Credentials are never sent to the browser or committed. The SDK does not expose independently verifiable returned model identity, so those metadata fields remain null.

Current checks: 72 tests pass; types, formatting and production build pass. Build emits a non-blocking frontend chunk-size advisory. Documentation routing is in [docs/README.md](docs/README.md); completed investigations are archived, current rules stay in architecture/.

Next candidate: controlled behavior comparisons across varied evidence and relationships, plus more natural brief explanations. No full campaign, automatic relationship evolution or mixed-provider implementation has started.

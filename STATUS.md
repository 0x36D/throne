# Status

The prototype includes seven mechanism demonstrations, an offline ruler decision loop, and a live DeepSeek NPC round. Chinese is the default; display language can switch to English. The web's "真实 NPC / Live NPC" entry uses a loopback-only local service, explicit thinking/high, and the pinned Harness adapter with shell tools and raw session persistence disabled.

The player chooses a decree. Commander Zhao receives it alongside a competing chancellor order and local reports, then selects a validated capability. Engine events implement the result and delayed reply. Failures pause the original decision and can be retried without repeating the decree. Completed runs persist in gitignored runs/; review and verified replay work without model calls, even after restarting the server. Unfinished sessions are still in memory.

One real round was played: hold the palace → DeepSeek obeyed → palace secured. One request took about 4.4 seconds and reported 393 reasoning tokens. The actor-visible snapshot did not contain objective crisis truth. This is a single functional trial, not evidence of calibrated political behavior. Details: [playtest](docs/issues/archive/live-playtest-2026-09-21.md).

Office/appointment rules and the earlier scenes remain available. Actual model calls are opt-in; pnpm demo and the automated tests use no provider credit. Credentials are never sent to the browser or committed. The SDK does not expose independently verifiable returned model identity, so those metadata fields remain null.

Current checks: 62 tests pass; types, formatting and production build pass. Build emits a non-blocking frontend chunk-size advisory. Documentation routing is in [docs/README.md](docs/README.md); completed investigations are archived, current rules stay in architecture/.

Next candidate: consecutive ruler/NPC decisions and behavior checks across varied evidence and relationships. No multi-round campaign or mixed-provider implementation has started.

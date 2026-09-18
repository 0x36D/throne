# Status

The repository contains the initial modular scaffold and four vertical scenarios. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, actor decision-policy boundaries, false-report, partial-implementation, contradictory-orders, and decision-revision scenarios, a headless demo, and a web view that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. The live model adapter is intentionally not enabled until its request/response contract and actor-visible context boundary are covered by tests.

The decision-revision slice preserves an initial command after new intelligence causes the ruler to reopen the same decision and send a countermand. The second courier departs later but arrives first; the guard executes revision 1 and ignores revision 0 when it eventually arrives. Both messages, both intents, and the complete order lifecycles remain in the event history. The ruler sees issued orders, received reports, and eventual confirmation, while the administrator view exposes the courier race and objective result. Earlier slices remain covered by their original tests.

Next vertical slice: emergent loss of practical control without a scripted coup or collapse trigger.

# Status

The repository contains the initial modular scaffold, six mechanism demonstrations, and the first playable decision loop. It has a deterministic discrete-event kernel, append-only in-memory simulation records, replay support, human, recorded, and model-backed decision-policy boundaries, shared actor, organization, and control-relationship contracts, a headless demo, and a localized web app that separates ruler knowledge from administrator truth.

DeepSeek Harness is pinned as an external SDK dependency and isolated behind `packages/agent-runtime`. Demo F accepts that structural decision-policy boundary but uses a recorded policy by default, so tests and replay consume no API credit. The adapter asks model-backed policies to return localized human-readable values while keeping stable JSON keys.

The playable capital-crisis scene stops at simulation time 10 with two conflicting reports and an open ruler decision. The administrator view is unavailable until the player chooses. `HumanDecisionPolicy` validates the submitted choice; the scenario then creates an intent and order, transmits it, executes it at simulation time 60, and delivers the result at time 90. Holding the palace and moving to the East Gate lead to different objective outcomes. Both completed histories replay from committed records without another player input. The UI never writes objective state directly.

Chinese is the default display language. `packages/localization` provides compile-time-matched Chinese and English catalogs, the web switch persists locally, and the CLI accepts `THRONE_LOCALE=en`. Simulation identifiers and records are kept language-neutral where practical.

Next implementation slice: place one real DeepSeek-backed NPC decision inside the playable path, record its structured output, and prove that the resulting player session still replays without another model call.

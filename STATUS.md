# Status

The prototype includes seven mechanism demonstrations and one playable ruler decision loop. Chinese is the default; the web language switch persists locally. The CLI still runs Demo F, and THRONE_LOCALE=en selects English headings.

The new office/appointment scene is available in the web navigation. It preserves identity, memories, previous tenure and private relationships while deriving formal command from recognized active appointments. A promoted general and his successor send conflicting orders; the captain's choice changes when relationship evidence changes. The ruler learns the result only through a delayed report. Unauthorized claims, over-capacity appointments, recognition and removal are covered by the rule API and tests; they are not yet a player appointment menu.

Confirmed PR #2 reliability gaps are fixed: alternative evidence dispositions have effects, unknown events and damaged collection fields fail explicitly, and the web exposes errors with a restart path. Reasonable localization and model-format compatibility remain. PR #2 was revised to the owner's agreed rules and merged with the contributor's history preserved.

The engine remains deterministic and in-memory. No live NPC model is enabled in these scenes, and replay consumes no API calls. The current appointment legality model represents one institution; multiple competing legal systems and fiscal authority implementation remain outside this slice.

Next: one real DeepSeek-backed NPC decision in the playable flow, including recorded output and explicit failure recovery. Read [docs/README.md](docs/README.md) for targeted documentation; active priorities are in [docs/issues/FEATURES.md](docs/issues/FEATURES.md), completed investigations in its archive. Current office rules remain in [ADR 0003](docs/architecture/0003-appointment-layer.md).

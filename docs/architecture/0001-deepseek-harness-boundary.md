# ADR 0001: Keep DeepSeek Harness outside the simulation kernel

Status: accepted

DeepSeek Harness is a fast-moving developer-preview dependency. Throne will pin a compatible SDK/runtime version and call it through `packages/agent-runtime`; its repository will not be copied into Throne.

The first integration uses the TypeScript SDK's subprocess boundary. The adapter receives an actor-visible `ActorDecisionInput` and returns a schema-validated `ActorDecisionOutput`. Harness tools, if introduced later, may inspect only decision-scoped actor information and may submit intents; they may never mutate objective state.

Harness session events are inference traces, not simulation events. Replaying a recorded simulation therefore never starts Harness or calls a model.

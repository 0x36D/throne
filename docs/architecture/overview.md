# Architecture overview

Throne is a modular monolith. Package boundaries protect the experiment's semantics; they are not deployment boundaries.

The simulation event log and the DeepSeek Harness session log are deliberately separate. The simulation log records world history in simulation time. Harness records model execution history. They are joined through run, branch, actor, decision-episode, and model-call identifiers.

The simulation kernel follows this path:

```text
ScheduledEvent batch
  -> scenario resolver
  -> proposed DomainEvents and future ScheduledEvents
  -> invariant validation
  -> atomic record append
  -> objective-state projection
```

All events at the earliest simulation timestamp are delivered to the scenario resolver as one batch. This prevents meaningful simultaneous inputs, such as contradictory orders, from being resolved by incidental array order.

Actor cognition is accessed through one `DecisionPolicy` contract. A role can use a human policy during play, a Harness policy during autonomous runs, or a recorded policy during replay without changing the simulation rules.

# Political Simulation Engine MVP Specification

Status: MVP architecture specification  
Audience: Codex / implementation agents / human reviewers  
Primary goal: Build a headless political simulation prototype that can demonstrate incomplete information, imperfect command execution, autonomous actors, unstable political order, and time-dependent decision processes without requiring a full historical grand-strategy game.

Gameplay intent and design maturity are documented in [DESIGN.md](./DESIGN.md). That supplement does not automatically expand this MVP's scope or override its architectural boundaries; conflicts require an explicit design decision and synchronized documentation.

---

## 1. Project Intent

This project is an experimental political simulation engine. Its purpose is not to reproduce a specific historical period, nation, or ideology. The initial goal is to test whether a relatively small set of general simulation rules can produce political behavior that resembles real historical dynamics more closely than conventional strategy games.

Most historical strategy games make several simplifying assumptions:

1. The player sees the true state of the country.
2. The player acts as the state itself rather than as one political actor inside the state.
3. Orders issued by the player are translated into effects with little or no independent implementation process.
4. Political institutions are usually stable background rules.
5. Rebellion, coups, disobedience, corruption, misinformation, and administrative failure are usually represented as predefined events or modifiers.
6. Actors usually choose from a developer-defined action menu.

This project intentionally rejects those assumptions.

The simulation should instead treat political order as something that must be continuously reproduced through information, communication, organization, incentives, relationships, and actual control over people and resources.

A ruler may legally hold supreme authority while lacking actual control over the army. A minister may formally obey an order while delaying implementation. A governor may submit falsified reports. A military unit may receive multiple contradictory orders from different authorities. A rebellion may gradually acquire the same organizational properties as a government. A political actor may change their decision after new information arrives, even after an earlier messenger has already departed.

The player should not be omniscient. The player should experience the political system through reports, messages, conversations, institutional procedures, and the behavior of other actors.

The engine should therefore distinguish between:

- what is objectively true in the simulated world;
- what information reaches a particular actor;
- what that actor currently believes;
- what that actor wants;
- what that actor decides to attempt;
- what other actors decide to do in response;
- what actually happens.

This distinction is the central design principle of the project.

---

## 2. Core Design Thesis

The engine is not primarily simulating "politics inside a stable state."

It is simulating how political order itself is produced, maintained, distorted, contested, and sometimes destroyed.

The engine must not assume that legal authority, actual control, obedience, legitimacy, or institutional stability are equivalent.

The engine should permit situations such as:

- a ruler who remains legally sovereign but is politically isolated;
- a minister who controls access to the ruler and selectively filters orders;
- a military commander who is legally subordinate but practically autonomous;
- officials who acknowledge an order but do not execute it;
- institutions that continue to exist formally after losing effective capacity;
- local authorities who continue to use the language of obedience while withholding taxes or troops;
- a rebel organization that gradually develops taxation, administration, courts, command structures, and territorial control;
- a coup that succeeds in one part of the political network but fails in another;
- actors making decisions based on false or delayed information;
- an actor reversing a decision after a first order has already been sent.

These outcomes should emerge from general mechanisms wherever possible, rather than from hard-coded "coup events," "rebellion events," or "corruption events."

---

## 3. MVP Question

The MVP exists to answer one question:

Can a relatively small simulation kernel produce credible political instability, information asymmetry, partial obedience, and autonomous decision-making without relying on scripted historical events?

The MVP is successful if it can repeatedly produce understandable situations such as:

- the ruler believes an order has been carried out when it has only been partially implemented;
- two officials give contradictory reports about the same situation;
- a key political actor delays, distorts, or refuses an order because their incentives favor doing so;
- a military command chain splits during a crisis;
- the central government loses effective control without an explicit "government collapse" event;
- a previously minor actor becomes politically important because circumstances increase their decision autonomy and impact;
- an actor revises a decision while earlier instructions remain physically in transit;
- replay can explain why the resulting sequence occurred.

The MVP does not need to be historically accurate in numerical calibration. It needs to validate the architecture.

---

## 4. Architectural Principle: Separate the World from the Minds

The system should be divided into two conceptually separate layers.

### 4.1 Simulation Core

The simulation core is the authoritative world.

It owns objective state, event timing, resource changes, organizational relationships, communication delays, and committed world mutations.

It does not ask an LLM what is objectively true.

It should be deterministic when replaying already-recorded decisions and events.

### 4.2 Agent Runtime

The agent runtime represents political cognition.

It may use LLMs for selected actors.

It receives only the information that a particular actor is allowed to observe.

It reasons over that actor's beliefs, motivations, relationships, memories, and available capabilities.

It produces structured intentions and decisions.

It cannot directly mutate authoritative world state.

The implementation should treat DeepSeek Harness, another agent harness, or a custom LLM runtime as replaceable infrastructure behind an adapter. The simulation core must not depend directly on framework-specific agent classes.

---

## 5. Required Data Layers

Every important political interaction should pass through the following conceptual layers:

`Objective World State -> Observation -> Belief -> Motivation -> Decision -> Intent -> Operation -> Event -> Response -> World Mutation`

These layers should not be collapsed into a single "AI action."

### 5.1 Objective World State

Objective state includes facts the engine treats as physically or institutionally instantiated.

Examples:

- a person is in a location;
- a treasury contains a particular amount of money;
- a military unit has a particular number of personnel;
- a messenger departed at a specific time;
- an official currently occupies an office;
- an organization controls a communication channel;
- a unit has recently received or obeyed particular orders;
- a stockpile contains a particular amount of grain;
- an actor has an established personal relationship with another actor;
- an organization pays a particular unit.

Avoid storing broad political conclusions as primitive truth when they can be derived from lower-level facts.

For example, avoid a primitive field such as:

`emperor_controls_army = 0.72`

Prefer to derive perceived or effective control from relationships such as command structure, pay source, recent obedience, officer appointments, communication access, personal loyalty, and current circumstances.

### 5.2 Observation

An observation is information available to a particular actor through a particular channel at a particular time.

Observation is not guaranteed to equal objective truth.

Observations may be:

- delayed;
- incomplete;
- statistically noisy;
- filtered;
- intentionally falsified;
- unintentionally incorrect;
- contradictory;
- missing.

Every observation should have provenance where practical.

Example fields:

```ts
type Observation = {
  id: string
  actorId: string
  observedAt: SimTime
  sourceType: string
  sourceId?: string
  subjectRefs: string[]
  payload: unknown
  confidenceHint?: number
  causalEventId?: string
}
```

The engine should be able to answer: "Why did this actor believe this?"

### 5.3 Belief State

Belief state is the actor's current model of the world.

Beliefs may conflict with objective truth.

Beliefs may also contain uncertainty.

Do not require every belief to be a single scalar value.

Example:

```ts
type Belief<T> = {
  proposition: string
  value?: T
  confidence: number
  supportingObservationIds: string[]
  updatedAt: SimTime
}
```

MVP belief representation may remain simple. It only needs to support uncertainty, contradiction, and update over time.

### 5.4 Motivation

Motivation is structured and engine-owned.

Do not rely on a prompt such as "you are ambitious" as the sole representation of personality.

A political actor may have separate and potentially conflicting motivational dimensions such as:

- self-preservation;
- wealth;
- office retention;
- personal ambition;
- loyalty to ruler;
- loyalty to state;
- loyalty to family;
- loyalty to organization;
- ideological commitment;
- local or regional attachment;
- concern for reputation;
- concern for subordinates;
- risk tolerance;
- revenge;
- fear of disorder;
- preference for procedural legality.

These values should not be treated as moral labels.

Avoid defining fixed archetypes such as "loyalist," "traitor," or "villain" as the primary decision model.

A person may oppose the ruler because they believe doing so protects the state. A self-interested actor may temporarily become highly cooperative because the regime's survival is necessary for their own survival.

### 5.5 Decision

A decision is a cognitive process, not necessarily an instantaneous event.

The system must support decisions that take time, can be interrupted by new information, and can be revised.

See Section 9.

### 5.6 Intent

An intent is what an actor chooses to attempt.

Example:

```ts
type Intent = {
  actorId: string
  createdAt: SimTime
  goal: string
  operationTemplate?: string
  parameters: Record<string, unknown>
  secrecy?: number
  urgency?: number
  causalDecisionEpisodeId: string
}
```

Intents do not directly alter the world.

### 5.7 Operation

An operation is an executable simulation-level attempt produced from an intent.

Operations are built from available primitives and capabilities.

Examples:

- send a message;
- order a subordinate;
- transfer funds;
- summon a meeting;
- appoint an official;
- remove an official;
- move a unit;
- investigate records;
- seize a building;
- arrest a person;
- publish a statement;
- establish a secret contact.

An operation may be legal or illegal.

Legality is not the same as physical executability.

### 5.8 Event

Operations produce scheduled events.

Events represent things that occur in simulation time.

Examples:

- messenger departs;
- message arrives;
- meeting begins;
- unit starts moving;
- payment fails;
- official receives contradictory instruction;
- arrest is attempted;
- report is submitted;
- decision deadline arrives.

Only the simulation kernel may commit authoritative mutations.

---

## 6. Legal Authority Is Not Hard Permission

This is a mandatory design rule.

The engine must distinguish between:

1. whether an actor is legally or procedurally authorized to perform an action;
2. whether an actor has enough practical access, control, or influence to attempt the action.

The simulation API should generally test `canAttempt`, not `isAuthorized`.

A general who legally has no authority to arrest the ruler may still attempt to do so if they control troops with access to the palace.

A local official may attempt to withhold taxes even when legally required to transfer them.

A minister may attempt to suppress a report even if regulations require forwarding it.

Legal authority should influence:

- expected obedience;
- reputational consequences;
- institutional resistance;
- later justification;
- legitimacy perceptions;
- willingness of third parties to cooperate.

It should not usually prevent the attempt from entering the simulation.

Hard prevention should be reserved for actual impossibility, such as lack of access, lack of communication, lack of required resources, or unavailable primitives.

---

## 7. Political Order as a Relationship Network

Do not model the state as a single actor that automatically owns all state capacity.

The MVP should represent political capacity through relationships among actors, offices, organizations, units, locations, and resources.

Relevant relationships may include:

- formal command;
- informal influence;
- funding;
- appointment authority;
- communication access;
- information access;
- personal loyalty;
- organizational membership;
- physical access;
- control over infrastructure;
- legal recognition.

A ruler's practical power should emerge from these relationships.

Do not create a single authoritative `sovereignPower` value.

Derived metrics are allowed for UI, debugging, or agent context, but the underlying world model should remain relational.

---

## 8. Organizations

Government, army, bureaucracy, faction, rebel organization, court clique, and similar entities should share a common organizational foundation where practical.

Do not build completely separate political logic for "government" and "rebels."

An organization should be able to have:

- members;
- offices or roles;
- resources;
- command relationships;
- internal procedures;
- communication channels;
- territorial presence;
- relationships with other organizations;
- claims or recognized authority;
- controlled assets.

A rebel movement that becomes more organized should be able to acquire administrative capabilities without switching to an entirely different engine type.

---

## 9. Time and Decision Episodes

### 9.1 No Single Global Monthly Tick

The simulation should use continuous simulation time plus an event scheduler.

Different systems may update at different effective resolutions.

Examples:

- annual or monthly demographic updates;
- monthly financial settlements;
- daily administrative routines;
- hourly crisis communication;
- minute-scale decisions if required by a specific event.

The engine should advance to the next scheduled event rather than iterating every actor every minute.

### 9.2 DecisionEpisode

Important decisions should be modeled as processes over time.

Example:

```ts
type DecisionEpisode = {
  id: string
  actorId: string
  openedAt: SimTime
  triggerObservationIds: string[]
  status: "open" | "committed" | "abandoned"
  urgency: number
  expectedResolutionAt?: SimTime
  provisionalIntents: Intent[]
  revisionCount: number
  finalIntentIds: string[]
}
```

A decision episode may include:

- initial reaction;
- consultation;
- waiting for more information;
- provisional intent;
- revision;
- final commitment;
- additional revision after earlier actions have already begun.

This allows realistic sequences such as:

- Actor receives report A.
- Actor decides to send order X.
- Messenger carrying X departs.
- New report B arrives.
- Actor reverses position.
- Actor sends order Y.
- Messenger Y attempts to overtake messenger X.
- Recipient may receive X first, Y first, both, or neither.

Earlier world events are not erased when the actor changes their mind.

### 9.3 Adaptive Decision Resolution

Not every decision requires detailed deliberation.

Routine low-impact actions may resolve quickly through deterministic rules or lightweight utility logic.

Full LLM deliberation should be reserved for decisions with high uncertainty, high impact, conflicting motivations, novel strategy requirements, or political significance.

Do not call an LLM every simulation tick.

---

## 10. Actor Cognition Tiers

The engine should support multiple cognitive resolutions.

### Tier 0: Aggregate Population

Used for large groups that do not currently require individual identity.

Examples:

- ordinary soldiers;
- peasants;
- urban workers;
- low-level clerks.

Represent group-level properties such as morale, pay satisfaction, discipline, trust in officers, local identity, political sentiment, fatigue, and fear.

### Tier 1: Lightweight Persistent Actors

Used for named individuals who have persistent identity but do not currently require LLM reasoning.

They should still have:

- identity;
- background;
- office history;
- key relationships;
- motivational parameters;
- important memories;
- relevant beliefs.

Decision-making may use utility scoring or rule-based behavior.

### Tier 2: LLM Actors

Used for actors facing complex strategic decisions.

The LLM should receive structured context based on:

- beliefs, not objective truth;
- motivations;
- relationships;
- relevant memories;
- available capabilities;
- current decision episode;
- known risks and constraints.

The LLM returns structured decisions, not direct world mutations.

### Dynamic Promotion and Demotion

An actor may move between Tier 1 and Tier 2 depending on current importance.

Potential promotion signals include:

- control of important resources;
- possession of critical information;
- entry into a succession crisis;
- command of a contested military unit;
- emergence as a rebellion leader;
- involvement in high-impact negotiation;
- unusually high decision uncertainty;
- unusually high potential impact.

Promotion must preserve identity continuity.

Do not invent a new personality at promotion time.

A lightweight actor must already have a persistent identity record.

Demotion should summarize significant new memories back into structured persistent state.

---

## 11. Personality and Strategic Behavior

LLMs used in this project must not be assumed to naturally behave like historical political actors.

Modern language models often have strong tendencies toward cooperation, explanation, honesty, and task completion.

The simulation must therefore encode political incentives structurally.

The engine should not simply prompt:

"You are a dishonest minister."

Instead it should provide the actor with a situation in which deception, delay, selective compliance, or obstruction may rationally advance their goals.

The LLM should choose among feasible strategies.

The engine owns incentives and constraints. The LLM owns high-level strategic choice.

For high-level actors, avoid pre-deciding the behavior class whenever possible.

Preferred flow:

1. Engine supplies beliefs, motivations, constraints, and feasible capabilities.
2. LLM chooses strategy.
3. LLM produces structured intent.
4. Engine validates whether the intent can be attempted.
5. Other actors and organizations respond.
6. Simulation determines outcome.

For low-level actors, the engine may use direct utility logic.

### Dishonesty

Dishonesty should have prerequisites and consequences.

A character should only be able to falsify or suppress information if they have relevant access or influence.

Deception should interact with:

- audit risk;
- independent information channels;
- trust;
- organizational control;
- penalties if discovered;
- expected gain;
- risk tolerance.

Avoid a single global `dishonesty` stat that causes indiscriminate lying.

---

## 12. Command and Implementation

An order is not an effect.

Orders should have a lifecycle.

Suggested states include:

- created;
- sent;
- received;
- acknowledged;
- interpreted;
- scheduled;
- partially executed;
- executed;
- reported complete;
- failed;
- countermanded;
- ignored.

The reported state may differ from actual state.

A subordinate may:

- comply;
- comply partially;
- reinterpret;
- delay;
- request clarification;
- conceal noncompliance;
- refuse;
- sabotage;
- redirect;
- defect.

These outcomes should depend on incentives, relationships, practical capacity, and information.

---

## 13. Communication

Communication must take simulation time.

Messages should be world objects or events with:

- sender;
- intended recipient;
- channel;
- departure time;
- expected arrival time;
- content;
- secrecy;
- reliability;
- interception risk;
- causal source.

The MVP does not require a detailed physical postal network.

However, it must support delayed, failed, intercepted, contradictory, and outdated messages.

Communication delays are essential to crisis simulation.

---

## 14. Capabilities and Primitives

The action system should be layered.

### 14.1 Engine Primitives

Primitives are stable, developer-defined operations representing basic things that can happen in the world.

The MVP should begin with a small set.

Candidate primitives:

- send message;
- move actor;
- move unit;
- transfer funds;
- transfer goods;
- request report;
- create report;
- appoint to office;
- remove from office;
- issue order;
- summon meeting;
- create organization relationship;
- modify organization membership;
- begin investigation;
- publish statement;
- attempt detention/arrest;
- establish secret contact;
- allocate administrative effort.

This list is intentionally incomplete.

Do not attempt to anticipate every historical political behavior.

### 14.2 Capability Layer

Capabilities are reusable combinations of primitives.

Examples:

- conduct provincial tax audit;
- organize palace security inspection;
- establish emergency grain distribution;
- quietly test military commanders' loyalty;
- coordinate simultaneous arrests;
- build a clandestine communication network.

Capabilities may contain:

- conditions;
- branching;
- waiting;
- retries;
- loops with hard limits;
- parallel steps;
- cancellation;
- resource requirements;
- information requirements;
- failure handling.

### 14.3 Dynamic Capability Growth

The capability library is intended to evolve.

The project should assume that developer intuition about the true distribution of historical political actions is incomplete.

The MVP should therefore support logging and later review of capability gaps.

A coding agent may eventually generate new capability definitions from existing primitives.

For MVP, prefer a restricted declarative capability format over arbitrary runtime TypeScript/Python modification of the simulation kernel.

Generated capabilities must not be able to create new primitives.

If a requested behavior cannot be expressed with existing primitives, the system should produce a `PrimitiveGap` record for human review.

---

## 15. Coding Agent Boundary

There are two different coding agents in this project and they must not be confused.

### 15.1 External Development Agent

Codex is allowed to edit the repository and implement the software.

This is normal software development.

### 15.2 In-Simulation Coding Agent

A future in-game coding agent may create or compose capabilities.

It must not:

- edit the simulation kernel;
- modify repository source code;
- access arbitrary filesystem resources;
- access arbitrary network resources;
- create new engine primitives;
- directly mutate world state;
- bypass event scheduling;
- bypass transaction validation.

For MVP, the in-simulation coding agent may be omitted entirely while the capability schema and `PrimitiveGap` mechanism are implemented.

---

## 16. Historical Action Mining

The project should eventually use historical text as empirical input for action-system design.

The purpose is not to train the engine to reenact specific stories.

The purpose is to discover what kinds of actions real historical actors frequently attempted.

A future pipeline may extract structured records from historical texts:

```ts
type HistoricalActionRecord = {
  actorRole: string
  targetRole?: string
  context: string
  objective?: string
  actionDescription: string
  mechanism?: string
  informationAvailable?: string
  legality?: string
  secrecy?: string
  duration?: string
  outcome?: string
}
```

The pipeline should then attempt to express extracted actions using existing primitives and capabilities.

If successful, the example validates the expressive power of the action system.

If repeatedly unsuccessful for the same reason, it may indicate a missing primitive.

This work is not required for MVP implementation.

However, the MVP architecture should preserve the distinction between primitive actions and higher-level capabilities so that historical action mining can be integrated later.

---

## 17. Event Scheduler

All world-changing actions must enter the event system.

Do not mutate authoritative world state directly from agent code.

Each event should include at minimum:

```ts
type SimEvent = {
  id: string
  scheduledAt: SimTime
  createdAt: SimTime
  eventType: string
  actorId?: string
  targetIds?: string[]
  causalEventId?: string
  causalDecisionEpisodeId?: string
  payload: unknown
}
```

Events at the same timestamp must not be resolved by arbitrary array order when their interaction matters.

When simultaneous events conflict, the engine should create the necessary observations or contested operations and allow relevant actors or resolution rules to respond.

The MVP may use deterministic tie-breaking for truly independent events.

---

## 18. Transactions and State Integrity

Operations that mutate world state should execute through transactions.

Suggested flow:

1. Operation begins.
2. Proposed changes are staged.
3. Invariants are checked.
4. If valid, changes commit.
5. If invalid, operation fails or partially resolves according to explicit rules.

Core invariants may include:

- no negative physical stock unless debt/deficit is explicitly modeled;
- actors cannot physically occupy impossible locations;
- dead actors cannot issue new decisions;
- resource transfers must have identifiable sources and destinations;
- organization membership and office assignments remain internally consistent.

Do not allow dynamically generated capabilities to bypass invariants.

---

## 19. Event Sourcing and Replay

The simulation should be event-sourced from the beginning.

Replay means replaying recorded decisions and events, not re-querying LLMs.

LLM output is not assumed to be deterministic across time, model versions, or providers.

The system should record enough information to explain:

- what an actor observed;
- what belief state was used;
- what decision episode was active;
- what structured decision the actor returned;
- what intent was accepted;
- what operation was scheduled;
- what world events occurred;
- what state mutations were committed.

A replay of recorded history should use stored decisions.

A branch created from a previous point may generate new LLM calls.

"Replay history" and "re-simulate from this date" are different operations.

---

## 20. LLM Integration

The MVP should not depend on a specific model provider.

Create an adapter interface.

Example:

```ts
interface AgentModel {
  decide(input: AgentDecisionInput): Promise<AgentDecisionOutput>
}
```

The model should receive only actor-visible information.

Do not provide the complete objective world state in the prompt.

The model output should be structured.

Example:

```ts
type AgentDecisionOutput = {
  reasoningSummary?: string
  selectedIntent: {
    goal: string
    capabilityId?: string
    parameters: Record<string, unknown>
  }
  confidence?: number
  requestedInformation?: string[]
}
```

Do not require or store unrestricted private chain-of-thought.

A concise model-generated rationale is sufficient for debugging.

The agent framework should be accessed through a replaceable adapter.

DeepSeek Harness is a candidate runtime, not part of the simulation kernel.

---

## 21. Initial MVP World

The first scenario should be intentionally small.

Suggested scale:

- 1 polity;
- 1 ruler;
- 5 senior political officials;
- 3 regional governors;
- 3 military formations;
- 10 regions;
- approximately 15–25 persistent named actors;
- only 3–6 simultaneous LLM actors under normal conditions;
- aggregate population groups rather than individual citizens.

Suggested organizations:

- central court/government;
- treasury/finance office;
- military command;
- intelligence or reporting office;
- 3 regional administrations.

Suggested resources:

- money;
- grain or generic provisions;
- administrative capacity;
- military manpower;
- communication capacity.

Suggested political relationships:

- formal command;
- appointment;
- personal loyalty;
- funding;
- information access;
- organizational membership.

The scenario does not need a historical map.

---

## 22. Required MVP Demonstrations

The MVP should contain automated or scripted demonstration scenarios proving the following mechanics.

### Demo A: False Report

A governor sends a report that differs from objective local conditions.

The ruler receives the report but not the truth directly.

An independent investigation can later reveal the discrepancy.

### Demo B: Partial Implementation

The ruler orders a policy.

A subordinate acknowledges the order but only partially implements it.

The ruler may initially receive a report claiming completion.

### Demo C: Contradictory Orders

A military formation receives conflicting orders from two political authorities.

The commander must decide what to do based on beliefs, relationships, incentives, and practical control.

### Demo D: Decision Revision

An actor sends an initial order.

New information arrives before the first order reaches its target.

The actor reverses their position and sends a second message.

Both messages remain real simulation objects.

### Demo E: Emergent Loss of Control

The ruler remains formally in office but loses practical control of one or more organizations.

No explicit `triggerCoup()` or `collapseGovernment()` function is allowed.

The condition must emerge from relationships, decisions, communication, and obedience.

### Demo F: Dynamic Actor Promotion

A previously lightweight actor becomes politically critical.

The system promotes the actor to LLM cognition while preserving their identity and history.

---

## 23. MVP User Interface

A polished game UI is not required.

The preferred first interface is a local web application.

Minimum UI requirements:

- simulation time;
- player-visible messages and reports;
- list of known actors;
- basic actor relationships;
- orders sent by the player;
- known status of organizations;
- timeline of player-visible events.

A separate debug/admin view may expose objective truth.

The player-facing view must not expose debug truth.

The purpose of the UI is to make the simulation inspectable, not visually impressive.

---

## 24. Suggested Repository Structure

```text
/apps
  /web
/packages
  /sim-core
  /event-store
  /sim-api
  /agent-runtime
  /agent-adapter
  /capability-runtime
  /scenario-mvp
  /shared-types
/tests
  /simulation
  /scenarios
/docs
  SPEC.md
```

This structure is a suggestion, not a strict requirement.

The critical architectural separation is:

- simulation core;
- agent runtime;
- world-facing API;
- event store;
- capability layer;
- UI.

---

## 25. Technology Guidance

For the MVP, prefer implementation simplicity over maximal runtime performance.

TypeScript is acceptable for the first version, especially if the agent runtime and web UI also use TypeScript.

Do not introduce Unity, Unreal, or Godot for the initial prototype unless a concrete requirement emerges.

The first version should prioritize:

- inspectability;
- testability;
- event replay;
- fast iteration;
- clear schemas;
- simple local execution.

Performance optimization should follow measurement.

---

## 26. Explicit Non-Goals for MVP

The MVP does NOT need to implement:

- a full historical grand-strategy game;
- a real historical country;
- a world map;
- detailed warfare;
- tactical combat;
- realistic logistics;
- detailed population simulation;
- Victoria-style POP economics;
- global trade;
- diplomacy among many states;
- historically accurate demographics;
- large-scale procedural narrative;
- individual simulation of every soldier or citizen;
- hundreds of simultaneous LLM agents;
- autonomous runtime modification of kernel source code;
- arbitrary runtime TypeScript/Python execution by in-game agents;
- unrestricted coding-agent filesystem or network access;
- historical action mining pipeline;
- perfect political science calibration;
- polished graphics;
- multiplayer;
- modding SDK;
- long-term save compatibility guarantees.

These are deliberately excluded so that the MVP can focus on validating the core political simulation architecture.

---

## 27. What Must Not Be Simplified Away

Although the MVP is small, the following architectural properties must not be replaced with shortcuts that would invalidate the experiment.

Do not give the player direct access to objective truth.

Do not treat orders as immediate effects.

Do not model legality as a hard permission system.

Do not make government stability an immutable engine assumption.

Do not make coup or rebellion primarily scripted event types.

Do not allow LLMs to mutate world state directly.

Do not call every actor's LLM every tick.

Do not use a single loyalty scalar as the entire political model.

Do not discard communication delay.

Do not erase earlier actions when a character changes their mind.

Do not make replay depend on re-calling an LLM.

Do not hard-code all higher-level political behavior as a fixed action menu.

---

## 28. Testing Philosophy

The simulation should be tested through invariants and scenario behavior, not only unit-level code coverage.

Tests should answer questions such as:

- Can an actor receive incorrect information without corrupting objective state?
- Can two actors hold incompatible beliefs about the same event?
- Can an order remain in transit while its sender changes policy?
- Can a subordinate acknowledge an order without executing it?
- Can a politically unauthorized action still be attempted?
- Can an organization split in practical obedience without changing formal law?
- Can the same recorded history replay identically without contacting an LLM?
- Can a lightweight actor be promoted without losing identity continuity?
- Can dynamically composed capabilities only invoke allowed primitives?

The MVP should include deterministic seeded scenario tests wherever possible.

---

## 29. Recommended Implementation Order

Phase 1 should implement shared types, simulation time, event scheduler, event store, basic entities, organizations, relationships, and deterministic replay.

Phase 2 should implement communication, observations, beliefs, orders, implementation states, and basic lightweight actor decisions.

Phase 3 should implement decision episodes, delayed and revised decisions, contradictory orders, and transaction-based world mutations.

Phase 4 should add one LLM adapter and a small number of Tier 2 actors.

Phase 5 should implement the MVP demonstration scenarios.

Phase 6 should add the declarative capability layer and primitive-gap logging.

Do not begin with dynamic coding-agent generation.

Do not begin with a large historical scenario.

---

## 30. Initial Entity Sketch

The following entities are expected, though exact implementation may change.

```ts
Actor
PersistentIdentity
MotivationProfile
BeliefState
Observation
Organization
Office
Relationship
Region
ResourceAccount
MilitaryFormation
Message
Order
DecisionEpisode
Intent
Capability
PrimitiveOperation
SimEvent
WorldTransaction
WorldState
```

The implementation agent may propose schema refinements, but should preserve the architectural distinctions described in this specification.

---

## 31. Design Rationale Summary

Several decisions in this specification are intentionally unusual.

### Why not let the player see true numbers?

Because imperfect information is one of the primary political mechanics being tested.

### Why not let orders directly change state?

Because administrative implementation and obedience are themselves political processes.

### Why separate legal authority from practical capability?

Because coups, disobedience, corruption, informal power, and regime collapse require actors to attempt actions outside formal authority.

### Why model decisions as time processes?

Because crisis politics often depend on information arriving while decisions and messages are already in motion.

### Why use only some LLM actors?

Because most people most of the time operate under strong constraints, while high-cost reasoning is most valuable at politically important decision points.

### Why keep motivations structured instead of only prompting personalities?

Because LLM instruction-following tendencies should not determine the political incentive model.

### Why avoid a fixed action menu?

Because developer intuition is unlikely to anticipate the real distribution of historical political behavior.

### Why distinguish primitives from capabilities?

Because the engine should have a small stable "physics" while higher-level political techniques can evolve.

### Why event-source everything?

Because LLM-driven simulations are otherwise extremely difficult to debug, explain, replay, or branch.

---

## 32. Definition of MVP Completion

The MVP is complete when a developer can run the local simulation and demonstrate all of the following in a small scenario:

1. The player receives incomplete or false information while objective state remains hidden.
2. Orders take time to travel and do not guarantee execution.
3. A character can revise a decision after an earlier instruction has already entered the world.
4. Two political actors can give conflicting orders to the same organization.
5. Actors can choose delay, deception, refusal, or defection when incentives justify it.
6. Legal authority and practical control can diverge.
7. A ruler can lose effective control without a hard-coded coup event.
8. A lightweight actor can become an LLM actor when their importance rises.
9. All important actions can be reconstructed from logs.
10. A recorded history can be replayed without re-calling the LLM.

If these ten properties work, the architecture has validated the project's central hypothesis.

Everything beyond this point is expansion, calibration, historical content, or product development.

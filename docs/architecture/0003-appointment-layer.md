# ADR 0003: Appointment, offices, and derived authority

Status: proposed

Reserved: ADR 0002 (resource and fiscal layer) is not yet written.

## Context

Throne has no first-class office or appointment model. Positions exist only as:

- `PersistentActor.officeHistory: OfficeHistoryEntry[]` (`packages/shared-types/src/agents.ts`),
- the `appointment` value of `ControlRelationshipKind` (`packages/shared-types/src/organizations.ts`),
- hand-authored `Organization.formalAuthorityIds` (for example `packages/scenario-mvp/src/loss-of-control.ts`).

There is no `Office` entity, no appointment operation, and no separation between the legal authority an office confers and the practical control an actor actually holds. This blocks historically central situations: a general promoted to chancellor who keeps command of the army through loyal subordinates; in-law (waiqi) power; contested appointments; officials who formally hold an office yet are not obeyed.

SPEC requires that legal authority is not hard permission (section 6), that practical control is derived from relationships rather than stored as a single value (section 7), that identity and office history persist across cognition changes (section 10), and that all world changes are event-sourced and replayable without model calls (section 19).

## Decision

We introduce an office and appointment layer with four explicit choices.

1. **Office powers are declared as relationship and power grants, not capability ids.** `OfficeDefinition.grants` names the control relationships and the controlled resources, channels, and commands the office confers. Practical authority therefore remains derivable through the existing relationship model instead of becoming a fixed action menu.

2. **`Organization.formalAuthorityIds` becomes derived, not authored.** The legal authority of an organization is computed from the offices currently in effect. Any hand-authored bootstrap data must reconcile with the derived value or fail loudly.

3. **Legality is a recorded snapshot that later events may revise.** An appointment carries `basis` and `legality`. Subsequent `office.recognized` or `office.contested` events may change the assessment. Legality never acts as a hard gate; it influences expected obedience, reputation, and third-party cooperation as SPEC section 6 describes.

4. **A position may have concurrent, contested claimants.** `capacity` is data. When it is exceeded, claimants coexist and `effectiveAuthority` arbitrates who can actually act. There is no last-writer-wins rule.

## Data contracts

Owned by `packages/shared-types`:

```ts
type OfficeGrant =
  | { kind: "relationship"; relationship: ControlRelationshipKind; targetRef: string }
  | { kind: "resource_control"; accountId: string }
  | { kind: "channel_control"; channelId: string }
  | { kind: "command"; organizationId: string; unitId?: string };

type OfficeDefinition = {
  id: string;
  nameKey: string;
  category: "civil" | "military" | "fiscal" | "censorate" | "palace" | "regional";
  grants: readonly OfficeGrant[];
  appointAuthority: readonly string[];
  eligibility: readonly JsonObject[];
  capacity: number;
  fixedTerm?: SimTime;
};

type AppointmentRecord = {
  id: string;
  officeId: string;
  incumbentId: string;
  appointedById: string;
  occurredAt: SimTime;
  basis: "decree" | "procedure" | "self_claim";
  legality: "legal" | "irregular" | "contested";
  eventId: EventId;
};
```

## Events

Names follow the existing `namespace.action` convention and carry causal links:

- `office.appointed`
- `office.removed`
- `office.tenure_ended`
- `office.contested`
- `office.recognized`

Appointment is an operation, not a direct state write. It validates the attempt, commits the office event, and appends the relationship edges named by the office grants.

## Derivation

Two layers must stay separate:

- **Legal layer.** `deriveFormalAuthority(state, organizationId)` returns the actors whose current offices grant command over the organization. Promotion removes the old office's edges and adds the new office's edges.
- **Relational layer.** `ControlRelationship` edges (`personal_loyalty`, `informal_influence`, `appointment`, `funding`) and `ObedienceRecord` history are persistent facts. Office changes never add, remove, or reweight them.

Practical control is not stored. It is computed on demand, generalizing `assessPracticalControl` (`packages/scenario-mvp/src/loss-of-control.ts`) to organizations, units, resource accounts, and channels. The divergence between the two layers is a first-class derived value available to the administrator view, never to the player-facing view.

## Case study: general promoted to chancellor

Initial state: a general holds a military office and has two subordinates who owe their offices to him (`appointment` edges) with high `personal_loyalty`.

A single decision episode commits two causally linked events: `office.removed` for the military office, `office.appointed` for the chancellor office. Consequences:

- `deriveFormalAuthority(army)` no longer contains the general and now contains the replacement commander.
- The general's `personal_loyalty`, `appointment`, and (through the chancellor's fiscal grants) `funding` edges persist, so `derivePracticalControl(army)` may still rank him highest.
- If the chancellor's grants include appointment authority over military offices, he can legally reinstall his old subordinates, reproducing his power network through procedure.

Obedience is resolved only when a command arrives: the new commander's `formal_command` competes with the general's loyalty, patronage, and funding leverage. The loser's order is recorded as `ignored` or `countermanded`, reusing the contradictory-orders mechanism. No hard block is introduced.

Relationship decay, if wanted, is driven by explicit events (for example a scheduled `relationship.decayed`), never by an implicit per-tick adjustment.

## Consequences

Positive:

- "General promoted to chancellor still commands the army" emerges from structure rather than a label or a scripted event.
- Legal authority and practical control become comparable, which is the project's central concern (SPEC sections 6 and 7).
- Office history remains append-only, preserving identity continuity (SPEC section 10).

Negative and risks:

- Deriving `formalAuthorityIds` touches existing hand-authored scenario data and requires reconciliation.
- Contested claimants force obedience evaluation and the administrator view to handle multiple simultaneous authorities.
- The layer expands MVP scope and touches SPEC sections 2, 6, 7, 10, 14.1, and 19; it requires an explicit design decision before implementation.

## Out of scope

- Command cost and administrative effort expenditure (a separate decision).
- Capability layer integration.
- Resource and fiscal flows (ADR 0002, unwritten).

## Verification

- An appointment never mutates any `ControlRelationship.strength`.
- Removing an incumbent never deletes office history.
- Replay reproduces office and authority state without model calls.
- An illegal transition (appointing into an over-capacity office, or by an actor without appointment authority) fails explicitly rather than silently.
- A contested claim yields coexisting authorities, not a merge.

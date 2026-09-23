import type {
  BribeDecision,
  BribeDecisionInput,
  BribeRecord,
  CorruptionRecord,
  DomainEvent,
  MotivationProfile,
} from "@throne/shared-types";

export type BriberyActor = {
  readonly id: string;
  readonly motivations: MotivationProfile;
};

export type BriberyState = {
  readonly actors: Readonly<Record<string, BriberyActor>>;
  readonly bribes: Readonly<Record<string, BribeRecord>>;
  readonly corruption: readonly CorruptionRecord[];
};

export const emptyBriberyState: BriberyState = {
  actors: {},
  bribes: {},
  corruption: [],
};

export type BribeDecisionPolicy = {
  decide(input: BribeDecisionInput): BribeDecision;
};

const reference = 100;

export function bribeBenefit(
  amount: number,
  target: MotivationProfile,
): number {
  const ratio = amount / (amount + reference);
  return rounded(ratio * (0.5 + target.wealth));
}

export function bribeRisk(target: MotivationProfile): number {
  return rounded(
    target.proceduralLegality * 0.8 + (1 - target.riskTolerance) * 0.3,
  );
}

export const heuristicBribePolicy: BribeDecisionPolicy = {
  decide(input) {
    const accept = input.benefit > input.risk;
    return {
      accept,
      reason: accept
        ? `gain ${input.benefit} outweighs risk ${input.risk}`
        : `risk ${input.risk} outweighs gain ${input.benefit}`,
    };
  },
};

export function addBriberyActor(
  state: BriberyState,
  actor: BriberyActor,
): BriberyState {
  if (state.actors[actor.id]) {
    throw new Error(`Duplicate bribery actor: ${actor.id}`);
  }
  return { ...state, actors: { ...state.actors, [actor.id]: actor } };
}

export function reduceBriberyEvent(
  state: BriberyState,
  event: DomainEvent,
): BriberyState {
  switch (event.eventType) {
    case "bribe.offered": {
      const bribe = bribeFromEvent(state, event, "offered");
      if (state.bribes[bribe.id]) {
        throw new Error(`Duplicate bribe: ${bribe.id}`);
      }
      return { ...state, bribes: { ...state.bribes, [bribe.id]: bribe } };
    }
    case "bribe.accepted":
    case "bribe.rejected": {
      const bribeId = String(event.payload.bribeId);
      const bribe = requiredBribe(state, bribeId);
      if (bribe.status !== "offered") {
        throw new Error(`Bribe ${bribeId} already resolved`);
      }
      return {
        ...state,
        bribes: {
          ...state.bribes,
          [bribeId]: {
            ...bribe,
            status:
              event.eventType === "bribe.accepted" ? "accepted" : "rejected",
            reason: String(event.payload.reason),
          },
        },
      };
    }
    case "corruption.recorded": {
      const record: CorruptionRecord = {
        id: String(event.payload.corruptionId),
        actorId: String(event.payload.actorId),
        bribeId: String(event.payload.bribeId),
        amount: Number(event.payload.amount),
        evidenceRefs: readStringArray(event.payload.evidenceRefs),
        at: event.occurredAt,
      };
      requiredBribe(state, record.bribeId);
      return { ...state, corruption: [...state.corruption, record] };
    }
    default:
      throw new Error(
        `Unhandled bribery event ${event.eventType} (${event.id})`,
      );
  }
}

export function deriveCorruptionEvidence(
  state: BriberyState,
  actorId: string,
): readonly string[] {
  return state.corruption
    .filter((record) => record.actorId === actorId)
    .map((record) => record.id);
}

function bribeFromEvent(
  state: BriberyState,
  event: DomainEvent,
  status: BribeRecord["status"],
): BribeRecord {
  const payload = event.payload;
  const fromId = String(payload.fromId);
  const toId = String(payload.toId);
  if (!state.actors[fromId]) throw new Error(`Unknown briber: ${fromId}`);
  if (!state.actors[toId]) throw new Error(`Unknown bribe recipient: ${toId}`);
  return {
    id: String(payload.bribeId),
    fromId,
    toId,
    amount: Number(payload.amount),
    targetRef: String(payload.targetRef),
    status,
    at: event.occurredAt,
    reason: "",
  };
}

function requiredBribe(state: BriberyState, id: string): BribeRecord {
  const bribe = state.bribes[id];
  if (!bribe) throw new Error(`Unknown bribe: ${id}`);
  return bribe;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("corruption evidenceRefs must be an array");
  }
  return value.map(String);
}

function rounded(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

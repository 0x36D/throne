import type { JsonObject } from "./json.ts";
import type { SimTime } from "./time.ts";

export type EventId = string;

export type CausalLinks = {
  readonly causalEventId?: EventId;
  readonly causalDecisionEpisodeId?: string;
};

export type ScheduledEvent = CausalLinks & {
  readonly id: EventId;
  readonly createdAt: SimTime;
  readonly scheduledAt: SimTime;
  readonly eventType: string;
  readonly actorId?: string;
  readonly targetIds?: readonly string[];
  readonly payload: JsonObject;
};

export type DomainEvent = CausalLinks & {
  readonly id: EventId;
  readonly occurredAt: SimTime;
  readonly eventType: string;
  readonly actorId?: string;
  readonly targetIds?: readonly string[];
  readonly payload: JsonObject;
};

export type SimulationRecord =
  | { readonly kind: "scheduled"; readonly event: ScheduledEvent }
  | {
      readonly kind: "consumed";
      readonly eventId: EventId;
      readonly consumedAt: SimTime;
    }
  | { readonly kind: "committed"; readonly event: DomainEvent };

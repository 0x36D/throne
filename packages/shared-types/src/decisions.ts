import type { JsonObject } from "./json.ts";
import type { SimTime } from "./time.ts";

export type Intent = {
  readonly id: string;
  readonly actorId: string;
  readonly createdAt: SimTime;
  readonly goal: string;
  readonly operationTemplate?: string;
  readonly parameters: JsonObject;
  readonly secrecy?: number;
  readonly urgency?: number;
  readonly causalDecisionEpisodeId: string;
};

export type DecisionEpisode = {
  readonly id: string;
  readonly actorId: string;
  readonly openedAt: SimTime;
  readonly triggerObservationIds: readonly string[];
  readonly status: "open" | "committed" | "abandoned";
  readonly urgency: number;
  readonly expectedResolutionAt?: SimTime;
  readonly provisionalIntents: readonly Intent[];
  readonly revisionCount: number;
  readonly finalIntentIds: readonly string[];
};

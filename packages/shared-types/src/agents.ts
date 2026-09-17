import { z } from "zod";
import type { JsonObject, JsonValue } from "./json.ts";
import type { SimTime } from "./time.ts";

export type Observation = {
  readonly id: string;
  readonly actorId: string;
  readonly observedAt: SimTime;
  readonly sourceType: string;
  readonly sourceId?: string;
  readonly subjectRefs: readonly string[];
  readonly payload: JsonObject;
  readonly confidenceHint?: number;
  readonly causalEventId?: string;
};

export type BeliefCandidate = {
  readonly value: JsonValue;
  readonly confidence: number;
  readonly supportingObservationIds: readonly string[];
};

export type BeliefEntry = {
  readonly subjectRef: string;
  readonly predicate: string;
  readonly candidates: readonly BeliefCandidate[];
  readonly updatedAt: SimTime;
};

export type ActorDecisionInput = {
  readonly runId: string;
  readonly branchId: string;
  readonly decisionEpisodeId: string;
  readonly actorId: string;
  readonly simulationTime: SimTime;
  readonly observations: readonly Observation[];
  readonly beliefs: readonly BeliefEntry[];
  readonly motivations: JsonObject;
  readonly relationships: readonly JsonObject[];
  readonly memories: readonly JsonObject[];
  readonly availableCapabilities: readonly string[];
};

export const actorDecisionOutputSchema = z.object({
  reasoningSummary: z.string().max(2_000).optional(),
  selectedIntent: z.object({
    goal: z.string().min(1),
    capabilityId: z.string().min(1).optional(),
    parameters: z.record(z.string(), z.json()),
  }),
  confidence: z.number().min(0).max(1).optional(),
  requestedInformation: z.array(z.string()).optional(),
});

export type ActorDecisionOutput = z.infer<typeof actorDecisionOutputSchema>;

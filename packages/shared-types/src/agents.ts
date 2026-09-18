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
  readonly identity: JsonObject;
  readonly officeHistory: readonly JsonObject[];
  readonly observations: readonly Observation[];
  readonly beliefs: readonly BeliefEntry[];
  readonly motivations: JsonObject;
  readonly relationships: readonly JsonObject[];
  readonly memories: readonly JsonObject[];
  readonly availableCapabilities: readonly string[];
  readonly outputLanguage?: string;
};

export type ActorCognitionTier = "lightweight" | "llm";

export type ActorIdentity = {
  readonly id: string;
  readonly displayNameKey: string;
  readonly background: JsonObject;
};

export type OfficeHistoryEntry = {
  readonly officeId: string;
  readonly startedAt: SimTime;
  readonly endedAt?: SimTime;
};

export type ActorMemory = {
  readonly id: string;
  readonly occurredAt: SimTime;
  readonly kind: string;
  readonly subjectRefs: readonly string[];
  readonly payload: JsonObject;
  readonly causalEventId?: string;
};

export type PromotionSignalKind =
  | "critical_information"
  | "critical_resource_control"
  | "contested_command"
  | "high_decision_uncertainty"
  | "high_potential_impact";

export type ActorPromotionSignal = {
  readonly id: string;
  readonly actorId: string;
  readonly kind: PromotionSignalKind;
  readonly strength: number;
  readonly evidenceRefs: readonly string[];
};

export type ActorPromotionRecord = {
  readonly id: string;
  readonly actorId: string;
  readonly fromTier: ActorCognitionTier;
  readonly toTier: ActorCognitionTier;
  readonly occurredAt: SimTime;
  readonly signalIds: readonly string[];
  readonly previousPolicyId: string;
  readonly nextPolicyId: string;
  readonly eventId: string;
};

export type ActorCognitionState = {
  readonly tier: ActorCognitionTier;
  readonly policyId: string;
  readonly promotionHistory: readonly ActorPromotionRecord[];
};

export type PersistentActor = {
  readonly identity: ActorIdentity;
  readonly officeHistory: readonly OfficeHistoryEntry[];
  readonly motivations: JsonObject;
  readonly memories: readonly ActorMemory[];
  readonly beliefs: readonly BeliefEntry[];
  readonly cognition: ActorCognitionState;
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

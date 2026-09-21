import {
  readStringArray as stringArray,
  readJsonObject as objectValue,
} from "@throne/shared-types";
import {
  actorDecisionOutputSchema,
  simTime,
  type ActorDecisionInput,
  type ActorDecisionOutput,
  type ActorMemory,
  type ActorPromotionSignal,
  type BeliefEntry,
  type DecisionEpisode,
  type DomainEvent,
  type Intent,
  type JsonObject,
  type JsonValue,
  type Observation,
  type PersistentActor,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  type DomainEventDraft,
  type DomainModel,
} from "@throne/sim-core";

export type PromotionDecisionPolicy = {
  decide(input: ActorDecisionInput): Promise<ActorDecisionOutput>;
};

export type StrategicArtifact = {
  readonly id: string;
  readonly kind: "sealed_officer_ledger";
  readonly importance: number;
  readonly holderId?: string;
  readonly subjectRefs: readonly string[];
  readonly disclosedToIds: readonly string[];
  readonly disposition?: "concealed";
};

export type CommunicationChannel = {
  readonly id: string;
  readonly kind: "sealed_palace_courier";
  readonly controllerId: string;
  readonly reachableActorIds: readonly string[];
};

export type PromotionMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly artifactId: string;
  readonly status: "in_transit" | "delivered";
};

export type PromotionDecisionEpisode = DecisionEpisode & {
  readonly selectedCapabilityId?: string;
};

export type DynamicPromotionState = {
  readonly actors: Readonly<Record<string, PersistentActor>>;
  readonly artifacts: Readonly<Record<string, StrategicArtifact>>;
  readonly channels: Readonly<Record<string, CommunicationChannel>>;
  readonly relationships: readonly JsonObject[];
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
  readonly promotionSignals: Readonly<Record<string, ActorPromotionSignal>>;
  readonly decisionEpisodes: Readonly<Record<string, PromotionDecisionEpisode>>;
  readonly decisionOutputs: Readonly<Record<string, ActorDecisionOutput>>;
  readonly intents: Readonly<Record<string, Intent>>;
  readonly messages: Readonly<Record<string, PromotionMessage>>;
};

export type PromotionActorSnapshot = {
  readonly actorId: string;
  readonly identity: PersistentActor["identity"];
  readonly officeHistory: PersistentActor["officeHistory"];
  readonly motivations: PersistentActor["motivations"];
  readonly memoryIds: readonly string[];
  readonly cognition: PersistentActor["cognition"];
};

export type PromotionRulerView = {
  readonly actorId: string;
  readonly observations: readonly Observation[];
  readonly knownOutcome: "no_report" | "sealed_evidence_received";
};

export type DynamicPromotionRun = {
  readonly state: DynamicPromotionState;
  readonly records: readonly SimulationRecord[];
  readonly actorBeforePromotion: PromotionActorSnapshot;
  readonly actorAfterPromotion: PromotionActorSnapshot;
  readonly rulerViewBeforeDecision: PromotionRulerView;
  readonly rulerViewFinal: PromotionRulerView;
  readonly debugTruth: {
    readonly actor: PersistentActor;
    readonly artifact: StrategicArtifact;
    readonly channel: CommunicationChannel;
    readonly promotionSignals: readonly ActorPromotionSignal[];
    readonly decisionEpisode: PromotionDecisionEpisode;
    readonly decisionOutput: ActorDecisionOutput;
    readonly intent: Intent;
  };
};

export type DynamicPromotionRunOptions = {
  readonly runId?: string;
  readonly policy?: PromotionDecisionPolicy;
  readonly outputLanguage?: string;
};

export const dynamicPromotionIds = {
  ruler: "actor:ruler",
  clerk: "actor:archive-clerk-shen",
  clerkOffice: "office:assistant-palace-registrar",
  ledger: "artifact:sealed-officer-ledger",
  channel: "channel:sealed-palace-courier",
  guard: "organization:imperial-guard",
  chancellor: "actor:chancellor",
  discoveryObservation: "observation:sealed-ledger-discovered",
  routineMemory: "memory:routine-seal-discrepancy",
  discoveryMemory: "memory:sealed-ledger-discovered",
  criticalInformationSignal: "promotion-signal:critical-information",
  highImpactSignal: "promotion-signal:high-potential-impact",
  promotion: "promotion:archive-clerk-to-llm",
  decision: "decision:sealed-ledger-disposition",
  intent: "intent:send-sealed-ledger-to-ruler",
  message: "message:sealed-ledger-to-ruler",
  rulerObservation: "observation:ruler-receives-sealed-ledger",
} as const;

const ids = dynamicPromotionIds;
const availableCapabilities = [
  "send_sealed_evidence_to_ruler",
  "share_evidence_with_chancellor",
  "conceal_evidence",
] as const;

export const recordedPromotionDecisionPolicy: PromotionDecisionPolicy = {
  async decide() {
    return {
      reasoningSummary:
        "The sealed ledger is dangerous, but the independent palace courier makes direct disclosure possible.",
      selectedIntent: {
        goal: "Deliver the sealed officer ledger directly to the ruler",
        capabilityId: "send_sealed_evidence_to_ruler",
        parameters: { artifactId: ids.ledger, recipientId: ids.ruler },
      },
      confidence: 0.78,
      requestedInformation: [],
    };
  },
};

const initialBeliefs: readonly BeliefEntry[] = [
  {
    subjectRef: ids.channel,
    predicate: "reaches_actor",
    candidates: [
      {
        value: ids.ruler,
        confidence: 0.9,
        supportingObservationIds: [],
      },
    ],
    updatedAt: simTime(0),
  },
];

export const dynamicPromotionInitialState: DynamicPromotionState = {
  actors: {
    [ids.clerk]: {
      identity: {
        id: ids.clerk,
        displayNameKey: "actor.clerkShen",
        background: {
          homeRegionId: "region:eastern-capital",
          familyOccupation: "minor_archive_officials",
          training: ["seal_authentication", "court_registers"],
        },
      },
      officeHistory: [{ officeId: ids.clerkOffice, startedAt: simTime(0) }],
      motivations: {
        selfPreservation: 0.72,
        proceduralLegality: 0.81,
        loyaltyToRuler: 0.58,
        reputationForAccuracy: 0.86,
      },
      memories: [],
      beliefs: initialBeliefs,
      cognition: {
        tier: "lightweight",
        policyId: "heuristic:archive-clerk",
        promotionHistory: [],
      },
    },
    [ids.ruler]: {
      identity: {
        id: ids.ruler,
        displayNameKey: "actor.ruler",
        background: { office: "sovereign" },
      },
      officeHistory: [{ officeId: "office:sovereign", startedAt: simTime(0) }],
      motivations: {},
      memories: [],
      beliefs: [],
      cognition: {
        tier: "lightweight",
        policyId: "human:player",
        promotionHistory: [],
      },
    },
    [ids.chancellor]: {
      identity: {
        id: ids.chancellor,
        displayNameKey: "actor.chancellor",
        background: {},
      },
      officeHistory: [{ officeId: "office:chancellor", startedAt: simTime(0) }],
      motivations: {},
      memories: [],
      beliefs: [],
      cognition: {
        tier: "lightweight",
        policyId: "heuristic:chancellor",
        promotionHistory: [],
      },
    },
  },
  artifacts: {
    [ids.ledger]: {
      id: ids.ledger,
      kind: "sealed_officer_ledger",
      importance: 0.95,
      subjectRefs: [ids.guard, ids.chancellor],
      disclosedToIds: [],
    },
  },
  channels: {
    [ids.channel]: {
      id: ids.channel,
      kind: "sealed_palace_courier",
      controllerId: ids.clerk,
      reachableActorIds: [ids.ruler, ids.chancellor],
    },
  },
  relationships: [
    {
      sourceId: ids.clerk,
      targetId: ids.ruler,
      kind: "procedural_access",
      strength: 0.45,
    },
  ],
  observations: {},
  actorObservationIds: {
    [ids.clerk]: [],
    [ids.ruler]: [],
    [ids.chancellor]: [],
  },
  promotionSignals: {},
  decisionEpisodes: {},
  decisionOutputs: {},
  intents: {},
  messages: {},
};

export function createDynamicPromotionModel(
  policy: PromotionDecisionPolicy,
  outputLanguage = "zh-CN",
  runId = "dynamic-actor-promotion",
): DomainModel<DynamicPromotionState> {
  return {
    async resolveBatch({ events, state, time }) {
      const committed: DomainEventDraft[] = [];
      const scheduled = [];

      for (const event of events) {
        switch (event.eventType) {
          case "clerk.review_archive":
            committed.push(
              memoryDraft({
                id: ids.routineMemory,
                actorId: ids.clerk,
                kind: "routine_seal_discrepancy_noted",
                subjectRefs: [ids.ledger],
                payload: { action: "flagged_for_later_review" },
                cause: event.id,
              }),
            );
            break;

          case "artifact.discover":
            committed.push(
              {
                eventType: "artifact.holder_changed",
                actorId: ids.clerk,
                targetIds: [ids.ledger],
                causalEventId: event.id,
                payload: { artifactId: ids.ledger, holderId: ids.clerk },
              },
              observationDraft({
                id: ids.discoveryObservation,
                actorId: ids.clerk,
                sourceType: "direct_inspection",
                sourceId: ids.ledger,
                subjectRefs: [ids.ledger, ids.guard, ids.chancellor],
                payload: {
                  finding:
                    "sealed ledger links guard appointments to private patronage",
                  confidence: 0.94,
                },
                cause: event.id,
              }),
              memoryDraft({
                id: ids.discoveryMemory,
                actorId: ids.clerk,
                kind: "critical_ledger_discovered",
                subjectRefs: [ids.ledger, ids.guard, ids.chancellor],
                payload: { discoveryMethod: "seal_comparison" },
                cause: event.id,
              }),
            );
            scheduled.push({
              eventType: "actor.evaluate_cognition",
              scheduledAt: simTime(30),
              actorId: ids.clerk,
              causalEventId: event.id,
              payload: { actorId: ids.clerk },
            });
            break;

          case "actor.evaluate_cognition": {
            const actor = getActor(state, ids.clerk);
            const signals = derivePromotionSignals(state, ids.clerk);
            for (const signal of signals) {
              committed.push({
                eventType: "actor.promotion_signal_recorded",
                actorId: ids.clerk,
                causalEventId: event.id,
                payload: { signal: signal as unknown as JsonValue },
              });
            }
            if (actor.cognition.tier === "lightweight" && signals.length >= 2) {
              committed.push({
                eventType: "actor.cognition_promoted",
                actorId: ids.clerk,
                causalEventId: event.id,
                payload: {
                  promotionId: ids.promotion,
                  fromTier: actor.cognition.tier,
                  toTier: "llm",
                  previousPolicyId: actor.cognition.policyId,
                  nextPolicyId: "llm:deepseek-harness",
                  signalIds: signals.map((signal) => signal.id),
                },
              });
              scheduled.push({
                eventType: "decision.open",
                scheduledAt: simTime(35),
                actorId: ids.clerk,
                causalEventId: event.id,
                payload: { decisionEpisodeId: ids.decision },
              });
            }
            break;
          }

          case "decision.open":
            committed.push({
              eventType: "decision.opened",
              actorId: ids.clerk,
              causalEventId: event.id,
              payload: {
                decisionEpisodeId: ids.decision,
                triggerObservationIds: [ids.discoveryObservation],
                urgency: 0.88,
                expectedResolutionAt: 40,
              },
            });
            scheduled.push({
              eventType: "decision.resolve_with_policy",
              scheduledAt: simTime(40),
              actorId: ids.clerk,
              causalEventId: event.id,
              payload: { decisionEpisodeId: ids.decision },
            });
            break;

          case "decision.resolve_with_policy": {
            const actor = getActor(state, ids.clerk);
            if (actor.cognition.tier !== "llm") {
              throw new Error(
                "Tier 1 actor cannot invoke the LLM decision policy",
              );
            }
            const input = decisionInput(state, time, outputLanguage, runId);
            const output = actorDecisionOutputSchema.parse(
              await policy.decide(input),
            );
            const capabilityId = output.selectedIntent.capabilityId;
            if (
              !capabilityId ||
              !availableCapabilities.includes(
                capabilityId as (typeof availableCapabilities)[number],
              )
            ) {
              throw new Error(
                `Policy selected unavailable capability: ${String(capabilityId)}`,
              );
            }
            const intent: Intent = {
              id: ids.intent,
              actorId: ids.clerk,
              createdAt: time,
              goal: output.selectedIntent.goal,
              operationTemplate: capabilityId,
              parameters: output.selectedIntent.parameters,
              urgency: 0.88,
              causalDecisionEpisodeId: ids.decision,
            };
            committed.push(
              {
                eventType: "policy.decision_recorded",
                actorId: ids.clerk,
                causalEventId: event.id,
                causalDecisionEpisodeId: ids.decision,
                payload: {
                  decisionEpisodeId: ids.decision,
                  output: output as unknown as JsonValue,
                },
              },
              {
                eventType: "decision.committed",
                actorId: ids.clerk,
                causalEventId: event.id,
                payload: {
                  decisionEpisodeId: ids.decision,
                  intentId: ids.intent,
                  selectedCapabilityId: capabilityId,
                },
              },
              {
                eventType: "intent.created",
                actorId: ids.clerk,
                causalEventId: event.id,
                causalDecisionEpisodeId: ids.decision,
                payload: { intent: intent as unknown as JsonValue },
              },
            );
            scheduled.push({
              eventType: "operation.execute_intent",
              scheduledAt: simTime(45),
              actorId: ids.clerk,
              causalEventId: event.id,
              causalDecisionEpisodeId: ids.decision,
              payload: { intentId: ids.intent },
            });
            break;
          }

          case "operation.execute_intent": {
            const intent = getIntent(state, String(event.payload.intentId));
            if (intent.operationTemplate !== "conceal_evidence") {
              const recipientId =
                intent.operationTemplate === "send_sealed_evidence_to_ruler"
                  ? ids.ruler
                  : ids.chancellor;
              const channel = getChannel(state, ids.channel);
              if (!channel.reachableActorIds.includes(recipientId)) {
                throw new Error(`Sealed courier cannot reach ${recipientId}`);
              }
              committed.push(
                {
                  eventType: "artifact.disclosure_recorded",
                  actorId: ids.clerk,
                  targetIds: [recipientId, ids.ledger],
                  causalEventId: event.id,
                  payload: { artifactId: ids.ledger, recipientId },
                },
                {
                  eventType: "message.created",
                  actorId: ids.clerk,
                  targetIds: [recipientId],
                  causalEventId: event.id,
                  payload: {
                    messageId: ids.message,
                    senderId: ids.clerk,
                    recipientId,
                    artifactId: ids.ledger,
                  },
                },
              );
              scheduled.push({
                eventType: "message.arrive",
                scheduledAt: simTime(90),
                actorId: ids.clerk,
                targetIds: [recipientId],
                causalEventId: event.id,
                payload: { messageId: ids.message },
              });
            } else {
              committed.push({
                eventType: "artifact.disposition_recorded",
                actorId: ids.clerk,
                causalEventId: event.id,
                payload: {
                  artifactId: ids.ledger,
                  capabilityId: intent.operationTemplate ?? "unknown",
                },
              });
            }
            break;
          }

          case "message.arrive": {
            const message = getMessage(state, String(event.payload.messageId));
            committed.push(
              {
                eventType: "message.arrived",
                actorId: message.senderId,
                targetIds: [message.recipientId],
                causalEventId: event.id,
                payload: { messageId: message.id },
              },
              observationDraft({
                id:
                  message.recipientId === ids.ruler
                    ? ids.rulerObservation
                    : "observation:chancellor-receives-sealed-ledger",
                actorId: message.recipientId,
                sourceType: "sealed_evidence",
                sourceId: message.id,
                subjectRefs: [message.artifactId, ids.guard, ids.chancellor],
                payload: {
                  artifactKind: "sealed_officer_ledger",
                  senderId: ids.clerk,
                },
                cause: event.id,
              }),
            );
            break;
          }

          default:
            throw new Error(
              `Unknown dynamic-promotion event: ${event.eventType}`,
            );
        }
      }
      return { events: committed, scheduled };
    },

    reduce(state, event) {
      switch (event.eventType) {
        case "memory.recorded": {
          const actor = getActor(state, String(event.payload.actorId));
          const memory = memoryFromEvent(event);
          return updateActor(state, actor.identity.id, {
            ...actor,
            memories: [...actor.memories, memory],
          });
        }
        case "artifact.holder_changed": {
          const artifact = getArtifact(state, String(event.payload.artifactId));
          return {
            ...state,
            artifacts: {
              ...state.artifacts,
              [artifact.id]: {
                ...artifact,
                holderId: String(event.payload.holderId),
              },
            },
          };
        }
        case "artifact.disclosure_recorded": {
          const artifact = getArtifact(state, String(event.payload.artifactId));
          return {
            ...state,
            artifacts: {
              ...state.artifacts,
              [artifact.id]: {
                ...artifact,
                disclosedToIds: [
                  ...artifact.disclosedToIds,
                  String(event.payload.recipientId),
                ],
              },
            },
          };
        }
        case "artifact.disposition_recorded": {
          if (event.payload.capabilityId !== "conceal_evidence") {
            throw new Error("Unknown artifact disposition");
          }
          const artifact = getArtifact(state, String(event.payload.artifactId));
          return {
            ...state,
            artifacts: {
              ...state.artifacts,
              [artifact.id]: { ...artifact, disposition: "concealed" },
            },
          };
        }
        case "observation.recorded":
          return recordObservation(state, event);
        case "actor.promotion_signal_recorded": {
          const signal = structuredClone(
            objectValue(event.payload.signal),
          ) as unknown as ActorPromotionSignal;
          return {
            ...state,
            promotionSignals: {
              ...state.promotionSignals,
              [signal.id]: signal,
            },
          };
        }
        case "actor.cognition_promoted": {
          const actor = getActor(state, event.actorId ?? "");
          return updateActor(state, actor.identity.id, {
            ...actor,
            cognition: {
              tier: "llm",
              policyId: String(event.payload.nextPolicyId),
              promotionHistory: [
                ...actor.cognition.promotionHistory,
                {
                  id: String(event.payload.promotionId),
                  actorId: actor.identity.id,
                  fromTier: "lightweight",
                  toTier: "llm",
                  occurredAt: event.occurredAt,
                  signalIds: stringArray(event.payload.signalIds),
                  previousPolicyId: String(event.payload.previousPolicyId),
                  nextPolicyId: String(event.payload.nextPolicyId),
                  eventId: event.id,
                },
              ],
            },
          });
        }
        case "decision.opened": {
          const episode: PromotionDecisionEpisode = {
            id: String(event.payload.decisionEpisodeId),
            actorId: event.actorId ?? ids.clerk,
            openedAt: event.occurredAt,
            triggerObservationIds: stringArray(
              event.payload.triggerObservationIds,
            ),
            status: "open",
            urgency: Number(event.payload.urgency),
            expectedResolutionAt: simTime(
              Number(event.payload.expectedResolutionAt),
            ),
            provisionalIntents: [],
            revisionCount: 0,
            finalIntentIds: [],
          };
          return {
            ...state,
            decisionEpisodes: {
              ...state.decisionEpisodes,
              [episode.id]: episode,
            },
          };
        }
        case "policy.decision_recorded": {
          const output = actorDecisionOutputSchema.parse(event.payload.output);
          return {
            ...state,
            decisionOutputs: {
              ...state.decisionOutputs,
              [String(event.payload.decisionEpisodeId)]: output,
            },
          };
        }
        case "decision.committed": {
          const episode = getDecision(
            state,
            String(event.payload.decisionEpisodeId),
          );
          return {
            ...state,
            decisionEpisodes: {
              ...state.decisionEpisodes,
              [episode.id]: {
                ...episode,
                status: "committed",
                finalIntentIds: [String(event.payload.intentId)],
                selectedCapabilityId: String(
                  event.payload.selectedCapabilityId,
                ),
              },
            },
          };
        }
        case "intent.created": {
          const intent = structuredClone(
            objectValue(event.payload.intent),
          ) as unknown as Intent;
          return {
            ...state,
            intents: { ...state.intents, [intent.id]: intent },
          };
        }
        case "message.created": {
          const message: PromotionMessage = {
            id: String(event.payload.messageId),
            senderId: String(event.payload.senderId),
            recipientId: String(event.payload.recipientId),
            artifactId: String(event.payload.artifactId),
            status: "in_transit",
          };
          return {
            ...state,
            messages: { ...state.messages, [message.id]: message },
          };
        }
        case "message.arrived": {
          const message = getMessage(state, String(event.payload.messageId));
          return {
            ...state,
            messages: {
              ...state.messages,
              [message.id]: { ...message, status: "delivered" },
            },
          };
        }
        default:
          throw new Error(
            `Unhandled domain event ${event.eventType} (${event.id})`,
          );
      }
    },

    validate(_before, after) {
      for (const actor of Object.values(after.actors)) {
        if (
          actor.identity.id === ids.clerk &&
          actor.officeHistory.length === 0
        ) {
          throw new Error("Promotable actor must retain office history");
        }
        if (
          actor.cognition.tier === "llm" &&
          actor.cognition.promotionHistory.length === 0
        ) {
          throw new Error("Tier 2 actor requires a promotion record");
        }
      }
      for (const message of Object.values(after.messages)) {
        if (
          !after.actors[message.senderId] ||
          !after.actors[message.recipientId]
        ) {
          throw new Error(`${message.id} refers to an unknown actor`);
        }
      }
    },
  };
}

export const dynamicPromotionModel = createDynamicPromotionModel(
  recordedPromotionDecisionPolicy,
);

export async function runDynamicPromotionScenario(
  options: DynamicPromotionRunOptions = {},
): Promise<DynamicPromotionRun> {
  const policy = options.policy ?? recordedPromotionDecisionPolicy;
  const runId = options.runId ?? "dynamic-actor-promotion-demo";
  const model = createDynamicPromotionModel(
    policy,
    options.outputLanguage ?? "zh-CN",
    runId,
  );
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    dynamicPromotionInitialState,
    model,
    store,
    runId,
  );
  await kernel.schedule({
    eventType: "clerk.review_archive",
    scheduledAt: simTime(0),
    actorId: ids.clerk,
    payload: {},
  });
  await kernel.schedule({
    eventType: "artifact.discover",
    scheduledAt: simTime(20),
    actorId: ids.clerk,
    targetIds: [ids.ledger],
    payload: { artifactId: ids.ledger },
  });

  let actorBeforePromotion: PromotionActorSnapshot | undefined;
  let actorAfterPromotion: PromotionActorSnapshot | undefined;
  let rulerViewBeforeDecision: PromotionRulerView | undefined;
  while (await kernel.step()) {
    if (kernel.time === simTime(0)) {
      actorBeforePromotion = promotionActorSnapshot(kernel.state, ids.clerk);
      rulerViewBeforeDecision = promotionRulerView(kernel.state);
    }
    if (kernel.time === simTime(30)) {
      actorAfterPromotion = promotionActorSnapshot(kernel.state, ids.clerk);
    }
  }
  if (
    !actorBeforePromotion ||
    !actorAfterPromotion ||
    !rulerViewBeforeDecision
  ) {
    throw new Error("Scenario did not reach all promotion snapshots");
  }
  const state = kernel.state;
  return {
    state,
    records: await store.readAll(),
    actorBeforePromotion,
    actorAfterPromotion,
    rulerViewBeforeDecision,
    rulerViewFinal: promotionRulerView(state),
    debugTruth: promotionDebugTruth(state),
  };
}

export function derivePromotionSignals(
  state: DynamicPromotionState,
  actorId: string,
): ActorPromotionSignal[] {
  const artifact = getArtifact(state, ids.ledger);
  if (artifact.holderId !== actorId) return [];
  const signals: ActorPromotionSignal[] = [];
  if (artifact.importance >= 0.8) {
    signals.push({
      id: ids.criticalInformationSignal,
      actorId,
      kind: "critical_information",
      strength: artifact.importance,
      evidenceRefs: [artifact.id],
    });
  }
  if (artifact.importance >= 0.9 && artifact.subjectRefs.includes(ids.guard)) {
    signals.push({
      id: ids.highImpactSignal,
      actorId,
      kind: "high_potential_impact",
      strength: 0.9,
      evidenceRefs: [artifact.id, ids.guard],
    });
  }
  return signals;
}

export function promotionActorSnapshot(
  state: DynamicPromotionState,
  actorId: string,
): PromotionActorSnapshot {
  const actor = getActor(state, actorId);
  return structuredClone({
    actorId,
    identity: actor.identity,
    officeHistory: actor.officeHistory,
    motivations: actor.motivations,
    memoryIds: actor.memories.map((memory) => memory.id),
    cognition: actor.cognition,
  }) as PromotionActorSnapshot;
}

export function promotionRulerView(
  state: DynamicPromotionState,
): PromotionRulerView {
  const observations = (state.actorObservationIds[ids.ruler] ?? []).map(
    (observationId) => {
      const observation = state.observations[observationId];
      if (!observation) throw new Error(`Unknown observation ${observationId}`);
      return observation;
    },
  );
  return structuredClone({
    actorId: ids.ruler,
    observations,
    knownOutcome:
      observations.length > 0 ? "sealed_evidence_received" : "no_report",
  }) as PromotionRulerView;
}

export function promotionDebugTruth(
  state: DynamicPromotionState,
): DynamicPromotionRun["debugTruth"] {
  const actor = getActor(state, ids.clerk);
  const artifact = getArtifact(state, ids.ledger);
  const channel = getChannel(state, ids.channel);
  const decisionEpisode = getDecision(state, ids.decision);
  const decisionOutput = state.decisionOutputs[ids.decision];
  const intent = state.intents[ids.intent];
  if (!decisionOutput || !intent)
    throw new Error("Promotion decision is incomplete");
  return structuredClone({
    actor,
    artifact,
    channel,
    promotionSignals: Object.values(state.promotionSignals),
    decisionEpisode,
    decisionOutput,
    intent,
  }) as DynamicPromotionRun["debugTruth"];
}

function decisionInput(
  state: DynamicPromotionState,
  time: ReturnType<typeof simTime>,
  outputLanguage: string,
  runId: string,
): ActorDecisionInput {
  const actor = getActor(state, ids.clerk);
  const observations = (state.actorObservationIds[ids.clerk] ?? []).map(
    (observationId) => {
      const observation = state.observations[observationId];
      if (!observation) throw new Error(`Unknown observation ${observationId}`);
      return observation;
    },
  );
  return {
    runId,
    branchId: "main",
    decisionEpisodeId: ids.decision,
    actorId: ids.clerk,
    simulationTime: time,
    identity: {
      id: actor.identity.id,
      displayNameKey: actor.identity.displayNameKey,
      background: actor.identity.background,
    },
    officeHistory: actor.officeHistory.map((entry) => ({
      officeId: entry.officeId,
      startedAt: entry.startedAt,
      ...(entry.endedAt === undefined ? {} : { endedAt: entry.endedAt }),
    })),
    observations,
    beliefs: actor.beliefs,
    motivations: actor.motivations,
    relationships: state.relationships,
    memories: actor.memories.map(memoryJson),
    availableCapabilities,
    outputLanguage,
  };
}

function memoryDraft(input: {
  id: string;
  actorId: string;
  kind: string;
  subjectRefs: readonly string[];
  payload: JsonObject;
  cause: string;
}): DomainEventDraft {
  return {
    eventType: "memory.recorded",
    actorId: input.actorId,
    causalEventId: input.cause,
    payload: {
      memoryId: input.id,
      actorId: input.actorId,
      kind: input.kind,
      subjectRefs: [...input.subjectRefs],
      content: input.payload,
    },
  };
}

function observationDraft(input: {
  id: string;
  actorId: string;
  sourceType: string;
  sourceId: string;
  subjectRefs: readonly string[];
  payload: JsonObject;
  cause: string;
}): DomainEventDraft {
  return {
    eventType: "observation.recorded",
    actorId: input.actorId,
    causalEventId: input.cause,
    payload: {
      observationId: input.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      subjectRefs: [...input.subjectRefs],
      content: input.payload,
    },
  };
}

function memoryFromEvent(event: DomainEvent): ActorMemory {
  return {
    id: String(event.payload.memoryId),
    occurredAt: event.occurredAt,
    kind: String(event.payload.kind),
    subjectRefs: stringArray(event.payload.subjectRefs),
    payload: objectValue(event.payload.content),
    ...(event.causalEventId ? { causalEventId: event.causalEventId } : {}),
  };
}

function memoryJson(memory: ActorMemory): JsonObject {
  return {
    id: memory.id,
    occurredAt: memory.occurredAt,
    kind: memory.kind,
    subjectRefs: [...memory.subjectRefs],
    payload: memory.payload,
  };
}

function recordObservation(
  state: DynamicPromotionState,
  event: DomainEvent,
): DynamicPromotionState {
  const actorId = event.actorId;
  if (!actorId) throw new Error("Observation requires actorId");
  const observation: Observation = {
    id: String(event.payload.observationId),
    actorId,
    observedAt: event.occurredAt,
    sourceType: String(event.payload.sourceType),
    sourceId: String(event.payload.sourceId),
    subjectRefs: stringArray(event.payload.subjectRefs),
    payload: objectValue(event.payload.content),
    ...(event.causalEventId ? { causalEventId: event.causalEventId } : {}),
  };
  return {
    ...state,
    observations: { ...state.observations, [observation.id]: observation },
    actorObservationIds: {
      ...state.actorObservationIds,
      [actorId]: [
        ...(state.actorObservationIds[actorId] ?? []),
        observation.id,
      ],
    },
  };
}

function updateActor(
  state: DynamicPromotionState,
  actorId: string,
  actor: PersistentActor,
): DynamicPromotionState {
  return { ...state, actors: { ...state.actors, [actorId]: actor } };
}

function getActor(state: DynamicPromotionState, id: string): PersistentActor {
  const value = state.actors[id];
  if (!value) throw new Error(`Unknown actor ${id}`);
  return value;
}

function getArtifact(
  state: DynamicPromotionState,
  id: string,
): StrategicArtifact {
  const value = state.artifacts[id];
  if (!value) throw new Error(`Unknown artifact ${id}`);
  return value;
}

function getChannel(
  state: DynamicPromotionState,
  id: string,
): CommunicationChannel {
  const value = state.channels[id];
  if (!value) throw new Error(`Unknown channel ${id}`);
  return value;
}

function getDecision(
  state: DynamicPromotionState,
  id: string,
): PromotionDecisionEpisode {
  const value = state.decisionEpisodes[id];
  if (!value) throw new Error(`Unknown decision ${id}`);
  return value;
}

function getIntent(state: DynamicPromotionState, id: string): Intent {
  const value = state.intents[id];
  if (!value) throw new Error(`Unknown intent ${id}`);
  return value;
}

function getMessage(
  state: DynamicPromotionState,
  id: string,
): PromotionMessage {
  const value = state.messages[id];
  if (!value) throw new Error(`Unknown message ${id}`);
  return value;
}

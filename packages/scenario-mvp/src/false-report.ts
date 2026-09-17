import {
  addSimTime,
  simTime,
  type BeliefCandidate,
  type BeliefEntry,
  type DomainEvent,
  type JsonObject,
  type JsonValue,
  type Observation,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  type DomainEventDraft,
  type DomainModel,
  type ScheduledEventDraft,
} from "@throne/sim-core";

export type ScenarioActor = {
  readonly id: string;
  readonly name: string;
  readonly office: string;
};

export type Region = {
  readonly id: string;
  readonly name: string;
  readonly grainStock: number;
};

export type ReportClaim = {
  readonly subjectRef: string;
  readonly predicate: string;
  readonly value: JsonValue;
};

export type Report = {
  readonly id: string;
  readonly authorId: string;
  readonly basis: "administrative_return" | "independent_inspection";
  readonly claim: ReportClaim;
};

export type ScenarioMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly reportId: string;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type Investigation = {
  readonly id: string;
  readonly inspectorId: string;
  readonly regionId: string;
  readonly status: "started" | "completed";
};

export type FalseReportState = {
  readonly actors: Readonly<Record<string, ScenarioActor>>;
  readonly regions: Readonly<Record<string, Region>>;
  readonly reports: Readonly<Record<string, Report>>;
  readonly messages: Readonly<Record<string, ScenarioMessage>>;
  readonly investigations: Readonly<Record<string, Investigation>>;
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
  readonly beliefs: Readonly<Record<string, readonly BeliefEntry[]>>;
  readonly contradictions: Readonly<
    Record<
      string,
      readonly {
        readonly subjectRef: string;
        readonly predicate: string;
        readonly observationIds: readonly string[];
      }[]
    >
  >;
};

export type ActorView = {
  readonly actor: ScenarioActor;
  readonly observations: readonly Observation[];
  readonly beliefs: readonly BeliefEntry[];
  readonly contradictions: readonly {
    readonly subjectRef: string;
    readonly predicate: string;
    readonly observationIds: readonly string[];
  }[];
};

export type FalseReportRun = {
  readonly state: FalseReportState;
  readonly records: readonly SimulationRecord[];
  readonly rulerView: ActorView;
  readonly debugTruth: {
    readonly regions: FalseReportState["regions"];
    readonly reports: FalseReportState["reports"];
  };
};

const ids = {
  ruler: "actor:ruler",
  governor: "actor:north-governor",
  inspector: "actor:inspector",
  region: "region:north",
  governorReport: "report:governor-return",
  governorMessage: "message:governor-return",
  investigation: "investigation:north-granary",
  inspectorReport: "report:inspection",
  inspectorMessage: "message:inspection",
} as const;

export const falseReportInitialState: FalseReportState = {
  actors: {
    [ids.ruler]: { id: ids.ruler, name: "The Ruler", office: "Sovereign" },
    [ids.governor]: {
      id: ids.governor,
      name: "Governor Ren",
      office: "Northern Governor",
    },
    [ids.inspector]: {
      id: ids.inspector,
      name: "Inspector Lin",
      office: "Granary Inspector",
    },
  },
  regions: {
    [ids.region]: {
      id: ids.region,
      name: "Northern Province",
      grainStock: 250,
    },
  },
  reports: {},
  messages: {},
  investigations: {},
  observations: {},
  actorObservationIds: {
    [ids.ruler]: [],
    [ids.governor]: [],
    [ids.inspector]: [],
  },
  beliefs: {
    [ids.ruler]: [],
    [ids.governor]: [],
    [ids.inspector]: [],
  },
  contradictions: {
    [ids.ruler]: [],
    [ids.governor]: [],
    [ids.inspector]: [],
  },
};

export const falseReportModel: DomainModel<FalseReportState> = {
  resolveBatch({ events, state, time }) {
    const committed: DomainEventDraft[] = [];
    const scheduled: ScheduledEventDraft[] = [];

    for (const event of events) {
      switch (event.eventType) {
        case "governor.prepare_false_report": {
          committed.push(
            reportCreated({
              reportId: ids.governorReport,
              authorId: ids.governor,
              basis: "administrative_return",
              claim: {
                subjectRef: ids.region,
                predicate: "grain_stock",
                value: 800,
              },
              causalEventId: event.id,
            }),
            messageCreated({
              messageId: ids.governorMessage,
              senderId: ids.governor,
              recipientId: ids.ruler,
              reportId: ids.governorReport,
              causalEventId: event.id,
            }),
          );
          scheduled.push(
            scheduleMessageDeparture(
              ids.governorMessage,
              addSimTime(time, 10),
              event.id,
            ),
          );
          break;
        }

        case "message.depart": {
          const message = requiredMessage(
            state,
            String(event.payload.messageId),
          );
          committed.push({
            eventType: "message.departed",
            actorId: message.senderId,
            targetIds: [message.recipientId],
            causalEventId: event.id,
            payload: { messageId: message.id },
          });
          scheduled.push({
            eventType: "message.arrive",
            scheduledAt: addSimTime(time, 60),
            actorId: message.senderId,
            targetIds: [message.recipientId],
            causalEventId: event.id,
            payload: { messageId: message.id },
          });
          break;
        }

        case "message.arrive": {
          const message = requiredMessage(
            state,
            String(event.payload.messageId),
          );
          const report = requiredReport(state, message.reportId);
          const observationId = `observation:${message.id}`;
          const confidence =
            report.basis === "independent_inspection" ? 0.95 : 0.72;

          committed.push(
            {
              eventType: "message.arrived",
              actorId: message.senderId,
              targetIds: [message.recipientId],
              causalEventId: event.id,
              payload: { messageId: message.id },
            },
            {
              eventType: "observation.recorded",
              actorId: message.recipientId,
              causalEventId: event.id,
              payload: {
                observationId,
                sourceType: "report",
                sourceId: report.id,
                subjectRefs: [report.claim.subjectRef],
                report: reportAsJson(report),
                confidenceHint: confidence,
              },
            },
            {
              eventType: "belief.evidence_added",
              actorId: message.recipientId,
              causalEventId: event.id,
              payload: {
                observationId,
                subjectRef: report.claim.subjectRef,
                predicate: report.claim.predicate,
                value: report.claim.value,
                confidence,
              },
            },
          );

          const conflictingEvidence = beliefCandidates(
            state,
            message.recipientId,
            report.claim,
          ).filter((candidate) => candidate.value !== report.claim.value);
          if (conflictingEvidence.length > 0) {
            committed.push({
              eventType: "belief.contradiction_noted",
              actorId: message.recipientId,
              causalEventId: event.id,
              payload: {
                subjectRef: report.claim.subjectRef,
                predicate: report.claim.predicate,
                observationIds: [
                  ...conflictingEvidence.flatMap(
                    (candidate) => candidate.supportingObservationIds,
                  ),
                  observationId,
                ],
              },
            });
          }
          break;
        }

        case "investigation.begin": {
          committed.push({
            eventType: "investigation.started",
            actorId: ids.inspector,
            causalEventId: event.id,
            payload: {
              investigationId: ids.investigation,
              inspectorId: ids.inspector,
              regionId: ids.region,
            },
          });
          scheduled.push({
            eventType: "investigation.complete",
            scheduledAt: addSimTime(time, 60),
            actorId: ids.inspector,
            causalEventId: event.id,
            payload: { investigationId: ids.investigation },
          });
          break;
        }

        case "investigation.complete": {
          const region = state.regions[ids.region];
          if (!region) throw new Error(`Unknown region: ${ids.region}`);
          committed.push(
            {
              eventType: "investigation.completed",
              actorId: ids.inspector,
              causalEventId: event.id,
              payload: { investigationId: ids.investigation },
            },
            reportCreated({
              reportId: ids.inspectorReport,
              authorId: ids.inspector,
              basis: "independent_inspection",
              claim: {
                subjectRef: ids.region,
                predicate: "grain_stock",
                value: region.grainStock,
              },
              causalEventId: event.id,
            }),
            messageCreated({
              messageId: ids.inspectorMessage,
              senderId: ids.inspector,
              recipientId: ids.ruler,
              reportId: ids.inspectorReport,
              causalEventId: event.id,
            }),
          );
          scheduled.push(
            scheduleMessageDeparture(
              ids.inspectorMessage,
              addSimTime(time, 10),
              event.id,
            ),
          );
          break;
        }

        default:
          throw new Error(
            `Unknown false-report event type: ${event.eventType}`,
          );
      }
    }

    return { events: committed, scheduled };
  },

  reduce(state, event) {
    switch (event.eventType) {
      case "report.created": {
        const report = reportFromEvent(event);
        return { ...state, reports: { ...state.reports, [report.id]: report } };
      }
      case "message.created": {
        const message = messageFromEvent(event);
        return {
          ...state,
          messages: { ...state.messages, [message.id]: message },
        };
      }
      case "message.departed":
        return updateMessageStatus(
          state,
          String(event.payload.messageId),
          "in_transit",
        );
      case "message.arrived":
        return updateMessageStatus(
          state,
          String(event.payload.messageId),
          "delivered",
        );
      case "investigation.started": {
        const investigation: Investigation = {
          id: String(event.payload.investigationId),
          inspectorId: String(event.payload.inspectorId),
          regionId: String(event.payload.regionId),
          status: "started",
        };
        return {
          ...state,
          investigations: {
            ...state.investigations,
            [investigation.id]: investigation,
          },
        };
      }
      case "investigation.completed": {
        const id = String(event.payload.investigationId);
        const investigation = state.investigations[id];
        if (!investigation) throw new Error(`Unknown investigation: ${id}`);
        return {
          ...state,
          investigations: {
            ...state.investigations,
            [id]: { ...investigation, status: "completed" },
          },
        };
      }
      case "observation.recorded":
        return recordObservation(state, event);
      case "belief.evidence_added":
        return addBeliefEvidence(state, event);
      case "belief.contradiction_noted":
        return noteContradiction(state, event);
      default:
        return state;
    }
  },

  validate(_before, after) {
    for (const message of Object.values(after.messages)) {
      if (
        !after.actors[message.senderId] ||
        !after.actors[message.recipientId]
      ) {
        throw new Error(`Message ${message.id} refers to an unknown actor`);
      }
      if (!after.reports[message.reportId]) {
        throw new Error(`Message ${message.id} refers to an unknown report`);
      }
    }
    for (const region of Object.values(after.regions)) {
      if (region.grainStock < 0)
        throw new Error(`Region ${region.id} has negative grain stock`);
    }
  },
};

export async function runFalseReportScenario(
  runId = "false-report-demo",
): Promise<FalseReportRun> {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    falseReportInitialState,
    falseReportModel,
    store,
    runId,
  );

  await kernel.schedule({
    eventType: "governor.prepare_false_report",
    scheduledAt: simTime(0),
    actorId: ids.governor,
    targetIds: [ids.ruler],
    payload: {},
  });
  await kernel.schedule({
    eventType: "investigation.begin",
    scheduledAt: simTime(90),
    actorId: ids.inspector,
    targetIds: [ids.region],
    payload: {},
  });

  await kernel.runUntilIdle();
  const state = kernel.state;
  return {
    state,
    records: await store.readAll(),
    rulerView: actorView(state, ids.ruler),
    debugTruth: debugTruth(state),
  };
}

export function actorView(state: FalseReportState, actorId: string): ActorView {
  const actor = state.actors[actorId];
  if (!actor) throw new Error(`Unknown actor: ${actorId}`);
  const observationIds = state.actorObservationIds[actorId] ?? [];
  return structuredClone({
    actor,
    observations: observationIds.map((id) => {
      const observation = state.observations[id];
      if (!observation) throw new Error(`Unknown observation: ${id}`);
      return observation;
    }),
    beliefs: state.beliefs[actorId] ?? [],
    contradictions: state.contradictions[actorId] ?? [],
  }) as ActorView;
}

export function debugTruth(
  state: FalseReportState,
): FalseReportRun["debugTruth"] {
  return structuredClone({
    regions: state.regions,
    reports: state.reports,
  }) as FalseReportRun["debugTruth"];
}

function reportCreated(input: {
  reportId: string;
  authorId: string;
  basis: Report["basis"];
  claim: ReportClaim;
  causalEventId: string;
}): DomainEventDraft {
  return {
    eventType: "report.created",
    actorId: input.authorId,
    causalEventId: input.causalEventId,
    payload: {
      reportId: input.reportId,
      authorId: input.authorId,
      basis: input.basis,
      claim: claimAsJson(input.claim),
    },
  };
}

function messageCreated(input: {
  messageId: string;
  senderId: string;
  recipientId: string;
  reportId: string;
  causalEventId: string;
}): DomainEventDraft {
  return {
    eventType: "message.created",
    actorId: input.senderId,
    targetIds: [input.recipientId],
    causalEventId: input.causalEventId,
    payload: {
      messageId: input.messageId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      reportId: input.reportId,
    },
  };
}

function scheduleMessageDeparture(
  messageId: string,
  scheduledAt: ReturnType<typeof simTime>,
  causalEventId: string,
): ScheduledEventDraft {
  return {
    eventType: "message.depart",
    scheduledAt,
    causalEventId,
    payload: { messageId },
  };
}

function requiredMessage(state: FalseReportState, id: string): ScenarioMessage {
  const message = state.messages[id];
  if (!message) throw new Error(`Unknown message: ${id}`);
  return message;
}

function requiredReport(state: FalseReportState, id: string): Report {
  const report = state.reports[id];
  if (!report) throw new Error(`Unknown report: ${id}`);
  return report;
}

function reportFromEvent(event: DomainEvent): Report {
  const claim = asObject(event.payload.claim);
  return {
    id: String(event.payload.reportId),
    authorId: String(event.payload.authorId),
    basis: String(event.payload.basis) as Report["basis"],
    claim: {
      subjectRef: String(claim.subjectRef),
      predicate: String(claim.predicate),
      value: claim.value ?? null,
    },
  };
}

function messageFromEvent(event: DomainEvent): ScenarioMessage {
  return {
    id: String(event.payload.messageId),
    senderId: String(event.payload.senderId),
    recipientId: String(event.payload.recipientId),
    reportId: String(event.payload.reportId),
    status: "draft",
  };
}

function updateMessageStatus(
  state: FalseReportState,
  id: string,
  status: ScenarioMessage["status"],
): FalseReportState {
  const message = requiredMessage(state, id);
  return {
    ...state,
    messages: { ...state.messages, [id]: { ...message, status } },
  };
}

function recordObservation(
  state: FalseReportState,
  event: DomainEvent,
): FalseReportState {
  const actorId = requiredActorId(event);
  const observationId = String(event.payload.observationId);
  const observation: Observation = {
    id: observationId,
    actorId,
    observedAt: event.occurredAt,
    sourceType: String(event.payload.sourceType),
    sourceId: String(event.payload.sourceId),
    subjectRefs: asStringArray(event.payload.subjectRefs),
    payload: { report: event.payload.report ?? null },
    confidenceHint: Number(event.payload.confidenceHint),
    ...(event.causalEventId === undefined
      ? {}
      : { causalEventId: event.causalEventId }),
  };
  return {
    ...state,
    observations: { ...state.observations, [observationId]: observation },
    actorObservationIds: {
      ...state.actorObservationIds,
      [actorId]: [...(state.actorObservationIds[actorId] ?? []), observationId],
    },
  };
}

function addBeliefEvidence(
  state: FalseReportState,
  event: DomainEvent,
): FalseReportState {
  const actorId = requiredActorId(event);
  const subjectRef = String(event.payload.subjectRef);
  const predicate = String(event.payload.predicate);
  const observationId = String(event.payload.observationId);
  const value = event.payload.value ?? null;
  const confidence = Number(event.payload.confidence);
  const beliefs = [...(state.beliefs[actorId] ?? [])];
  const beliefIndex = beliefs.findIndex(
    (belief) =>
      belief.subjectRef === subjectRef && belief.predicate === predicate,
  );
  const previous = beliefIndex < 0 ? undefined : beliefs[beliefIndex];
  const candidates = [...(previous?.candidates ?? [])];
  const candidateIndex = candidates.findIndex(
    (candidate) => candidate.value === value,
  );

  if (candidateIndex < 0) {
    candidates.push({
      value,
      confidence,
      supportingObservationIds: [observationId],
    });
  } else {
    const candidate = candidates[candidateIndex];
    if (!candidate)
      throw new Error("Belief candidate disappeared during update");
    candidates[candidateIndex] = {
      ...candidate,
      confidence: Math.max(candidate.confidence, confidence),
      supportingObservationIds: [
        ...new Set([...candidate.supportingObservationIds, observationId]),
      ],
    };
  }

  const nextBelief: BeliefEntry = {
    subjectRef,
    predicate,
    candidates: candidates.sort(
      (left, right) => right.confidence - left.confidence,
    ),
    updatedAt: event.occurredAt,
  };
  if (beliefIndex < 0) beliefs.push(nextBelief);
  else beliefs[beliefIndex] = nextBelief;
  return { ...state, beliefs: { ...state.beliefs, [actorId]: beliefs } };
}

function noteContradiction(
  state: FalseReportState,
  event: DomainEvent,
): FalseReportState {
  const actorId = requiredActorId(event);
  const contradiction = {
    subjectRef: String(event.payload.subjectRef),
    predicate: String(event.payload.predicate),
    observationIds: asStringArray(event.payload.observationIds),
  };
  return {
    ...state,
    contradictions: {
      ...state.contradictions,
      [actorId]: [...(state.contradictions[actorId] ?? []), contradiction],
    },
  };
}

function beliefCandidates(
  state: FalseReportState,
  actorId: string,
  claim: ReportClaim,
): readonly BeliefCandidate[] {
  return (
    state.beliefs[actorId]?.find(
      (belief) =>
        belief.subjectRef === claim.subjectRef &&
        belief.predicate === claim.predicate,
    )?.candidates ?? []
  );
}

function requiredActorId(event: DomainEvent): string {
  if (!event.actorId) throw new Error(`${event.eventType} requires an actor`);
  return event.actorId;
}

function asObject(value: JsonValue | undefined): JsonObject {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("Expected a JSON object");
  }
  return value as JsonObject;
}

function asStringArray(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) throw new TypeError("Expected a JSON array");
  return value.map(String);
}

function claimAsJson(claim: ReportClaim): JsonObject {
  return {
    subjectRef: claim.subjectRef,
    predicate: claim.predicate,
    value: claim.value,
  };
}

function reportAsJson(report: Report): JsonObject {
  return {
    id: report.id,
    authorId: report.authorId,
    basis: report.basis,
    claim: claimAsJson(report.claim),
  };
}

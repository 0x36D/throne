import {
  addSimTime,
  simTime,
  type DecisionEpisode,
  type DomainEvent,
  type Intent,
  type JsonObject,
  type Observation,
  type OrderLifecycleEntry,
  type OrderStatus,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  type DomainEventDraft,
  type DomainModel,
  type ScheduledEventDraft,
} from "@throne/sim-core";
import type { ScenarioActor } from "./false-report.ts";

export type RelationshipKind =
  | "formal_command"
  | "legal_recognition"
  | "funding"
  | "appointment"
  | "personal_loyalty"
  | "informal_influence";

export type PoliticalRelationship = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly kind: RelationshipKind;
  readonly strength: number;
};

export type MilitaryUnit = {
  readonly id: string;
  readonly name: string;
  readonly commanderId: string;
  readonly locationId: string;
  readonly accessibleLocationIds: readonly string[];
};

export type MilitaryOrder = {
  readonly id: string;
  readonly issuerId: string;
  readonly recipientId: string;
  readonly unitId: string;
  readonly objective: "hold_palace" | "secure_granary";
  readonly targetLocationId: string;
  readonly status: OrderStatus;
  readonly lifecycle: readonly OrderLifecycleEntry[];
};

export type CommandMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly kind: "order" | "decision_report";
  readonly travelTime: number;
  readonly orderId?: string;
  readonly reportId?: string;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type CommandDecisionReport = {
  readonly id: string;
  readonly authorId: string;
  readonly recipientId: string;
  readonly decisionEpisodeId: string;
  readonly subjectOrderId: string;
  readonly selectedOrderId: string;
  readonly outcome: "obeyed" | "not_followed";
  readonly disclosedAlternativeOrderId?: string;
};

export type DecisionFactor = {
  readonly kind: RelationshipKind | "mission_fit" | "physical_access";
  readonly label: string;
  readonly score: number;
  readonly relationshipId?: string;
};

export type OrderEvaluation = {
  readonly orderId: string;
  readonly total: number;
  readonly factors: readonly DecisionFactor[];
};

export type CommandDecisionEpisode = DecisionEpisode & {
  readonly candidateOrderIds: readonly string[];
  readonly evaluations: readonly OrderEvaluation[];
  readonly selectedOrderId?: string;
};

export type CommanderContext = {
  readonly beliefs: {
    readonly palaceThreat: number;
    readonly granaryThreat: number;
  };
  readonly motivations: {
    readonly preservePoliticalOrder: number;
    readonly protectSupply: number;
  };
};

export type ContradictoryOrdersState = {
  readonly actors: Readonly<Record<string, ScenarioActor>>;
  readonly relationships: Readonly<Record<string, PoliticalRelationship>>;
  readonly units: Readonly<Record<string, MilitaryUnit>>;
  readonly orders: Readonly<Record<string, MilitaryOrder>>;
  readonly messages: Readonly<Record<string, CommandMessage>>;
  readonly reports: Readonly<Record<string, CommandDecisionReport>>;
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
  readonly decisionEpisodes: Readonly<Record<string, CommandDecisionEpisode>>;
  readonly intents: Readonly<Record<string, Intent>>;
  readonly commanderContexts: Readonly<Record<string, CommanderContext>>;
};

export type ContradictoryOrdersActorView = {
  readonly actor: ScenarioActor;
  readonly issuedOrders: readonly {
    readonly id: string;
    readonly objective: MilitaryOrder["objective"];
    readonly targetLocationId: string;
  }[];
  readonly observations: readonly Observation[];
  readonly knownOutcome:
    "awaiting_response" | "order_followed" | "order_overruled";
  readonly disclosedAlternativeOrderId?: string;
};

export type ContradictoryOrdersRun = {
  readonly state: ContradictoryOrdersState;
  readonly records: readonly SimulationRecord[];
  readonly rulerViewBeforeResponse: ContradictoryOrdersActorView;
  readonly rulerViewAfterResponse: ContradictoryOrdersActorView;
  readonly debugTruth: {
    readonly orders: ContradictoryOrdersState["orders"];
    readonly units: ContradictoryOrdersState["units"];
    readonly relationships: ContradictoryOrdersState["relationships"];
    readonly decisionEpisodes: ContradictoryOrdersState["decisionEpisodes"];
    readonly intents: ContradictoryOrdersState["intents"];
  };
};

export const contradictoryOrdersIds = {
  ruler: "actor:ruler",
  chancellor: "actor:chancellor",
  commander: "actor:guard-commander",
  unit: "unit:palace-guard",
  barracks: "location:guard-barracks",
  palace: "location:imperial-palace",
  granary: "location:capital-granary",
  rulerOrder: "order:ruler-hold-palace",
  chancellorOrder: "order:chancellor-secure-granary",
  rulerOrderMessage: "message:ruler-hold-palace",
  chancellorOrderMessage: "message:chancellor-secure-granary",
  decision: "decision:guard-conflicting-orders",
  intent: "intent:guard-move",
  rulerReport: "report:commander-to-ruler",
  chancellorReport: "report:commander-to-chancellor",
  rulerReportMessage: "message:commander-to-ruler",
  chancellorReportMessage: "message:commander-to-chancellor",
} as const;

const ids = contradictoryOrdersIds;

export const contradictoryOrdersInitialState: ContradictoryOrdersState = {
  actors: {
    [ids.ruler]: { id: ids.ruler, name: "The Ruler", office: "Sovereign" },
    [ids.chancellor]: {
      id: ids.chancellor,
      name: "Chancellor Wei",
      office: "Grand Chancellor",
    },
    [ids.commander]: {
      id: ids.commander,
      name: "Commander Zhao",
      office: "Commander of the Palace Guard",
    },
  },
  relationships: relationshipRecords([
    relationship(
      "relationship:ruler-formal-command",
      ids.ruler,
      ids.commander,
      "formal_command",
      0.95,
    ),
    relationship(
      "relationship:ruler-legal-recognition",
      ids.ruler,
      ids.unit,
      "legal_recognition",
      0.9,
    ),
    relationship(
      "relationship:ruler-personal-loyalty",
      ids.ruler,
      ids.commander,
      "personal_loyalty",
      0.25,
    ),
    relationship(
      "relationship:chancellor-funding",
      ids.chancellor,
      ids.unit,
      "funding",
      0.95,
    ),
    relationship(
      "relationship:chancellor-appointment",
      ids.chancellor,
      ids.commander,
      "appointment",
      0.85,
    ),
    relationship(
      "relationship:chancellor-influence",
      ids.chancellor,
      ids.commander,
      "informal_influence",
      0.75,
    ),
  ]),
  units: {
    [ids.unit]: {
      id: ids.unit,
      name: "Palace Guard",
      commanderId: ids.commander,
      locationId: ids.barracks,
      accessibleLocationIds: [ids.palace, ids.granary],
    },
  },
  orders: {},
  messages: {},
  reports: {},
  observations: {},
  actorObservationIds: {
    [ids.ruler]: [],
    [ids.chancellor]: [],
    [ids.commander]: [],
  },
  decisionEpisodes: {},
  intents: {},
  commanderContexts: {
    [ids.commander]: {
      beliefs: { palaceThreat: 0.35, granaryThreat: 0.9 },
      motivations: { preservePoliticalOrder: 0.7, protectSupply: 0.9 },
    },
  },
};

export const contradictoryOrdersModel: DomainModel<ContradictoryOrdersState> = {
  resolveBatch({ events, state, time }) {
    const committed: DomainEventDraft[] = [];
    const scheduled: ScheduledEventDraft[] = [];
    const arrivingOrders = events
      .filter((event) => {
        if (event.eventType !== "message.arrive") return false;
        return (
          requiredMessage(state, String(event.payload.messageId)).kind ===
          "order"
        );
      })
      .sort((left, right) => left.id.localeCompare(right.id));

    if (arrivingOrders.length > 0) {
      const firstArrival = arrivingOrders[0];
      if (!firstArrival)
        throw new Error("Arrival batch unexpectedly became empty");
      const orderIds: string[] = [];
      for (const event of arrivingOrders) {
        const message = requiredMessage(state, String(event.payload.messageId));
        if (!message.orderId)
          throw new Error(`Order message ${message.id} has no order`);
        const order = requiredOrder(state, message.orderId);
        orderIds.push(order.id);
        committed.push(
          messageArrived(message, event.id),
          orderStatusChanged(order.id, "received", event.id),
          observationRecorded({
            observationId: `observation:${message.id}`,
            actorId: message.recipientId,
            sourceType: "order",
            sourceId: order.id,
            subjectRefs: [order.id, order.unitId],
            payload: { order: orderAsJson(order) },
            causalEventId: event.id,
          }),
        );
      }
      scheduled.push({
        eventType: "decision.open",
        scheduledAt: addSimTime(time, 10),
        actorId: ids.commander,
        causalEventId: firstArrival.id,
        payload: { orderIds: orderIds.sort() },
      });
    }

    for (const event of events) {
      if (arrivingOrders.some((arrival) => arrival.id === event.id)) continue;

      switch (event.eventType) {
        case "authority.issue_order": {
          const orderId = String(event.payload.orderId);
          const issuerId = String(event.payload.issuerId);
          const travelTime = Number(event.payload.travelTime);
          const messageId = String(event.payload.messageId);
          committed.push(
            {
              eventType: "order.created",
              actorId: issuerId,
              targetIds: [ids.commander, ids.unit],
              causalEventId: event.id,
              payload: {
                orderId,
                issuerId,
                recipientId: ids.commander,
                unitId: ids.unit,
                objective: String(event.payload.objective),
                targetLocationId: String(event.payload.targetLocationId),
              },
            },
            messageCreated({
              messageId,
              senderId: issuerId,
              recipientId: ids.commander,
              kind: "order",
              travelTime,
              orderId,
              causalEventId: event.id,
            }),
          );
          scheduled.push(
            scheduleDeparture(messageId, addSimTime(time, 10), event.id),
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
          if (message.kind === "order" && message.orderId) {
            committed.push(
              orderStatusChanged(message.orderId, "sent", event.id),
            );
          }
          scheduled.push({
            eventType: "message.arrive",
            scheduledAt: addSimTime(time, message.travelTime),
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
          if (message.kind !== "decision_report" || !message.reportId) {
            throw new Error(`Unexpected arriving message: ${message.id}`);
          }
          const report = requiredReport(state, message.reportId);
          committed.push(
            messageArrived(message, event.id),
            observationRecorded({
              observationId: `observation:${message.id}`,
              actorId: message.recipientId,
              sourceType: "decision_report",
              sourceId: report.id,
              subjectRefs: [report.subjectOrderId, report.selectedOrderId],
              payload: { report: reportAsJson(report) },
              causalEventId: event.id,
            }),
          );
          break;
        }

        case "decision.open": {
          const orderIds = asStringArray(event.payload.orderIds).sort();
          const observationIds = orderIds.map((orderId) => {
            const observation = Object.values(state.observations).find(
              (candidate) =>
                candidate.actorId === ids.commander &&
                candidate.sourceId === orderId,
            );
            if (!observation)
              throw new Error(`No observation for order ${orderId}`);
            return observation.id;
          });
          committed.push({
            eventType: "decision.opened",
            actorId: ids.commander,
            causalEventId: event.id,
            payload: {
              decisionEpisodeId: ids.decision,
              triggerObservationIds: observationIds,
              candidateOrderIds: orderIds,
              urgency: 0.9,
              expectedResolutionAt: addSimTime(time, 30),
            },
          });
          scheduled.push({
            eventType: "decision.resolve",
            scheduledAt: addSimTime(time, 30),
            actorId: ids.commander,
            causalEventId: event.id,
            payload: { decisionEpisodeId: ids.decision },
          });
          break;
        }

        case "decision.resolve": {
          const episode = requiredDecision(
            state,
            String(event.payload.decisionEpisodeId),
          );
          const evaluations = episode.candidateOrderIds
            .map((orderId) =>
              evaluateOrder(state, requiredOrder(state, orderId)),
            )
            .sort(
              (left, right) =>
                right.total - left.total ||
                left.orderId.localeCompare(right.orderId),
            );
          const winner = evaluations[0];
          if (!winner)
            throw new Error("Cannot resolve a decision without candidates");
          const selectedOrder = requiredOrder(state, winner.orderId);
          const intent: Intent = {
            id: ids.intent,
            actorId: ids.commander,
            createdAt: time,
            goal:
              selectedOrder.objective === "hold_palace"
                ? "Hold the Imperial Palace"
                : "Secure the capital grain supply",
            operationTemplate: "move_unit",
            parameters: {
              unitId: selectedOrder.unitId,
              targetLocationId: selectedOrder.targetLocationId,
              orderId: selectedOrder.id,
            },
            urgency: 0.9,
            causalDecisionEpisodeId: episode.id,
          };
          committed.push(
            {
              eventType: "decision.committed",
              actorId: ids.commander,
              causalEventId: event.id,
              payload: {
                decisionEpisodeId: episode.id,
                selectedOrderId: selectedOrder.id,
                evaluations: evaluations.map(evaluationAsJson),
                intentId: intent.id,
              },
            },
            intentCreated(intent, event.id),
          );
          for (const orderId of episode.candidateOrderIds) {
            committed.push(
              orderStatusChanged(
                orderId,
                orderId === selectedOrder.id ? "acknowledged" : "ignored",
                event.id,
              ),
            );
            const order = requiredOrder(state, orderId);
            const obeyed = order.id === selectedOrder.id;
            const isRuler = order.issuerId === ids.ruler;
            const reportId = isRuler ? ids.rulerReport : ids.chancellorReport;
            const messageId = isRuler
              ? ids.rulerReportMessage
              : ids.chancellorReportMessage;
            committed.push(
              reportCreated({
                reportId,
                recipientId: order.issuerId,
                subjectOrderId: order.id,
                selectedOrderId: selectedOrder.id,
                outcome: obeyed ? "obeyed" : "not_followed",
                ...(obeyed
                  ? {}
                  : { disclosedAlternativeOrderId: selectedOrder.id }),
                causalEventId: event.id,
              }),
              messageCreated({
                messageId,
                senderId: ids.commander,
                recipientId: order.issuerId,
                kind: "decision_report",
                travelTime: 60,
                reportId,
                causalEventId: event.id,
              }),
            );
            scheduled.push(
              scheduleDeparture(messageId, addSimTime(time, 10), event.id),
            );
          }
          scheduled.push({
            eventType: "operation.execute_intent",
            scheduledAt: addSimTime(time, 10),
            actorId: ids.commander,
            targetIds: [selectedOrder.unitId, selectedOrder.targetLocationId],
            causalEventId: event.id,
            causalDecisionEpisodeId: episode.id,
            payload: { intentId: intent.id },
          });
          break;
        }

        case "operation.execute_intent": {
          const intent = requiredIntent(state, String(event.payload.intentId));
          const unit = requiredUnit(state, String(intent.parameters.unitId));
          const targetLocationId = String(intent.parameters.targetLocationId);
          const orderId = String(intent.parameters.orderId);
          if (!unit.accessibleLocationIds.includes(targetLocationId)) {
            committed.push({
              eventType: "operation.failed",
              actorId: intent.actorId,
              causalEventId: event.id,
              causalDecisionEpisodeId: intent.causalDecisionEpisodeId,
              payload: { intentId: intent.id, reason: "location_inaccessible" },
            });
            break;
          }
          committed.push(
            {
              eventType: "unit.moved",
              actorId: intent.actorId,
              targetIds: [unit.id, targetLocationId],
              causalEventId: event.id,
              causalDecisionEpisodeId: intent.causalDecisionEpisodeId,
              payload: {
                unitId: unit.id,
                fromLocationId: unit.locationId,
                toLocationId: targetLocationId,
                intentId: intent.id,
              },
            },
            orderStatusChanged(orderId, "executed", event.id),
          );
          break;
        }

        default:
          throw new Error(
            `Unknown contradictory-orders event: ${event.eventType}`,
          );
      }
    }

    return { events: committed, scheduled };
  },

  reduce(state, event) {
    switch (event.eventType) {
      case "order.created": {
        const order: MilitaryOrder = {
          id: String(event.payload.orderId),
          issuerId: String(event.payload.issuerId),
          recipientId: String(event.payload.recipientId),
          unitId: String(event.payload.unitId),
          objective: String(
            event.payload.objective,
          ) as MilitaryOrder["objective"],
          targetLocationId: String(event.payload.targetLocationId),
          status: "created",
          lifecycle: [lifecycleEntry("created", event)],
        };
        return { ...state, orders: { ...state.orders, [order.id]: order } };
      }
      case "order.status_changed": {
        const order = requiredOrder(state, String(event.payload.orderId));
        const status = String(event.payload.status) as OrderStatus;
        return {
          ...state,
          orders: {
            ...state.orders,
            [order.id]: {
              ...order,
              status,
              lifecycle: [...order.lifecycle, lifecycleEntry(status, event)],
            },
          },
        };
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
      case "report.created": {
        const report = reportFromEvent(event);
        return { ...state, reports: { ...state.reports, [report.id]: report } };
      }
      case "observation.recorded":
        return recordObservation(state, event);
      case "decision.opened": {
        const episode: CommandDecisionEpisode = {
          id: String(event.payload.decisionEpisodeId),
          actorId: requiredActorId(event),
          openedAt: event.occurredAt,
          triggerObservationIds: asStringArray(
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
          candidateOrderIds: asStringArray(event.payload.candidateOrderIds),
          evaluations: [],
        };
        return {
          ...state,
          decisionEpisodes: {
            ...state.decisionEpisodes,
            [episode.id]: episode,
          },
        };
      }
      case "decision.committed": {
        const episode = requiredDecision(
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
              evaluations: evaluationsFromJson(event.payload.evaluations),
              selectedOrderId: String(event.payload.selectedOrderId),
              finalIntentIds: [String(event.payload.intentId)],
            },
          },
        };
      }
      case "intent.created": {
        const intent = intentFromEvent(event);
        return { ...state, intents: { ...state.intents, [intent.id]: intent } };
      }
      case "unit.moved": {
        const unit = requiredUnit(state, String(event.payload.unitId));
        return {
          ...state,
          units: {
            ...state.units,
            [unit.id]: {
              ...unit,
              locationId: String(event.payload.toLocationId),
            },
          },
        };
      }
      default:
        return state;
    }
  },

  validate(_before, after) {
    for (const order of Object.values(after.orders)) {
      if (!after.actors[order.issuerId] || !after.actors[order.recipientId]) {
        throw new Error(`Order ${order.id} refers to an unknown actor`);
      }
      if (!after.units[order.unitId]) {
        throw new Error(`Order ${order.id} refers to an unknown unit`);
      }
    }
    for (const message of Object.values(after.messages)) {
      if (
        !after.actors[message.senderId] ||
        !after.actors[message.recipientId]
      ) {
        throw new Error(`Message ${message.id} refers to an unknown actor`);
      }
    }
    for (const episode of Object.values(after.decisionEpisodes)) {
      if (episode.status === "committed") {
        if (!episode.selectedOrderId || episode.finalIntentIds.length !== 1) {
          throw new Error(`Committed decision ${episode.id} is incomplete`);
        }
      }
    }
  },
};

export async function runContradictoryOrdersScenario(
  runId = "contradictory-orders-demo",
): Promise<ContradictoryOrdersRun> {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    contradictoryOrdersInitialState,
    contradictoryOrdersModel,
    store,
    runId,
  );

  await kernel.schedule({
    eventType: "authority.issue_order",
    scheduledAt: simTime(0),
    actorId: ids.ruler,
    targetIds: [ids.commander, ids.unit],
    payload: {
      orderId: ids.rulerOrder,
      issuerId: ids.ruler,
      objective: "hold_palace",
      targetLocationId: ids.palace,
      messageId: ids.rulerOrderMessage,
      travelTime: 110,
    },
  });
  await kernel.schedule({
    eventType: "authority.issue_order",
    scheduledAt: simTime(40),
    actorId: ids.chancellor,
    targetIds: [ids.commander, ids.unit],
    payload: {
      orderId: ids.chancellorOrder,
      issuerId: ids.chancellor,
      objective: "secure_granary",
      targetLocationId: ids.granary,
      messageId: ids.chancellorOrderMessage,
      travelTime: 70,
    },
  });

  let rulerViewBeforeResponse: ContradictoryOrdersActorView | undefined;
  while (await kernel.step()) {
    if (kernel.time === simTime(120)) {
      rulerViewBeforeResponse = contradictoryOrdersActorView(
        kernel.state,
        ids.ruler,
      );
    }
  }
  if (!rulerViewBeforeResponse) {
    throw new Error("Scenario did not reach the simultaneous-arrival point");
  }
  const state = kernel.state;
  return {
    state,
    records: await store.readAll(),
    rulerViewBeforeResponse,
    rulerViewAfterResponse: contradictoryOrdersActorView(state, ids.ruler),
    debugTruth: contradictoryOrdersDebugTruth(state),
  };
}

export function contradictoryOrdersActorView(
  state: ContradictoryOrdersState,
  actorId: string,
): ContradictoryOrdersActorView {
  const actor = state.actors[actorId];
  if (!actor) throw new Error(`Unknown actor: ${actorId}`);
  const issuedOrders = Object.values(state.orders)
    .filter((order) => order.issuerId === actorId)
    .map((order) => ({
      id: order.id,
      objective: order.objective,
      targetLocationId: order.targetLocationId,
    }));
  const observations = (state.actorObservationIds[actorId] ?? []).map(
    (observationId) => {
      const observation = state.observations[observationId];
      if (!observation)
        throw new Error(`Unknown observation: ${observationId}`);
      return observation;
    },
  );
  const report = observations.map(reportFromObservation).find(Boolean);
  return structuredClone({
    actor,
    issuedOrders,
    observations,
    knownOutcome:
      report === undefined
        ? "awaiting_response"
        : report.outcome === "obeyed"
          ? "order_followed"
          : "order_overruled",
    ...(report?.disclosedAlternativeOrderId === undefined
      ? {}
      : { disclosedAlternativeOrderId: report.disclosedAlternativeOrderId }),
  }) as ContradictoryOrdersActorView;
}

export function contradictoryOrdersDebugTruth(
  state: ContradictoryOrdersState,
): ContradictoryOrdersRun["debugTruth"] {
  return structuredClone({
    orders: state.orders,
    units: state.units,
    relationships: state.relationships,
    decisionEpisodes: state.decisionEpisodes,
    intents: state.intents,
  }) as ContradictoryOrdersRun["debugTruth"];
}

export function evaluateOrder(
  state: ContradictoryOrdersState,
  order: MilitaryOrder,
): OrderEvaluation {
  const context = state.commanderContexts[order.recipientId];
  if (!context) throw new Error(`No decision context for ${order.recipientId}`);
  const unit = requiredUnit(state, order.unitId);
  const weights: Record<RelationshipKind, number> = {
    formal_command: 1,
    legal_recognition: 0.8,
    funding: 1,
    appointment: 0.8,
    personal_loyalty: 0.7,
    informal_influence: 0.7,
  };
  const factors: DecisionFactor[] = Object.values(state.relationships)
    .filter(
      (relationship) =>
        relationship.sourceId === order.issuerId &&
        [order.recipientId, order.unitId].includes(relationship.targetId),
    )
    .map((relationship) => ({
      kind: relationship.kind,
      label: humanize(relationship.kind),
      score: rounded(relationship.strength * weights[relationship.kind]),
      relationshipId: relationship.id,
    }));
  const missionFit =
    order.objective === "hold_palace"
      ? context.beliefs.palaceThreat *
        context.motivations.preservePoliticalOrder
      : context.beliefs.granaryThreat * context.motivations.protectSupply;
  factors.push({
    kind: "mission_fit",
    label:
      order.objective === "hold_palace"
        ? "perceived palace threat × preserve order"
        : "perceived granary threat × protect supply",
    score: rounded(missionFit),
  });
  factors.push({
    kind: "physical_access",
    label: "unit can reach target",
    score: unit.accessibleLocationIds.includes(order.targetLocationId)
      ? 0.2
      : -10,
  });
  return {
    orderId: order.id,
    total: rounded(factors.reduce((sum, factor) => sum + factor.score, 0)),
    factors,
  };
}

function relationship(
  id: string,
  sourceId: string,
  targetId: string,
  kind: RelationshipKind,
  strength: number,
): PoliticalRelationship {
  return { id, sourceId, targetId, kind, strength };
}

function relationshipRecords(
  relationships: readonly PoliticalRelationship[],
): Readonly<Record<string, PoliticalRelationship>> {
  return Object.fromEntries(relationships.map((item) => [item.id, item]));
}

function orderStatusChanged(
  orderId: string,
  status: OrderStatus,
  causalEventId: string,
): DomainEventDraft {
  return {
    eventType: "order.status_changed",
    causalEventId,
    payload: { orderId, status },
  };
}

function lifecycleEntry(
  status: OrderStatus,
  event: DomainEvent,
): OrderLifecycleEntry {
  return { status, occurredAt: event.occurredAt, eventId: event.id };
}

function messageCreated(input: {
  messageId: string;
  senderId: string;
  recipientId: string;
  kind: CommandMessage["kind"];
  travelTime: number;
  orderId?: string;
  reportId?: string;
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
      kind: input.kind,
      travelTime: input.travelTime,
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
      ...(input.reportId === undefined ? {} : { reportId: input.reportId }),
    },
  };
}

function messageArrived(
  message: CommandMessage,
  causalEventId: string,
): DomainEventDraft {
  return {
    eventType: "message.arrived",
    actorId: message.senderId,
    targetIds: [message.recipientId],
    causalEventId,
    payload: { messageId: message.id },
  };
}

function scheduleDeparture(
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

function reportCreated(input: {
  reportId: string;
  recipientId: string;
  subjectOrderId: string;
  selectedOrderId: string;
  outcome: CommandDecisionReport["outcome"];
  disclosedAlternativeOrderId?: string;
  causalEventId: string;
}): DomainEventDraft {
  return {
    eventType: "report.created",
    actorId: ids.commander,
    targetIds: [input.recipientId],
    causalEventId: input.causalEventId,
    payload: {
      reportId: input.reportId,
      authorId: ids.commander,
      recipientId: input.recipientId,
      decisionEpisodeId: ids.decision,
      subjectOrderId: input.subjectOrderId,
      selectedOrderId: input.selectedOrderId,
      outcome: input.outcome,
      ...(input.disclosedAlternativeOrderId === undefined
        ? {}
        : { disclosedAlternativeOrderId: input.disclosedAlternativeOrderId }),
    },
  };
}

function observationRecorded(input: {
  observationId: string;
  actorId: string;
  sourceType: string;
  sourceId: string;
  subjectRefs: readonly string[];
  payload: JsonObject;
  causalEventId: string;
}): DomainEventDraft {
  return {
    eventType: "observation.recorded",
    actorId: input.actorId,
    causalEventId: input.causalEventId,
    payload: {
      observationId: input.observationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      subjectRefs: [...input.subjectRefs],
      observationPayload: input.payload,
    },
  };
}

function intentCreated(
  intent: Intent,
  causalEventId: string,
): DomainEventDraft {
  return {
    eventType: "intent.created",
    actorId: intent.actorId,
    causalEventId,
    causalDecisionEpisodeId: intent.causalDecisionEpisodeId,
    payload: {
      intentId: intent.id,
      actorId: intent.actorId,
      goal: intent.goal,
      ...(intent.operationTemplate === undefined
        ? {}
        : { operationTemplate: intent.operationTemplate }),
      parameters: intent.parameters,
      ...(intent.urgency === undefined ? {} : { urgency: intent.urgency }),
    },
  };
}

function requiredOrder(
  state: ContradictoryOrdersState,
  id: string,
): MilitaryOrder {
  const order = state.orders[id];
  if (!order) throw new Error(`Unknown order: ${id}`);
  return order;
}

function requiredMessage(
  state: ContradictoryOrdersState,
  id: string,
): CommandMessage {
  const message = state.messages[id];
  if (!message) throw new Error(`Unknown message: ${id}`);
  return message;
}

function requiredReport(
  state: ContradictoryOrdersState,
  id: string,
): CommandDecisionReport {
  const report = state.reports[id];
  if (!report) throw new Error(`Unknown report: ${id}`);
  return report;
}

function requiredDecision(
  state: ContradictoryOrdersState,
  id: string,
): CommandDecisionEpisode {
  const episode = state.decisionEpisodes[id];
  if (!episode) throw new Error(`Unknown decision episode: ${id}`);
  return episode;
}

function requiredIntent(state: ContradictoryOrdersState, id: string): Intent {
  const intent = state.intents[id];
  if (!intent) throw new Error(`Unknown intent: ${id}`);
  return intent;
}

function requiredUnit(
  state: ContradictoryOrdersState,
  id: string,
): MilitaryUnit {
  const unit = state.units[id];
  if (!unit) throw new Error(`Unknown unit: ${id}`);
  return unit;
}

function requiredActorId(event: DomainEvent): string {
  if (!event.actorId) throw new Error(`${event.eventType} requires an actor`);
  return event.actorId;
}

function messageFromEvent(event: DomainEvent): CommandMessage {
  return {
    id: String(event.payload.messageId),
    senderId: String(event.payload.senderId),
    recipientId: String(event.payload.recipientId),
    kind: String(event.payload.kind) as CommandMessage["kind"],
    travelTime: Number(event.payload.travelTime),
    ...(event.payload.orderId === undefined
      ? {}
      : { orderId: String(event.payload.orderId) }),
    ...(event.payload.reportId === undefined
      ? {}
      : { reportId: String(event.payload.reportId) }),
    status: "draft",
  };
}

function reportFromEvent(event: DomainEvent): CommandDecisionReport {
  return {
    id: String(event.payload.reportId),
    authorId: String(event.payload.authorId),
    recipientId: String(event.payload.recipientId),
    decisionEpisodeId: String(event.payload.decisionEpisodeId),
    subjectOrderId: String(event.payload.subjectOrderId),
    selectedOrderId: String(event.payload.selectedOrderId),
    outcome: String(event.payload.outcome) as CommandDecisionReport["outcome"],
    ...(event.payload.disclosedAlternativeOrderId === undefined
      ? {}
      : {
          disclosedAlternativeOrderId: String(
            event.payload.disclosedAlternativeOrderId,
          ),
        }),
  };
}

function reportAsJson(report: CommandDecisionReport): JsonObject {
  return {
    id: report.id,
    authorId: report.authorId,
    recipientId: report.recipientId,
    decisionEpisodeId: report.decisionEpisodeId,
    subjectOrderId: report.subjectOrderId,
    selectedOrderId: report.selectedOrderId,
    outcome: report.outcome,
    ...(report.disclosedAlternativeOrderId === undefined
      ? {}
      : { disclosedAlternativeOrderId: report.disclosedAlternativeOrderId }),
  };
}

function reportFromObservation(
  observation: Observation,
): CommandDecisionReport | undefined {
  const value = observation.payload.report;
  if (!value || Array.isArray(value) || typeof value !== "object")
    return undefined;
  const report = value as JsonObject;
  if (typeof report.outcome !== "string") return undefined;
  return {
    id: String(report.id),
    authorId: String(report.authorId),
    recipientId: String(report.recipientId),
    decisionEpisodeId: String(report.decisionEpisodeId),
    subjectOrderId: String(report.subjectOrderId),
    selectedOrderId: String(report.selectedOrderId),
    outcome: report.outcome as CommandDecisionReport["outcome"],
    ...(report.disclosedAlternativeOrderId === undefined
      ? {}
      : {
          disclosedAlternativeOrderId: String(
            report.disclosedAlternativeOrderId,
          ),
        }),
  };
}

function orderAsJson(order: MilitaryOrder): JsonObject {
  return {
    id: order.id,
    issuerId: order.issuerId,
    recipientId: order.recipientId,
    unitId: order.unitId,
    objective: order.objective,
    targetLocationId: order.targetLocationId,
  };
}

function evaluationAsJson(evaluation: OrderEvaluation): JsonObject {
  return {
    orderId: evaluation.orderId,
    total: evaluation.total,
    factors: evaluation.factors.map((factor) => ({
      kind: factor.kind,
      label: factor.label,
      score: factor.score,
      ...(factor.relationshipId === undefined
        ? {}
        : { relationshipId: factor.relationshipId }),
    })),
  };
}

function evaluationsFromJson(value: unknown): OrderEvaluation[] {
  if (!Array.isArray(value))
    throw new Error("Decision evaluations must be an array");
  return value.map((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") {
      throw new Error("Decision evaluation must be an object");
    }
    const evaluation = item as JsonObject;
    if (!Array.isArray(evaluation.factors)) {
      throw new Error("Decision factors must be an array");
    }
    return {
      orderId: String(evaluation.orderId),
      total: Number(evaluation.total),
      factors: evaluation.factors.map((factor) => {
        if (!factor || Array.isArray(factor) || typeof factor !== "object") {
          throw new Error("Decision factor must be an object");
        }
        const record = factor as JsonObject;
        return {
          kind: String(record.kind) as DecisionFactor["kind"],
          label: String(record.label),
          score: Number(record.score),
          ...(record.relationshipId === undefined
            ? {}
            : { relationshipId: String(record.relationshipId) }),
        };
      }),
    };
  });
}

function intentFromEvent(event: DomainEvent): Intent {
  const parameters = event.payload.parameters;
  if (
    !parameters ||
    Array.isArray(parameters) ||
    typeof parameters !== "object"
  ) {
    throw new Error("Intent parameters must be an object");
  }
  if (!event.causalDecisionEpisodeId) {
    throw new Error("Intent requires a causal decision episode");
  }
  return {
    id: String(event.payload.intentId),
    actorId: String(event.payload.actorId),
    createdAt: event.occurredAt,
    goal: String(event.payload.goal),
    ...(event.payload.operationTemplate === undefined
      ? {}
      : { operationTemplate: String(event.payload.operationTemplate) }),
    parameters: parameters as JsonObject,
    ...(event.payload.urgency === undefined
      ? {}
      : { urgency: Number(event.payload.urgency) }),
    causalDecisionEpisodeId: event.causalDecisionEpisodeId,
  };
}

function recordObservation(
  state: ContradictoryOrdersState,
  event: DomainEvent,
): ContradictoryOrdersState {
  const actorId = requiredActorId(event);
  const payload = event.payload.observationPayload;
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Observation requires an object payload");
  }
  const observation: Observation = {
    id: String(event.payload.observationId),
    actorId,
    observedAt: event.occurredAt,
    sourceType: String(event.payload.sourceType),
    sourceId: String(event.payload.sourceId),
    subjectRefs: asStringArray(event.payload.subjectRefs),
    payload: payload as JsonObject,
    ...(event.causalEventId === undefined
      ? {}
      : { causalEventId: event.causalEventId }),
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

function updateMessageStatus(
  state: ContradictoryOrdersState,
  id: string,
  status: CommandMessage["status"],
): ContradictoryOrdersState {
  const message = requiredMessage(state, id);
  return {
    ...state,
    messages: { ...state.messages, [id]: { ...message, status } },
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function rounded(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

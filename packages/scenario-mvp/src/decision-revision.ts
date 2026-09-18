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

export type RevisionOrder = {
  readonly id: string;
  readonly decisionEpisodeId: string;
  readonly revision: number;
  readonly issuerId: string;
  readonly recipientId: string;
  readonly unitId: string;
  readonly objective: "move_to_east_gate" | "hold_imperial_palace";
  readonly targetLocationId: string;
  readonly supersedesOrderId?: string;
  readonly status: OrderStatus;
  readonly lifecycle: readonly OrderLifecycleEntry[];
};

export type RevisionMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly kind: "order" | "revision_report";
  readonly travelTime: number;
  readonly orderId?: string;
  readonly payload: JsonObject;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type RevisionUnit = {
  readonly id: string;
  readonly name: string;
  readonly commanderId: string;
  readonly locationId: string;
  readonly accessibleLocationIds: readonly string[];
  readonly acceptedOrderId?: string;
  readonly highestRevisionByDecision: Readonly<Record<string, number>>;
};

export type RevisionDecisionEpisode = DecisionEpisode & {
  readonly activeIntentId?: string;
};

export type DecisionRevisionState = {
  readonly actors: Readonly<Record<string, ScenarioActor>>;
  readonly units: Readonly<Record<string, RevisionUnit>>;
  readonly orders: Readonly<Record<string, RevisionOrder>>;
  readonly messages: Readonly<Record<string, RevisionMessage>>;
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
  readonly decisionEpisodes: Readonly<Record<string, RevisionDecisionEpisode>>;
  readonly intents: Readonly<Record<string, Intent>>;
};

export type KnownRevisionOrder = {
  readonly id: string;
  readonly revision: number;
  readonly objective: RevisionOrder["objective"];
  readonly targetLocationId: string;
  readonly supersedesOrderId?: string;
  readonly issuedAt: number;
};

export type DecisionRevisionActorView = {
  readonly actor: ScenarioActor;
  readonly observations: readonly Observation[];
  readonly issuedOrders: readonly KnownRevisionOrder[];
  readonly knownOutcome:
    "first_order_in_flight" | "revision_in_flight" | "revision_confirmed";
};

export type DecisionRevisionRun = {
  readonly state: DecisionRevisionState;
  readonly records: readonly SimulationRecord[];
  readonly rulerViewAfterFirstOrder: DecisionRevisionActorView;
  readonly rulerViewAfterRevision: DecisionRevisionActorView;
  readonly rulerViewFinal: DecisionRevisionActorView;
  readonly debugTruth: {
    readonly units: DecisionRevisionState["units"];
    readonly orders: DecisionRevisionState["orders"];
    readonly messages: DecisionRevisionState["messages"];
    readonly decisionEpisodes: DecisionRevisionState["decisionEpisodes"];
    readonly intents: DecisionRevisionState["intents"];
  };
};

export const decisionRevisionIds = {
  ruler: "actor:ruler",
  commander: "actor:guard-commander",
  scout: "actor:east-gate-scout",
  inspector: "actor:palace-inspector",
  unit: "unit:palace-guard",
  barracks: "location:guard-barracks",
  eastGate: "location:east-gate",
  palace: "location:imperial-palace",
  decision: "decision:east-gate-crisis",
  firstObservation: "observation:east-gate-threat",
  correctingObservation: "observation:palace-plot",
  firstIntent: "intent:send-guard-east",
  revisedIntent: "intent:hold-guard-palace",
  firstOrder: "order:move-guard-east",
  revisedOrder: "order:hold-guard-palace",
  firstMessage: "message:move-guard-east",
  revisedMessage: "message:hold-guard-palace",
  reportMessage: "message:revision-effective",
} as const;

const ids = decisionRevisionIds;

export const decisionRevisionInitialState: DecisionRevisionState = {
  actors: {
    [ids.ruler]: { id: ids.ruler, name: "The Ruler", office: "Sovereign" },
    [ids.commander]: {
      id: ids.commander,
      name: "Commander Zhao",
      office: "Commander of the Palace Guard",
    },
    [ids.scout]: {
      id: ids.scout,
      name: "Scout Qiao",
      office: "East Gate Scout",
    },
    [ids.inspector]: {
      id: ids.inspector,
      name: "Inspector Lin",
      office: "Palace Inspector",
    },
  },
  units: {
    [ids.unit]: {
      id: ids.unit,
      name: "Palace Guard",
      commanderId: ids.commander,
      locationId: ids.barracks,
      accessibleLocationIds: [ids.eastGate, ids.palace],
      highestRevisionByDecision: {},
    },
  },
  orders: {},
  messages: {},
  observations: {},
  actorObservationIds: {
    [ids.ruler]: [],
    [ids.commander]: [],
    [ids.scout]: [],
    [ids.inspector]: [],
  },
  decisionEpisodes: {},
  intents: {},
};

export const decisionRevisionModel: DomainModel<DecisionRevisionState> = {
  resolveBatch({ events, state, time }) {
    const committed: DomainEventDraft[] = [];
    const scheduled: ScheduledEventDraft[] = [];

    for (const event of events) {
      switch (event.eventType) {
        case "crisis.initial_report_arrives":
          committed.push(
            observationDraft({
              id: ids.firstObservation,
              actorId: ids.ruler,
              sourceType: "field_report",
              sourceId: ids.scout,
              subjectRefs: [ids.eastGate],
              payload: {
                claim: "armed movement reported outside the east gate",
                confidence: 0.7,
              },
              cause: event.id,
            }),
            {
              eventType: "decision.opened",
              actorId: ids.ruler,
              causalEventId: event.id,
              payload: {
                decisionEpisodeId: ids.decision,
                triggerObservationIds: [ids.firstObservation],
                urgency: 0.95,
                expectedResolutionAt: addSimTime(time, 10),
              },
            },
          );
          scheduled.push({
            eventType: "decision.commit_initial",
            scheduledAt: addSimTime(time, 10),
            actorId: ids.ruler,
            causalEventId: event.id,
            payload: { decisionEpisodeId: ids.decision },
          });
          break;

        case "decision.commit_initial": {
          const episode = getDecision(
            state,
            String(event.payload.decisionEpisodeId),
          );
          const intent = makeIntent(
            ids.firstIntent,
            "Move the Palace Guard to the East Gate",
            ids.firstOrder,
            ids.eastGate,
            time,
          );
          committed.push(
            decisionEvent(
              "decision.committed",
              episode.id,
              intent.id,
              event.id,
            ),
            intentDraft(intent, event.id),
            orderDraft({
              id: ids.firstOrder,
              revision: 0,
              objective: "move_to_east_gate",
              targetLocationId: ids.eastGate,
              cause: event.id,
            }),
            messageDraft({
              id: ids.firstMessage,
              senderId: ids.ruler,
              recipientId: ids.commander,
              kind: "order",
              travelTime: 100,
              orderId: ids.firstOrder,
              payload: {},
              cause: event.id,
            }),
          );
          scheduled.push(
            departure(ids.firstMessage, addSimTime(time, 10), event.id),
          );
          break;
        }

        case "crisis.correcting_report_arrives": {
          const episode = getDecision(state, ids.decision);
          committed.push(
            observationDraft({
              id: ids.correctingObservation,
              actorId: ids.ruler,
              sourceType: "independent_intelligence",
              sourceId: ids.inspector,
              subjectRefs: [ids.eastGate, ids.palace],
              payload: {
                claim:
                  "the east-gate movement is a decoy; conspirators are approaching the palace",
                confidence: 0.92,
              },
              cause: event.id,
            }),
            {
              eventType: "decision.revision_opened",
              actorId: ids.ruler,
              causalEventId: event.id,
              payload: {
                decisionEpisodeId: episode.id,
                triggerObservationId: ids.correctingObservation,
                expectedResolutionAt: addSimTime(time, 10),
              },
            },
          );
          scheduled.push({
            eventType: "decision.commit_revision",
            scheduledAt: addSimTime(time, 10),
            actorId: ids.ruler,
            causalEventId: event.id,
            payload: { decisionEpisodeId: episode.id },
          });
          break;
        }

        case "decision.commit_revision": {
          const episode = getDecision(
            state,
            String(event.payload.decisionEpisodeId),
          );
          const intent = makeIntent(
            ids.revisedIntent,
            "Countermand the deployment and hold the Imperial Palace",
            ids.revisedOrder,
            ids.palace,
            time,
          );
          committed.push(
            decisionEvent("decision.revised", episode.id, intent.id, event.id),
            intentDraft(intent, event.id),
            statusDraft(ids.firstOrder, "countermanded", event.id),
            orderDraft({
              id: ids.revisedOrder,
              revision: 1,
              objective: "hold_imperial_palace",
              targetLocationId: ids.palace,
              supersedesOrderId: ids.firstOrder,
              cause: event.id,
            }),
            messageDraft({
              id: ids.revisedMessage,
              senderId: ids.ruler,
              recipientId: ids.commander,
              kind: "order",
              travelTime: 40,
              orderId: ids.revisedOrder,
              payload: {},
              cause: event.id,
            }),
          );
          scheduled.push(
            departure(ids.revisedMessage, addSimTime(time, 5), event.id),
          );
          break;
        }

        case "message.depart": {
          const message = getMessage(state, String(event.payload.messageId));
          committed.push(
            messageStatusDraft(message, "message.departed", event.id),
          );
          if (message.kind === "order" && message.orderId) {
            committed.push(statusDraft(message.orderId, "sent", event.id));
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
          const message = getMessage(state, String(event.payload.messageId));
          committed.push(
            messageStatusDraft(message, "message.arrived", event.id),
          );
          if (message.kind === "revision_report") {
            committed.push(
              observationDraft({
                id: `observation:${message.id}`,
                actorId: message.recipientId,
                sourceType: "revision_report",
                sourceId: message.id,
                subjectRefs: [ids.firstOrder, ids.revisedOrder, ids.unit],
                payload: message.payload,
                cause: event.id,
              }),
            );
            break;
          }
          if (!message.orderId)
            throw new Error(`Order message ${message.id} has no order`);
          const order = getOrder(state, message.orderId);
          const unit = getUnit(state, order.unitId);
          const highest =
            unit.highestRevisionByDecision[order.decisionEpisodeId] ?? -1;
          committed.push(
            statusDraft(order.id, "received", event.id),
            observationDraft({
              id: `observation:${message.id}`,
              actorId: message.recipientId,
              sourceType: "order",
              sourceId: order.id,
              subjectRefs: [order.id, order.unitId],
              payload: { order: orderJson(order) },
              cause: event.id,
            }),
          );
          if (order.revision < highest) {
            if (!unit.acceptedOrderId)
              throw new Error("Accepted revision has no order");
            committed.push(
              statusDraft(order.id, "ignored", event.id),
              messageDraft({
                id: ids.reportMessage,
                senderId: ids.commander,
                recipientId: ids.ruler,
                kind: "revision_report",
                travelTime: 60,
                payload: {
                  effectiveOrderId: unit.acceptedOrderId,
                  ignoredOrderId: order.id,
                  effectiveRevision: highest,
                  unitLocationId: unit.locationId,
                },
                cause: event.id,
              }),
            );
            scheduled.push(
              departure(ids.reportMessage, addSimTime(time, 10), event.id),
            );
          } else {
            scheduled.push({
              eventType: "commander.apply_order",
              scheduledAt: addSimTime(time, 10),
              actorId: ids.commander,
              targetIds: [order.unitId],
              causalEventId: event.id,
              causalDecisionEpisodeId: order.decisionEpisodeId,
              payload: { orderId: order.id },
            });
          }
          break;
        }

        case "commander.apply_order": {
          const order = getOrder(state, String(event.payload.orderId));
          const unit = getUnit(state, order.unitId);
          if (!unit.accessibleLocationIds.includes(order.targetLocationId)) {
            committed.push(statusDraft(order.id, "failed", event.id));
            break;
          }
          committed.push(
            statusDraft(order.id, "acknowledged", event.id),
            {
              eventType: "unit.order_accepted",
              actorId: ids.commander,
              targetIds: [unit.id],
              causalEventId: event.id,
              causalDecisionEpisodeId: order.decisionEpisodeId,
              payload: {
                unitId: unit.id,
                orderId: order.id,
                decisionEpisodeId: order.decisionEpisodeId,
                revision: order.revision,
              },
            },
            {
              eventType: "unit.moved",
              actorId: ids.commander,
              targetIds: [unit.id, order.targetLocationId],
              causalEventId: event.id,
              causalDecisionEpisodeId: order.decisionEpisodeId,
              payload: {
                unitId: unit.id,
                fromLocationId: unit.locationId,
                toLocationId: order.targetLocationId,
                orderId: order.id,
              },
            },
            statusDraft(order.id, "executed", event.id),
          );
          break;
        }

        default:
          throw new Error(
            `Unknown decision-revision event: ${event.eventType}`,
          );
      }
    }
    return { events: committed, scheduled };
  },

  reduce(state, event) {
    switch (event.eventType) {
      case "observation.recorded":
        return recordObservation(state, event);
      case "decision.opened": {
        const episode: RevisionDecisionEpisode = {
          id: String(event.payload.decisionEpisodeId),
          actorId: requiredActorId(event),
          openedAt: event.occurredAt,
          triggerObservationIds: strings(event.payload.triggerObservationIds),
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
      case "decision.committed":
      case "decision.revised": {
        const episode = getDecision(
          state,
          String(event.payload.decisionEpisodeId),
        );
        const intentId = String(event.payload.intentId);
        return {
          ...state,
          decisionEpisodes: {
            ...state.decisionEpisodes,
            [episode.id]: {
              ...episode,
              status: "committed",
              activeIntentId: intentId,
              finalIntentIds: [...episode.finalIntentIds, intentId],
            },
          },
        };
      }
      case "decision.revision_opened": {
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
              status: "open",
              revisionCount: episode.revisionCount + 1,
              triggerObservationIds: [
                ...episode.triggerObservationIds,
                String(event.payload.triggerObservationId),
              ],
              expectedResolutionAt: simTime(
                Number(event.payload.expectedResolutionAt),
              ),
            },
          },
        };
      }
      case "intent.created": {
        const intent = intentFromEvent(event);
        return { ...state, intents: { ...state.intents, [intent.id]: intent } };
      }
      case "order.created": {
        const order = orderFromEvent(event);
        return { ...state, orders: { ...state.orders, [order.id]: order } };
      }
      case "order.status_changed": {
        const order = getOrder(state, String(event.payload.orderId));
        const status = String(event.payload.status) as OrderStatus;
        return {
          ...state,
          orders: {
            ...state.orders,
            [order.id]: {
              ...order,
              status,
              lifecycle: [...order.lifecycle, lifecycle(status, event)],
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
        return setMessageStatus(
          state,
          String(event.payload.messageId),
          "in_transit",
        );
      case "message.arrived":
        return setMessageStatus(
          state,
          String(event.payload.messageId),
          "delivered",
        );
      case "unit.order_accepted": {
        const unit = getUnit(state, String(event.payload.unitId));
        return {
          ...state,
          units: {
            ...state.units,
            [unit.id]: {
              ...unit,
              acceptedOrderId: String(event.payload.orderId),
              highestRevisionByDecision: {
                ...unit.highestRevisionByDecision,
                [String(event.payload.decisionEpisodeId)]: Number(
                  event.payload.revision,
                ),
              },
            },
          },
        };
      }
      case "unit.moved": {
        const unit = getUnit(state, String(event.payload.unitId));
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
      if (!after.units[order.unitId])
        throw new Error(`Unknown unit on ${order.id}`);
    }
    for (const episode of Object.values(after.decisionEpisodes)) {
      if (episode.status === "committed" && !episode.activeIntentId) {
        throw new Error(
          `Committed decision ${episode.id} has no active intent`,
        );
      }
    }
  },
};

export async function runDecisionRevisionScenario(
  runId = "decision-revision-demo",
): Promise<DecisionRevisionRun> {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    decisionRevisionInitialState,
    decisionRevisionModel,
    store,
    runId,
  );
  await kernel.schedule({
    eventType: "crisis.initial_report_arrives",
    scheduledAt: simTime(0),
    actorId: ids.scout,
    targetIds: [ids.ruler],
    payload: {},
  });
  await kernel.schedule({
    eventType: "crisis.correcting_report_arrives",
    scheduledAt: simTime(35),
    actorId: ids.inspector,
    targetIds: [ids.ruler],
    payload: {},
  });

  let firstView: DecisionRevisionActorView | undefined;
  let revisedView: DecisionRevisionActorView | undefined;
  while (await kernel.step()) {
    if (kernel.time === simTime(20)) {
      firstView = decisionRevisionActorView(kernel.state, ids.ruler);
    }
    if (kernel.time === simTime(50)) {
      revisedView = decisionRevisionActorView(kernel.state, ids.ruler);
    }
  }
  if (!firstView || !revisedView) {
    throw new Error("Scenario did not reach both decision snapshots");
  }
  const state = kernel.state;
  return {
    state,
    records: await store.readAll(),
    rulerViewAfterFirstOrder: firstView,
    rulerViewAfterRevision: revisedView,
    rulerViewFinal: decisionRevisionActorView(state, ids.ruler),
    debugTruth: revisionDebugTruth(state),
  };
}

export function decisionRevisionActorView(
  state: DecisionRevisionState,
  actorId: string,
): DecisionRevisionActorView {
  const actor = state.actors[actorId];
  if (!actor) throw new Error(`Unknown actor: ${actorId}`);
  const observations = (state.actorObservationIds[actorId] ?? []).map((id) => {
    const observation = state.observations[id];
    if (!observation) throw new Error(`Unknown observation: ${id}`);
    return observation;
  });
  const issuedOrders = Object.values(state.orders)
    .filter((order) => order.issuerId === actorId)
    .sort((left, right) => left.revision - right.revision)
    .map(knownOrder);
  const confirmed = observations.some(
    (observation) => observation.sourceType === "revision_report",
  );
  return structuredClone({
    actor,
    observations,
    issuedOrders,
    knownOutcome: confirmed
      ? "revision_confirmed"
      : issuedOrders.length > 1
        ? "revision_in_flight"
        : "first_order_in_flight",
  }) as DecisionRevisionActorView;
}

export function revisionDebugTruth(
  state: DecisionRevisionState,
): DecisionRevisionRun["debugTruth"] {
  return structuredClone({
    units: state.units,
    orders: state.orders,
    messages: state.messages,
    decisionEpisodes: state.decisionEpisodes,
    intents: state.intents,
  }) as DecisionRevisionRun["debugTruth"];
}

function makeIntent(
  id: string,
  goal: string,
  orderId: string,
  targetLocationId: string,
  createdAt: ReturnType<typeof simTime>,
): Intent {
  return {
    id,
    actorId: ids.ruler,
    createdAt,
    goal,
    operationTemplate: "issue_order",
    parameters: { orderId, unitId: ids.unit, targetLocationId },
    urgency: 0.95,
    causalDecisionEpisodeId: ids.decision,
  };
}

function decisionEvent(
  eventType: "decision.committed" | "decision.revised",
  decisionEpisodeId: string,
  intentId: string,
  causalEventId: string,
): DomainEventDraft {
  return {
    eventType,
    actorId: ids.ruler,
    causalEventId,
    payload: { decisionEpisodeId, intentId },
  };
}

function intentDraft(intent: Intent, causalEventId: string): DomainEventDraft {
  return {
    eventType: "intent.created",
    actorId: intent.actorId,
    causalEventId,
    causalDecisionEpisodeId: intent.causalDecisionEpisodeId,
    payload: {
      intentId: intent.id,
      actorId: intent.actorId,
      goal: intent.goal,
      operationTemplate: intent.operationTemplate ?? "issue_order",
      parameters: intent.parameters,
      urgency: intent.urgency ?? 0,
    },
  };
}

function orderDraft(input: {
  id: string;
  revision: number;
  objective: RevisionOrder["objective"];
  targetLocationId: string;
  supersedesOrderId?: string;
  cause: string;
}): DomainEventDraft {
  return {
    eventType: "order.created",
    actorId: ids.ruler,
    targetIds: [ids.commander, ids.unit],
    causalEventId: input.cause,
    causalDecisionEpisodeId: ids.decision,
    payload: {
      orderId: input.id,
      decisionEpisodeId: ids.decision,
      revision: input.revision,
      issuerId: ids.ruler,
      recipientId: ids.commander,
      unitId: ids.unit,
      objective: input.objective,
      targetLocationId: input.targetLocationId,
      ...(input.supersedesOrderId === undefined
        ? {}
        : { supersedesOrderId: input.supersedesOrderId }),
    },
  };
}

function statusDraft(
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

function messageDraft(input: {
  id: string;
  senderId: string;
  recipientId: string;
  kind: RevisionMessage["kind"];
  travelTime: number;
  orderId?: string;
  payload: JsonObject;
  cause: string;
}): DomainEventDraft {
  return {
    eventType: "message.created",
    actorId: input.senderId,
    targetIds: [input.recipientId],
    causalEventId: input.cause,
    payload: {
      messageId: input.id,
      senderId: input.senderId,
      recipientId: input.recipientId,
      kind: input.kind,
      travelTime: input.travelTime,
      content: input.payload,
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
    },
  };
}

function messageStatusDraft(
  message: RevisionMessage,
  eventType: "message.departed" | "message.arrived",
  causalEventId: string,
): DomainEventDraft {
  return {
    eventType,
    actorId: message.senderId,
    targetIds: [message.recipientId],
    causalEventId,
    payload: { messageId: message.id },
  };
}

function departure(
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
      observationPayload: input.payload,
    },
  };
}

function getDecision(
  state: DecisionRevisionState,
  id: string,
): RevisionDecisionEpisode {
  const value = state.decisionEpisodes[id];
  if (!value) throw new Error(`Unknown decision: ${id}`);
  return value;
}

function getOrder(state: DecisionRevisionState, id: string): RevisionOrder {
  const value = state.orders[id];
  if (!value) throw new Error(`Unknown order: ${id}`);
  return value;
}

function getMessage(state: DecisionRevisionState, id: string): RevisionMessage {
  const value = state.messages[id];
  if (!value) throw new Error(`Unknown message: ${id}`);
  return value;
}

function getUnit(state: DecisionRevisionState, id: string): RevisionUnit {
  const value = state.units[id];
  if (!value) throw new Error(`Unknown unit: ${id}`);
  return value;
}

function requiredActorId(event: DomainEvent): string {
  if (!event.actorId) throw new Error(`${event.eventType} requires an actor`);
  return event.actorId;
}

function orderFromEvent(event: DomainEvent): RevisionOrder {
  return {
    id: String(event.payload.orderId),
    decisionEpisodeId: String(event.payload.decisionEpisodeId),
    revision: Number(event.payload.revision),
    issuerId: String(event.payload.issuerId),
    recipientId: String(event.payload.recipientId),
    unitId: String(event.payload.unitId),
    objective: String(event.payload.objective) as RevisionOrder["objective"],
    targetLocationId: String(event.payload.targetLocationId),
    ...(event.payload.supersedesOrderId === undefined
      ? {}
      : { supersedesOrderId: String(event.payload.supersedesOrderId) }),
    status: "created",
    lifecycle: [lifecycle("created", event)],
  };
}

function messageFromEvent(event: DomainEvent): RevisionMessage {
  const content = event.payload.content;
  if (!content || Array.isArray(content) || typeof content !== "object") {
    throw new Error("Message content must be an object");
  }
  return {
    id: String(event.payload.messageId),
    senderId: String(event.payload.senderId),
    recipientId: String(event.payload.recipientId),
    kind: String(event.payload.kind) as RevisionMessage["kind"],
    travelTime: Number(event.payload.travelTime),
    ...(event.payload.orderId === undefined
      ? {}
      : { orderId: String(event.payload.orderId) }),
    payload: content as JsonObject,
    status: "draft",
  };
}

function orderJson(order: RevisionOrder): JsonObject {
  return {
    id: order.id,
    decisionEpisodeId: order.decisionEpisodeId,
    revision: order.revision,
    objective: order.objective,
    targetLocationId: order.targetLocationId,
    ...(order.supersedesOrderId === undefined
      ? {}
      : { supersedesOrderId: order.supersedesOrderId }),
  };
}

function knownOrder(order: RevisionOrder): KnownRevisionOrder {
  const created = order.lifecycle.find((entry) => entry.status === "created");
  if (!created) throw new Error(`Order ${order.id} has no creation event`);
  return {
    id: order.id,
    revision: order.revision,
    objective: order.objective,
    targetLocationId: order.targetLocationId,
    ...(order.supersedesOrderId === undefined
      ? {}
      : { supersedesOrderId: order.supersedesOrderId }),
    issuedAt: created.occurredAt,
  };
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
  if (!event.causalDecisionEpisodeId)
    throw new Error("Intent requires a decision");
  return {
    id: String(event.payload.intentId),
    actorId: String(event.payload.actorId),
    createdAt: event.occurredAt,
    goal: String(event.payload.goal),
    operationTemplate: String(event.payload.operationTemplate),
    parameters: parameters as JsonObject,
    urgency: Number(event.payload.urgency),
    causalDecisionEpisodeId: event.causalDecisionEpisodeId,
  };
}

function recordObservation(
  state: DecisionRevisionState,
  event: DomainEvent,
): DecisionRevisionState {
  const actorId = requiredActorId(event);
  const payload = event.payload.observationPayload;
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Observation payload must be an object");
  }
  const observation: Observation = {
    id: String(event.payload.observationId),
    actorId,
    observedAt: event.occurredAt,
    sourceType: String(event.payload.sourceType),
    sourceId: String(event.payload.sourceId),
    subjectRefs: strings(event.payload.subjectRefs),
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

function setMessageStatus(
  state: DecisionRevisionState,
  id: string,
  status: RevisionMessage["status"],
): DecisionRevisionState {
  const message = getMessage(state, id);
  return {
    ...state,
    messages: { ...state.messages, [id]: { ...message, status } },
  };
}

function lifecycle(
  status: OrderStatus,
  event: DomainEvent,
): OrderLifecycleEntry {
  return { status, occurredAt: event.occurredAt, eventId: event.id };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

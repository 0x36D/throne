import {
  readStringArray as stringArray,
  readJsonObject as objectValue,
} from "@throne/shared-types";
import {
  addSimTime,
  simTime,
  type ControlRelationship,
  type ControlRelationshipKind,
  type DecisionEpisode,
  type DomainEvent,
  type Intent,
  type JsonObject,
  type JsonValue,
  type ObedienceRecord,
  type Observation,
  type OrderLifecycleEntry,
  type OrderStatus,
  type Organization,
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

export type ControlObjective =
  "hold_imperial_palace" | "secure_treasury" | "guard_military_pay_office";

export type ControlOrder = {
  readonly id: string;
  readonly round: 1 | 2;
  readonly issuerId: string;
  readonly recipientId: string;
  readonly organizationId: string;
  readonly unitId: string;
  readonly objective: ControlObjective;
  readonly targetLocationId: string;
  readonly status: OrderStatus;
  readonly lifecycle: readonly OrderLifecycleEntry[];
};

export type ControlMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly kind: "order" | "decision_report";
  readonly travelTime: number;
  readonly orderId?: string;
  readonly reportId?: string;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type ControlDecisionReport = {
  readonly id: string;
  readonly round: 1 | 2;
  readonly authorId: string;
  readonly recipientId: string;
  readonly subjectOrderId: string;
  readonly selectedOrderId: string;
  readonly outcome: "obeyed" | "not_followed";
  readonly disclosedAlternativeOrderId?: string;
};

export type ControlUnit = {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly commanderId: string;
  readonly locationId: string;
  readonly accessibleLocationIds: readonly string[];
};

export type ControlResourceAccount = {
  readonly id: string;
  readonly ownerId: string;
  readonly kind: "money";
  readonly balance: number;
};

export type PayrollObligation = {
  readonly organizationId: string;
  readonly accountId: string;
  readonly arrears: number;
};

export type ControlDecisionFactor = {
  readonly kind: ControlRelationshipKind | "mission_fit";
  readonly label: string;
  readonly score: number;
  readonly relationshipId?: string;
};

export type ControlOrderEvaluation = {
  readonly orderId: string;
  readonly total: number;
  readonly factors: readonly ControlDecisionFactor[];
};

export type ControlDecisionEpisode = DecisionEpisode & {
  readonly round: 1 | 2;
  readonly candidateOrderIds: readonly string[];
  readonly evaluations: readonly ControlOrderEvaluation[];
  readonly selectedOrderId?: string;
};

export type LossOfControlState = {
  readonly actors: Readonly<Record<string, ScenarioActor>>;
  readonly organizations: Readonly<Record<string, Organization>>;
  readonly relationships: Readonly<Record<string, ControlRelationship>>;
  readonly units: Readonly<Record<string, ControlUnit>>;
  readonly resourceAccounts: Readonly<Record<string, ControlResourceAccount>>;
  readonly payroll: PayrollObligation;
  readonly orders: Readonly<Record<string, ControlOrder>>;
  readonly messages: Readonly<Record<string, ControlMessage>>;
  readonly reports: Readonly<Record<string, ControlDecisionReport>>;
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
  readonly decisionEpisodes: Readonly<Record<string, ControlDecisionEpisode>>;
  readonly intents: Readonly<Record<string, Intent>>;
  readonly obedienceRecords: readonly ObedienceRecord[];
};

export type PracticalControlCandidate = {
  readonly actorId: string;
  readonly relationshipSupport: number;
  readonly latestObedience: "obeyed" | "not_obeyed" | "none";
  readonly score: number;
  readonly evidenceIds: readonly string[];
};

export type PracticalControlAssessment = {
  readonly organizationId: string;
  readonly formalAuthorityIds: readonly string[];
  readonly leadingActorId: string;
  readonly candidates: readonly PracticalControlCandidate[];
};

export type LossOfControlActorView = {
  readonly actor: ScenarioActor;
  readonly organization: {
    readonly id: string;
    readonly name: string;
    readonly formalAuthorityIds: readonly string[];
  };
  readonly issuedOrders: readonly {
    readonly id: string;
    readonly round: 1 | 2;
    readonly objective: ControlObjective;
    readonly targetLocationId: string;
  }[];
  readonly observations: readonly Observation[];
  readonly knownOutcome:
    | "awaiting_first_response"
    | "first_command_obeyed"
    | "later_command_overruled";
  readonly disclosedAlternativeOrderId?: string;
};

export type LossOfControlRun = {
  readonly state: LossOfControlState;
  readonly records: readonly SimulationRecord[];
  readonly rulerViewAfterFirstDecision: LossOfControlActorView;
  readonly rulerViewFinal: LossOfControlActorView;
  readonly controlAfterFirstDecision: PracticalControlAssessment;
  readonly controlFinal: PracticalControlAssessment;
  readonly debugTruth: {
    readonly organizations: LossOfControlState["organizations"];
    readonly relationships: LossOfControlState["relationships"];
    readonly units: LossOfControlState["units"];
    readonly resourceAccounts: LossOfControlState["resourceAccounts"];
    readonly payroll: LossOfControlState["payroll"];
    readonly orders: LossOfControlState["orders"];
    readonly decisionEpisodes: LossOfControlState["decisionEpisodes"];
    readonly obedienceRecords: LossOfControlState["obedienceRecords"];
  };
};

export const lossOfControlIds = {
  ruler: "actor:ruler",
  chancellor: "actor:chancellor",
  commander: "actor:guard-commander",
  organization: "organization:imperial-guard",
  unit: "unit:palace-guard",
  palace: "location:imperial-palace",
  treasury: "location:central-treasury",
  payOffice: "location:military-pay-office",
  guardPayroll: "resource:guard-payroll",
  chancellorReserve: "resource:chancellor-reserve",
  fundingRelationship: "relationship:chancellor-funding-guard",
  firstDecision: "decision:control-round-1",
  secondDecision: "decision:control-round-2",
  firstRulerOrder: "order:round-1:ruler-hold-palace",
  firstChancellorOrder: "order:round-1:chancellor-secure-treasury",
  secondRulerOrder: "order:round-2:ruler-hold-palace",
  secondChancellorOrder: "order:round-2:chancellor-guard-pay-office",
  firstIntent: "intent:control-round-1",
  secondIntent: "intent:control-round-2",
} as const;

const ids = lossOfControlIds;

function initialRelationship(
  id: string,
  sourceId: string,
  targetId: string,
  kind: ControlRelationshipKind,
  strength: number,
): ControlRelationship {
  return {
    id,
    sourceId,
    targetId,
    kind,
    strength,
    history: [
      {
        strength,
        occurredAt: simTime(0),
        eventId: "initial-state",
        reason: "initial relationship",
      },
    ],
  };
}

const initialRelationships = [
  initialRelationship(
    "relationship:ruler-formal-command",
    ids.ruler,
    ids.commander,
    "formal_command",
    0.95,
  ),
  initialRelationship(
    "relationship:ruler-legal-recognition",
    ids.ruler,
    ids.organization,
    "legal_recognition",
    0.95,
  ),
  initialRelationship(
    "relationship:ruler-personal-loyalty",
    ids.ruler,
    ids.commander,
    "personal_loyalty",
    0.65,
  ),
  initialRelationship(
    ids.fundingRelationship,
    ids.chancellor,
    ids.organization,
    "funding",
    0.2,
  ),
  initialRelationship(
    "relationship:chancellor-appointment",
    ids.chancellor,
    ids.commander,
    "appointment",
    0.55,
  ),
  initialRelationship(
    "relationship:chancellor-influence",
    ids.chancellor,
    ids.commander,
    "informal_influence",
    0.35,
  ),
];

export const lossOfControlInitialState: LossOfControlState = {
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
      office: "Commander of the Imperial Guard",
    },
  },
  organizations: {
    [ids.organization]: {
      id: ids.organization,
      name: "Imperial Guard",
      kind: "military",
      formalAuthorityIds: [ids.ruler],
      memberIds: [ids.commander],
      assetIds: [ids.unit],
      resourceAccountIds: [ids.guardPayroll],
    },
  },
  relationships: Object.fromEntries(
    initialRelationships.map((relationship) => [relationship.id, relationship]),
  ),
  units: {
    [ids.unit]: {
      id: ids.unit,
      name: "Palace Guard",
      organizationId: ids.organization,
      commanderId: ids.commander,
      locationId: ids.palace,
      accessibleLocationIds: [ids.palace, ids.treasury, ids.payOffice],
    },
  },
  resourceAccounts: {
    [ids.guardPayroll]: {
      id: ids.guardPayroll,
      ownerId: ids.organization,
      kind: "money",
      balance: 0,
    },
    [ids.chancellorReserve]: {
      id: ids.chancellorReserve,
      ownerId: ids.chancellor,
      kind: "money",
      balance: 150,
    },
  },
  payroll: {
    organizationId: ids.organization,
    accountId: ids.guardPayroll,
    arrears: 100,
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
  obedienceRecords: [],
};

export const lossOfControlModel: DomainModel<LossOfControlState> = {
  resolveBatch({ events, state, time }) {
    const committed: DomainEventDraft[] = [];
    const scheduled: ScheduledEventDraft[] = [];
    const arrivingOrders = events
      .filter((event) => {
        if (event.eventType !== "message.arrive") return false;
        return (
          getMessage(state, String(event.payload.messageId)).kind === "order"
        );
      })
      .sort((left, right) => left.id.localeCompare(right.id));

    if (arrivingOrders.length > 0) {
      const firstArrival = arrivingOrders[0];
      if (!firstArrival)
        throw new Error("Arrival batch unexpectedly became empty");
      const orderIds: string[] = [];
      for (const event of arrivingOrders) {
        const message = getMessage(state, String(event.payload.messageId));
        if (!message.orderId)
          throw new Error(`Order message ${message.id} has no order`);
        const order = getOrder(state, message.orderId);
        orderIds.push(order.id);
        committed.push(
          messageStatusDraft(message, "message.arrived", event.id),
          orderStatusDraft(order.id, "received", event.id),
          observationDraft({
            id: `observation:${message.id}`,
            actorId: message.recipientId,
            sourceType: "order",
            sourceId: order.id,
            subjectRefs: [order.id, order.organizationId, order.unitId],
            payload: { order: orderJson(order) },
            cause: event.id,
          }),
        );
      }
      const firstOrder = getOrder(state, orderIds[0] ?? "");
      scheduled.push({
        eventType: "decision.open",
        scheduledAt: addSimTime(time, 5),
        actorId: ids.commander,
        causalEventId: firstArrival.id,
        payload: {
          decisionEpisodeId:
            firstOrder.round === 1 ? ids.firstDecision : ids.secondDecision,
          round: firstOrder.round,
          orderIds: orderIds.sort(),
        },
      });
    }

    for (const event of events) {
      if (arrivingOrders.some((arrival) => arrival.id === event.id)) continue;
      switch (event.eventType) {
        case "authority.issue_order": {
          const orderId = String(event.payload.orderId);
          const issuerId = String(event.payload.issuerId);
          const messageId = String(event.payload.messageId);
          committed.push(
            {
              eventType: "order.created",
              actorId: issuerId,
              targetIds: [ids.commander, ids.organization, ids.unit],
              causalEventId: event.id,
              payload: {
                orderId,
                round: Number(event.payload.round),
                issuerId,
                recipientId: ids.commander,
                organizationId: ids.organization,
                unitId: ids.unit,
                objective: String(event.payload.objective),
                targetLocationId: String(event.payload.targetLocationId),
              },
            },
            messageCreatedDraft({
              id: messageId,
              senderId: issuerId,
              recipientId: ids.commander,
              kind: "order",
              travelTime: Number(event.payload.travelTime),
              orderId,
              cause: event.id,
            }),
          );
          scheduled.push(
            messageDeparture(messageId, addSimTime(time, 5), event.id),
          );
          break;
        }

        case "message.depart": {
          const message = getMessage(state, String(event.payload.messageId));
          committed.push(
            messageStatusDraft(message, "message.departed", event.id),
          );
          if (message.kind === "order" && message.orderId) {
            committed.push(orderStatusDraft(message.orderId, "sent", event.id));
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
          if (message.kind !== "decision_report" || !message.reportId) {
            throw new Error(`Unexpected arriving message ${message.id}`);
          }
          const report = getReport(state, message.reportId);
          committed.push(
            messageStatusDraft(message, "message.arrived", event.id),
            observationDraft({
              id: `observation:${message.id}`,
              actorId: message.recipientId,
              sourceType: "decision_report",
              sourceId: report.id,
              subjectRefs: [
                report.subjectOrderId,
                report.selectedOrderId,
                ids.organization,
              ],
              payload: { report: reportJson(report) },
              cause: event.id,
            }),
          );
          break;
        }

        case "organization.fund_payroll": {
          const amount = Number(event.payload.amount);
          const source = getAccount(state, ids.chancellorReserve);
          const target = getAccount(state, ids.guardPayroll);
          const relation = getRelationship(state, ids.fundingRelationship);
          if (amount > source.balance || amount > state.payroll.arrears) {
            throw new Error(
              "Payroll transfer exceeds available money or arrears",
            );
          }
          const dependenceGain =
            state.payroll.arrears === 0
              ? 0
              : (amount / state.payroll.arrears) * 0.75;
          const newStrength = rounded(
            Math.min(1, relation.strength + dependenceGain),
          );
          committed.push(
            {
              eventType: "resource.transferred",
              actorId: ids.chancellor,
              targetIds: [ids.organization],
              causalEventId: event.id,
              payload: {
                sourceAccountId: source.id,
                targetAccountId: target.id,
                amount,
              },
            },
            {
              eventType: "organization.payroll_updated",
              actorId: ids.chancellor,
              targetIds: [ids.organization],
              causalEventId: event.id,
              payload: {
                organizationId: ids.organization,
                arrearsPaid: amount,
              },
            },
            {
              eventType: "relationship.strength_changed",
              actorId: ids.chancellor,
              targetIds: [ids.organization],
              causalEventId: event.id,
              payload: {
                relationshipId: relation.id,
                previousStrength: relation.strength,
                newStrength,
                reason: "settled full guard payroll arrears",
              },
            },
            observationDraft({
              id: "observation:commander-payroll-settled",
              actorId: ids.commander,
              sourceType: "payroll_ledger",
              sourceId: ids.guardPayroll,
              subjectRefs: [ids.organization, ids.chancellor],
              payload: {
                payerId: ids.chancellor,
                amount,
                arrearsRemaining: state.payroll.arrears - amount,
              },
              cause: event.id,
            }),
          );
          break;
        }

        case "decision.open": {
          const orderIds = stringArray(event.payload.orderIds).sort();
          const observationIds = orderIds.map((orderId) => {
            const observation = Object.values(state.observations).find(
              (candidate) =>
                candidate.actorId === ids.commander &&
                candidate.sourceId === orderId,
            );
            if (!observation)
              throw new Error(`No commander observation for ${orderId}`);
            return observation.id;
          });
          committed.push({
            eventType: "decision.opened",
            actorId: ids.commander,
            causalEventId: event.id,
            payload: {
              decisionEpisodeId: String(event.payload.decisionEpisodeId),
              round: Number(event.payload.round),
              triggerObservationIds: observationIds,
              candidateOrderIds: orderIds,
              urgency: 0.9,
              expectedResolutionAt: addSimTime(time, 10),
            },
          });
          scheduled.push({
            eventType: "decision.resolve",
            scheduledAt: addSimTime(time, 10),
            actorId: ids.commander,
            causalEventId: event.id,
            payload: {
              decisionEpisodeId: String(event.payload.decisionEpisodeId),
            },
          });
          break;
        }

        case "decision.resolve": {
          const episode = getDecision(
            state,
            String(event.payload.decisionEpisodeId),
          );
          const evaluations = episode.candidateOrderIds
            .map((orderId) =>
              evaluateControlOrder(state, getOrder(state, orderId)),
            )
            .sort(
              (left, right) =>
                right.total - left.total ||
                left.orderId.localeCompare(right.orderId),
            );
          const winner = evaluations[0];
          if (!winner)
            throw new Error("Cannot resolve a decision without candidates");
          const selectedOrder = getOrder(state, winner.orderId);
          const intentId =
            episode.round === 1 ? ids.firstIntent : ids.secondIntent;
          const intent: Intent = {
            id: intentId,
            actorId: ids.commander,
            createdAt: time,
            goal: objectiveLabel(selectedOrder.objective),
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
                evaluations: evaluations.map(evaluationJson),
                intentId: intent.id,
              },
            },
            intentCreatedDraft(intent, event.id),
          );
          for (const orderId of episode.candidateOrderIds) {
            const order = getOrder(state, orderId);
            const obeyed = order.id === selectedOrder.id;
            const reportId = `report:round-${episode.round}:${order.issuerId}`;
            const messageId = `message:round-${episode.round}:report:${order.issuerId}`;
            committed.push(
              orderStatusDraft(
                order.id,
                obeyed ? "acknowledged" : "ignored",
                event.id,
              ),
              {
                eventType: "obedience.recorded",
                actorId: ids.commander,
                targetIds: [order.issuerId, ids.organization, ids.unit],
                causalEventId: event.id,
                causalDecisionEpisodeId: episode.id,
                payload: {
                  obedienceRecordId: `obedience:round-${episode.round}:${order.issuerId}`,
                  organizationId: ids.organization,
                  unitId: ids.unit,
                  decisionEpisodeId: episode.id,
                  orderId: order.id,
                  issuerId: order.issuerId,
                  obeyed,
                },
              },
              reportCreatedDraft({
                id: reportId,
                round: episode.round,
                recipientId: order.issuerId,
                subjectOrderId: order.id,
                selectedOrderId: selectedOrder.id,
                outcome: obeyed ? "obeyed" : "not_followed",
                ...(obeyed
                  ? {}
                  : { disclosedAlternativeOrderId: selectedOrder.id }),
                cause: event.id,
              }),
              messageCreatedDraft({
                id: messageId,
                senderId: ids.commander,
                recipientId: order.issuerId,
                kind: "decision_report",
                travelTime: 30,
                reportId,
                cause: event.id,
              }),
            );
            scheduled.push(
              messageDeparture(messageId, addSimTime(time, 5), event.id),
            );
          }
          scheduled.push({
            eventType: "operation.execute_intent",
            scheduledAt: addSimTime(time, 5),
            actorId: ids.commander,
            targetIds: [selectedOrder.unitId, selectedOrder.targetLocationId],
            causalEventId: event.id,
            causalDecisionEpisodeId: episode.id,
            payload: { intentId: intent.id },
          });
          break;
        }

        case "operation.execute_intent": {
          const intent = getIntent(state, String(event.payload.intentId));
          const unit = getUnit(state, String(intent.parameters.unitId));
          const targetLocationId = String(intent.parameters.targetLocationId);
          const orderId = String(intent.parameters.orderId);
          if (!unit.accessibleLocationIds.includes(targetLocationId)) {
            committed.push(orderStatusDraft(orderId, "failed", event.id));
            break;
          }
          committed.push(
            {
              eventType: "unit.moved",
              actorId: ids.commander,
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
            orderStatusDraft(orderId, "executed", event.id),
          );
          break;
        }

        default:
          throw new Error(`Unknown loss-of-control event: ${event.eventType}`);
      }
    }
    return { events: committed, scheduled };
  },

  reduce(state, event) {
    switch (event.eventType) {
      case "order.created": {
        const order: ControlOrder = {
          id: String(event.payload.orderId),
          round: Number(event.payload.round) as 1 | 2,
          issuerId: String(event.payload.issuerId),
          recipientId: String(event.payload.recipientId),
          organizationId: String(event.payload.organizationId),
          unitId: String(event.payload.unitId),
          objective: String(event.payload.objective) as ControlObjective,
          targetLocationId: String(event.payload.targetLocationId),
          status: "created",
          lifecycle: [lifecycleEntry("created", event)],
        };
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
        return updateMessage(
          state,
          String(event.payload.messageId),
          "in_transit",
        );
      case "message.arrived":
        return updateMessage(
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
      case "resource.transferred": {
        const source = getAccount(state, String(event.payload.sourceAccountId));
        const target = getAccount(state, String(event.payload.targetAccountId));
        const amount = Number(event.payload.amount);
        return {
          ...state,
          resourceAccounts: {
            ...state.resourceAccounts,
            [source.id]: { ...source, balance: source.balance - amount },
            [target.id]: { ...target, balance: target.balance + amount },
          },
        };
      }
      case "organization.payroll_updated":
        return {
          ...state,
          payroll: {
            ...state.payroll,
            arrears: state.payroll.arrears - Number(event.payload.arrearsPaid),
          },
        };
      case "relationship.strength_changed": {
        const relationship = getRelationship(
          state,
          String(event.payload.relationshipId),
        );
        const strength = Number(event.payload.newStrength);
        return {
          ...state,
          relationships: {
            ...state.relationships,
            [relationship.id]: {
              ...relationship,
              strength,
              history: [
                ...relationship.history,
                {
                  strength,
                  occurredAt: event.occurredAt,
                  eventId: event.id,
                  reason: String(event.payload.reason),
                },
              ],
            },
          },
        };
      }
      case "obedience.recorded": {
        const record: ObedienceRecord = {
          id: String(event.payload.obedienceRecordId),
          organizationId: String(event.payload.organizationId),
          unitId: String(event.payload.unitId),
          decisionEpisodeId: String(event.payload.decisionEpisodeId),
          orderId: String(event.payload.orderId),
          issuerId: String(event.payload.issuerId),
          obeyed: Boolean(event.payload.obeyed),
          occurredAt: event.occurredAt,
          eventId: event.id,
        };
        return {
          ...state,
          obedienceRecords: [...state.obedienceRecords, record],
        };
      }
      case "decision.opened": {
        const episode: ControlDecisionEpisode = {
          id: String(event.payload.decisionEpisodeId),
          actorId: event.actorId ?? ids.commander,
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
          round: Number(event.payload.round) as 1 | 2,
          candidateOrderIds: stringArray(event.payload.candidateOrderIds),
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
              selectedOrderId: String(event.payload.selectedOrderId),
              evaluations: evaluationsFromJson(event.payload.evaluations),
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
        throw new Error(
          `Unhandled domain event ${event.eventType} (${event.id})`,
        );
    }
  },

  validate(_before, after) {
    for (const organization of Object.values(after.organizations)) {
      for (const actorId of [
        ...organization.formalAuthorityIds,
        ...organization.memberIds,
      ]) {
        if (!after.actors[actorId])
          throw new Error(
            `${organization.id} refers to unknown actor ${actorId}`,
          );
      }
      for (const assetId of organization.assetIds) {
        if (!after.units[assetId])
          throw new Error(
            `${organization.id} refers to unknown asset ${assetId}`,
          );
      }
    }
    for (const relationship of Object.values(after.relationships)) {
      if (relationship.strength < 0 || relationship.strength > 1) {
        throw new Error(`${relationship.id} has invalid strength`);
      }
    }
    if (after.payroll.arrears < 0)
      throw new Error("Payroll arrears cannot be negative");
    for (const account of Object.values(after.resourceAccounts)) {
      if (account.balance < 0)
        throw new Error(`${account.id} cannot be overdrawn`);
    }
  },
};

export async function runLossOfControlScenario(
  runId = "emergent-loss-of-control-demo",
): Promise<LossOfControlRun> {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    lossOfControlInitialState,
    lossOfControlModel,
    store,
    runId,
  );
  for (const draft of scenarioSchedule()) await kernel.schedule(draft);

  let rulerViewAfterFirstDecision: LossOfControlActorView | undefined;
  let controlAfterFirstDecision: PracticalControlAssessment | undefined;
  while (await kernel.step()) {
    if (kernel.time === simTime(90)) {
      rulerViewAfterFirstDecision = lossOfControlActorView(
        kernel.state,
        ids.ruler,
      );
      controlAfterFirstDecision = assessPracticalControl(
        kernel.state,
        ids.organization,
      );
    }
  }
  if (!rulerViewAfterFirstDecision || !controlAfterFirstDecision) {
    throw new Error("Scenario did not reach the first control snapshot");
  }
  const state = kernel.state;
  return {
    state,
    records: await store.readAll(),
    rulerViewAfterFirstDecision,
    rulerViewFinal: lossOfControlActorView(state, ids.ruler),
    controlAfterFirstDecision,
    controlFinal: assessPracticalControl(state, ids.organization),
    debugTruth: lossOfControlDebugTruth(state),
  };
}

export function lossOfControlActorView(
  state: LossOfControlState,
  actorId: string,
): LossOfControlActorView {
  const actor = state.actors[actorId];
  if (!actor) throw new Error(`Unknown actor ${actorId}`);
  const organization = getOrganization(state, ids.organization);
  const observations = (state.actorObservationIds[actorId] ?? []).map(
    (observationId) => {
      const observation = state.observations[observationId];
      if (!observation) throw new Error(`Unknown observation ${observationId}`);
      return observation;
    },
  );
  const issuedOrders = Object.values(state.orders)
    .filter((order) => order.issuerId === actorId)
    .sort((left, right) => left.round - right.round)
    .map((order) => ({
      id: order.id,
      round: order.round,
      objective: order.objective,
      targetLocationId: order.targetLocationId,
    }));
  const reports = observations
    .map(reportFromObservation)
    .filter((report) => report !== undefined);
  const finalReport = reports.find((report) => report.round === 2);
  return structuredClone({
    actor,
    organization: {
      id: organization.id,
      name: organization.name,
      formalAuthorityIds: organization.formalAuthorityIds,
    },
    issuedOrders,
    observations,
    knownOutcome: finalReport
      ? "later_command_overruled"
      : reports.some(
            (report) => report.round === 1 && report.outcome === "obeyed",
          )
        ? "first_command_obeyed"
        : "awaiting_first_response",
    ...(finalReport?.disclosedAlternativeOrderId
      ? { disclosedAlternativeOrderId: finalReport.disclosedAlternativeOrderId }
      : {}),
  }) as LossOfControlActorView;
}

export function assessPracticalControl(
  state: LossOfControlState,
  organizationId: string,
): PracticalControlAssessment {
  const organization = getOrganization(state, organizationId);
  const candidateIds = [
    ...new Set(Object.values(state.relationships).map((item) => item.sourceId)),
  ].filter((actorId) => state.actors[actorId] !== undefined);
  const weights: Record<ControlRelationshipKind, number> = {
    formal_command: 0.8,
    legal_recognition: 0.5,
    funding: 1.5,
    appointment: 0.7,
    personal_loyalty: 0.8,
    informal_influence: 0.6,
    organizational_membership: 0.4,
  };
  const candidates = candidateIds
    .map((actorId): PracticalControlCandidate => {
      const relationships = Object.values(state.relationships).filter(
        (relationship) =>
          relationship.sourceId === actorId &&
          [
            organization.id,
            ...organization.memberIds,
            ...organization.assetIds,
          ].includes(relationship.targetId),
      );
      const relationshipSupport = rounded(
        relationships.reduce(
          (sum, relationship) =>
            sum + relationship.strength * weights[relationship.kind],
          0,
        ),
      );
      const latestRecord = state.obedienceRecords
        .filter(
          (record) =>
            record.organizationId === organizationId &&
            record.issuerId === actorId,
        )
        .sort((left, right) => right.occurredAt - left.occurredAt)[0];
      const obedienceScore = latestRecord
        ? latestRecord.obeyed
          ? 0.8
          : -0.4
        : 0;
      return {
        actorId,
        relationshipSupport,
        latestObedience: latestRecord
          ? latestRecord.obeyed
            ? "obeyed"
            : "not_obeyed"
          : "none",
        score: rounded(relationshipSupport + obedienceScore),
        evidenceIds: [
          ...relationships.map((relationship) => relationship.id),
          ...(latestRecord ? [latestRecord.id] : []),
        ],
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.actorId.localeCompare(right.actorId),
    );
  const leader = candidates[0];
  if (!leader) throw new Error(`No control candidates for ${organizationId}`);
  return {
    organizationId,
    formalAuthorityIds: organization.formalAuthorityIds,
    leadingActorId: leader.actorId,
    candidates,
  };
}

export function lossOfControlDebugTruth(
  state: LossOfControlState,
): LossOfControlRun["debugTruth"] {
  return structuredClone({
    organizations: state.organizations,
    relationships: state.relationships,
    units: state.units,
    resourceAccounts: state.resourceAccounts,
    payroll: state.payroll,
    orders: state.orders,
    decisionEpisodes: state.decisionEpisodes,
    obedienceRecords: state.obedienceRecords,
  }) as LossOfControlRun["debugTruth"];
}

export function evaluateControlOrder(
  state: LossOfControlState,
  order: ControlOrder,
): ControlOrderEvaluation {
  const weights: Record<ControlRelationshipKind, number> = {
    formal_command: 0.8,
    legal_recognition: 0.5,
    funding: 1.2,
    appointment: 0.7,
    personal_loyalty: 0.8,
    informal_influence: 0.6,
    organizational_membership: 0.4,
  };
  const organization = getOrganization(state, order.organizationId);
  const factors: ControlDecisionFactor[] = Object.values(state.relationships)
    .filter(
      (relationship) =>
        relationship.sourceId === order.issuerId &&
        [order.recipientId, organization.id, order.unitId].includes(
          relationship.targetId,
        ),
    )
    .map((relationship) => ({
      kind: relationship.kind,
      label: relationship.kind.replaceAll("_", " "),
      score: rounded(relationship.strength * weights[relationship.kind]),
      relationshipId: relationship.id,
    }));
  const missionFit: Record<ControlObjective, number> = {
    hold_imperial_palace: order.round === 1 ? 0.85 : 0.65,
    secure_treasury: 0.55,
    guard_military_pay_office: 0.9,
  };
  factors.push({
    kind: "mission_fit",
    label: `commander's perceived fit: ${objectiveLabel(order.objective)}`,
    score: missionFit[order.objective],
  });
  return {
    orderId: order.id,
    total: rounded(factors.reduce((sum, factor) => sum + factor.score, 0)),
    factors,
  };
}

function scenarioSchedule(): ScheduledEventDraft[] {
  return [
    issueOrder(
      0,
      1,
      ids.ruler,
      ids.firstRulerOrder,
      "hold_imperial_palace",
      ids.palace,
      35,
    ),
    issueOrder(
      10,
      1,
      ids.chancellor,
      ids.firstChancellorOrder,
      "secure_treasury",
      ids.treasury,
      25,
    ),
    {
      eventType: "organization.fund_payroll",
      scheduledAt: simTime(100),
      actorId: ids.chancellor,
      targetIds: [ids.organization],
      payload: { amount: 100 },
    },
    issueOrder(
      120,
      2,
      ids.ruler,
      ids.secondRulerOrder,
      "hold_imperial_palace",
      ids.palace,
      35,
    ),
    issueOrder(
      130,
      2,
      ids.chancellor,
      ids.secondChancellorOrder,
      "guard_military_pay_office",
      ids.payOffice,
      25,
    ),
  ];
}

function issueOrder(
  scheduledAt: number,
  round: 1 | 2,
  issuerId: string,
  orderId: string,
  objective: ControlObjective,
  targetLocationId: string,
  travelTime: number,
): ScheduledEventDraft {
  return {
    eventType: "authority.issue_order",
    scheduledAt: simTime(scheduledAt),
    actorId: issuerId,
    targetIds: [ids.commander, ids.organization, ids.unit],
    payload: {
      round,
      issuerId,
      orderId,
      objective,
      targetLocationId,
      messageId: `message:${orderId}`,
      travelTime,
    },
  };
}

function messageCreatedDraft(input: {
  id: string;
  senderId: string;
  recipientId: string;
  kind: ControlMessage["kind"];
  travelTime: number;
  orderId?: string;
  reportId?: string;
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
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.reportId ? { reportId: input.reportId } : {}),
    },
  };
}

function messageDeparture(
  messageId: string,
  scheduledAt: ReturnType<typeof simTime>,
  cause: string,
): ScheduledEventDraft {
  return {
    eventType: "message.depart",
    scheduledAt,
    causalEventId: cause,
    payload: { messageId },
  };
}

function messageStatusDraft(
  message: ControlMessage,
  eventType: "message.departed" | "message.arrived",
  cause: string,
): DomainEventDraft {
  return {
    eventType,
    actorId: message.senderId,
    targetIds: [message.recipientId],
    causalEventId: cause,
    payload: { messageId: message.id },
  };
}

function orderStatusDraft(
  orderId: string,
  status: OrderStatus,
  cause: string,
): DomainEventDraft {
  return {
    eventType: "order.status_changed",
    causalEventId: cause,
    payload: { orderId, status },
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

function reportCreatedDraft(input: {
  id: string;
  round: 1 | 2;
  recipientId: string;
  subjectOrderId: string;
  selectedOrderId: string;
  outcome: ControlDecisionReport["outcome"];
  disclosedAlternativeOrderId?: string;
  cause: string;
}): DomainEventDraft {
  return {
    eventType: "report.created",
    actorId: ids.commander,
    targetIds: [input.recipientId],
    causalEventId: input.cause,
    payload: {
      reportId: input.id,
      round: input.round,
      authorId: ids.commander,
      recipientId: input.recipientId,
      subjectOrderId: input.subjectOrderId,
      selectedOrderId: input.selectedOrderId,
      outcome: input.outcome,
      ...(input.disclosedAlternativeOrderId
        ? { disclosedAlternativeOrderId: input.disclosedAlternativeOrderId }
        : {}),
    },
  };
}

function intentCreatedDraft(intent: Intent, cause: string): DomainEventDraft {
  return {
    eventType: "intent.created",
    actorId: intent.actorId,
    causalEventId: cause,
    causalDecisionEpisodeId: intent.causalDecisionEpisodeId,
    payload: { intent: intent as unknown as JsonValue },
  };
}

function lifecycleEntry(
  status: OrderStatus,
  event: DomainEvent,
): OrderLifecycleEntry {
  return { status, occurredAt: event.occurredAt, eventId: event.id };
}

function messageFromEvent(event: DomainEvent): ControlMessage {
  return {
    id: String(event.payload.messageId),
    senderId: String(event.payload.senderId),
    recipientId: String(event.payload.recipientId),
    kind: String(event.payload.kind) as ControlMessage["kind"],
    travelTime: Number(event.payload.travelTime),
    ...(event.payload.orderId
      ? { orderId: String(event.payload.orderId) }
      : {}),
    ...(event.payload.reportId
      ? { reportId: String(event.payload.reportId) }
      : {}),
    status: "draft",
  };
}

function reportFromEvent(event: DomainEvent): ControlDecisionReport {
  return {
    id: String(event.payload.reportId),
    round: Number(event.payload.round) as 1 | 2,
    authorId: String(event.payload.authorId),
    recipientId: String(event.payload.recipientId),
    subjectOrderId: String(event.payload.subjectOrderId),
    selectedOrderId: String(event.payload.selectedOrderId),
    outcome: String(event.payload.outcome) as ControlDecisionReport["outcome"],
    ...(event.payload.disclosedAlternativeOrderId
      ? {
          disclosedAlternativeOrderId: String(
            event.payload.disclosedAlternativeOrderId,
          ),
        }
      : {}),
  };
}

function recordObservation(
  state: LossOfControlState,
  event: DomainEvent,
): LossOfControlState {
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

function intentFromEvent(event: DomainEvent): Intent {
  return structuredClone(
    objectValue(event.payload.intent),
  ) as unknown as Intent;
}

function updateMessage(
  state: LossOfControlState,
  messageId: string,
  status: ControlMessage["status"],
): LossOfControlState {
  const message = getMessage(state, messageId);
  return {
    ...state,
    messages: { ...state.messages, [message.id]: { ...message, status } },
  };
}

function orderJson(order: ControlOrder): JsonObject {
  return {
    id: order.id,
    round: order.round,
    issuerId: order.issuerId,
    organizationId: order.organizationId,
    unitId: order.unitId,
    objective: order.objective,
    targetLocationId: order.targetLocationId,
  };
}

function reportJson(report: ControlDecisionReport): JsonObject {
  return {
    id: report.id,
    round: report.round,
    authorId: report.authorId,
    recipientId: report.recipientId,
    subjectOrderId: report.subjectOrderId,
    selectedOrderId: report.selectedOrderId,
    outcome: report.outcome,
    ...(report.disclosedAlternativeOrderId
      ? { disclosedAlternativeOrderId: report.disclosedAlternativeOrderId }
      : {}),
  };
}

function evaluationJson(evaluation: ControlOrderEvaluation): JsonObject {
  return {
    orderId: evaluation.orderId,
    total: evaluation.total,
    factors: evaluation.factors.map((factor) => ({
      kind: factor.kind,
      label: factor.label,
      score: factor.score,
      ...(factor.relationshipId
        ? { relationshipId: factor.relationshipId }
        : {}),
    })),
  };
}

function evaluationsFromJson(
  value: JsonValue | undefined,
): ControlOrderEvaluation[] {
  if (!Array.isArray(value))
    throw new Error("Decision evaluations must be an array");
  return value.map((item) => {
    const object = objectValue(item);
    if (!Array.isArray(object.factors))
      throw new Error("Decision factors must be an array");
    const rawFactors = object.factors;
    return {
      orderId: String(object.orderId),
      total: Number(object.total),
      factors: rawFactors.map((factor) => {
        const factorObject = objectValue(factor);
        return {
          kind: String(factorObject.kind) as ControlDecisionFactor["kind"],
          label: String(factorObject.label),
          score: Number(factorObject.score),
          ...(factorObject.relationshipId
            ? { relationshipId: String(factorObject.relationshipId) }
            : {}),
        };
      }),
    };
  });
}

function reportFromObservation(
  observation: Observation,
): ControlDecisionReport | undefined {
  if (observation.sourceType !== "decision_report") return undefined;
  const value = objectValue(observation.payload.report);
  if (Object.keys(value).length === 0) return undefined;
  return {
    id: String(value.id),
    round: Number(value.round) as 1 | 2,
    authorId: String(value.authorId),
    recipientId: String(value.recipientId),
    subjectOrderId: String(value.subjectOrderId),
    selectedOrderId: String(value.selectedOrderId),
    outcome: String(value.outcome) as ControlDecisionReport["outcome"],
    ...(value.disclosedAlternativeOrderId
      ? {
          disclosedAlternativeOrderId: String(
            value.disclosedAlternativeOrderId,
          ),
        }
      : {}),
  };
}

function objectiveLabel(objective: ControlObjective): string {
  return {
    hold_imperial_palace: "Hold the Imperial Palace",
    secure_treasury: "Secure the Central Treasury",
    guard_military_pay_office: "Guard the Military Pay Office",
  }[objective];
}

function rounded(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function getOrganization(state: LossOfControlState, id: string): Organization {
  const value = state.organizations[id];
  if (!value) throw new Error(`Unknown organization ${id}`);
  return value;
}

function getRelationship(
  state: LossOfControlState,
  id: string,
): ControlRelationship {
  const value = state.relationships[id];
  if (!value) throw new Error(`Unknown relationship ${id}`);
  return value;
}

function getUnit(state: LossOfControlState, id: string): ControlUnit {
  const value = state.units[id];
  if (!value) throw new Error(`Unknown unit ${id}`);
  return value;
}

function getAccount(
  state: LossOfControlState,
  id: string,
): ControlResourceAccount {
  const value = state.resourceAccounts[id];
  if (!value) throw new Error(`Unknown resource account ${id}`);
  return value;
}

function getOrder(state: LossOfControlState, id: string): ControlOrder {
  const value = state.orders[id];
  if (!value) throw new Error(`Unknown order ${id}`);
  return value;
}

function getMessage(state: LossOfControlState, id: string): ControlMessage {
  const value = state.messages[id];
  if (!value) throw new Error(`Unknown message ${id}`);
  return value;
}

function getReport(
  state: LossOfControlState,
  id: string,
): ControlDecisionReport {
  const value = state.reports[id];
  if (!value) throw new Error(`Unknown report ${id}`);
  return value;
}

function getDecision(
  state: LossOfControlState,
  id: string,
): ControlDecisionEpisode {
  const value = state.decisionEpisodes[id];
  if (!value) throw new Error(`Unknown decision episode ${id}`);
  return value;
}

function getIntent(state: LossOfControlState, id: string): Intent {
  const value = state.intents[id];
  if (!value) throw new Error(`Unknown intent ${id}`);
  return value;
}

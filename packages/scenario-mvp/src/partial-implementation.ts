import {
  addSimTime,
  simTime,
  type DomainEvent,
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

export type ResourceAccount = {
  readonly id: string;
  readonly name: string;
  readonly resource: "grain";
  readonly balance: number;
};

export type GrainTransferOrder = {
  readonly id: string;
  readonly issuerId: string;
  readonly recipientId: string;
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly requestedAmount: number;
  readonly fulfilledAmount: number;
  readonly actualStatus: OrderStatus;
  readonly reportedStatus?: "reported_complete";
  readonly reportedFulfilledAmount?: number;
  readonly lifecycle: readonly OrderLifecycleEntry[];
};

export type GrainTransfer = {
  readonly id: string;
  readonly orderId: string;
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly amount: number;
  readonly limitedBy?: "administrative_capacity" | "available_stock";
};

export type OrderReport = {
  readonly id: string;
  readonly authorId: string;
  readonly orderId: string;
  readonly basis: "administrative_return" | "independent_audit";
  readonly claimedStatus: "reported_complete" | "partially_executed";
  readonly claimedFulfilledAmount: number;
};

export type OrderMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly kind: "order" | "acknowledgement" | "report";
  readonly orderId: string;
  readonly reportId?: string;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type OrderInvestigation = {
  readonly id: string;
  readonly inspectorId: string;
  readonly orderId: string;
  readonly status: "started" | "completed";
};

export type PartialImplementationState = {
  readonly actors: Readonly<
    Record<string, ScenarioActor & { readonly grainTransferCapacity?: number }>
  >;
  readonly accounts: Readonly<Record<string, ResourceAccount>>;
  readonly orders: Readonly<Record<string, GrainTransferOrder>>;
  readonly transfers: Readonly<Record<string, GrainTransfer>>;
  readonly reports: Readonly<Record<string, OrderReport>>;
  readonly messages: Readonly<Record<string, OrderMessage>>;
  readonly investigations: Readonly<Record<string, OrderInvestigation>>;
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
};

export type KnownOrder = {
  readonly id: string;
  readonly requestedAmount: number;
  readonly knownStatus:
    "sent" | "acknowledged" | "reported_complete" | "disputed";
  readonly reportedFulfilledAmount?: number;
  readonly verifiedFulfilledAmount?: number;
};

export type PartialImplementationActorView = {
  readonly actor: ScenarioActor;
  readonly observations: readonly Observation[];
  readonly order: KnownOrder;
};

export type PartialImplementationRun = {
  readonly state: PartialImplementationState;
  readonly records: readonly SimulationRecord[];
  readonly rulerViewBeforeAudit: PartialImplementationActorView;
  readonly rulerViewAfterAudit: PartialImplementationActorView;
  readonly debugTruth: {
    readonly accounts: PartialImplementationState["accounts"];
    readonly orders: PartialImplementationState["orders"];
    readonly transfers: PartialImplementationState["transfers"];
    readonly reports: PartialImplementationState["reports"];
  };
};

export const partialImplementationIds = {
  ruler: "actor:ruler",
  governor: "actor:north-governor",
  inspector: "actor:inspector",
  northernGranary: "account:northern-granary",
  capitalGranary: "account:capital-granary",
  order: "order:grain-relief",
  orderMessage: "message:grain-relief-order",
  acknowledgementMessage: "message:grain-relief-acknowledgement",
  transfer: "transfer:grain-relief-partial",
  completionReport: "report:grain-relief-complete",
  completionMessage: "message:grain-relief-complete",
  investigation: "investigation:grain-relief-audit",
  auditReport: "report:grain-relief-audit",
  auditMessage: "message:grain-relief-audit",
} as const;

const ids = partialImplementationIds;

export const partialImplementationInitialState: PartialImplementationState = {
  actors: {
    [ids.ruler]: { id: ids.ruler, name: "The Ruler", office: "Sovereign" },
    [ids.governor]: {
      id: ids.governor,
      name: "Governor Ren",
      office: "Northern Governor",
      grainTransferCapacity: 150,
    },
    [ids.inspector]: {
      id: ids.inspector,
      name: "Inspector Lin",
      office: "Granary Inspector",
    },
  },
  accounts: {
    [ids.northernGranary]: {
      id: ids.northernGranary,
      name: "Northern Provincial Granary",
      resource: "grain",
      balance: 1_000,
    },
    [ids.capitalGranary]: {
      id: ids.capitalGranary,
      name: "Capital Relief Granary",
      resource: "grain",
      balance: 100,
    },
  },
  orders: {},
  transfers: {},
  reports: {},
  messages: {},
  investigations: {},
  observations: {},
  actorObservationIds: {
    [ids.ruler]: [],
    [ids.governor]: [],
    [ids.inspector]: [],
  },
};

export const partialImplementationModel: DomainModel<PartialImplementationState> =
  {
    resolveBatch({ events, state, time }) {
      const committed: DomainEventDraft[] = [];
      const scheduled: ScheduledEventDraft[] = [];

      for (const event of events) {
        switch (event.eventType) {
          case "ruler.issue_grain_order": {
            committed.push(
              {
                eventType: "order.created",
                actorId: ids.ruler,
                targetIds: [ids.governor],
                causalEventId: event.id,
                payload: {
                  orderId: ids.order,
                  issuerId: ids.ruler,
                  recipientId: ids.governor,
                  fromAccountId: ids.northernGranary,
                  toAccountId: ids.capitalGranary,
                  requestedAmount: 400,
                },
              },
              messageCreated({
                messageId: ids.orderMessage,
                senderId: ids.ruler,
                recipientId: ids.governor,
                kind: "order",
                orderId: ids.order,
                causalEventId: event.id,
              }),
            );
            scheduled.push(
              scheduleMessageDeparture(
                ids.orderMessage,
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
            if (message.kind === "order") {
              committed.push(
                orderStatusChanged(message.orderId, "sent", event),
              );
            }
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
            committed.push({
              eventType: "message.arrived",
              actorId: message.senderId,
              targetIds: [message.recipientId],
              causalEventId: event.id,
              payload: { messageId: message.id },
            });

            if (message.kind === "order") {
              committed.push(
                orderStatusChanged(message.orderId, "received", event),
                observationRecorded({
                  observationId: `observation:${message.id}`,
                  actorId: message.recipientId,
                  sourceType: "order",
                  sourceId: message.orderId,
                  subjectRefs: [message.orderId],
                  payload: { orderId: message.orderId },
                  causalEventId: event.id,
                }),
              );
              scheduled.push({
                eventType: "order.acknowledge",
                scheduledAt: addSimTime(time, 10),
                actorId: message.recipientId,
                targetIds: [ids.ruler],
                causalEventId: event.id,
                payload: { orderId: message.orderId },
              });
            } else {
              const payload: JsonObject = {
                kind: message.kind,
                orderId: message.orderId,
                ...(message.reportId === undefined
                  ? {}
                  : {
                      report: reportAsJson(
                        requiredReport(state, message.reportId),
                      ),
                    }),
              };
              committed.push(
                observationRecorded({
                  observationId: `observation:${message.id}`,
                  actorId: message.recipientId,
                  sourceType: message.kind,
                  sourceId: message.reportId ?? message.orderId,
                  subjectRefs: [message.orderId],
                  payload,
                  causalEventId: event.id,
                }),
              );
            }
            break;
          }

          case "order.acknowledge": {
            const order = requiredOrder(state, String(event.payload.orderId));
            committed.push(
              orderStatusChanged(order.id, "acknowledged", event),
              messageCreated({
                messageId: ids.acknowledgementMessage,
                senderId: order.recipientId,
                recipientId: order.issuerId,
                kind: "acknowledgement",
                orderId: order.id,
                causalEventId: event.id,
              }),
            );
            scheduled.push(
              scheduleMessageDeparture(
                ids.acknowledgementMessage,
                addSimTime(time, 10),
                event.id,
              ),
              {
                eventType: "order.implement",
                scheduledAt: addSimTime(time, 20),
                actorId: order.recipientId,
                targetIds: [order.toAccountId],
                causalEventId: event.id,
                payload: { orderId: order.id },
              },
            );
            break;
          }

          case "order.implement": {
            const order = requiredOrder(state, String(event.payload.orderId));
            const governor = state.actors[order.recipientId];
            const source = requiredAccount(state, order.fromAccountId);
            const capacity = governor?.grainTransferCapacity ?? 0;
            const actualAmount = Math.min(
              order.requestedAmount,
              source.balance,
              capacity,
            );
            const limitedBy =
              source.balance < capacity
                ? "available_stock"
                : "administrative_capacity";
            committed.push(
              {
                eventType: "resource.transferred",
                actorId: order.recipientId,
                targetIds: [order.fromAccountId, order.toAccountId],
                causalEventId: event.id,
                payload: {
                  transferId: ids.transfer,
                  orderId: order.id,
                  fromAccountId: order.fromAccountId,
                  toAccountId: order.toAccountId,
                  amount: actualAmount,
                  limitedBy,
                },
              },
              orderStatusChanged(
                order.id,
                actualAmount === order.requestedAmount
                  ? "executed"
                  : "partially_executed",
                event,
                { fulfilledAmount: actualAmount },
              ),
            );
            scheduled.push({
              eventType: "governor.report_completion",
              scheduledAt: addSimTime(time, 10),
              actorId: order.recipientId,
              targetIds: [order.issuerId],
              causalEventId: event.id,
              payload: { orderId: order.id },
            });
            break;
          }

          case "governor.report_completion": {
            const order = requiredOrder(state, String(event.payload.orderId));
            committed.push(
              reportCreated({
                reportId: ids.completionReport,
                authorId: order.recipientId,
                orderId: order.id,
                basis: "administrative_return",
                claimedStatus: "reported_complete",
                claimedFulfilledAmount: order.requestedAmount,
                causalEventId: event.id,
              }),
              {
                eventType: "order.reported_complete",
                actorId: order.recipientId,
                targetIds: [order.issuerId],
                causalEventId: event.id,
                payload: {
                  orderId: order.id,
                  reportedFulfilledAmount: order.requestedAmount,
                },
              },
              messageCreated({
                messageId: ids.completionMessage,
                senderId: order.recipientId,
                recipientId: order.issuerId,
                kind: "report",
                orderId: order.id,
                reportId: ids.completionReport,
                causalEventId: event.id,
              }),
            );
            scheduled.push(
              scheduleMessageDeparture(
                ids.completionMessage,
                addSimTime(time, 10),
                event.id,
              ),
            );
            break;
          }

          case "investigation.begin": {
            committed.push({
              eventType: "investigation.started",
              actorId: ids.inspector,
              targetIds: [ids.order],
              causalEventId: event.id,
              payload: {
                investigationId: ids.investigation,
                inspectorId: ids.inspector,
                orderId: ids.order,
              },
            });
            scheduled.push({
              eventType: "investigation.complete",
              scheduledAt: addSimTime(time, 60),
              actorId: ids.inspector,
              targetIds: [ids.order],
              causalEventId: event.id,
              payload: { investigationId: ids.investigation },
            });
            break;
          }

          case "investigation.complete": {
            const investigation = requiredInvestigation(
              state,
              String(event.payload.investigationId),
            );
            const order = requiredOrder(state, investigation.orderId);
            committed.push(
              {
                eventType: "investigation.completed",
                actorId: investigation.inspectorId,
                targetIds: [order.id],
                causalEventId: event.id,
                payload: { investigationId: investigation.id },
              },
              reportCreated({
                reportId: ids.auditReport,
                authorId: investigation.inspectorId,
                orderId: order.id,
                basis: "independent_audit",
                claimedStatus:
                  order.fulfilledAmount === order.requestedAmount
                    ? "reported_complete"
                    : "partially_executed",
                claimedFulfilledAmount: order.fulfilledAmount,
                causalEventId: event.id,
              }),
              messageCreated({
                messageId: ids.auditMessage,
                senderId: investigation.inspectorId,
                recipientId: order.issuerId,
                kind: "report",
                orderId: order.id,
                reportId: ids.auditReport,
                causalEventId: event.id,
              }),
            );
            scheduled.push(
              scheduleMessageDeparture(
                ids.auditMessage,
                addSimTime(time, 10),
                event.id,
              ),
            );
            break;
          }

          default:
            throw new Error(
              `Unknown partial-implementation event type: ${event.eventType}`,
            );
        }
      }

      return { events: committed, scheduled };
    },

    reduce(state, event) {
      switch (event.eventType) {
        case "order.created": {
          const order: GrainTransferOrder = {
            id: String(event.payload.orderId),
            issuerId: String(event.payload.issuerId),
            recipientId: String(event.payload.recipientId),
            fromAccountId: String(event.payload.fromAccountId),
            toAccountId: String(event.payload.toAccountId),
            requestedAmount: Number(event.payload.requestedAmount),
            fulfilledAmount: 0,
            actualStatus: "created",
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
                actualStatus: status,
                fulfilledAmount:
                  event.payload.fulfilledAmount === undefined
                    ? order.fulfilledAmount
                    : Number(event.payload.fulfilledAmount),
                lifecycle: [...order.lifecycle, lifecycleEntry(status, event)],
              },
            },
          };
        }
        case "order.reported_complete": {
          const order = requiredOrder(state, String(event.payload.orderId));
          return {
            ...state,
            orders: {
              ...state.orders,
              [order.id]: {
                ...order,
                reportedStatus: "reported_complete",
                reportedFulfilledAmount: Number(
                  event.payload.reportedFulfilledAmount,
                ),
                lifecycle: [
                  ...order.lifecycle,
                  lifecycleEntry("reported_complete", event),
                ],
              },
            },
          };
        }
        case "resource.transferred":
          return applyTransfer(state, event);
        case "report.created": {
          const report = reportFromEvent(event);
          return {
            ...state,
            reports: { ...state.reports, [report.id]: report },
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
        case "investigation.started": {
          const investigation: OrderInvestigation = {
            id: String(event.payload.investigationId),
            inspectorId: String(event.payload.inspectorId),
            orderId: String(event.payload.orderId),
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
          const investigation = requiredInvestigation(
            state,
            String(event.payload.investigationId),
          );
          return {
            ...state,
            investigations: {
              ...state.investigations,
              [investigation.id]: { ...investigation, status: "completed" },
            },
          };
        }
        case "observation.recorded":
          return recordObservation(state, event);
        default:
          throw new Error(
            `Unhandled domain event ${event.eventType} (${event.id})`,
          );
      }
    },

    validate(before, after) {
      const beforeTotal = totalGrain(before);
      const afterTotal = totalGrain(after);
      if (beforeTotal !== afterTotal) {
        throw new Error(
          `Grain was not conserved: ${beforeTotal} -> ${afterTotal}`,
        );
      }
      for (const account of Object.values(after.accounts)) {
        if (account.balance < 0) {
          throw new Error(`Account ${account.id} has a negative balance`);
        }
      }
      for (const order of Object.values(after.orders)) {
        if (order.fulfilledAmount > order.requestedAmount) {
          throw new Error(`Order ${order.id} was over-fulfilled`);
        }
      }
      for (const message of Object.values(after.messages)) {
        if (
          !after.actors[message.senderId] ||
          !after.actors[message.recipientId]
        ) {
          throw new Error(`Message ${message.id} refers to an unknown actor`);
        }
        if (!after.orders[message.orderId]) {
          throw new Error(`Message ${message.id} refers to an unknown order`);
        }
      }
    },
  };

export async function runPartialImplementationScenario(
  runId = "partial-implementation-demo",
): Promise<PartialImplementationRun> {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    partialImplementationInitialState,
    partialImplementationModel,
    store,
    runId,
  );

  await kernel.schedule({
    eventType: "ruler.issue_grain_order",
    scheduledAt: simTime(0),
    actorId: ids.ruler,
    targetIds: [ids.governor],
    payload: {},
  });
  await kernel.schedule({
    eventType: "investigation.begin",
    scheduledAt: simTime(200),
    actorId: ids.inspector,
    targetIds: [ids.order],
    payload: {},
  });

  let rulerViewBeforeAudit: PartialImplementationActorView | undefined;
  while (await kernel.step()) {
    if (kernel.time === simTime(180)) {
      rulerViewBeforeAudit = partialImplementationActorView(
        kernel.state,
        ids.ruler,
      );
    }
  }
  if (!rulerViewBeforeAudit) {
    throw new Error("Scenario did not reach the pre-audit ruler view");
  }

  const state = kernel.state;
  return {
    state,
    records: await store.readAll(),
    rulerViewBeforeAudit,
    rulerViewAfterAudit: partialImplementationActorView(state, ids.ruler),
    debugTruth: partialImplementationDebugTruth(state),
  };
}

export function partialImplementationActorView(
  state: PartialImplementationState,
  actorId: string,
): PartialImplementationActorView {
  const actor = state.actors[actorId];
  if (!actor) throw new Error(`Unknown actor: ${actorId}`);
  const observationIds = state.actorObservationIds[actorId] ?? [];
  const observations = observationIds.map((id) => {
    const observation = state.observations[id];
    if (!observation) throw new Error(`Unknown observation: ${id}`);
    return observation;
  });
  const administrativeReport = observations
    .map(reportFromObservation)
    .find((report) => report?.basis === "administrative_return");
  const auditReport = observations
    .map(reportFromObservation)
    .find((report) => report?.basis === "independent_audit");
  const acknowledged = observations.some(
    (observation) => observation.sourceType === "acknowledgement",
  );

  return structuredClone({
    actor,
    observations,
    order: {
      id: ids.order,
      requestedAmount: 400,
      knownStatus: auditReport
        ? "disputed"
        : administrativeReport
          ? "reported_complete"
          : acknowledged
            ? "acknowledged"
            : "sent",
      ...(administrativeReport === undefined
        ? {}
        : {
            reportedFulfilledAmount:
              administrativeReport.claimedFulfilledAmount,
          }),
      ...(auditReport === undefined
        ? {}
        : { verifiedFulfilledAmount: auditReport.claimedFulfilledAmount }),
    },
  }) as PartialImplementationActorView;
}

export function partialImplementationDebugTruth(
  state: PartialImplementationState,
): PartialImplementationRun["debugTruth"] {
  return structuredClone({
    accounts: state.accounts,
    orders: state.orders,
    transfers: state.transfers,
    reports: state.reports,
  }) as PartialImplementationRun["debugTruth"];
}

function orderStatusChanged(
  orderId: string,
  status: OrderStatus,
  cause: { readonly id: string },
  extra: JsonObject = {},
): DomainEventDraft {
  return {
    eventType: "order.status_changed",
    causalEventId: cause.id,
    payload: { orderId, status, ...extra },
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
  kind: OrderMessage["kind"];
  orderId: string;
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
      orderId: input.orderId,
      ...(input.reportId === undefined ? {} : { reportId: input.reportId }),
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

function reportCreated(input: {
  reportId: string;
  authorId: string;
  orderId: string;
  basis: OrderReport["basis"];
  claimedStatus: OrderReport["claimedStatus"];
  claimedFulfilledAmount: number;
  causalEventId: string;
}): DomainEventDraft {
  return {
    eventType: "report.created",
    actorId: input.authorId,
    targetIds: [input.orderId],
    causalEventId: input.causalEventId,
    payload: {
      reportId: input.reportId,
      authorId: input.authorId,
      orderId: input.orderId,
      basis: input.basis,
      claimedStatus: input.claimedStatus,
      claimedFulfilledAmount: input.claimedFulfilledAmount,
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

function requiredOrder(
  state: PartialImplementationState,
  id: string,
): GrainTransferOrder {
  const order = state.orders[id];
  if (!order) throw new Error(`Unknown order: ${id}`);
  return order;
}

function requiredAccount(
  state: PartialImplementationState,
  id: string,
): ResourceAccount {
  const account = state.accounts[id];
  if (!account) throw new Error(`Unknown account: ${id}`);
  return account;
}

function requiredMessage(
  state: PartialImplementationState,
  id: string,
): OrderMessage {
  const message = state.messages[id];
  if (!message) throw new Error(`Unknown message: ${id}`);
  return message;
}

function requiredReport(
  state: PartialImplementationState,
  id: string,
): OrderReport {
  const report = state.reports[id];
  if (!report) throw new Error(`Unknown report: ${id}`);
  return report;
}

function requiredInvestigation(
  state: PartialImplementationState,
  id: string,
): OrderInvestigation {
  const investigation = state.investigations[id];
  if (!investigation) throw new Error(`Unknown investigation: ${id}`);
  return investigation;
}

function messageFromEvent(event: DomainEvent): OrderMessage {
  return {
    id: String(event.payload.messageId),
    senderId: String(event.payload.senderId),
    recipientId: String(event.payload.recipientId),
    kind: String(event.payload.kind) as OrderMessage["kind"],
    orderId: String(event.payload.orderId),
    ...(event.payload.reportId === undefined
      ? {}
      : { reportId: String(event.payload.reportId) }),
    status: "draft",
  };
}

function reportFromEvent(event: DomainEvent): OrderReport {
  return {
    id: String(event.payload.reportId),
    authorId: String(event.payload.authorId),
    orderId: String(event.payload.orderId),
    basis: String(event.payload.basis) as OrderReport["basis"],
    claimedStatus: String(
      event.payload.claimedStatus,
    ) as OrderReport["claimedStatus"],
    claimedFulfilledAmount: Number(event.payload.claimedFulfilledAmount),
  };
}

function reportAsJson(report: OrderReport): JsonObject {
  return {
    id: report.id,
    authorId: report.authorId,
    orderId: report.orderId,
    basis: report.basis,
    claimedStatus: report.claimedStatus,
    claimedFulfilledAmount: report.claimedFulfilledAmount,
  };
}

function reportFromObservation(
  observation: Observation,
): OrderReport | undefined {
  const value = observation.payload.report;
  if (!value || Array.isArray(value) || typeof value !== "object")
    return undefined;
  const report = value as JsonObject;
  if (typeof report.basis !== "string") return undefined;
  return {
    id: String(report.id),
    authorId: String(report.authorId),
    orderId: String(report.orderId),
    basis: report.basis as OrderReport["basis"],
    claimedStatus: String(report.claimedStatus) as OrderReport["claimedStatus"],
    claimedFulfilledAmount: Number(report.claimedFulfilledAmount),
  };
}

function updateMessageStatus(
  state: PartialImplementationState,
  id: string,
  status: OrderMessage["status"],
): PartialImplementationState {
  const message = requiredMessage(state, id);
  return {
    ...state,
    messages: { ...state.messages, [id]: { ...message, status } },
  };
}

function applyTransfer(
  state: PartialImplementationState,
  event: DomainEvent,
): PartialImplementationState {
  const transfer: GrainTransfer = {
    id: String(event.payload.transferId),
    orderId: String(event.payload.orderId),
    fromAccountId: String(event.payload.fromAccountId),
    toAccountId: String(event.payload.toAccountId),
    amount: Number(event.payload.amount),
    ...(event.payload.limitedBy === undefined
      ? {}
      : {
          limitedBy: String(event.payload.limitedBy) as NonNullable<
            GrainTransfer["limitedBy"]
          >,
        }),
  };
  const source = requiredAccount(state, transfer.fromAccountId);
  const destination = requiredAccount(state, transfer.toAccountId);
  return {
    ...state,
    accounts: {
      ...state.accounts,
      [source.id]: { ...source, balance: source.balance - transfer.amount },
      [destination.id]: {
        ...destination,
        balance: destination.balance + transfer.amount,
      },
    },
    transfers: { ...state.transfers, [transfer.id]: transfer },
  };
}

function recordObservation(
  state: PartialImplementationState,
  event: DomainEvent,
): PartialImplementationState {
  if (!event.actorId) throw new Error("Observation requires an actor");
  const payload = event.payload.observationPayload;
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Observation requires an object payload");
  }
  const observation: Observation = {
    id: String(event.payload.observationId),
    actorId: event.actorId,
    observedAt: event.occurredAt,
    sourceType: String(event.payload.sourceType),
    sourceId: String(event.payload.sourceId),
    subjectRefs: Array.isArray(event.payload.subjectRefs)
      ? event.payload.subjectRefs.map(String)
      : [],
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
      [event.actorId]: [
        ...(state.actorObservationIds[event.actorId] ?? []),
        observation.id,
      ],
    },
  };
}

function totalGrain(state: PartialImplementationState): number {
  return Object.values(state.accounts).reduce(
    (total, account) => total + account.balance,
    0,
  );
}

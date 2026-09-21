import { z } from "zod";
import {
  addSimTime,
  simTime,
  readStringArray,
  type ControlRelationship,
  type DecisionEpisode,
  type DomainEvent,
  type Intent,
  type JsonObject,
  type Observation,
  type OrderLifecycleEntry,
  type OrderStatus,
  type PersistentActor,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  type DomainEventDraft,
  type DomainModel,
  type ScheduledEventDraft,
} from "@throne/sim-core";
import {
  deriveFormalAuthority,
  reduceOfficeEvent,
  resolveOfficeBatch,
  type OfficeState,
} from "./appointments.ts";

export const appointmentIds = {
  ruler: "actor:ruler",
  general: "actor:general-wei",
  successor: "actor:commander-zhang",
  captain: "actor:captain-zhao",
  army: "organization:imperial-guard",
  military: "office:guard-commander",
  chancellor: "office:chancellor",
  oldAppointment: "appointment:wei-military",
  newAppointment: "appointment:zhang-military",
  promotion: "appointment:wei-chancellor",
  palace: "location:imperial-palace",
  payOffice: "location:military-pay-office",
  oldOrder: "order:wei-pay-office",
  newOrder: "order:zhang-palace",
  decision: "decision:appointment-conflict",
  intent: "intent:appointment-conflict",
  report: "observation:appointment-report",
} as const;
const ids = appointmentIds;

export type AppointmentOrder = {
  readonly id: string;
  readonly issuerId: string;
  readonly recipientId: string;
  readonly targetLocationId: string;
  readonly status: OrderStatus;
  readonly lifecycle: readonly OrderLifecycleEntry[];
};
export type AppointmentEvaluation = {
  readonly orderId: string;
  readonly issuerId: string;
  readonly formal: number;
  readonly personal: number;
  readonly total: number;
};
export type AppointmentScenarioState = OfficeState & {
  readonly relationships: readonly ControlRelationship[];
  readonly orders: Readonly<Record<string, AppointmentOrder>>;
  readonly observations: readonly Observation[];
  readonly commanderFormalAuthorityIds: readonly string[];
  readonly unitLocationId: string;
  readonly decision?: DecisionEpisode & {
    readonly selectedOrderId?: string;
    readonly evaluations?: readonly AppointmentEvaluation[];
  };
  readonly intent?: Intent;
};
export type AppointmentRulerView = {
  readonly appointments: readonly {
    readonly id: string;
    readonly officeId: string;
    readonly incumbentId: string;
    readonly ended: boolean;
  }[];
  readonly reports: readonly Observation[];
};
export type AppointmentRun = {
  readonly initialState: AppointmentScenarioState;
  readonly before: AppointmentScenarioState;
  readonly afterAppointment: AppointmentScenarioState;
  readonly state: AppointmentScenarioState;
  readonly rulerBeforeReport: AppointmentRulerView;
  readonly rulerFinal: AppointmentRulerView;
  readonly records: readonly SimulationRecord[];
};

function actor(id: string): PersistentActor {
  return {
    identity: { id, displayNameKey: id, background: { origin: "capital" } },
    officeHistory: [],
    motivations: { preserveStanding: 0.8 },
    memories: [],
    beliefs: [],
    cognition: {
      tier: "lightweight",
      policyId: "heuristic:officer",
      promotionHistory: [],
    },
  };
}
function relationship(
  id: string,
  kind: ControlRelationship["kind"],
  strength: number,
): ControlRelationship {
  return {
    id,
    sourceId: ids.general,
    targetId: ids.captain,
    kind,
    strength,
    history: [],
  };
}
export const appointmentInitialState: AppointmentScenarioState = {
  actors: Object.fromEntries(
    [ids.ruler, ids.general, ids.successor, ids.captain].map((id) => [
      id,
      actor(id),
    ]),
  ),
  offices: {
    [ids.military]: {
      id: ids.military,
      nameKey: "appointment.military",
      capacity: 1,
      appointAuthorityIds: [ids.ruler],
      grants: [{ kind: "command", organizationId: ids.army }],
    },
    [ids.chancellor]: {
      id: ids.chancellor,
      nameKey: "appointment.chancellor",
      capacity: 1,
      appointAuthorityIds: [ids.ruler],
      grants: [],
    },
  },
  appointments: {},
  appointmentChannels: Object.fromEntries(
    [ids.ruler, ids.general, ids.successor].map((id) => [
      id,
      [ids.military, ids.chancellor],
    ]),
  ),
  relationships: [
    relationship("relationship:old-loyalty", "personal_loyalty", 0.95),
    relationship("relationship:old-patronage", "appointment", 0.75),
  ],
  orders: {},
  observations: [],
  commanderFormalAuthorityIds: [],
  unitLocationId: "location:guard-barracks",
};

const orderSchema = z.object({
  orderId: z.string(),
  issuerId: z.string(),
  targetLocationId: z.string(),
});
const orderRef = z.object({ orderId: z.string() });
const evaluationSchema = z.object({
  orderId: z.string(),
  issuerId: z.string(),
  formal: z.number(),
  personal: z.number(),
  total: z.number(),
});
const decisionSchema = z.object({
  selectedOrderId: z.string(),
  evaluations: z.array(evaluationSchema),
});

export function evaluateAppointmentOrders(
  state: AppointmentScenarioState,
): AppointmentEvaluation[] {
  return Object.values(state.orders)
    .filter((order) => order.status === "received")
    .map((order) => {
      const formal = state.commanderFormalAuthorityIds.includes(order.issuerId)
        ? 1.2
        : 0;
      const personal = state.relationships
        .filter(
          (r) => r.sourceId === order.issuerId && r.targetId === ids.captain,
        )
        .reduce((sum, r) => sum + r.strength, 0);
      return {
        orderId: order.id,
        issuerId: order.issuerId,
        formal,
        personal,
        total: formal + personal,
      };
    })
    .sort((a, b) => b.total - a.total || a.orderId.localeCompare(b.orderId));
}

export const appointmentModel: DomainModel<AppointmentScenarioState> = {
  resolveBatch({ state, events, time }) {
    const officeEvents = events.filter((event) =>
      event.eventType.startsWith("office."),
    );
    const committed: DomainEventDraft[] = [
      ...resolveOfficeBatch(state, officeEvents, time).events,
    ];
    const scheduled: ScheduledEventDraft[] = [];
    for (const event of events.filter(
      (event) => !event.eventType.startsWith("office."),
    )) {
      const draft = (
        eventType: string,
        payload: JsonObject,
        actorId: string = ids.captain,
      ): DomainEventDraft => ({
        eventType,
        payload,
        actorId,
        causalEventId: event.id,
      });
      const later = (eventType: string, delay: number, payload: JsonObject) =>
        scheduled.push({
          eventType,
          scheduledAt: addSimTime(time, delay),
          actorId: ids.captain,
          causalEventId: event.id,
          payload,
        });
      switch (event.eventType) {
        case "notice.arrive":
          committed.push(
            draft("notice.received", {
              authorityIds: deriveFormalAuthority(state, ids.army),
            }),
          );
          break;
        case "orders.dispatch":
          for (const order of [
            {
              orderId: ids.oldOrder,
              issuerId: ids.general,
              targetLocationId: ids.payOffice,
            },
            {
              orderId: ids.newOrder,
              issuerId: ids.successor,
              targetLocationId: ids.palace,
            },
          ]) {
            committed.push(draft("order.sent", order, order.issuerId));
            later("order.arrive", 30, { orderId: order.orderId });
          }
          break;
        case "order.arrive": {
          const { orderId } = orderRef.parse(event.payload);
          const order = requiredOrder(state, orderId);
          committed.push(draft("order.received", { orderId }));
          committed.push(
            draft("observation.recorded", {
              id: `observation:${orderId}`,
              recipientId: ids.captain,
              sourceId: orderId,
              kind: "command",
              issuerId: order.issuerId,
              targetLocationId: order.targetLocationId,
            }),
          );
          break;
        }
        case "decision.resolve": {
          if (state.decision?.status !== "open")
            throw new Error("No open appointment decision");
          const evaluations = evaluateAppointmentOrders(state);
          const selected = evaluations[0];
          if (!selected) throw new Error("No received orders to evaluate");
          committed.push(
            draft("decision.committed", {
              selectedOrderId: selected.orderId,
              evaluations: evaluations.map((e) => ({ ...e })),
            }),
          );
          later("operation.execute", 5, { orderId: selected.orderId });
          break;
        }
        case "operation.execute": {
          const { orderId } = orderRef.parse(event.payload);
          const order = requiredOrder(state, orderId);
          if (
            state.decision?.selectedOrderId !== orderId ||
            order.status !== "scheduled"
          )
            throw new Error("Order is not the accepted intent");
          committed.push(
            draft("order.executed", {
              orderId,
              targetLocationId: order.targetLocationId,
            }),
          );
          later("report.arrive", 40, {
            orderId,
            issuerId: order.issuerId,
            targetLocationId: order.targetLocationId,
          });
          break;
        }
        case "report.arrive": {
          const report = orderSchema.parse(event.payload);
          committed.push(
            draft("observation.recorded", {
              id: ids.report,
              recipientId: ids.ruler,
              sourceId: report.orderId,
              kind: "commander_report",
              issuerId: report.issuerId,
              targetLocationId: report.targetLocationId,
            }),
          );
          break;
        }
        default:
          throw new Error(
            `Unknown appointment scenario operation: ${event.eventType}`,
          );
      }
    }
    const arrivals = events.filter((e) => e.eventType === "order.arrive");
    if (arrivals.length > 0) {
      if (state.decision) throw new Error("Duplicate appointment decision");
      committed.push({
        eventType: "decision.opened",
        actorId: ids.captain,
        causalEventId: arrivals[0]!.id,
        payload: {
          observationIds: arrivals.map(
            (e) => `observation:${orderRef.parse(e.payload).orderId}`,
          ),
        },
      });
      scheduled.push({
        eventType: "decision.resolve",
        actorId: ids.captain,
        scheduledAt: addSimTime(time, 5),
        causalEventId: arrivals[0]!.id,
        payload: {},
      });
    }
    return { events: committed, scheduled };
  },
  reduce(state, event) {
    if (event.eventType.startsWith("office."))
      return reduceOfficeEvent(state, event);
    switch (event.eventType) {
      case "notice.received":
        return {
          ...state,
          commanderFormalAuthorityIds: readStringArray(
            event.payload.authorityIds,
          ),
        };
      case "order.sent": {
        const input = orderSchema.parse(event.payload);
        if (!state.actors[input.issuerId])
          throw new Error(`Unknown issuer: ${input.issuerId}`);
        const order: AppointmentOrder = {
          id: input.orderId,
          issuerId: input.issuerId,
          recipientId: ids.captain,
          targetLocationId: input.targetLocationId,
          status: "sent",
          lifecycle: [lifecycle("sent", event)],
        };
        return { ...state, orders: { ...state.orders, [order.id]: order } };
      }
      case "order.received": {
        const { orderId } = orderRef.parse(event.payload);
        return updateOrder(state, orderId, "received", event);
      }
      case "observation.recorded": {
        const input = z
          .object({
            id: z.string(),
            recipientId: z.string(),
            sourceId: z.string(),
            kind: z.enum(["command", "commander_report"]),
            issuerId: z.string(),
            targetLocationId: z.string(),
          })
          .parse(event.payload);
        const observation: Observation = {
          id: input.id,
          actorId: input.recipientId,
          observedAt: event.occurredAt,
          sourceId: input.sourceId,
          sourceType: input.kind,
          subjectRefs: [ids.army],
          payload: {
            issuerId: input.issuerId,
            targetLocationId: input.targetLocationId,
          },
          causalEventId: event.id,
        };
        return { ...state, observations: [...state.observations, observation] };
      }
      case "decision.opened":
        return {
          ...state,
          decision: {
            id: ids.decision,
            actorId: ids.captain,
            openedAt: event.occurredAt,
            triggerObservationIds: readStringArray(
              event.payload.observationIds,
            ),
            status: "open",
            urgency: 0.8,
            provisionalIntents: [],
            revisionCount: 0,
            finalIntentIds: [],
          },
        };
      case "decision.committed": {
        const input = decisionSchema.parse(event.payload);
        if (!state.decision) throw new Error("Missing appointment decision");
        const selected = requiredOrder(state, input.selectedOrderId);
        let next = state;
        for (const order of Object.values(state.orders)) {
          next = updateOrder(
            next,
            order.id,
            order.id === selected.id ? "scheduled" : "ignored",
            event,
          );
        }
        return {
          ...next,
          decision: {
            ...state.decision,
            status: "committed",
            selectedOrderId: selected.id,
            evaluations: input.evaluations,
            finalIntentIds: [ids.intent],
          },
          intent: {
            id: ids.intent,
            actorId: ids.captain,
            createdAt: event.occurredAt,
            goal: "deploy_guard",
            operationTemplate: "move_unit",
            parameters: {
              orderId: selected.id,
              targetLocationId: selected.targetLocationId,
            },
            causalDecisionEpisodeId: ids.decision,
          },
        };
      }
      case "order.executed": {
        const input = z
          .object({ orderId: z.string(), targetLocationId: z.string() })
          .parse(event.payload);
        return {
          ...updateOrder(state, input.orderId, "executed", event),
          unitLocationId: input.targetLocationId,
        };
      }
      default:
        throw new Error(
          `Unhandled appointment scenario event: ${event.eventType}`,
        );
    }
  },
  validate(_before, after) {
    for (const r of after.relationships) {
      if (
        !Number.isFinite(r.strength) ||
        r.strength < 0 ||
        r.strength > 1 ||
        !after.actors[r.sourceId] ||
        !after.actors[r.targetId]
      )
        throw new Error(`Invalid relationship: ${r.id}`);
    }
    for (const a of Object.values(after.appointments)) {
      if (!after.actors[a.incumbentId] || !after.offices[a.officeId])
        throw new Error(`Invalid appointment: ${a.id}`);
    }
  },
};

export async function runAppointmentScenario(
  options: {
    readonly runId?: string;
    readonly oldPersonalSupport?: number;
  } = {},
): Promise<AppointmentRun> {
  const support = options.oldPersonalSupport;
  if (
    support !== undefined &&
    (!Number.isFinite(support) || support < 0 || support > 1)
  )
    throw new Error("Invalid personal support");
  const initialState: AppointmentScenarioState = {
    ...appointmentInitialState,
    relationships: appointmentInitialState.relationships.map((r) => ({
      ...r,
      strength: support ?? r.strength,
    })),
  };
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    initialState,
    appointmentModel,
    store,
    options.runId ?? "appointment-demo",
  );
  await kernel.schedule({
    eventType: "office.appoint",
    scheduledAt: simTime(0),
    actorId: ids.ruler,
    payload: {
      appointmentId: ids.oldAppointment,
      officeId: ids.military,
      incumbentId: ids.general,
      basis: "decree",
    },
  });
  await kernel.runUntilIdle();
  const before = kernel.state;
  for (const operation of [
    {
      eventType: "office.remove",
      payload: { appointmentId: ids.oldAppointment },
    },
    {
      eventType: "office.appoint",
      payload: {
        appointmentId: ids.promotion,
        officeId: ids.chancellor,
        incumbentId: ids.general,
        basis: "decree",
      },
    },
    {
      eventType: "office.appoint",
      payload: {
        appointmentId: ids.newAppointment,
        officeId: ids.military,
        incumbentId: ids.successor,
        basis: "decree",
      },
    },
  ] as const)
    await kernel.schedule({
      ...operation,
      actorId: ids.ruler,
      scheduledAt: simTime(10),
    });
  await kernel.step();
  const afterAppointment = kernel.state;
  await kernel.schedule({
    eventType: "notice.arrive",
    scheduledAt: simTime(20),
    payload: {},
  });
  await kernel.schedule({
    eventType: "orders.dispatch",
    scheduledAt: simTime(25),
    payload: {},
  });
  await kernel.runUntilIdle();
  return {
    initialState,
    before,
    afterAppointment,
    state: kernel.state,
    rulerBeforeReport: appointmentRulerView(afterAppointment),
    rulerFinal: appointmentRulerView(kernel.state),
    records: await store.readAll(),
  };
}

export function appointmentRulerView(
  state: AppointmentScenarioState,
): AppointmentRulerView {
  return {
    appointments: Object.values(state.appointments)
      .filter((a) => a.appointedById === ids.ruler)
      .map((a) => ({
        id: a.id,
        officeId: a.officeId,
        incumbentId: a.incumbentId,
        ended: a.endedAt !== undefined,
      })),
    reports: state.observations.filter(
      (observation) => observation.actorId === ids.ruler,
    ),
  };
}

function requiredOrder(
  state: AppointmentScenarioState,
  id: string,
): AppointmentOrder {
  const order = state.orders[id];
  if (!order) throw new Error(`Unknown appointment order: ${id}`);
  return order;
}
function lifecycle(
  status: OrderStatus,
  event: DomainEvent,
): OrderLifecycleEntry {
  return { status, occurredAt: event.occurredAt, eventId: event.id };
}
function updateOrder(
  state: AppointmentScenarioState,
  id: string,
  status: OrderStatus,
  event: DomainEvent,
): AppointmentScenarioState {
  const order = requiredOrder(state, id);
  return {
    ...state,
    orders: {
      ...state.orders,
      [id]: {
        ...order,
        status,
        lifecycle: [...order.lifecycle, lifecycle(status, event)],
      },
    },
  };
}

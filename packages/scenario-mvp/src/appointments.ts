import { z } from "zod";
import {
  simTime,
  type AppointmentRecord,
  type AppointmentHistoryEntry,
  type DomainEvent,
  type OfficeDefinition,
  type PersistentActor,
  type ScheduledEvent,
  type SimTime,
} from "@throne/shared-types";
import type { DomainEventDraft, MutationPlan } from "@throne/sim-core";

export type OfficeState = {
  readonly actors: Readonly<Record<string, PersistentActor>>;
  readonly offices: Readonly<Record<string, OfficeDefinition>>;
  readonly appointments: Readonly<Record<string, AppointmentRecord>>;
  readonly appointmentChannels: Readonly<Record<string, readonly string[]>>;
};

const appointSchema = z.object({
  appointmentId: z.string().min(1),
  officeId: z.string().min(1),
  incumbentId: z.string().min(1),
  basis: z.enum(["decree", "self_claim"]),
});
const appointmentRef = z.object({ appointmentId: z.string().min(1) });
const appointedSchema = appointSchema.extend({
  appointedById: z.string().min(1),
  legality: z.enum(["legal", "irregular"]),
  recognized: z.boolean(),
});

export function deriveFormalAuthority(
  state: OfficeState,
  organizationId: string,
): string[] {
  return [
    ...new Set(
      Object.values(state.appointments)
        .filter(
          (a) =>
            a.endedAt === undefined &&
            a.recognized &&
            requiredOffice(state, a.officeId).grants.some(
              (grant) =>
                grant.kind === "command" &&
                grant.organizationId === organizationId,
            ),
        )
        .map((a) => a.incumbentId),
    ),
  ].sort();
}

export function hasAppointmentAuthority(
  state: OfficeState,
  actorId: string,
  officeId: string,
): boolean {
  const office = requiredOffice(state, officeId);
  return (
    office.appointAuthorityIds.includes(actorId) ||
    Object.values(state.appointments).some(
      (a) =>
        a.incumbentId === actorId &&
        a.endedAt === undefined &&
        a.recognized &&
        requiredOffice(state, a.officeId).grants.some(
          (g) => g.kind === "appointment" && g.officeId === officeId,
        ),
    )
  );
}

export function resolveOfficeBatch(
  state: OfficeState,
  events: readonly ScheduledEvent[],
  time: SimTime,
): MutationPlan {
  const drafts: DomainEventDraft[] = [];
  let staged = state;
  const append = (draft: DomainEventDraft) => {
    drafts.push(draft);
    staged = reduceOfficeEvent(staged, {
      ...draft,
      id: `staged:${drafts.length}`,
      occurredAt: time,
    });
  };
  const priority = (event: ScheduledEvent) =>
    event.eventType === "office.remove" ? 0 : 1;
  const sorted = [...events].sort(
    (a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id),
  );
  for (const event of sorted) {
    const actorId = event.actorId;
    if (!actorId || !state.actors[actorId])
      throw new Error(`Unknown appointing actor: ${actorId}`);
    if (event.eventType === "office.appoint") {
      const input = appointSchema.parse(event.payload);
      requiredOffice(state, input.officeId);
      if (!state.actors[input.incumbentId])
        throw new Error(`Unknown incumbent: ${input.incumbentId}`);
      if (staged.appointments[input.appointmentId])
        throw new Error(`Duplicate appointment: ${input.appointmentId}`);
      requireChannel(state, actorId, input.officeId);
      const authorized = hasAppointmentAuthority(
        state,
        actorId,
        input.officeId,
      );
      append({
        eventType: "office.appointed",
        actorId,
        causalEventId: event.id,
        payload: {
          ...input,
          appointedById: actorId,
          legality: authorized ? "legal" : "irregular",
          recognized: authorized,
        },
      });
    } else if (
      event.eventType === "office.remove" ||
      event.eventType === "office.recognize"
    ) {
      const { appointmentId } = appointmentRef.parse(event.payload);
      const appointment = requiredAppointment(staged, appointmentId);
      if (appointment.endedAt !== undefined)
        throw new Error(`Appointment already ended: ${appointmentId}`);
      requireChannel(state, actorId, appointment.officeId);
      const authorized = hasAppointmentAuthority(
        state,
        actorId,
        appointment.officeId,
      );
      const kind =
        event.eventType === "office.remove"
          ? authorized
            ? "office.removed"
            : "office.removal_contested"
          : authorized
            ? "office.recognized"
            : "office.recognition_contested";
      append({
        eventType: kind,
        actorId,
        causalEventId: event.id,
        payload: { appointmentId },
      });
    } else {
      throw new Error(`Unknown office operation: ${event.eventType}`);
    }
  }
  for (const office of Object.values(staged.offices)) {
    if (!Number.isInteger(office.capacity) || office.capacity < 1)
      throw new Error(`Invalid capacity: ${office.id}`);
    const active = Object.values(staged.appointments).filter(
      (a) => a.officeId === office.id && a.endedAt === undefined,
    );
    if (active.length <= office.capacity) continue;
    for (const appointment of active) {
      if (appointment.legality === "contested") continue;
      const cause = sorted.find(
        (event) =>
          event.payload.officeId === office.id ||
          event.payload.appointmentId === appointment.id,
      );
      if (!cause) throw new Error(`Unrecorded office conflict: ${office.id}`);
      append({
        eventType: "office.contested",
        actorId: appointment.appointedById,
        causalEventId: cause.id,
        payload: { appointmentId: appointment.id },
      });
    }
  }
  return { events: drafts };
}

export function reduceOfficeEvent<State extends OfficeState>(
  state: State,
  event: DomainEvent,
): State {
  const actorId = event.actorId;
  if (!actorId || !state.actors[actorId])
    throw new Error(`Unknown office event actor: ${actorId}`);
  if (event.eventType === "office.appointed") {
    const input = appointedSchema.parse(event.payload);
    requiredOffice(state, input.officeId);
    const actor = state.actors[input.incumbentId];
    if (!actor) throw new Error(`Unknown incumbent: ${input.incumbentId}`);
    if (state.appointments[input.appointmentId])
      throw new Error(`Duplicate appointment: ${input.appointmentId}`);
    const appointment: AppointmentRecord = {
      id: input.appointmentId,
      officeId: input.officeId,
      incumbentId: input.incumbentId,
      appointedById: input.appointedById,
      startedAt: event.occurredAt,
      basis: input.basis,
      legality: input.legality,
      recognized: input.recognized,
      history: [historyEntry("appointed", event, actorId)],
    };
    return {
      ...state,
      appointments: { ...state.appointments, [appointment.id]: appointment },
      actors: {
        ...state.actors,
        [actor.identity.id]: {
          ...actor,
          officeHistory: [
            ...actor.officeHistory,
            {
              appointmentId: appointment.id,
              officeId: appointment.officeId,
              startedAt: event.occurredAt,
            },
          ],
        },
      },
    };
  }
  const types = {
    "office.contested": "contested",
    "office.recognized": "recognized",
    "office.removed": "removed",
    "office.removal_contested": "removal_contested",
    "office.recognition_contested": "recognition_contested",
  } as const;
  if (!(event.eventType in types))
    throw new Error(`Unknown office domain event: ${event.eventType}`);
  const kind = types[event.eventType as keyof typeof types];
  const { appointmentId } = appointmentRef.parse(event.payload);
  const appointment = requiredAppointment(state, appointmentId);
  if (appointment.endedAt !== undefined)
    throw new Error(`Appointment already ended: ${appointmentId}`);
  const actor = state.actors[appointment.incumbentId];
  if (!actor) throw new Error(`Unknown incumbent: ${appointment.incumbentId}`);
  return {
    ...state,
    appointments: {
      ...state.appointments,
      [appointmentId]: {
        ...appointment,
        ...(kind === "removed" ? { endedAt: event.occurredAt } : {}),
        ...(kind === "recognized"
          ? { recognized: true, legality: "legal" as const }
          : {}),
        ...(kind === "contested" ? { legality: "contested" as const } : {}),
        history: [...appointment.history, historyEntry(kind, event, actorId)],
      },
    },
    actors:
      kind !== "removed"
        ? state.actors
        : {
            ...state.actors,
            [actor.identity.id]: {
              ...actor,
              officeHistory: actor.officeHistory.map((entry) =>
                entry.appointmentId === appointmentId
                  ? { ...entry, endedAt: event.occurredAt }
                  : entry,
              ),
            },
          },
  };
}

function requiredOffice(state: OfficeState, id: string): OfficeDefinition {
  const office = state.offices[id];
  if (!office) throw new Error(`Unknown office: ${id}`);
  return office;
}

function requiredAppointment(
  state: OfficeState,
  id: string,
): AppointmentRecord {
  const appointment = state.appointments[id];
  if (!appointment) throw new Error(`Unknown appointment: ${id}`);
  return appointment;
}

function requireChannel(state: OfficeState, actorId: string, officeId: string) {
  if (!state.appointmentChannels[actorId]?.includes(officeId)) {
    throw new Error(
      `No appointment communication route: ${actorId} -> ${officeId}`,
    );
  }
}

function historyEntry(
  kind: AppointmentHistoryEntry["kind"],
  event: DomainEvent,
  actorId: string,
): AppointmentHistoryEntry {
  return {
    kind,
    occurredAt: simTime(event.occurredAt),
    eventId: event.id,
    actorId,
  };
}

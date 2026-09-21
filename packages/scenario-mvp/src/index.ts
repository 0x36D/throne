import { addSimTime, type DomainEvent } from "@throne/shared-types";
import type { DomainModel } from "@throne/sim-core";

export * from "./false-report.ts";
export * from "./partial-implementation.ts";
export * from "./contradictory-orders.ts";
export * from "./decision-revision.ts";
export * from "./loss-of-control.ts";
export * from "./dynamic-promotion.ts";
export * from "./player-decision.ts";
export * from "./appointments.ts";
export * from "./appointment-scenario.ts";

export type BootstrapMessage = {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly content: string;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type BootstrapState = {
  readonly messages: Readonly<Record<string, BootstrapMessage>>;
};

export const bootstrapInitialState: BootstrapState = {
  messages: {
    "message-1": {
      id: "message-1",
      senderId: "governor",
      recipientId: "ruler",
      content: "The provincial granaries are adequately supplied.",
      status: "draft",
    },
  },
};

export const bootstrapModel: DomainModel<BootstrapState> = {
  resolveBatch({ events, time }) {
    const committed = [];
    const scheduled = [];

    for (const event of events) {
      const messageId = String(event.payload.messageId);
      if (event.eventType === "message.depart") {
        committed.push({
          eventType: "message.departed",
          ...(event.actorId === undefined ? {} : { actorId: event.actorId }),
          ...(event.targetIds === undefined
            ? {}
            : { targetIds: event.targetIds }),
          causalEventId: event.id,
          payload: { messageId },
        });
        scheduled.push({
          eventType: "message.arrive",
          scheduledAt: addSimTime(time, 60),
          ...(event.actorId === undefined ? {} : { actorId: event.actorId }),
          ...(event.targetIds === undefined
            ? {}
            : { targetIds: event.targetIds }),
          causalEventId: event.id,
          payload: { messageId },
        });
      } else if (event.eventType === "message.arrive") {
        committed.push({
          eventType: "message.arrived",
          ...(event.actorId === undefined ? {} : { actorId: event.actorId }),
          ...(event.targetIds === undefined
            ? {}
            : { targetIds: event.targetIds }),
          causalEventId: event.id,
          payload: { messageId },
        });
      } else {
        throw new Error(`Unknown bootstrap event type: ${event.eventType}`);
      }
    }

    return { events: committed, scheduled };
  },
  reduce(state, event: DomainEvent) {
    if (
      event.eventType !== "message.departed" &&
      event.eventType !== "message.arrived"
    ) {
      throw new Error(
        `Unhandled domain event ${event.eventType} (${event.id})`,
      );
    }
    const messageId = String(event.payload.messageId);
    const message = state.messages[messageId];
    if (!message) throw new Error(`Unknown message: ${messageId}`);

    const status =
      event.eventType === "message.departed" ? "in_transit" : "delivered";

    return {
      messages: {
        ...state.messages,
        [messageId]: { ...message, status },
      },
    };
  },
  validate(_before, after) {
    for (const message of Object.values(after.messages)) {
      if (!message.senderId || !message.recipientId) {
        throw new Error("Messages require a sender and recipient");
      }
    }
  },
};

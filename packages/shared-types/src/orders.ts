import type { SimTime } from "./time.ts";

export type OrderStatus =
  | "created"
  | "sent"
  | "received"
  | "acknowledged"
  | "interpreted"
  | "scheduled"
  | "partially_executed"
  | "executed"
  | "reported_complete"
  | "failed"
  | "countermanded"
  | "ignored";

export type OrderLifecycleEntry = {
  readonly status: OrderStatus;
  readonly occurredAt: SimTime;
  readonly eventId: string;
};

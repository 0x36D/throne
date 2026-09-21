import type { SimTime } from "./time.ts";

export type OfficeGrant =
  | { readonly kind: "command"; readonly organizationId: string }
  | { readonly kind: "appointment"; readonly officeId: string };

export type OfficeDefinition = {
  readonly id: string;
  readonly nameKey: string;
  readonly capacity: number;
  readonly appointAuthorityIds: readonly string[];
  readonly grants: readonly OfficeGrant[];
};

export type AppointmentLegality = "legal" | "irregular" | "contested";

export type AppointmentHistoryEntry = {
  readonly kind:
    | "appointed"
    | "contested"
    | "recognized"
    | "removed"
    | "removal_contested"
    | "recognition_contested";
  readonly occurredAt: SimTime;
  readonly eventId: string;
  readonly actorId: string;
};

export type AppointmentRecord = {
  readonly id: string;
  readonly officeId: string;
  readonly incumbentId: string;
  readonly appointedById: string;
  readonly startedAt: SimTime;
  readonly endedAt?: SimTime;
  readonly basis: "decree" | "self_claim";
  readonly legality: AppointmentLegality;
  readonly recognized: boolean;
  readonly history: readonly AppointmentHistoryEntry[];
};

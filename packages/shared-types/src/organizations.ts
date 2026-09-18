import type { SimTime } from "./time.ts";

export type OrganizationKind =
  "government" | "military" | "bureaucracy" | "faction" | "rebel";

export type Organization = {
  readonly id: string;
  readonly name: string;
  readonly kind: OrganizationKind;
  readonly formalAuthorityIds: readonly string[];
  readonly memberIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly resourceAccountIds: readonly string[];
};

export type ControlRelationshipKind =
  | "formal_command"
  | "legal_recognition"
  | "funding"
  | "appointment"
  | "personal_loyalty"
  | "informal_influence"
  | "organizational_membership";

export type RelationshipStrengthEntry = {
  readonly strength: number;
  readonly occurredAt: SimTime;
  readonly eventId: string;
  readonly reason: string;
};

export type ControlRelationship = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly kind: ControlRelationshipKind;
  readonly strength: number;
  readonly history: readonly RelationshipStrengthEntry[];
};

export type ObedienceRecord = {
  readonly id: string;
  readonly organizationId: string;
  readonly unitId: string;
  readonly decisionEpisodeId: string;
  readonly orderId: string;
  readonly issuerId: string;
  readonly obeyed: boolean;
  readonly occurredAt: SimTime;
  readonly eventId: string;
};

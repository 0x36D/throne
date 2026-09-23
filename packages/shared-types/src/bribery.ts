import type { SimTime } from "./time.ts";

export type BribeStatus = "offered" | "accepted" | "rejected";

export type BribeRecord = {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly amount: number;
  readonly targetRef: string;
  readonly status: BribeStatus;
  readonly at: SimTime;
  readonly reason: string;
};

export type CorruptionRecord = {
  readonly id: string;
  readonly actorId: string;
  readonly bribeId: string;
  readonly amount: number;
  readonly evidenceRefs: readonly string[];
  readonly at: SimTime;
};

export type BribeDecisionInput = {
  readonly briberId: string;
  readonly recipientId: string;
  readonly amount: number;
  readonly targetRef: string;
  readonly benefit: number;
  readonly risk: number;
};

export type BribeDecision = {
  readonly accept: boolean;
  readonly reason: string;
};

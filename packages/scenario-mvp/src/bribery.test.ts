import { describe, expect, it } from "vitest";
import {
  simTime,
  type DomainEvent,
  type MotivationProfile,
} from "@throne/shared-types";
import {
  addBriberyActor,
  bribeBenefit,
  bribeRisk,
  deriveCorruptionEvidence,
  emptyBriberyState,
  heuristicBribePolicy,
  reduceBriberyEvent,
  type BriberyState,
} from "./bribery.ts";

function profile(overrides: Partial<MotivationProfile>): MotivationProfile {
  return {
    selfPreservation: 0.5,
    wealth: 0.5,
    officeRetention: 0.5,
    ambition: 0.5,
    loyaltyToRuler: 0.5,
    loyaltyToState: 0.5,
    loyaltyToFamily: 0.5,
    loyaltyToOrganization: 0.5,
    ideologicalCommitment: 0.5,
    regionalAttachment: 0.5,
    reputation: 0.5,
    concernForSubordinates: 0.5,
    riskTolerance: 0.5,
    revenge: 0.5,
    fearOfDisorder: 0.5,
    proceduralLegality: 0.5,
    ...overrides,
  };
}

const principled = profile({
  wealth: 0.4,
  proceduralLegality: 0.9,
  riskTolerance: 0.4,
});
const corrupt = profile({
  wealth: 0.9,
  proceduralLegality: 0.2,
  riskTolerance: 0.7,
});

function base(): BriberyState {
  let state = addBriberyActor(emptyBriberyState, {
    id: "actor:briber",
    motivations: profile({}),
  });
  state = addBriberyActor(state, {
    id: "actor:principled",
    motivations: principled,
  });
  state = addBriberyActor(state, { id: "actor:corrupt", motivations: corrupt });
  return state;
}

function event(
  eventType: string,
  id: string,
  payload: Record<string, unknown>,
): DomainEvent {
  return { id, occurredAt: simTime(10), eventType, payload: payload as never };
}

describe("bribery layer", () => {
  it("rejects a principled official and accepts a corrupt one", () => {
    const principledDecision = heuristicBribePolicy.decide({
      briberId: "actor:briber",
      recipientId: "actor:principled",
      amount: 40,
      targetRef: "audit:governor",
      benefit: bribeBenefit(40, principled),
      risk: bribeRisk(principled),
    });
    const corruptDecision = heuristicBribePolicy.decide({
      briberId: "actor:briber",
      recipientId: "actor:corrupt",
      amount: 40,
      targetRef: "audit:governor",
      benefit: bribeBenefit(40, corrupt),
      risk: bribeRisk(corrupt),
    });
    expect(principledDecision.accept).toBe(false);
    expect(corruptDecision.accept).toBe(true);
  });

  it("records offers, resolutions, and corruption evidence", () => {
    let state = base();
    state = reduceBriberyEvent(
      state,
      event("bribe.offered", "b1", {
        bribeId: "bribe:1",
        fromId: "actor:briber",
        toId: "actor:corrupt",
        amount: 40,
        targetRef: "audit:governor",
      }),
    );
    expect(state.bribes["bribe:1"]?.status).toBe("offered");

    state = reduceBriberyEvent(
      state,
      event("bribe.accepted", "b2", {
        bribeId: "bribe:1",
        reason: "gain outweighs risk",
      }),
    );
    expect(state.bribes["bribe:1"]?.status).toBe("accepted");

    state = reduceBriberyEvent(
      state,
      event("corruption.recorded", "b3", {
        corruptionId: "corruption:1",
        actorId: "actor:corrupt",
        bribeId: "bribe:1",
        amount: 40,
        evidenceRefs: ["bribe:1"],
      }),
    );
    expect(state.corruption).toHaveLength(1);
    expect(deriveCorruptionEvidence(state, "actor:corrupt")).toEqual([
      "corruption:1",
    ]);
  });

  it("rejects unknown events and unresolvable bribes", () => {
    const unknown: DomainEvent = event("typo.unknown", "x", {});
    expect(() => reduceBriberyEvent(base(), unknown)).toThrow(
      "Unhandled bribery event",
    );
    expect(() =>
      reduceBriberyEvent(
        base(),
        event("bribe.rejected", "y", { bribeId: "missing", reason: "no" }),
      ),
    ).toThrow("Unknown bribe");
  });
});

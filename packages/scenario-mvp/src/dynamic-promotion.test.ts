import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import type { ActorDecisionInput } from "@throne/shared-types";
import {
  dynamicPromotionIds,
  dynamicPromotionInitialState,
  dynamicPromotionModel,
  promotionActorSnapshot,
  promotionRulerView,
  runDynamicPromotionScenario,
  type PromotionDecisionPolicy,
} from "./dynamic-promotion.ts";

function tracingPolicy(inputs: ActorDecisionInput[]): PromotionDecisionPolicy {
  return {
    async decide(input) {
      inputs.push(structuredClone(input));
      return {
        reasoningSummary: "The palace courier permits direct disclosure.",
        selectedIntent: {
          goal: "Deliver the ledger to the ruler",
          capabilityId: "send_sealed_evidence_to_ruler",
          parameters: {
            artifactId: dynamicPromotionIds.ledger,
            recipientId: dynamicPromotionIds.ruler,
          },
        },
        confidence: 0.8,
      };
    },
  };
}

describe("dynamic actor promotion scenario", () => {
  it("promotes a persistent lightweight actor without replacing identity or history", async () => {
    const inputs: ActorDecisionInput[] = [];
    const run = await runDynamicPromotionScenario({
      runId: "dynamic-promotion-continuity-test",
      policy: tracingPolicy(inputs),
    });

    expect(run.actorBeforePromotion.cognition.tier).toBe("lightweight");
    expect(run.actorAfterPromotion.cognition.tier).toBe("llm");
    expect(run.actorAfterPromotion.identity).toEqual(
      run.actorBeforePromotion.identity,
    );
    expect(run.actorAfterPromotion.officeHistory).toEqual(
      run.actorBeforePromotion.officeHistory,
    );
    expect(run.actorAfterPromotion.motivations).toEqual(
      run.actorBeforePromotion.motivations,
    );
    expect(run.actorAfterPromotion.memoryIds).toEqual([
      dynamicPromotionIds.routineMemory,
      dynamicPromotionIds.discoveryMemory,
    ]);
    expect(run.actorAfterPromotion.cognition.promotionHistory).toHaveLength(1);
    expect(inputs).toHaveLength(1);
  });

  it("derives promotion from critical information and potential impact", async () => {
    const run = await runDynamicPromotionScenario({
      runId: "dynamic-promotion-signals-test",
    });

    expect(
      run.debugTruth.promotionSignals.map((signal) => signal.kind).sort(),
    ).toEqual(["critical_information", "high_potential_impact"]);
    expect(run.debugTruth.actor.cognition.policyId).toBe(
      "llm:deepseek-harness",
    );
    expect(
      [
        ...(run.debugTruth.actor.cognition.promotionHistory[0]?.signalIds ??
          []),
      ].sort(),
    ).toEqual(
      [
        dynamicPromotionIds.criticalInformationSignal,
        dynamicPromotionIds.highImpactSignal,
      ].sort(),
    );
  });

  it("passes the promoted actor's existing context into the policy", async () => {
    const inputs: ActorDecisionInput[] = [];
    await runDynamicPromotionScenario({
      runId: "dynamic-promotion-context-test",
      policy: tracingPolicy(inputs),
      outputLanguage: "zh-CN",
    });
    const input = inputs[0];

    expect(input?.actorId).toBe(dynamicPromotionIds.clerk);
    expect(input?.identity.id).toBe(dynamicPromotionIds.clerk);
    expect(input?.officeHistory[0]?.officeId).toBe(
      dynamicPromotionIds.clerkOffice,
    );
    expect(input?.memories.map((memory) => memory.id)).toEqual([
      dynamicPromotionIds.routineMemory,
      dynamicPromotionIds.discoveryMemory,
    ]);
    expect(input?.observations.map((observation) => observation.id)).toEqual([
      dynamicPromotionIds.discoveryObservation,
    ]);
    expect(input?.availableCapabilities).toContain(
      "send_sealed_evidence_to_ruler",
    );
    expect(input?.outputLanguage).toBe("zh-CN");
  });

  it("commits the structured decision and lets the ruler receive the evidence later", async () => {
    const run = await runDynamicPromotionScenario({
      runId: "dynamic-promotion-operation-test",
    });

    expect(run.debugTruth.decisionEpisode.status).toBe("committed");
    expect(run.debugTruth.decisionEpisode.selectedCapabilityId).toBe(
      "send_sealed_evidence_to_ruler",
    );
    expect(run.debugTruth.artifact.disclosedToIds).toEqual([
      dynamicPromotionIds.ruler,
    ]);
    expect(run.rulerViewBeforeDecision.knownOutcome).toBe("no_report");
    expect(run.rulerViewFinal.knownOutcome).toBe("sealed_evidence_received");
    expect(run.rulerViewFinal.observations[0]?.observedAt).toBe(90);
  });

  it("replays without contacting the policy again", async () => {
    const inputs: ActorDecisionInput[] = [];
    const run = await runDynamicPromotionScenario({
      runId: "dynamic-promotion-replay-test",
      policy: tracingPolicy(inputs),
    });
    expect(inputs).toHaveLength(1);

    const replayed = replay(
      dynamicPromotionInitialState,
      run.records,
      dynamicPromotionModel.reduce,
    );

    expect(inputs).toHaveLength(1);
    expect(replayed).toEqual(run.state);
    expect(promotionActorSnapshot(replayed, dynamicPromotionIds.clerk)).toEqual(
      promotionActorSnapshot(run.state, dynamicPromotionIds.clerk),
    );
    expect(promotionRulerView(replayed)).toEqual(run.rulerViewFinal);
  });

  it("rejects a policy decision outside the supplied capabilities", async () => {
    const policy: PromotionDecisionPolicy = {
      async decide() {
        return {
          selectedIntent: {
            goal: "Rewrite the world directly",
            capabilityId: "mutate_world_state",
            parameters: {},
          },
        };
      },
    };

    await expect(
      runDynamicPromotionScenario({
        runId: "dynamic-promotion-capability-test",
        policy,
      }),
    ).rejects.toThrow("unavailable capability");
  });
});
